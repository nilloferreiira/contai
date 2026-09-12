import { z } from 'zod'
import { and, desc, eq, gte, ilike, isNull, lte } from 'drizzle-orm'
import { cards, categories, expenseInstallments } from '@contai/db'
import { ServiceError } from './errors'
import type { Database } from './types'

export const occurrenceFiltersSchema = z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    q: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    cardId: z.string().uuid().optional(),
    status: z.enum(['pending', 'paid', 'cancelled']).optional(),
})
export type OccurrenceFilters = z.infer<typeof occurrenceFiltersSchema>

export const occurrencePatchSchema = z.object({
    status: z.enum(['pending', 'paid', 'cancelled']).optional(),
    amount: z.number().positive().optional(),
    description: z.string().min(1).max(120).optional(),
    categoryId: z.string().uuid().nullable().optional(),
    cardId: z.string().uuid().nullable().optional(),
})
export type OccurrencePatch = z.infer<typeof occurrencePatchSchema>

export const scopeSchema = z.enum(['occurrence', 'future', 'series', 'end'])
export type Scope = z.infer<typeof scopeSchema>

function scopedConditions(scope: Scope, userId: string, current: typeof expenseInstallments.$inferSelect) {
    const conditions = [eq(expenseInstallments.userId, userId), isNull(expenseInstallments.deletedAt)]

    if (scope === 'future' && current.installmentPlanId) {
        conditions.push(
            eq(expenseInstallments.installmentPlanId, current.installmentPlanId),
            gte(expenseInstallments.occurrenceDate, current.occurrenceDate),
        )
        return conditions
    }
    if (scope === 'series' && current.recurrenceId) {
        conditions.push(eq(expenseInstallments.recurrenceId, current.recurrenceId))
        return conditions
    }
    if (scope === 'end' && current.recurrenceId) {
        conditions.push(
            eq(expenseInstallments.recurrenceId, current.recurrenceId),
            gte(expenseInstallments.occurrenceDate, current.occurrenceDate),
        )
        return conditions
    }
    throw new ServiceError('INVALID_SCOPE', 'Escopo inválido para esta ocorrência')
}

export function listOccurrences(db: Database, userId: string, filters: OccurrenceFilters) {
    const conditions = [eq(expenseInstallments.userId, userId), isNull(expenseInstallments.deletedAt)]

    if (filters.from) conditions.push(gte(expenseInstallments.occurrenceDate, filters.from))
    if (filters.to) conditions.push(lte(expenseInstallments.occurrenceDate, filters.to))
    if (filters.q) conditions.push(ilike(expenseInstallments.description, `%${filters.q}%`))
    if (filters.categoryId) conditions.push(eq(expenseInstallments.categoryId, filters.categoryId))
    if (filters.cardId) conditions.push(eq(expenseInstallments.cardId, filters.cardId))
    if (filters.status) conditions.push(eq(expenseInstallments.status, filters.status))

    return db.select().from(expenseInstallments).where(and(...conditions)).orderBy(desc(expenseInstallments.occurrenceDate))
}

async function findCurrent(db: Database, userId: string, id: string) {
    const [current] = await db
        .select()
        .from(expenseInstallments)
        .where(and(eq(expenseInstallments.id, id), eq(expenseInstallments.userId, userId), isNull(expenseInstallments.deletedAt)))
        .limit(1)

    if (!current) throw new ServiceError('NOT_FOUND', 'Ocorrência não encontrada')
    return current
}

export async function updateOccurrence(db: Database, userId: string, id: string, scope: Scope, patchInput: OccurrencePatch) {
    if (patchInput.categoryId) {
        const [categoryRow] = await db
            .select({ id: categories.id })
            .from(categories)
            .where(and(eq(categories.id, patchInput.categoryId), eq(categories.userId, userId), isNull(categories.deletedAt)))
            .limit(1)
        if (!categoryRow) throw new ServiceError('NOT_FOUND', 'Categoria não encontrada')
    }

    if (patchInput.cardId) {
        const [cardRow] = await db
            .select({ id: cards.id })
            .from(cards)
            .where(and(eq(cards.id, patchInput.cardId), eq(cards.userId, userId), isNull(cards.deletedAt)))
            .limit(1)
        if (!cardRow) throw new ServiceError('NOT_FOUND', 'Cartão não encontrado')
    }

    const patch: Partial<typeof expenseInstallments.$inferInsert> = {
        ...(patchInput.status && { status: patchInput.status }),
        ...(patchInput.amount && { amount: String(patchInput.amount) }),
        ...(patchInput.description && { description: patchInput.description }),
        ...(patchInput.categoryId !== undefined && { categoryId: patchInput.categoryId }),
        ...(patchInput.cardId !== undefined && { cardId: patchInput.cardId }),
    }

    if (scope === 'occurrence') {
        const [data] = await db
            .update(expenseInstallments)
            .set(patch)
            .where(and(eq(expenseInstallments.id, id), eq(expenseInstallments.userId, userId), isNull(expenseInstallments.deletedAt)))
            .returning()

        if (!data) throw new ServiceError('NOT_FOUND', 'Ocorrência não encontrada')
        return [data]
    }

    const current = await findCurrent(db, userId, id)
    const conditions = scopedConditions(scope, userId, current)
    return db.update(expenseInstallments).set(patch).where(and(...conditions)).returning()
}

export async function deleteOccurrence(db: Database, userId: string, id: string, scope: Scope) {
    const deletedAt = new Date()

    if (scope === 'occurrence') {
        const [deleted] = await db
            .update(expenseInstallments)
            .set({ deletedAt })
            .where(and(eq(expenseInstallments.id, id), eq(expenseInstallments.userId, userId), isNull(expenseInstallments.deletedAt)))
            .returning()

        if (!deleted) throw new ServiceError('NOT_FOUND', 'Ocorrência não encontrada')
        return { ok: true }
    }

    const current = await findCurrent(db, userId, id)
    const conditions = scopedConditions(scope, userId, current)
    await db.update(expenseInstallments).set({ deletedAt }).where(and(...conditions))
    return { ok: true }
}
