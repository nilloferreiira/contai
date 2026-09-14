import { and, asc, eq, isNull } from 'drizzle-orm'
import { categories } from '@contai/db'
import { categoryInputSchema, updateCategoryInputSchema, type CategoryInput, type UpdateCategoryInput } from '@contai/domain'
import { ServiceError } from './errors'
import type { Database } from './types'

const DEFAULT_CATEGORIES = ['Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 'Compras', 'Outros']

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

function getPostgresErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') return undefined
    if ('code' in error && typeof error.code === 'string') return error.code
    if ('cause' in error) return getPostgresErrorCode(error.cause)
    return undefined
}

export async function createCategory(db: Database, userId: string, input: CategoryInput) {
    try {
        const [data] = await db
            .insert(categories)
            .values({ name: input.name, icon: input.icon, userId })
            .returning()
        return data
    } catch (error: unknown) {
        if (getPostgresErrorCode(error) === '23505') {
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
