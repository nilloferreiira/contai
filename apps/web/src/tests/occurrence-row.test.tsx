import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { toISODate } from '@contai/domain'
import { OccurrenceRow, type OccurrenceRowProps } from '@/components/app/occurrence-row'

function makeOccurrence(
    occurrenceDate: string,
    status: 'pending' | 'paid' | 'cancelled' = 'pending',
): OccurrenceRowProps['occurrence'] {
    return {
        id: 'occ-1',
        userId: 'user-1',
        expenseId: 'exp-1',
        installmentPlanId: null,
        recurrenceId: null,
        merchantId: null,
        categoryId: null,
        cardId: null,
        description: 'Padaria',
        installmentNumber: null,
        installmentsTotal: null,
        amount: '25.00',
        occurrenceDate,
        dueDate: occurrenceDate,
        invoiceMonth: occurrenceDate.slice(0, 7),
        status,
        deletedAt: null,
        createdAt: new Date(),
    } as unknown as OccurrenceRowProps['occurrence']
}

describe('OccurrenceRow previsto badge', () => {
    it('does not mark a past pending occurrence as previsto', () => {
        render(<OccurrenceRow occurrence={makeOccurrence('2020-01-01')} onClick={() => {}} />)
        expect(screen.queryByText('Previsto')).toBeNull()
    })

    it('does not mark today\'s pending occurrence as previsto', () => {
        const today = toISODate(new Date())
        render(<OccurrenceRow occurrence={makeOccurrence(today)} onClick={() => {}} />)
        expect(screen.queryByText('Previsto')).toBeNull()
    })

    it('marks a future pending occurrence as previsto', () => {
        render(<OccurrenceRow occurrence={makeOccurrence('2999-01-01')} onClick={() => {}} />)
        expect(screen.queryByText('Previsto')).not.toBeNull()
    })

    it('does not mark a cancelled future occurrence as previsto', () => {
        render(
            <OccurrenceRow
                occurrence={makeOccurrence('2999-01-01', 'cancelled')}
                onClick={() => {}}
            />,
        )
        expect(screen.queryByText('Previsto')).toBeNull()
    })
})
