import { z } from 'zod'

const envSchema = z.object({
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().url(),
})

export const env = envSchema.parse(process.env)
