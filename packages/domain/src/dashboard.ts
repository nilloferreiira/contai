import { monthKey, toISODate } from './date'

export interface Occurrence {
    amount: number
    category_id: string | null
    card_id: string | null
    status: 'pending' | 'paid' | 'cancelled'
    recurrence_id?: string | null
    installments_total?: number | null
    occurrence_date?: string
    due_date?: string
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

export function isForecast(occurrence: Occurrence, today: Date = new Date()): boolean {
    if (!occurrence.occurrence_date) return false
    return occurrence.occurrence_date > toISODate(today)
}

export interface RealizedForecastSplit {
    realized: number
    forecast: number
    total: number
}

export function splitRealizedForecast(occurrences: Occurrence[], today: Date = new Date()): RealizedForecastSplit {
    let realized = 0
    let forecast = 0
    for (const o of occurrences) {
        if (o.status === 'cancelled') continue
        if (isForecast(o, today)) forecast += o.amount
        else realized += o.amount
    }
    return { realized, forecast, total: realized + forecast }
}

export interface TypeBreakdown {
    invoicesTotal: number
    recurringTotal: number
    installmentsTotal: number
}

export function breakdownByType(occurrences: Occurrence[]): TypeBreakdown {
    let invoicesTotal = 0
    let recurringTotal = 0
    let installmentsTotal = 0
    for (const o of occurrences) {
        if (o.status === 'cancelled') continue
        if (o.card_id) invoicesTotal += o.amount
        if (o.recurrence_id) recurringTotal += o.amount
        if (o.installments_total && o.installments_total > 1) installmentsTotal += o.amount
    }
    return { invoicesTotal, recurringTotal, installmentsTotal }
}

export interface AmountSlice {
    id: string
    total: number
}

export function byCategoryTotals(occurrences: Occurrence[]): AmountSlice[] {
    const map = new Map<string, number>()
    for (const o of occurrences) {
        if (o.status === 'cancelled') continue
        const key = o.category_id ?? 'none'
        map.set(key, (map.get(key) ?? 0) + o.amount)
    }
    return [...map.entries()].map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total)
}

export function byCardTotals(occurrences: Occurrence[]): AmountSlice[] {
    const map = new Map<string, number>()
    for (const o of occurrences) {
        if (o.status === 'cancelled') continue
        const key = o.card_id ?? 'none'
        map.set(key, (map.get(key) ?? 0) + o.amount)
    }
    return [...map.entries()].map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total)
}

export interface UpcomingInvoice {
    cardId: string
    total: number
    realizedTotal: number
    forecastTotal: number
    dueDate: string
}

export function upcomingInvoices(occurrences: Occurrence[], from: Date, today: Date = new Date()): UpcomingInvoice[] {
    const fromISO = toISODate(from)
    const map = new Map<string, { total: number; realized: number; forecast: number; dueDate: string }>()
    for (const o of occurrences) {
        if (!o.card_id || o.status !== 'pending' || !o.due_date || !o.occurrence_date) continue
        if (o.due_date < fromISO) continue
        const monthOfDue = o.due_date.slice(0, 7)
        const key = `${o.card_id}|${monthOfDue}`
        const entry = map.get(key) ?? { total: 0, realized: 0, forecast: 0, dueDate: o.due_date }
        entry.total += o.amount
        if (isForecast(o, today)) entry.forecast += o.amount
        else entry.realized += o.amount
        if (o.due_date < entry.dueDate) entry.dueDate = o.due_date
        map.set(key, entry)
    }
    return [...map.entries()]
        .map(([key, value]) => ({
            cardId: key.split('|')[0] ?? '',
            total: value.total,
            realizedTotal: value.realized,
            forecastTotal: value.forecast,
            dueDate: value.dueDate,
        }))
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export interface MonthForecast {
    key: string
    total: number
}

export function monthlyForecast(occurrences: Occurrence[], from: Date, months: number): MonthForecast[] {
    const keys: string[] = []
    for (let i = 0; i < months; i++) {
        keys.push(monthKey(new Date(from.getFullYear(), from.getMonth() + i, 1)))
    }
    const totals = new Map<string, number>(keys.map((k) => [k, 0]))
    for (const o of occurrences) {
        if (o.status === 'cancelled' || !o.occurrence_date) continue
        const key = o.occurrence_date.slice(0, 7)
        if (!totals.has(key)) continue
        totals.set(key, (totals.get(key) ?? 0) + o.amount)
    }
    return keys.map((key) => ({ key, total: totals.get(key) ?? 0 }))
}
