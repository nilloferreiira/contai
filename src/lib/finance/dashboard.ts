export interface Occurrence {
    amount: number
    category_id: string | null
    card_id: string | null
    status: 'pending' | 'paid' | 'cancelled'
}

export function summarizeMonth(occurrences: Occurrence[]) {
    const active = occurrences.filter((o) => o.status !== 'cancelled')

    const total = active.reduce((sum, o) => sum + o.amount, 0)

    const byCategory: Record<string, number> = {}
    const byCard: Record<string, number> = {}

    for (const occurrence of active) {
        if (occurrence.category_id) {
            byCategory[occurrence.category_id] = (byCategory[occurrence.category_id] ?? 0) + occurrence.amount
        }
        if (occurrence.card_id) {
            byCard[occurrence.card_id] = (byCard[occurrence.card_id] ?? 0) + occurrence.amount
        }
    }

    return { total, byCategory, byCard }
}
