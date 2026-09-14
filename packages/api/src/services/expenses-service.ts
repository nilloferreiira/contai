import { and, eq, isNull } from 'drizzle-orm'
import { cards, categories, expenseInstallments, expenses, installmentPlans, merchants, recurrences } from '@contai/db'
import {
    createExpenseInputSchema,
    fromISODate,
    generateInstallments,
    generateRecurrenceOccurrences,
    getInvoiceForExpense,
    normalizeMerchantName,
    toISODate,
    type CardCycle,
    type CreateExpenseInput,
} from '@contai/domain'
import { ServiceError } from './errors'
import type { Database } from './types'

// Re-exported for backward compatibility: the schema and its inferred type
// now live in `@contai/domain` (see that package's CLAUDE.md) so client
// components can import them without pulling in `better-auth`/`@contai/db`
// through `@contai/api`'s barrel.
export { createExpenseInputSchema }
export type { CreateExpenseInput }

export async function createExpense(db: Database, userId: string, input: CreateExpenseInput) {
    const purchaseDate = fromISODate(input.purchaseDate)

    return db.transaction(async (tx) => {
        let categoryId: string | null = null
        if (input.categoryId) {
            const [categoryRow] = await tx
                .select({ id: categories.id })
                .from(categories)
                .where(and(eq(categories.id, input.categoryId), eq(categories.userId, userId), isNull(categories.deletedAt)))
                .limit(1)
            if (!categoryRow) throw new ServiceError('NOT_FOUND', 'Categoria não encontrada')
            categoryId = categoryRow.id
        }

        let merchantId: string | null = null
        if (input.merchantName) {
            const normalized = normalizeMerchantName(input.merchantName)
            const [existing] = await tx
                .select()
                .from(merchants)
                .where(and(eq(merchants.normalizedName, normalized), eq(merchants.userId, userId), isNull(merchants.deletedAt)))
                .limit(1)

            if (existing) {
                merchantId = existing.id
                await tx
                    .update(merchants)
                    .set({ usageCount: existing.usageCount + 1 })
                    .where(eq(merchants.id, existing.id))
            } else {
                const [created] = await tx
                    .insert(merchants)
                    .values({
                        userId,
                        normalizedName: normalized,
                        displayName: input.merchantName,
                        defaultCategoryId: categoryId,
                        defaultCardId: input.cardId ?? null,
                        usageCount: 1,
                    })
                    .returning()
                merchantId = created.id
            }
        }

        const [expense] = await tx
            .insert(expenses)
            .values({
                userId,
                type: input.type,
                description: input.description,
                merchantId,
                categoryId,
                cardId: input.cardId ?? null,
                totalAmount: String(input.amount),
                purchaseDate: toISODate(purchaseDate),
                notes: input.notes ?? null,
            })
            .returning()

        let card: CardCycle | null = null
        if (input.cardId) {
            const [cardRow] = await tx
                .select({ closing_day: cards.closingDay, due_day: cards.dueDay })
                .from(cards)
                .where(and(eq(cards.id, input.cardId), eq(cards.userId, userId), isNull(cards.deletedAt)))
                .limit(1)
            if (!cardRow) throw new ServiceError('NOT_FOUND', 'Cartão não encontrado')
            card = cardRow
        }

        if (input.type === 'installment' && input.installments) {
            const [plan] = await tx
                .insert(installmentPlans)
                .values({ expenseId: expense.id, userId, installmentsTotal: input.installments })
                .returning()

            const generatedInstallments = generateInstallments(input.amount, input.installments, purchaseDate, card)
            const occurrences = await tx
                .insert(expenseInstallments)
                .values(
                    generatedInstallments.map((installment) => ({
                        userId,
                        expenseId: expense.id,
                        installmentPlanId: plan.id,
                        merchantId,
                        categoryId,
                        cardId: input.cardId ?? null,
                        description: input.description,
                        installmentNumber: installment.installment_number,
                        installmentsTotal: installment.installments_total,
                        amount: String(installment.amount),
                        occurrenceDate: installment.occurrence_date,
                        dueDate: installment.due_date,
                        invoiceMonth: installment.invoice_month,
                    })),
                )
                .returning()

            return { expense, occurrences }
        }

        if (input.type === 'recurring' && input.frequency) {
            const [recurrence] = await tx
                .insert(recurrences)
                .values({
                    userId,
                    frequency: input.frequency,
                    startDate: toISODate(purchaseDate),
                    endDate: input.endDate ?? null,
                })
                .returning()

            const untilDate = new Date(purchaseDate)
            untilDate.setMonth(untilDate.getMonth() + 12)
            const dates = generateRecurrenceOccurrences(
                purchaseDate,
                input.frequency,
                untilDate,
                input.endDate ? fromISODate(input.endDate) : null,
            )

            const occurrences = await tx
                .insert(expenseInstallments)
                .values(
                    dates.map((date) => {
                        const occurrenceDate = fromISODate(date)
                        const invoice = getInvoiceForExpense(occurrenceDate, card)
                        return {
                            userId,
                            expenseId: expense.id,
                            recurrenceId: recurrence.id,
                            merchantId,
                            categoryId,
                            cardId: input.cardId ?? null,
                            description: input.description,
                            amount: String(input.amount),
                            occurrenceDate: date,
                            dueDate: toISODate(invoice.dueDate),
                            invoiceMonth: invoice.month,
                        }
                    }),
                )
                .returning()

            return { expense, occurrences }
        }

        const invoice = getInvoiceForExpense(purchaseDate, card)
        const [occurrence] = await tx
            .insert(expenseInstallments)
            .values({
                userId,
                expenseId: expense.id,
                merchantId,
                categoryId,
                cardId: input.cardId ?? null,
                description: input.description,
                amount: String(input.amount),
                occurrenceDate: toISODate(purchaseDate),
                dueDate: toISODate(invoice.dueDate),
                invoiceMonth: invoice.month,
            })
            .returning()

        return { expense, occurrences: [occurrence] }
    })
}
