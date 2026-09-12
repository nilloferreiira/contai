import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { env } from './env'

declare global {
    var __contaiDb: ReturnType<typeof drizzle<typeof schema>> | undefined
}

export const db =
    globalThis.__contaiDb ??
    drizzle(postgres(env.DATABASE_URL), { schema })

if (env.NODE_ENV !== 'production') {
    globalThis.__contaiDb = db
}

export * from './schema'
