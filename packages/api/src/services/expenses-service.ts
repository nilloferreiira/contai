import { z } from 'zod'
import { and, eq, isNull } from 'drizzle-orm'
import { cards, categories, expenseInstallments, expenses, installmentPlans, merchants, recurrences } from '@contai/db'
import {
    fromISODate,
    generateInstallments,
    generateRecurrenceOccurrences,
    getInvoiceForExpense,
    normalizeMerchantName,
    toISODate,
    type CardCycle,
} from '@contai/domain'
import { ServiceError } from './errors'
import type { Database } from './types'

export const createExpenseInputSchema = z
    .object({
        amount: z.number().positive('Informe um valor maior que zero'),
        description: z.string().min(1, 'Descreva a despesa').max(120),
        merchantName: z.string().max(80).optional(),
        categoryId: z.string().uuid().nullable().optional(),
        cardId: z.string().uuid().nullable().optional(),
        purchaseDate: z.string().date(),
        type: z.enum(['single', 'installment', 'recurring']),
        installments: z.number().int().min(2).max(48).optional(),
        frequency: z.enum(['weekly', 'monthly', 'yearly']).optional(),
        endDate: z.string().date().nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
    })
    .refine((v) => v.type !== 'installment' || !!v.installments, {
        path: ['installments'],
        message: 'Informe o número de parcelas',
    })
    .refine((v) => v.type !== 'recurring' || !!v.frequency, {
        path: ['frequency'],
        message: 'Informe a frequência',
    })

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>

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
