import { afterEach, describe, expect, it } from 'vitest'
import { toISODate, monthKey, clampDay, fromISODate, monthLabel } from '../src/date'

describe('toISODate', () => {
    it('formats a date as YYYY-MM-DD ignoring time', () => {
        expect(toISODate(new Date(2026, 2, 5, 23, 59))).toBe('2026-03-05')
    })
})

describe('fromISODate', () => {
    const originalTz = process.env.TZ

    afterEach(() => {
        process.env.TZ = originalTz
    })

    it('parses a YYYY-MM-DD string to a local-midnight Date matching those components', () => {
        const result = fromISODate('2026-09-09')
        expect(result.getFullYear()).toBe(2026)
        expect(result.getMonth()).toBe(8) // 0-indexed
        expect(result.getDate()).toBe(9)
    })

    it('round-trips through toISODate unchanged, regardless of the host timezone', () => {
        // This is the actual regression this function exists to prevent: a bare
        // `new Date('2026-09-09')` parses as UTC midnight, which toISODate's local
        // getters then read back as the previous day on any negative-UTC-offset
        // host (e.g. America/Sao_Paulo, this app's target market).
        process.env.TZ = 'America/Sao_Paulo'
        expect(toISODate(fromISODate('2026-09-09'))).toBe('2026-09-09')

        process.env.TZ = 'UTC'
        expect(toISODate(fromISODate('2026-09-09'))).toBe('2026-09-09')

        process.env.TZ = 'Pacific/Kiritimati' // UTC+14, for the opposite direction
        expect(toISODate(fromISODate('2026-09-09'))).toBe('2026-09-09')
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

describe('monthLabel', () => {
    it('formats a date as lowercase Portuguese month name and year', () => {
        expect(monthLabel(new Date(2026, 8, 9))).toBe('setembro 2026')
    })

    it('handles the first month of the year', () => {
        expect(monthLabel(new Date(2026, 0, 1))).toBe('janeiro 2026')
    })
})
