import { describe, expect, it } from 'vitest'
import { passwordRequirements, signInSchema, signUpSchema } from '@/lib/schemas/auth-schema'
import { authClient } from '@/lib/auth-client'

describe('Auth schemas & client', () => {
    it('validates password requirements correctly', () => {
        const weak = 'weak'
        expect(passwordRequirements.every((r) => r.test(weak))).toBe(false)

        const strong = 'Strong1@Password'
        expect(passwordRequirements.every((r) => r.test(strong))).toBe(true)
    })

    it('validates signUpSchema requiring name, email, and strong password', () => {
        const valid = signUpSchema.safeParse({
            name: 'Dan Test',
            email: 'dan@example.com',
            password: 'Strong1@Password',
        })
        expect(valid.success).toBe(true)

        const invalidName = signUpSchema.safeParse({
            name: 'D',
            email: 'dan@example.com',
            password: 'Strong1@Password',
        })
        expect(invalidName.success).toBe(false)

        const invalidPassword = signUpSchema.safeParse({
            name: 'Dan Test',
            email: 'dan@example.com',
            password: 'simplepassword',
        })
        expect(invalidPassword.success).toBe(false)
    })

    it('validates signInSchema', () => {
        const valid = signInSchema.safeParse({
            email: 'dan@example.com',
            password: 'secret',
        })
        expect(valid.success).toBe(true)

        const invalidEmail = signInSchema.safeParse({
            email: 'invalid-email',
            password: 'secret',
        })
        expect(invalidEmail.success).toBe(false)
    })

    it('exports authClient properly', () => {
        expect(authClient).toBeDefined()
        expect(authClient.signIn).toBeDefined()
        expect(authClient.signUp).toBeDefined()
    })

    it('connects to database and queries user table', async () => {
        const { db } = await import('@/db')
        const { user } = await import('@/db/schema')
        const users = await db.select().from(user)
        expect(Array.isArray(users)).toBe(true)
    })
})
