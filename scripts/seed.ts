// scripts/seed.ts
import { eq } from 'drizzle-orm'
import { db, cards, categories, expenseInstallments, expenses, installmentPlans, merchants, recurrences, user } from '@contai/db'
import { toISODate, generateInstallments, getInvoiceForExpense, generateRecurrenceOccurrences, type CardCycle } from '@contai/domain'
import { seedCards, seedCategories, seedExpenses, seedMerchants, seedRecurrences } from './seed-data/finance-profile'

function addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, date.getDate())
}

function cardCycleFor(cardKey: string | null): CardCycle | null {
    if (!cardKey) return null
    const card = seedCards.find((c) => c.key === cardKey)!
    return { closing_day: card.closingDay, due_day: card.dueDay }
}

async function main() {
    const targetUserId = process.argv[2]
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!targetUserId || !uuidPattern.test(targetUserId)) {
        console.error('Uso: pnpm db:seed <userId>')
        process.exit(1)
    }

    const [existingUser] = await db.select({ id: user.id }).from(user).where(eq(user.id, targetUserId))
    if (!existingUser) {
        throw new Error(`Usuário ${targetUserId} não existe. Crie a conta antes de aplicar o seed.`)
    }

    const [hasCard] = await db.select({ id: cards.id }).from(cards).where(eq(cards.userId, targetUserId))
    const [hasCategory] = await db.select({ id: categories.id }).from(categories).where(eq(categories.userId, targetUserId))
    const [hasMerchant] = await db.select({ id: merchants.id }).from(merchants).where(eq(merchants.userId, targetUserId))
    const [hasExpense] = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.userId, targetUserId))
    if (hasCard || hasCategory || hasMerchant || hasExpense) {
        throw new Error(`Usuário ${targetUserId} já possui dados financeiros. Seed cancelado para evitar duplicação.`)
    }

    const cardIdByKey = new Map<string, string>()
    for (const card of seedCards) {
        const [row] = await db
            .insert(cards)
            .values({ userId: targetUserId, name: card.name, closingDay: card.closingDay, dueDay: card.dueDay, creditLimit: card.creditLimit, color: card.color })
            .returning({ id: cards.id })
        cardIdByKey.set(card.key, row.id)
    }

    const categoryIdByKey = new Map<string, string>()
    for (const category of seedCategories) {
        const [row] = await db
            .insert(categories)
            .values({ userId: targetUserId, name: category.name, icon: category.icon })
            .returning({ id: categories.id })
        categoryIdByKey.set(category.key, row.id)
    }

    const merchantIdByKey = new Map<string, string>()
    for (const merchant of seedMerchants) {
        const [row] = await db
            .insert(merchants)
            .values({
                userId: targetUserId,
                displayName: merchant.displayName,
                normalizedName: merchant.normalizedName,
                defaultCategoryId: merchant.categoryKey ? categoryIdByKey.get(merchant.categoryKey) : null,
                defaultCardId: merchant.cardKey ? cardIdByKey.get(merchant.cardKey) : null,
                usageCount: merchant.usageCount,
            })
            .returning({ id: merchants.id })
        merchantIdByKey.set(merchant.key, row.id)
    }

    for (const expense of seedExpenses) {
        const merchantId = merchantIdByKey.get(expense.merchantKey) ?? null
        const categoryId = categoryIdByKey.get(expense.categoryKey) ?? null
        const cardId = cardIdByKey.get(expense.cardKey) ?? null
        const cardCycle = cardCycleFor(expense.cardKey)
        const purchaseDate = new Date(`${expense.purchaseDate}T00:00:00`)

        const [expenseRow] = await db
            .insert(expenses)
            .values({
                userId: targetUserId,
                type: expense.type,
                description: expense.description,
                merchantId,
                categoryId,
                cardId,
                totalAmount: expense.totalAmount,
                purchaseDate: expense.purchaseDate,
            })
            .returning({ id: expenses.id })

        if (expense.type === 'single') {
            const invoice = getInvoiceForExpense(purchaseDate, cardCycle)
            await db.insert(expenseInstallments).values({
                userId: targetUserId,
                expenseId: expenseRow.id,
                merchantId,
                categoryId,
                cardId,
                description: expense.description,
                installmentNumber: 1,
                installmentsTotal: 1,
                amount: expense.totalAmount,
                occurrenceDate: expense.purchaseDate,
                dueDate: toISODate(invoice.dueDate),
                invoiceMonth: invoice.month,
            })
            continue
        }

        const [planRow] = await db
            .insert(installmentPlans)
            .values({ userId: targetUserId, expenseId: expenseRow.id, installmentsTotal: expense.installments! })
            .returning({ id: installmentPlans.id })

        const occurrences = generateInstallments(Number(expense.totalAmount), expense.installments!, purchaseDate, cardCycle)
        await db.insert(expenseInstallments).values(
            occurrences.map((occ) => ({
                userId: targetUserId,
                expenseId: expenseRow.id,
                installmentPlanId: planRow.id,
                merchantId,
                categoryId,
                cardId,
                description: expense.description,
                installmentNumber: occ.installment_number,
                installmentsTotal: occ.installments_total,
                amount: occ.amount.toFixed(2),
                occurrenceDate: occ.occurrence_date,
                dueDate: occ.due_date,
                invoiceMonth: occ.invoice_month,
            })),
        )
    }

    for (const recurrence of seedRecurrences) {
        const merchantId = recurrence.merchantKey ? merchantIdByKey.get(recurrence.merchantKey) ?? null : null
        const categoryId = recurrence.categoryKey ? categoryIdByKey.get(recurrence.categoryKey) ?? null : null
        const cardId = recurrence.cardKey ? cardIdByKey.get(recurrence.cardKey) ?? null : null
        const cardCycle = cardCycleFor(recurrence.cardKey)
        const startDate = new Date(`${recurrence.startDate}T00:00:00`)
        const endDate = recurrence.endDate ? new Date(`${recurrence.endDate}T00:00:00`) : null

        const [expenseRow] = await db
            .insert(expenses)
            .values({
                userId: targetUserId,
                type: 'recurring',
                description: recurrence.description,
                merchantId,
                categoryId,
                cardId,
                totalAmount: recurrence.amount,
                purchaseDate: recurrence.startDate,
            })
            .returning({ id: expenses.id })

        const [recurrenceRow] = await db
            .insert(recurrences)
            .values({ userId: targetUserId, frequency: recurrence.frequency, startDate: recurrence.startDate, endDate: recurrence.endDate, active: true })
            .returning({ id: recurrences.id })

        const until = endDate ?? addMonths(startDate, 12)
        const dates = generateRecurrenceOccurrences(startDate, recurrence.frequency, until, endDate)

        await db.insert(expenseInstallments).values(
            dates.map((date) => {
                const invoice = getInvoiceForExpense(new Date(`${date}T00:00:00`), cardCycle)
                return {
                    userId: targetUserId,
                    expenseId: expenseRow.id,
                    recurrenceId: recurrenceRow.id,
                    merchantId,
                    categoryId,
                    cardId,
                    description: recurrence.description,
                    amount: recurrence.amount,
                    occurrenceDate: date,
                    dueDate: toISODate(invoice.dueDate),
                    invoiceMonth: invoice.month,
                }
            }),
        )
    }

    console.log(`Perfil financeiro criado com sucesso para ${targetUserId}`)
    process.exit(0)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
