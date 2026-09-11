import { describe, expect, it } from 'vitest'
import { generateInstallments } from '@/lib/finance/installments'
import type { CardCycle } from '@/lib/finance/invoice'

const card: CardCycle = { closing_day: 10, due_day: 20 }

describe('generateInstallments', () => {
    it('anchors each installment to purchase-month + i, not the due date', () => {
        // Purchase on March 15 (after closing) in 3x — must NOT skip April.
        const result = generateInstallments(300, 3, new Date(2026, 2, 15), card)
        expect(result.map((r) => r.occurrence_date)).toEqual(['2026-03-15', '2026-04-01', '2026-05-01'])
        expect(result.map((r) => r.invoice_month)).toEqual(['2026-04', '2026-05', '2026-06'])
    })

    it('distributes remainder cents across the first installments', () => {
        const result = generateInstallments(100, 3, new Date(2026, 0, 1), card)
        expect(result.map((r) => r.amount)).toEqual([33.34, 33.33, 33.33])
        expect(result.reduce((sum, r) => sum + r.amount, 0)).toBeCloseTo(100, 2)
    })

    it('numbers installments starting at 1', () => {
        const result = generateInstallments(200, 2, new Date(2026, 5, 1), card)
        expect(result.map((r) => r.installment_number)).toEqual([1, 2])
        expect(result.every((r) => r.installments_total === 2)).toBe(true)
    })
})
