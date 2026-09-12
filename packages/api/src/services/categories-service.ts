import { z } from 'zod'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { categories } from '@contai/db'
import { ServiceError } from './errors'
import type { Database } from './types'

const DEFAULT_CATEGORIES = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Compras', 'Outros']

export const categoryInputSchema = z.object({
    name: z.string().min(1, 'Informe um nome').max(60),
    icon: z.string().max(40).nullable().optional(),
})
export type CategoryInput = z.infer<typeof categoryInputSchema>

export const updateCategoryInputSchema = categoryInputSchema.partial()
export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>

export async function listCategories(db: Database, userId: string) {
    const existing = await db
        .select()
        .from(categories)
        .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)))
        .orderBy(asc(categories.name))

    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()))
    const missing = DEFAULT_CATEGORIES.filter((name) => !existingNames.has(name.toLowerCase()))

    if (missing.length === 0) return existing

    const inserted = await db
        .insert(categories)
        .values(missing.map((name) => ({ name, userId })))
        .returning()

    return [...existing, ...inserted].sort((a, b) => a.name.localeCompare(b.name))
}

export async function createCategory(db: Database, userId: string, input: CategoryInput) {
    try {
        const [data] = await db
            .insert(categories)
            .values({ name: input.name, icon: input.icon, userId })
            .returning()
        return data
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
            throw new ServiceError('CONFLICT', 'Categoria já existe')
        }
        throw error
    }
}

export async function updateCategory(db: Database, userId: string, id: string, input: UpdateCategoryInput) {
    const [data] = await db
        .update(categories)
        .set(input)
        .where(and(eq(categories.id, id), eq(categories.userId, userId), isNull(categories.deletedAt)))
        .returning()

    if (!data) throw new ServiceError('NOT_FOUND', 'Categoria não encontrada')
    return data
}

export async function deleteCategory(db: Database, userId: string, id: string) {
    const [data] = await db
        .update(categories)
        .set({ deletedAt: new Date() })
        .where(and(eq(categories.id, id), eq(categories.userId, userId), isNull(categories.deletedAt)))
        .returning()

    if (!data) throw new ServiceError('NOT_FOUND', 'Categoria não encontrada')
    return { ok: true }
}
