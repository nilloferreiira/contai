import { afterEach, describe, expect, it } from 'vitest'
import { generateRecurrenceOccurrences, toISODate } from '@contai/domain'
import { createTestUser, getCaller, truncateAll } from './helpers'

function todayAt(monthOffset: number): Date {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, now.getDate())
}

const today = todayAt(0)
const todayISO = toISODate(today)
const horizon = todayAt(12)

describe('recurrences router', () => {
    afterEach(async () => {
        await truncateAll()
    })

    describe('occurrences.convertToRecurring', () => {
        it('turns a single expense into a subscription and generates the remaining future charges', async () => {
            const user = await createTestUser()
            const caller = getCaller(user.id)
            const { occurrences } = await caller.expenses.create({
                amount: 40,
                description: 'academia',
                purchaseDate: todayISO,
                type: 'single',
            })

            const recurrence = await caller.occurrences.convertToRecurring({
                id: occurrences[0].id,
                frequency: 'monthly',
            })

            const list = await caller.occurrences.list({})
            const expectedDates = generateRecurrenceOccurrences(today, 'monthly', horizon, null)
            expect(list.map((o) => o.occurrenceDate).sort()).toEqual(expectedDates.sort())
            expect(list.every((o) => o.recurrenceId === recurrence.id)).toBe(true)
            expect(list.every((o) => o.description === 'academia' && Number(o.amount) === 40)).toBe(true)
        })

        it('rejects an occurrence that is already part of an installment plan (CONFLICT)', async () => {
            const user = await createTestUser()
            const caller = getCaller(user.id)
            const { occurrences } = await caller.expenses.create({
                amount: 300,
                description: 'geladeira',
                purchaseDate: todayISO,
                type: 'installment',
                installments: 3,
            })

            await expect(
                caller.occurrences.convertToRecurring({ id: occurrences[0].id, frequency: 'monthly' }),
            ).rejects.toMatchObject({ code: 'CONFLICT' })
        })

        it('rejects an occurrence that is already recurring (CONFLICT)', async () => {
            const user = await createTestUser()
            const caller = getCaller(user.id)
            const { occurrences } = await caller.expenses.create({
                amount: 40,
                description: 'academia',
                purchaseDate: todayISO,
                type: 'recurring',
                frequency: 'monthly',
            })

            await expect(
                caller.occurrences.convertToRecurring({ id: occurrences[0].id, frequency: 'yearly' }),
            ).rejects.toMatchObject({ code: 'CONFLICT' })
        })

        it('rejects an occurrence belonging to a different user (NOT_FOUND)', async () => {
            const owner = await createTestUser()
            const attacker = await createTestUser()
            const { occurrences } = await getCaller(owner.id).expenses.create({
                amount: 40,
                description: 'academia',
                purchaseDate: todayISO,
                type: 'single',
            })

            await expect(
                getCaller(attacker.id).occurrences.convertToRecurring({ id: occurrences[0].id, frequency: 'monthly' }),
            ).rejects.toMatchObject({ code: 'NOT_FOUND' })
        })
    })

    describe('recurrences.get', () => {
        it('rejects a recurrence belonging to a different user (NOT_FOUND)', async () => {
            const owner = await createTestUser()
            const attacker = await createTestUser()
            const { occurrences } = await getCaller(owner.id).expenses.create({
                amount: 40,
                description: 'academia',
                purchaseDate: todayISO,
                type: 'recurring',
                frequency: 'monthly',
            })

            await expect(getCaller(attacker.id).recurrences.get({ id: occurrences[0].recurrenceId! })).rejects.toMatchObject({
                code: 'NOT_FOUND',
            })
        })
    })

    describe('recurrences.update', () => {
        it('changes the frequency and regenerates future occurrences, leaving the past one untouched', async () => {
            const user = await createTestUser()
            const caller = getCaller(user.id)
            const purchase = todayAt(-1)
            const { occurrences } = await caller.expenses.create({
                amount: 40,
                description: 'academia',
                purchaseDate: toISODate(purchase),
                type: 'recurring',
                frequency: 'monthly',
            })
            const recurrenceId = occurrences[0].recurrenceId!

            await caller.recurrences.update({ id: recurrenceId, data: { frequency: 'yearly' } })

            const list = (await caller.occurrences.list({})).filter((o) => o.recurrenceId === recurrenceId)
            const expectedDates = generateRecurrenceOccurrences(purchase, 'yearly', horizon, null)
            expect(list.map((o) => o.occurrenceDate).sort()).toEqual(expectedDates.sort())
            expect(list.every((o) => o.description === 'academia' && Number(o.amount) === 40)).toBe(true)
        })
    })

    describe('recurrences.setActive', () => {
        it('pausing deletes future pending occurrences but keeps past ones', async () => {
            const user = await createTestUser()
            const caller = getCaller(user.id)
            const purchase = todayAt(-1)
            const { occurrences } = await caller.expenses.create({
                amount: 40,
                description: 'academia',
                purchaseDate: toISODate(purchase),
                type: 'recurring',
                frequency: 'monthly',
            })
            const recurrenceId = occurrences[0].recurrenceId!

            await caller.recurrences.setActive({ id: recurrenceId, active: false })

            const list = (await caller.occurrences.list({})).filter((o) => o.recurrenceId === recurrenceId)
            expect(list.map((o) => o.occurrenceDate)).toEqual([toISODate(purchase)])
        })

        it('resuming regenerates future occurrences from the original schedule', async () => {
            const user = await createTestUser()
            const caller = getCaller(user.id)
            const purchase = todayAt(-1)
            const { occurrences } = await caller.expenses.create({
                amount: 40,
                description: 'academia',
                purchaseDate: toISODate(purchase),
                type: 'recurring',
                frequency: 'monthly',
            })
            const recurrenceId = occurrences[0].recurrenceId!
            await caller.recurrences.setActive({ id: recurrenceId, active: false })

            await caller.recurrences.setActive({ id: recurrenceId, active: true })

            const list = (await caller.occurrences.list({})).filter((o) => o.recurrenceId === recurrenceId)
            const expectedDates = generateRecurrenceOccurrences(purchase, 'monthly', horizon, null)
            expect(list.map((o) => o.occurrenceDate).sort()).toEqual(expectedDates.sort())
        })

        it('resuming regenerates correctly even when pausing had deleted every occurrence (no past charge yet)', async () => {
            const user = await createTestUser()
            const caller = getCaller(user.id)
            const { occurrences } = await caller.expenses.create({
                amount: 40,
                description: 'academia',
                purchaseDate: todayISO,
                type: 'recurring',
                frequency: 'monthly',
            })
            const recurrenceId = occurrences[0].recurrenceId!
            await caller.recurrences.setActive({ id: recurrenceId, active: false })
            expect((await caller.occurrences.list({})).filter((o) => o.recurrenceId === recurrenceId)).toEqual([])

            await caller.recurrences.setActive({ id: recurrenceId, active: true })

            const list = (await caller.occurrences.list({})).filter((o) => o.recurrenceId === recurrenceId)
            const expectedDates = generateRecurrenceOccurrences(today, 'monthly', horizon, null)
            expect(list.map((o) => o.occurrenceDate).sort()).toEqual(expectedDates.sort())
            expect(list.every((o) => o.description === 'academia' && Number(o.amount) === 40)).toBe(true)
        })
    })
})
