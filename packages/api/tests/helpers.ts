import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { db, user } from '@contai/db'
import type { Context } from '../src/context'
import { appRouter } from '../src/routers/_app'

export { db }

export async function createTestUser(overrides?: Partial<{ name: string; email: string }>) {
    const id = randomUUID()
    const [row] = await db
        .insert(user)
        .values({
            id,
            name: overrides?.name ?? 'Test User',
            email: overrides?.email ?? `test-${id}@example.com`,
        })
        .returning()
    return row
}

export function getCaller(userId: string | null) {
    const ctx: Context = { session: null, userId, db }
    return appRouter.createCaller(ctx)
}

export async function truncateAll() {
    await db.execute(sql`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE`)
}
