import { z } from 'zod'
import { and, desc, eq, gte, isNull } from 'drizzle-orm'
import { cards, expenseInstallments, recurrences } from '@contai/db'
import { fromISODate, generateRecurrenceOccurrences, getInvoiceForExpense, toISODate, type CardCycle } from '@contai/domain'
import { ServiceError } from './errors'
import type { Database } from './types'

export const recurrencePatchSchema = z.object({
    frequency: z.enum(['weekly', 'monthly', 'yearly']).optional(),
    endDate: z.string().date().nullable().optional(),
})
export type RecurrencePatch = z.infer<typeof recurrencePatchSchema>

export const convertToRecurringInputSchema = z.object({
    frequency: z.enum(['weekly', 'monthly', 'yearly']),
    endDate: z.string().date().nullable().optional(),
})
export type ConvertToRecurringInput = z.infer<typeof convertToRecurringInputSchema>

const HORIZON_MONTHS = 12

function horizon(): Date {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + HORIZON_MONTHS, now.getDate())
}

async function getCardCycle(db: Database, userId: string, cardId: string | null): Promise<CardCycle | null> {
    if (!cardId) return null
    const [cardRow] = await db
        .select({ closing_day: cards.closingDay, due_day: cards.dueDay })
        .from(cards)
        .where(and(eq(cards.id, cardId), eq(cards.userId, userId), isNull(cards.deletedAt)))
        .limit(1)
    return cardRow ?? null
}

export async function getRecurrence(db: Database, userId: string, id: string) {
    const [recurrence] = await db
        .select()
        .from(recurrences)
        .where(and(eq(recurrences.id, id), eq(recurrences.userId, userId), isNull(recurrences.deletedAt)))
        .limit(1)
    if (!recurrence) throw new ServiceError('NOT_FOUND', 'Recorrência não encontrada')
    return recurrence
}

export async function convertToRecurring(db: Database, userId: string, occurrenceId: string, input: ConvertToRecurringInput) {
    const [current] = await db
        .select()
        .from(expenseInstallments)
        .where(and(eq(expenseInstallments.id, occurrenceId), eq(expenseInstallments.userId, userId), isNull(expenseInstallments.deletedAt)))
        .limit(1)
    if (!current) throw new ServiceError('NOT_FOUND', 'Ocorrência não encontrada')
    if (current.recurrenceId || current.installmentPlanId) {
        throw new ServiceError('CONFLICT', 'Esta despesa já é uma assinatura ou uma compra parcelada')
    }

    const startDate = fromISODate(current.occurrenceDate)
    const endDate = input.endDate ? fromISODate(input.endDate) : null

    const [recurrence] = await db
        .insert(recurrences)
        .values({ userId, frequency: input.frequency, startDate: current.occurrenceDate, endDate: input.endDate ?? null })
        .returning()

    await db.update(expenseInstallments).set({ recurrenceId: recurrence.id }).where(eq(expenseInstallments.id, current.id))

    const dates = generateRecurrenceOccurrences(startDate, input.frequency, horizon(), endDate).filter(
        (date) => date !== current.occurrenceDate,
    )

    if (dates.length) {
        const card = await getCardCycle(db, userId, current.cardId)
        await db.insert(expenseInstallments).values(
            dates.map((date) => {
                const occurrenceDate = fromISODate(date)
                const invoice = getInvoiceForExpense(occurrenceDate, card)
                return {
                    userId,
                    expenseId: current.expenseId,
                    recurrenceId: recurrence.id,
                    merchantId: current.merchantId,
                    categoryId: current.categoryId,
                    cardId: current.cardId,
                    description: current.description,
                    amount: current.amount,
                    occurrenceDate: date,
                    dueDate: toISODate(invoice.dueDate),
                    invoiceMonth: invoice.month,
                }
            }),
        )
    }

    return recurrence
}

async function regenerateFutureOccurrences(db: Database, userId: string, recurrenceId: string) {
    const recurrence = await getRecurrence(db, userId, recurrenceId)
    if (!recurrence.active) return

    const todayISO = toISODate(new Date())

    // Source fields from the most recent occurrence ever recorded for this
    // recurrence, deleted or not: `recurrences` itself has no description/
    // amount/category/card of its own, and pausing (or a frequency change)
    // can soft-delete every visible occurrence of a subscription that hasn't
    // had a charge before today yet, leaving nothing else to copy from.
    const [source] = await db
        .select()
        .from(expenseInstallments)
        .where(and(eq(expenseInstallments.recurrenceId, recurrenceId), eq(expenseInstallments.userId, userId)))
        .orderBy(desc(expenseInstallments.occurrenceDate))
        .limit(1)
    if (!source) return

    await db
        .update(expenseInstallments)
        .set({ deletedAt: new Date() })
        .where(
            and(
                eq(expenseInstallments.recurrenceId, recurrenceId),
                eq(expenseInstallments.userId, userId),
                gte(expenseInstallments.occurrenceDate, todayISO),
                eq(expenseInstallments.status, 'pending'),
                isNull(expenseInstallments.deletedAt),
            ),
        )

    const remaining = await db
        .select({ occurrenceDate: expenseInstallments.occurrenceDate })
        .from(expenseInstallments)
        .where(
            and(
                eq(expenseInstallments.recurrenceId, recurrenceId),
                eq(expenseInstallments.userId, userId),
                isNull(expenseInstallments.deletedAt),
            ),
        )

    const existingDates = new Set(remaining.map((row) => row.occurrenceDate))
    const endDate = recurrence.endDate ? fromISODate(recurrence.endDate) : null
    const dates = generateRecurrenceOccurrences(fromISODate(recurrence.startDate), recurrence.frequency, horizon(), endDate).filter(
        (date) => date >= todayISO && !existingDates.has(date),
    )
    if (!dates.length) return

    const card = await getCardCycle(db, userId, source.cardId)
    await db.insert(expenseInstallments).values(
        dates.map((date) => {
            const occurrenceDate = fromISODate(date)
            const invoice = getInvoiceForExpense(occurrenceDate, card)
            return {
                userId,
                expenseId: source.expenseId,
                recurrenceId,
                merchantId: source.merchantId,
                categoryId: source.categoryId,
                cardId: source.cardId,
                description: source.description,
                amount: source.amount,
                occurrenceDate: date,
                dueDate: toISODate(invoice.dueDate),
                invoiceMonth: invoice.month,
            }
        }),
    )
}

export async function updateRecurrenceSettings(db: Database, userId: string, id: string, patch: RecurrencePatch) {
    const [recurrence] = await db
        .update(recurrences)
        .set({
            ...(patch.frequency && { frequency: patch.frequency }),
            ...(patch.endDate !== undefined && { endDate: patch.endDate }),
        })
        .where(and(eq(recurrences.id, id), eq(recurrences.userId, userId), isNull(recurrences.deletedAt)))
        .returning()
    if (!recurrence) throw new ServiceError('NOT_FOUND', 'Recorrência não encontrada')

    await regenerateFutureOccurrences(db, userId, id)
    return recurrence
}

export async function setRecurrenceActive(db: Database, userId: string, id: string, active: boolean) {
    const [recurrence] = await db
        .update(recurrences)
        .set({ active })
        .where(and(eq(recurrences.id, id), eq(recurrences.userId, userId), isNull(recurrences.deletedAt)))
        .returning()
    if (!recurrence) throw new ServiceError('NOT_FOUND', 'Recorrência não encontrada')

    if (!active) {
        const todayISO = toISODate(new Date())
        await db
            .update(expenseInstallments)
            .set({ deletedAt: new Date() })
            .where(
                and(
                    eq(expenseInstallments.recurrenceId, id),
                    eq(expenseInstallments.userId, userId),
                    gte(expenseInstallments.occurrenceDate, todayISO),
                    eq(expenseInstallments.status, 'pending'),
                    isNull(expenseInstallments.deletedAt),
                ),
            )
        return recurrence
    }

    await regenerateFutureOccurrences(db, userId, id)
    return recurrence
}
