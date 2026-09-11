import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

declare global {
    var __contaiDb: ReturnType<typeof drizzle<typeof schema>> | undefined
}

const connectionString = process.env.DATABASE_URL!

export const db =
    globalThis.__contaiDb ??
    drizzle(postgres(connectionString), { schema })

if (process.env.NODE_ENV !== 'production') {
    globalThis.__contaiDb = db
}

export * from './schema'
