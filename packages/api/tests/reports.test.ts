import { afterEach, describe, expect, it } from 'vitest'
import { createTestUser, getCaller, truncateAll } from './helpers'

describe('reports router — summary', () => {
    afterEach(async () => {
        await truncateAll()
    })

    it('aggregates totals by category and card for the given invoice month, excluding cancelled', async () => {
        const user = await createTestUser()
        const caller = getCaller(user.id)
        const card = await caller.cards.create({ name: 'Nubank', closingDay: 28, dueDay: 5, color: '#820ad1' })
        const category = await caller.categories.create({ name: 'Pets' })

        const kept = await caller.expenses.create({
            amount: 40,
            description: 'ração',
            purchaseDate: '2026-09-01',
            type: 'single',
            categoryId: category.id,
            cardId: card.id,
        })
        const cancelled = await caller.expenses.create({
            amount: 999,
            description: 'estorno',
            purchaseDate: '2026-09-02',
            type: 'single',
            categoryId: category.id,
            cardId: card.id,
        })
        await caller.occurrences.update({
            id: cancelled.occurrences[0].id,
            scope: 'occurrence',
            data: { status: 'cancelled' },
        })

        const month = kept.occurrences[0].invoiceMonth
        const summary = await caller.reports.summary({ month })

        expect(summary.total).toBe(40)
        expect(summary.byCategory[category.id]).toBe(40)
        expect(summary.byCard[card.id]).toBe(40)
    })

    it('only aggregates the caller-owned occurrences for that month', async () => {
        const owner = await createTestUser()
        const other = await createTestUser()

        const ownerExpense = await getCaller(owner.id).expenses.create({
            amount: 40,
            description: 'mercado',
            purchaseDate: '2026-09-01',
            type: 'single',
        })
        await getCaller(other.id).expenses.create({
            amount: 500,
            description: "other's expense",
            purchaseDate: '2026-09-01',
            type: 'single',
        })

        const month = ownerExpense.occurrences[0].invoiceMonth
        const summary = await getCaller(owner.id).reports.summary({ month })

        expect(summary.total).toBe(40)
    })
})
