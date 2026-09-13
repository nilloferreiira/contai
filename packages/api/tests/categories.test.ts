import { afterEach, describe, expect, it } from 'vitest'
import { createTestUser, getCaller, truncateAll } from './helpers'

describe('categories router', () => {
    afterEach(async () => {
        await truncateAll()
    })

    it('seeds the 7 default categories on first list() for a new user', async () => {
        const user = await createTestUser()
        const categories = await getCaller(user.id).categories.list()

        expect(categories).toHaveLength(7)
        expect(categories.map((c) => c.name)).toContain('Alimentação')
    })

    it('does not duplicate default categories on a second list() call', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)

        await caller.categories.list()
        const secondCall = await caller.categories.list()

        expect(secondCall).toHaveLength(7)
    })

    it('rejects creating a category whose name collides case-insensitively with an existing one', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)
        await caller.categories.create({ name: 'Pets' })

        await expect(caller.categories.create({ name: 'pets' })).rejects.toMatchObject({ code: 'CONFLICT' })
    })

    it('rejects updating a category that belongs to a different user', async () => {
        const owner = await createTestUser()
        const attacker = await createTestUser()
        const category = await getCaller(owner.id).categories.create({ name: 'Pets' })

        await expect(
            getCaller(attacker.id).categories.update({ id: category.id, data: { name: 'Hijacked' } }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('rejects deleting a category that belongs to a different user', async () => {
        const owner = await createTestUser()
        const attacker = await createTestUser()
        const category = await getCaller(owner.id).categories.create({ name: 'Pets' })

        await expect(getCaller(attacker.id).categories.delete({ id: category.id })).rejects.toMatchObject({
            code: 'NOT_FOUND',
        })
    })
})
