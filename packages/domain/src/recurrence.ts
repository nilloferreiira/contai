import { toISODate } from './date'

export type Frequency = 'weekly' | 'monthly' | 'yearly'

export function generateRecurrenceOccurrences(
    startDate: Date,
    frequency: Frequency,
    untilDate: Date,
    endDate?: Date | null,
): string[] {
    const limit = endDate && endDate.getTime() < untilDate.getTime() ? endDate : untilDate
    const occurrences: string[] = []
    let current = new Date(startDate)

    while (toISODate(current) <= toISODate(limit)) {
        occurrences.push(toISODate(current))
        current = advance(current, frequency)
    }

    return occurrences
}

function advance(date: Date, frequency: Frequency): Date {
    if (frequency === 'weekly') return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7)
    if (frequency === 'monthly') return new Date(date.getFullYear(), date.getMonth() + 1, date.getDate())
    return new Date(date.getFullYear() + 1, date.getMonth(), date.getDate())
}
