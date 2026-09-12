import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) {
    try {
        process.loadEnvFile('../../apps/web/.env.local')
    } catch {
        // ignore if file does not exist
    }
}

export default defineConfig({
    dialect: 'postgresql',
    schema: './src/schema/index.ts',
    out: './src/migrations',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    verbose: true,
    strict: false,
})
