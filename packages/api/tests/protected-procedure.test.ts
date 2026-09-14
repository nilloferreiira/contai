import { describe, expect, it } from 'vitest'
import { getCaller } from './helpers'

describe('protectedProcedure', () => {
    it('rejects an unauthenticated caller (no userId) with UNAUTHORIZED', async () => {
        const caller = getCaller(null)

        await expect(caller.cards.list()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    })

    it('rejects an unauthenticated mutation with UNAUTHORIZED', async () => {
        const caller = getCaller(null)

        await expect(
            caller.expenses.create({
                amount: 50,
                description: 'mercado',
                purchaseDate: '2026-09-09',
                type: 'single',
            }),
        ).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    })
})
