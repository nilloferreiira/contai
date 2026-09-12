import { describe, expect, it } from 'vitest'
import { getInvoiceForExpense, type CardCycle } from '../src/invoice'
import { toISODate } from '../src/date'

const card: CardCycle = { closing_day: 10, due_day: 20 }

describe('getInvoiceForExpense', () => {
    it('assigns a purchase before closing to the current month invoice', () => {
        const result = getInvoiceForExpense(new Date(2026, 2, 5), card) // March 5, closes on 10th
        expect(result.month).toBe('2026-03')
        expect(toISODate(result.dueDate)).toBe('2026-03-20')
    })

    it('assigns a purchase after closing to the next month invoice', () => {
        const result = getInvoiceForExpense(new Date(2026, 2, 15), card) // March 15, after closing
        expect(result.month).toBe('2026-04')
        expect(toISODate(result.dueDate)).toBe('2026-04-20')
    })

    it('rolls over the year when the purchase is in December after closing', () => {
        const result = getInvoiceForExpense(new Date(2026, 11, 15), card) // Dec 15
        expect(result.month).toBe('2027-01')
        expect(toISODate(result.dueDate)).toBe('2027-01-20')
    })

    it('falls back to the purchase month with no card', () => {
        const result = getInvoiceForExpense(new Date(2026, 2, 15), null)
        expect(result.month).toBe('2026-03')
        expect(toISODate(result.dueDate)).toBe('2026-03-15')
    })
})
