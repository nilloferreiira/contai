import { describe, expect, it } from 'vitest'
import { authClient } from '@/lib/auth-client'

describe('Auth client', () => {
    it('exports authClient properly', () => {
        expect(authClient).toBeDefined()
        expect(authClient.signIn).toBeDefined()
        expect(authClient.signUp).toBeDefined()
    })

    it('connects to database and queries user table', async () => {
        const { db, user } = await import('@contai/db')
        const users = await db.select().from(user)
        expect(Array.isArray(users)).toBe(true)
    })
})
