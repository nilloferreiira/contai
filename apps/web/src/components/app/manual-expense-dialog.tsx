'use client'

import { useMemo } from 'react'
import { toISODate, type CreateExpenseInput, type ParsedExpense } from '@contai/domain'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ExpenseForm } from '@/components/forms/expense-form'

export interface ManualExpenseDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initial?: ParsedExpense | null
    onSaved?: () => void
}

export function ManualExpenseDialog({ open, onOpenChange, initial, onSaved }: ManualExpenseDialogProps) {
    const defaultValues = useMemo<Partial<CreateExpenseInput> | undefined>(() => {
        if (!initial) return undefined
        const values: Partial<CreateExpenseInput> = {
            amount: initial.amount ?? 0,
            description: initial.merchantName ?? '',
            purchaseDate: toISODate(initial.purchaseDate),
            type: initial.frequency ? 'recurring' : (initial.installments ?? 1) > 1 ? 'installment' : 'single',
        }
        if (initial.merchantName) values.merchantName = initial.merchantName
        if (initial.categoryId) values.categoryId = initial.categoryId
        if (initial.cardId) values.cardId = initial.cardId
        if (initial.installments && initial.installments > 1) values.installments = initial.installments
        if (initial.frequency) values.frequency = initial.frequency
        return values
    }, [initial])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto rounded-3xl sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Nova despesa</DialogTitle>
                </DialogHeader>
                <ExpenseForm
                    key={open ? 'open' : 'closed'}
                    defaultValues={defaultValues}
                    onSuccess={() => {
                        onSaved?.()
                        onOpenChange(false)
                    }}
                />
            </DialogContent>
        </Dialog>
    )
}
