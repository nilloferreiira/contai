import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { TEST_DATABASE_URL } from './test-env'

const migrationsFolder = fileURLToPath(new URL('../../db/src/migrations', import.meta.url))

export async function setup() {
    const sql = postgres(TEST_DATABASE_URL, { max: 1 })
    const db = drizzle(sql)
    await migrate(db, { migrationsFolder })
    await sql.end()
}
