import { afterEach, describe, expect, it } from 'vitest'
import { createTestUser, getCaller, truncateAll } from './helpers'

describe('occurrences router', () => {
    afterEach(async () => {
        await truncateAll()
    })

    it('lists only the caller-owned, non-deleted occurrences', async () => {
        const owner = await createTestUser()
        const other = await createTestUser()
        await getCaller(owner.id).expenses.create({
            amount: 50,
            description: 'mercado',
            purchaseDate: '2026-09-09',
            type: 'single',
        })
        await getCaller(other.id).expenses.create({
            amount: 30,
            description: 'padaria',
            purchaseDate: '2026-09-09',
            type: 'single',
        })

        const list = await getCaller(owner.id).occurrences.list({})

        expect(list).toHaveLength(1)
        expect(list[0].description).toBe('mercado')
    })

    it('update scope "occurrence" only patches the single targeted row', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)
        const { occurrences } = await caller.expenses.create({
            amount: 300,
            description: 'geladeira',
            purchaseDate: '2026-09-09',
            type: 'installment',
            installments: 3,
        })

        await caller.occurrences.update({ id: occurrences[0].id, scope: 'occurrence', data: { status: 'paid' } })

        const list = await caller.occurrences.list({})
        const statuses = Object.fromEntries(list.map((o) => [o.installmentNumber, o.status]))
        expect(statuses[1]).toBe('paid')
        expect(statuses[2]).toBe('pending')
        expect(statuses[3]).toBe('pending')
    })

    it('update scope "future" patches the targeted installment and every later one, not earlier ones', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)
        const { occurrences } = await caller.expenses.create({
            amount: 300,
            description: 'geladeira',
            purchaseDate: '2026-09-09',
            type: 'installment',
            installments: 3,
        })
        const second = occurrences.find((o) => o.installmentNumber === 2)!

        await caller.occurrences.update({ id: second.id, scope: 'future', data: { status: 'paid' } })

        const list = await caller.occurrences.list({})
        const statuses = Object.fromEntries(list.map((o) => [o.installmentNumber, o.status]))
        expect(statuses[1]).toBe('pending')
        expect(statuses[2]).toBe('paid')
        expect(statuses[3]).toBe('paid')
    })

    it('rejects scope "future" on an occurrence that has no installment plan (INVALID_SCOPE)', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)
        const { occurrences } = await caller.expenses.create({
            amount: 50,
            description: 'mercado',
            purchaseDate: '2026-09-09',
            type: 'single',
        })

        await expect(
            caller.occurrences.update({ id: occurrences[0].id, scope: 'future', data: { status: 'paid' } }),
        ).rejects.toMatchObject({ code: 'UNPROCESSABLE_CONTENT' })
    })

    it('rejects scope "series" on an installment occurrence that has no recurrence (INVALID_SCOPE)', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)
        const { occurrences } = await caller.expenses.create({
            amount: 300,
            description: 'geladeira',
            purchaseDate: '2026-09-09',
            type: 'installment',
            installments: 3,
        })

        await expect(
            caller.occurrences.update({ id: occurrences[0].id, scope: 'series', data: { status: 'paid' } }),
        ).rejects.toMatchObject({ code: 'UNPROCESSABLE_CONTENT' })
    })

    it('rejects patching categoryId to a category the caller does not own', async () => {
        const owner = await createTestUser()
        const attacker = await createTestUser()
        const category = await getCaller(owner.id).categories.create({ name: 'Pets' })
        const { occurrences } = await getCaller(attacker.id).expenses.create({
            amount: 50,
            description: 'mercado',
            purchaseDate: '2026-09-09',
            type: 'single',
        })

        await expect(
            getCaller(attacker.id).occurrences.update({
                id: occurrences[0].id,
                scope: 'occurrence',
                data: { categoryId: category.id },
            }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('rejects updating an occurrence that belongs to a different user', async () => {
        const owner = await createTestUser()
        const attacker = await createTestUser()
        const { occurrences } = await getCaller(owner.id).expenses.create({
            amount: 50,
            description: 'mercado',
            purchaseDate: '2026-09-09',
            type: 'single',
        })

        await expect(
            getCaller(attacker.id).occurrences.update({
                id: occurrences[0].id,
                scope: 'occurrence',
                data: { status: 'paid' },
            }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('soft-deletes with scope "occurrence" so the row disappears from list() but is not hard-deleted', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)
        const { occurrences } = await caller.expenses.create({
            amount: 50,
            description: 'mercado',
            purchaseDate: '2026-09-09',
            type: 'single',
        })

        await caller.occurrences.delete({ id: occurrences[0].id, scope: 'occurrence' })

        expect(await caller.occurrences.list({})).toEqual([])
    })
})
