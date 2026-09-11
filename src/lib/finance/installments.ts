import { getInvoiceForExpense, type CardCycle } from './invoice'
import { toISODate, monthKey, clampDay } from './date'

export interface InstallmentOccurrence {
    installment_number: number
    installments_total: number
    amount: number
    occurrence_date: string
    due_date: string
    invoice_month: string
}

export function generateInstallments(
    total: number,
    count: number,
    purchaseDate: Date,
    card: CardCycle | null,
): InstallmentOccurrence[] {
    const cents = Math.round(total * 100)
    const base = Math.floor(cents / count)
    const rest = cents - base * count

    // The first installment's invoice is derived from the card's closing
    // day; subsequent installments ride the following invoices in sequence
    // (not re-derived from a day-1 anchor, which would misclassify them as
    // "before closing" and collapse into the same invoice month).
    const firstInvoice = getInvoiceForExpense(purchaseDate, card)
    const [firstYear, firstMonthNum] = firstInvoice.month.split('-').map(Number)

    return Array.from({ length: count }, (_, i) => {
        const anchor = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth() + i, i === 0 ? purchaseDate.getDate() : 1)

        let invoiceMonth: string
        let dueDate: Date
        if (card) {
            const invoiceMonthStart = new Date(firstYear, firstMonthNum - 1 + i, 1)
            invoiceMonth = monthKey(invoiceMonthStart)
            dueDate = clampDay(invoiceMonthStart, card.due_day)
        } else {
            invoiceMonth = monthKey(anchor)
            dueDate = anchor
        }

        return {
            installment_number: i + 1,
            installments_total: count,
            amount: (base + (i < rest ? 1 : 0)) / 100,
            occurrence_date: toISODate(anchor),
            due_date: toISODate(dueDate),
            invoice_month: invoiceMonth,
        }
    })
}
