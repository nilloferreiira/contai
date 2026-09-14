import { z } from 'zod'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { cards } from '@contai/db'
import { ServiceError } from './errors'
import type { Database } from './types'

export const cardInputSchema = z.object({
    name: z.string().min(1, 'Informe um nome').max(60),
    closingDay: z.number().int().min(1).max(31),
    dueDay: z.number().int().min(1).max(31),
    creditLimit: z.number().positive().nullable().optional(),
    color: z.string().min(1),
})
export type CardInput = z.infer<typeof cardInputSchema>

export const updateCardInputSchema = cardInputSchema.partial().extend({ active: z.boolean().optional() })
export type UpdateCardInput = z.infer<typeof updateCardInputSchema>

export function listCards(db: Database, userId: string) {
    return db
        .select()
        .from(cards)
        .where(and(eq(cards.userId, userId), eq(cards.active, true), isNull(cards.deletedAt)))
        .orderBy(asc(cards.createdAt))
}

export async function createCard(db: Database, userId: string, input: CardInput) {
    const [data] = await db
        .insert(cards)
        .values({
            userId,
            name: input.name,
            closingDay: input.closingDay,
            dueDay: input.dueDay,
            creditLimit: input.creditLimit != null ? String(input.creditLimit) : null,
            color: input.color,
        })
        .returning()
    return data
}

export async function updateCard(db: Database, userId: string, id: string, input: UpdateCardInput) {
    const updateData: Partial<typeof cards.$inferInsert> = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.closingDay !== undefined) updateData.closingDay = input.closingDay
    if (input.dueDay !== undefined) updateData.dueDay = input.dueDay
    if (input.creditLimit !== undefined) updateData.creditLimit = input.creditLimit != null ? String(input.creditLimit) : null
    if (input.color !== undefined) updateData.color = input.color
    if (input.active !== undefined) updateData.active = input.active

    const [data] = await db
        .update(cards)
        .set(updateData)
        .where(and(eq(cards.id, id), eq(cards.userId, userId), isNull(cards.deletedAt)))
        .returning()

    if (!data) throw new ServiceError('NOT_FOUND', 'Cartão não encontrado')
    return data
}

export async function deleteCard(db: Database, userId: string, id: string) {
    const [data] = await db
        .update(cards)
        .set({ deletedAt: new Date() })
        .where(and(eq(cards.id, id), eq(cards.userId, userId), isNull(cards.deletedAt)))
        .returning()

    if (!data) throw new ServiceError('NOT_FOUND', 'Cartão não encontrado')
    return { ok: true }
}
