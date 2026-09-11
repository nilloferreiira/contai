import { describe, expect, it } from 'vitest'
import { toISODate, monthKey, clampDay } from '@/lib/finance/date'

describe('toISODate', () => {
    it('formats a date as YYYY-MM-DD ignoring time', () => {
        expect(toISODate(new Date(2026, 2, 5, 23, 59))).toBe('2026-03-05')
    })
})

describe('monthKey', () => {
    it('formats a date as YYYY-MM', () => {
        expect(monthKey(new Date(2026, 0, 15))).toBe('2026-01')
    })
})

describe('clampDay', () => {
    it('clamps day 31 to the last day of a 30-day month', () => {
        const result = clampDay(new Date(2026, 3, 1), 31) // April has 30 days
        expect(toISODate(result)).toBe('2026-04-30')
    })

    it('keeps the day when it fits in the month', () => {
        const result = clampDay(new Date(2026, 2, 1), 15)
        expect(toISODate(result)).toBe('2026-03-15')
    })
})
