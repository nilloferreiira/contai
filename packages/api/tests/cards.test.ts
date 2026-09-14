import { TRPCError } from '@trpc/server'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestUser, getCaller, truncateAll } from './helpers'

describe('cards router', () => {
    afterEach(async () => {
        await truncateAll()
    })

    it('creates and lists only the caller-owned, active, non-deleted cards', async () => {
        const owner = await createTestUser()
        const other = await createTestUser()
        const ownerCaller = getCaller(owner.id)
        const otherCaller = getCaller(other.id)

        await ownerCaller.cards.create({ name: 'Nubank', closingDay: 5, dueDay: 12, color: '#820ad1' })
        await otherCaller.cards.create({ name: "Other's card", closingDay: 1, dueDay: 8, color: '#000000' })

        const ownerCards = await ownerCaller.cards.list()

        expect(ownerCards).toHaveLength(1)
        expect(ownerCards[0].name).toBe('Nubank')
    })

    it('rejects updating a card that belongs to a different user', async () => {
        const owner = await createTestUser()
        const attacker = await createTestUser()
        const card = await getCaller(owner.id).cards.create({
            name: 'Nubank',
            closingDay: 5,
            dueDay: 12,
            color: '#820ad1',
        })

        await expect(
            getCaller(attacker.id).cards.update({ id: card.id, data: { name: 'Hijacked' } }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' } satisfies Partial<TRPCError>)
    })

    it('rejects deleting a nonexistent card instead of silently succeeding', async () => {
        const owner = await createTestUser()

        await expect(
            getCaller(owner.id).cards.delete({ id: '00000000-0000-0000-0000-000000000000' }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' } satisfies Partial<TRPCError>)
    })

    it('soft-deletes a card so it no longer appears in list()', async () => {
        const owner = await createTestUser()
        const caller = getCaller(owner.id)
        const card = await caller.cards.create({ name: 'Nubank', closingDay: 5, dueDay: 12, color: '#820ad1' })

        await caller.cards.delete({ id: card.id })

        expect(await caller.cards.list()).toEqual([])
    })
})
