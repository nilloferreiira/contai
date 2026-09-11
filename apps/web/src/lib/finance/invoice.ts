import { clampDay, monthKey } from './date'

export interface CardCycle {
    closing_day: number
    due_day: number
}

export function getInvoiceForExpense(purchaseDate: Date, card: CardCycle | null) {
    if (!card) {
        return { month: monthKey(purchaseDate), dueDate: purchaseDate }
    }

    const afterClosing = purchaseDate.getDate() > card.closing_day
    const base = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + (afterClosing ? 1 : 0), 1)
    const dueDate = clampDay(base, card.due_day)

    return { month: monthKey(base), dueDate }
}
