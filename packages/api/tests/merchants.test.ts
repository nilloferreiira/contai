import { describe, expect, it, afterEach } from 'vitest'
import { createTestUser, getCaller, truncateAll } from './helpers'

describe('merchants router', () => {
    afterEach(async () => {
        await truncateAll()
    })

    it('returns [] for a fresh user with no expenses yet', async () => {
        const user = await createTestUser()
        expect(await getCaller(user.id).merchants.list()).toEqual([])
    })

    it('only returns merchants scoped to the caller, ordered by usage', async () => {
        const owner = await createTestUser()
        const other = await createTestUser()

        await getCaller(owner.id).expenses.create({
            amount: 20,
            description: 'padaria',
            merchantName: 'Padaria do Bairro',
            purchaseDate: '2026-03-01',
            type: 'single',
        })
        await getCaller(other.id).expenses.create({
            amount: 15,
            description: 'padaria',
            merchantName: "Other's Bakery",
            purchaseDate: '2026-03-01',
            type: 'single',
        })

        const merchants = await getCaller(owner.id).merchants.list()

        expect(merchants).toHaveLength(1)
        expect(merchants[0].displayName).toBe('Padaria do Bairro')
    })

    it('increments usageCount when the same normalized merchant name is reused', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)

        await caller.expenses.create({
            amount: 20,
            description: 'padaria',
            merchantName: 'Padaria do Bairro',
            purchaseDate: '2026-03-01',
            type: 'single',
        })
        await caller.expenses.create({
            amount: 25,
            description: 'padaria de novo',
            merchantName: 'padaria do bairro',
            purchaseDate: '2026-03-05',
            type: 'single',
        })

        const merchants = await caller.merchants.list()

        expect(merchants).toHaveLength(1)
        expect(merchants[0].usageCount).toBe(2)
    })
})
