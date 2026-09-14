// toISODate/fromISODate are a matched pair and the only sanctioned way to move
// a calendar date (YYYY-MM-DD, no time-of-day meaning) in or out of a Date in
// this codebase. Every Date this module and its siblings (invoice.ts,
// installments.ts, recurrence.ts) touch is built via `new Date(y, m, d)` and
// read via local getters (getFullYear/getMonth/getDate) — that pairing
// round-trips correctly in any host timezone. `new Date(someISOString)` is NOT
// interchangeable with `new Date(y, m, d)`: the bare string constructor parses
// a date-only string as UTC midnight per spec, so reading it back with local
// getters silently drifts by a day on any non-UTC host. This was a real,
// shipped bug (fixed by introducing fromISODate) — see
// packages/api/src/services/expenses-service.ts's use of fromISODate for the
// call-site history. Always parse a caller-supplied YYYY-MM-DD string with
// fromISODate, never with `new Date(str)`.
export function toISODate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function fromISODate(dateString: string): Date {
    const [year, month, day] = dateString.split('-').map(Number)
    return new Date(year, month - 1, day)
}

export function monthKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
}

export function clampDay(monthStart: Date, day: number): Date {
    const year = monthStart.getFullYear()
    const month = monthStart.getMonth()
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
    return new Date(year, month, Math.min(day, lastDayOfMonth))
}

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function monthLabel(date: Date): string {
    return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}
