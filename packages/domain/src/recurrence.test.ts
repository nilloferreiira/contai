import { describe, expect, it } from 'vitest'
import { generateRecurrenceOccurrences } from './recurrence'

describe('generateRecurrenceOccurrences', () => {
    it('includes the start date itself', () => {
        const result = generateRecurrenceOccurrences(new Date(2026, 0, 1), 'monthly', new Date(2026, 0, 1))
        expect(result).toEqual(['2026-01-01'])
    })

    it('generates monthly occurrences up to the until date', () => {
        const result = generateRecurrenceOccurrences(new Date(2026, 0, 15), 'monthly', new Date(2026, 3, 15))
        expect(result).toEqual(['2026-01-15', '2026-02-15', '2026-03-15', '2026-04-15'])
    })

    it('generates weekly occurrences by calendar date, not by elapsed hours', () => {
        const result = generateRecurrenceOccurrences(new Date(2026, 0, 1), 'weekly', new Date(2026, 0, 22))
        expect(result).toEqual(['2026-01-01', '2026-01-08', '2026-01-15', '2026-01-22'])
    })

    it('stops at an explicit end date even if before the until date', () => {
        const result = generateRecurrenceOccurrences(new Date(2026, 0, 1), 'monthly', new Date(2026, 5, 1), new Date(2026, 1, 15))
        expect(result).toEqual(['2026-01-01', '2026-02-01'])
    })
})
