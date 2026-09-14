import { afterEach, describe, expect, it } from 'vitest'
import { createTestUser, getCaller, truncateAll } from './helpers'

describe('expenses router — createExpense', () => {
    afterEach(async () => {
        await truncateAll()
    })

    it('single expense: creates one occurrence on the purchase date', async () => {
        const user = await createTestUser()
        const { occurrences } = await getCaller(user.id).expenses.create({
            amount: 50,
            description: 'mercado',
            purchaseDate: '2026-09-09',
            type: 'single',
        })

        expect(occurrences).toHaveLength(1)
        expect(occurrences[0].occurrenceDate).toBe('2026-09-09')
        expect(Number(occurrences[0].amount)).toBe(50)
    })

    it('installment expense: splits into N occurrences — first on purchase day, rest on the 1st of following months', async () => {
        // Matches @contai/domain's generateInstallments contract (see its own
        // installments.test.ts): only installment 1 anchors to the purchase day;
        // installments 2..N anchor to the 1st of each following month.
        const user = await createTestUser()
        const { occurrences } = await getCaller(user.id).expenses.create({
            amount: 300,
            description: 'geladeira',
            purchaseDate: '2026-09-09',
            type: 'installment',
            installments: 3,
        })

        expect(occurrences).toHaveLength(3)
        expect(occurrences.map((o) => o.installmentNumber)).toEqual([1, 2, 3])
        expect(occurrences.map((o) => o.occurrenceDate)).toEqual(['2026-09-09', '2026-10-01', '2026-11-01'])
        expect(occurrences.every((o) => o.installmentsTotal === 3)).toBe(true)
    })

    it('recurring expense: generates one occurrence per period up to 12 months out', async () => {
        const user = await createTestUser()
        const { occurrences } = await getCaller(user.id).expenses.create({
            amount: 40,
            description: 'academia',
            purchaseDate: '2026-09-09',
            type: 'recurring',
            frequency: 'monthly',
        })

        expect(occurrences).toHaveLength(13)
        expect(occurrences[0].occurrenceDate).toBe('2026-09-09')
        expect(occurrences[occurrences.length - 1].occurrenceDate).toBe('2027-09-09')
    })

    it('recurring expense: respects an endDate earlier than the 12-month window', async () => {
        const user = await createTestUser()
        const { occurrences } = await getCaller(user.id).expenses.create({
            amount: 40,
            description: 'assinatura',
            purchaseDate: '2026-09-09',
            type: 'recurring',
            frequency: 'monthly',
            endDate: '2026-11-09',
        })

        expect(occurrences.map((o) => o.occurrenceDate)).toEqual(['2026-09-09', '2026-10-09', '2026-11-09'])
    })

    it('rejects a cardId that does not belong to the caller', async () => {
        const owner = await createTestUser()
        const attacker = await createTestUser()
        const card = await getCaller(owner.id).cards.create({
            name: 'Nubank',
            closingDay: 5,
            dueDay: 12,
            color: '#820ad1',
        })

        await expect(
            getCaller(attacker.id).expenses.create({
                amount: 50,
                description: 'mercado',
                purchaseDate: '2026-09-09',
                type: 'single',
                cardId: card.id,
            }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('rejects a categoryId that does not belong to the caller', async () => {
        const owner = await createTestUser()
        const attacker = await createTestUser()
        const category = await getCaller(owner.id).categories.create({ name: 'Pets' })

        await expect(
            getCaller(attacker.id).expenses.create({
                amount: 50,
                description: 'mercado',
                purchaseDate: '2026-09-09',
                type: 'single',
                categoryId: category.id,
            }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('never leaves a dangling foreign-tenant cardId on the created expense occurrence', async () => {
        // Regression guard for the final-review finding: a rejected cardId must not
        // partially persist — the whole transaction rolls back.
        const owner = await createTestUser()
        const attacker = await createTestUser()
        const card = await getCaller(owner.id).cards.create({
            name: 'Nubank',
            closingDay: 5,
            dueDay: 12,
            color: '#820ad1',
        })

        await expect(
            getCaller(attacker.id).expenses.create({
                amount: 50,
                description: 'mercado',
                purchaseDate: '2026-09-09',
                type: 'single',
                cardId: card.id,
            }),
        ).rejects.toBeTruthy()

        expect(await getCaller(attacker.id).occurrences.list({})).toEqual([])
    })

    it('produces the same occurrenceDate/invoiceMonth regardless of the host process timezone', async () => {
        const originalTz = process.env.TZ

        try {
            process.env.TZ = 'UTC'
            const utcUser = await createTestUser()
            const { occurrences: utcOccurrences } = await getCaller(utcUser.id).expenses.create({
                amount: 50,
                description: 'compra à noite',
                purchaseDate: '2026-03-15',
                type: 'single',
            })

            process.env.TZ = 'America/Sao_Paulo'
            const brUser = await createTestUser()
            const { occurrences: brOccurrences } = await getCaller(brUser.id).expenses.create({
                amount: 50,
                description: 'compra à noite',
                purchaseDate: '2026-03-15',
                type: 'single',
            })

            expect(brOccurrences[0].occurrenceDate).toBe(utcOccurrences[0].occurrenceDate)
            expect(brOccurrences[0].occurrenceDate).toBe('2026-03-15')
            expect(brOccurrences[0].invoiceMonth).toBe(utcOccurrences[0].invoiceMonth)
        } finally {
            process.env.TZ = originalTz
        }
    })
})
