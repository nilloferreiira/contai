import { describe, expect, it } from 'vitest'
import { summarizeMonth, type Occurrence } from '../src/dashboard'

const occurrences: Occurrence[] = [
    { amount: 100, category_id: 'cat-1', card_id: 'card-1', status: 'pending' },
    { amount: 50, category_id: 'cat-1', card_id: 'card-2', status: 'paid' },
    { amount: 30, category_id: 'cat-2', card_id: 'card-1', status: 'pending' },
    { amount: 20, category_id: null, card_id: null, status: 'cancelled' },
]

describe('summarizeMonth', () => {
    it('sums the total excluding cancelled occurrences', () => {
        expect(summarizeMonth(occurrences).total).toBe(180)
    })

    it('groups by category excluding cancelled', () => {
        expect(summarizeMonth(occurrences).byCategory).toEqual({ 'cat-1': 150, 'cat-2': 30 })
    })

    it('groups by card excluding cancelled', () => {
        expect(summarizeMonth(occurrences).byCard).toEqual({ 'card-1': 130, 'card-2': 50 })
    })
})
