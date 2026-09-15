import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'
import { recurrences } from '@contai/db'
import { createTestUser, db, getCaller, truncateAll } from './helpers'

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

    it('update scope "future" patches the targeted recurring occurrence and every later one, not earlier ones', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)
        const { occurrences } = await caller.expenses.create({
            amount: 40,
            description: 'academia',
            purchaseDate: '2026-09-09',
            type: 'recurring',
            frequency: 'monthly',
        })
        const second = occurrences.find((o) => o.occurrenceDate === '2026-10-09')!

        await caller.occurrences.update({ id: second.id, scope: 'future', data: { status: 'paid' } })

        const list = await caller.occurrences.list({})
        const statuses = Object.fromEntries(list.map((o) => [o.occurrenceDate, o.status]))
        expect(statuses['2026-09-09']).toBe('pending')
        expect(statuses['2026-10-09']).toBe('paid')
        expect(statuses['2026-11-09']).toBe('paid')
    })

    it('rejects scope "future" on an occurrence that has no recurrence (INVALID_SCOPE)', async () => {
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

    it('rejects scope "future" on an installment occurrence (INVALID_SCOPE)', async () => {
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
            caller.occurrences.update({ id: occurrences[0].id, scope: 'future', data: { status: 'paid' } }),
        ).rejects.toMatchObject({ code: 'UNPROCESSABLE_CONTENT' })
    })

    it('update scope "series" patches every installment in the purchase, including earlier ones', async () => {
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

        await caller.occurrences.update({ id: second.id, scope: 'series', data: { status: 'paid' } })

        const list = await caller.occurrences.list({})
        expect(list.every((o) => o.status === 'paid')).toBe(true)
    })

    it('update scope "series" with an amount divides the total across every installment', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)
        const { occurrences } = await caller.expenses.create({
            amount: 300,
            description: 'geladeira',
            purchaseDate: '2026-09-09',
            type: 'installment',
            installments: 3,
        })

        await caller.occurrences.update({ id: occurrences[0].id, scope: 'series', data: { amount: 600 } })

        const list = await caller.occurrences.list({})
        expect(list.every((o) => Number(o.amount) === 200)).toBe(true)
    })

    it('rejects scope "series" on an occurrence that is neither an installment nor a recurrence (INVALID_SCOPE)', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)
        const { occurrences } = await caller.expenses.create({
            amount: 50,
            description: 'mercado',
            purchaseDate: '2026-09-09',
            type: 'single',
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

    it('delete scope "end" deletes future occurrences and marks the recurrence inactive as of that date', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)
        const { occurrences } = await caller.expenses.create({
            amount: 40,
            description: 'academia',
            purchaseDate: '2026-09-09',
            type: 'recurring',
            frequency: 'monthly',
        })
        const second = occurrences.find((o) => o.occurrenceDate === '2026-10-09')!

        await caller.occurrences.delete({ id: second.id, scope: 'end' })

        const list = await caller.occurrences.list({})
        expect(list.map((o) => o.occurrenceDate)).toEqual(['2026-09-09'])

        const [recurrence] = await db
            .select()
            .from(recurrences)
            .where(eq(recurrences.id, second.recurrenceId!))
        expect(recurrence.active).toBe(false)
        expect(recurrence.endDate).toBe('2026-10-09')
    })
})
