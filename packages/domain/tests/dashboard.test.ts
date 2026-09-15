import { describe, expect, it } from 'vitest'
import {
    breakdownByType,
    byCardTotals,
    byCategoryTotals,
    isForecast,
    monthlyForecast,
    splitRealizedForecast,
    summarizeMonth,
    upcomingInvoices,
    type Occurrence,
} from '../src/dashboard'

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

describe('isForecast', () => {
    const today = new Date(2026, 8, 15)

    it('returns true when occurrence_date is after today', () => {
        expect(isForecast({ amount: 10, category_id: null, card_id: null, status: 'pending', occurrence_date: '2026-09-20' }, today)).toBe(true)
    })

    it('returns false when occurrence_date is today or earlier', () => {
        expect(isForecast({ amount: 10, category_id: null, card_id: null, status: 'pending', occurrence_date: '2026-09-15' }, today)).toBe(false)
        expect(isForecast({ amount: 10, category_id: null, card_id: null, status: 'pending', occurrence_date: '2026-09-10' }, today)).toBe(false)
    })

    it('returns false when occurrence_date is missing', () => {
        expect(isForecast({ amount: 10, category_id: null, card_id: null, status: 'pending' }, today)).toBe(false)
    })
})

describe('splitRealizedForecast', () => {
    const today = new Date(2026, 8, 15)
    const split: Occurrence[] = [
        { amount: 100, category_id: null, card_id: null, status: 'paid', occurrence_date: '2026-09-10' },
        { amount: 50, category_id: null, card_id: null, status: 'pending', occurrence_date: '2026-09-20' },
        { amount: 999, category_id: null, card_id: null, status: 'cancelled', occurrence_date: '2026-09-05' },
    ]

    it('splits realized vs forecast excluding cancelled', () => {
        expect(splitRealizedForecast(split, today)).toEqual({ realized: 100, forecast: 50, total: 150 })
    })

    it('returns zeros for empty input', () => {
        expect(splitRealizedForecast([], today)).toEqual({ realized: 0, forecast: 0, total: 0 })
    })
})

describe('breakdownByType', () => {
    it('totals invoices, recurring, and installments excluding cancelled', () => {
        const input: Occurrence[] = [
            { amount: 100, category_id: null, card_id: 'card-1', status: 'pending' },
            { amount: 50, category_id: null, card_id: null, status: 'pending', recurrence_id: 'rec-1' },
            { amount: 30, category_id: null, card_id: null, status: 'pending', installments_total: 3 },
            { amount: 20, category_id: null, card_id: null, status: 'pending', installments_total: 1 },
            { amount: 999, category_id: null, card_id: 'card-1', status: 'cancelled' },
        ]
        expect(breakdownByType(input)).toEqual({ invoicesTotal: 100, recurringTotal: 50, installmentsTotal: 30 })
    })

    it('returns zeros for empty input', () => {
        expect(breakdownByType([])).toEqual({ invoicesTotal: 0, recurringTotal: 0, installmentsTotal: 0 })
    })
})

describe('byCategoryTotals', () => {
    it('groups by category excluding cancelled, sorted descending', () => {
        expect(byCategoryTotals(occurrences)).toEqual([
            { id: 'cat-1', total: 150 },
            { id: 'cat-2', total: 30 },
        ])
    })

    it('returns an empty array for empty input', () => {
        expect(byCategoryTotals([])).toEqual([])
    })
})

describe('byCardTotals', () => {
    it('groups by card excluding cancelled, sorted descending', () => {
        expect(byCardTotals(occurrences)).toEqual([
            { id: 'card-1', total: 130 },
            { id: 'card-2', total: 50 },
        ])
    })

    it('returns an empty array for empty input', () => {
        expect(byCardTotals([])).toEqual([])
    })
})

describe('upcomingInvoices', () => {
    const today = new Date(2026, 8, 15)
    const from = new Date(2026, 8, 1)

    it('groups pending card occurrences by card and due month, splitting realized/forecast', () => {
        const input: Occurrence[] = [
            { amount: 100, category_id: null, card_id: 'card-1', status: 'pending', occurrence_date: '2026-09-05', due_date: '2026-09-10' },
            { amount: 50, category_id: null, card_id: 'card-1', status: 'pending', occurrence_date: '2026-09-20', due_date: '2026-09-10' },
            { amount: 999, category_id: null, card_id: 'card-1', status: 'paid', occurrence_date: '2026-09-01', due_date: '2026-09-10' },
        ]
        expect(upcomingInvoices(input, from, today)).toEqual([
            { cardId: 'card-1', total: 150, realizedTotal: 100, forecastTotal: 50, dueDate: '2026-09-10' },
        ])
    })

    it('excludes occurrences with due_date before from', () => {
        const input: Occurrence[] = [
            { amount: 100, category_id: null, card_id: 'card-1', status: 'pending', occurrence_date: '2026-08-05', due_date: '2026-08-10' },
        ]
        expect(upcomingInvoices(input, from, today)).toEqual([])
    })

    it('returns an empty array for empty input', () => {
        expect(upcomingInvoices([], from, today)).toEqual([])
    })
})

describe('monthlyForecast', () => {
    it('totals amounts per month over the requested window, excluding cancelled', () => {
        const input: Occurrence[] = [
            { amount: 100, category_id: null, card_id: null, status: 'pending', occurrence_date: '2026-09-05' },
            { amount: 50, category_id: null, card_id: null, status: 'pending', occurrence_date: '2026-10-05' },
            { amount: 999, category_id: null, card_id: null, status: 'cancelled', occurrence_date: '2026-09-10' },
            { amount: 10, category_id: null, card_id: null, status: 'pending', occurrence_date: '2026-12-05' },
        ]
        expect(monthlyForecast(input, new Date(2026, 8, 1), 3)).toEqual([
            { key: '2026-09', total: 100 },
            { key: '2026-10', total: 50 },
            { key: '2026-11', total: 0 },
        ])
    })

    it('returns zero-total months for empty input', () => {
        expect(monthlyForecast([], new Date(2026, 8, 1), 2)).toEqual([
            { key: '2026-09', total: 0 },
            { key: '2026-10', total: 0 },
        ])
    })
})
