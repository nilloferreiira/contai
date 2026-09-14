'use client'

import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { parseExpenseInput, formatBRL, toISODate } from '@contai/domain'
import { useCards } from '@/hooks/use-cards'
import { useCategories } from '@/hooks/use-categories'
import { useMerchants } from '@/hooks/use-merchants'
import { useCreateExpense } from '@/hooks/use-create-expense'
import { Input } from '@/components/ui/input'

export interface QuickAddProps {
    autoFocus?: boolean
}

export function QuickAdd({ autoFocus }: QuickAddProps) {
    const [text, setText] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const { data: cards = [] } = useCards()
    const { data: categories = [] } = useCategories()
    const { data: merchants = [] } = useMerchants()
    const createExpense = useCreateExpense()

    const parserMerchants = useMemo(
        () =>
            merchants.map((m) => ({
                id: m.id,
                normalized_name: m.normalizedName,
                display_name: m.displayName,
                default_category_id: m.defaultCategoryId,
                default_card_id: m.defaultCardId,
            })),
        [merchants],
    )

    const parsed = useMemo(() => {
        if (!text.trim()) return null
        return parseExpenseInput(text, { cards, categories, merchants: parserMerchants }, new Date())
    }, [text, cards, categories, parserMerchants])

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key !== 'Enter' || !parsed || parsed.ambiguous || parsed.amount === null) return

        createExpense.mutate(
            {
                amount: parsed.amount,
                description: parsed.merchantName ?? text,
                merchantName: parsed.merchantName ?? undefined,
                categoryId: parsed.categoryId,
                cardId: parsed.cardId,
                purchaseDate: toISODate(parsed.purchaseDate),
                type: parsed.installments ? 'installment' : parsed.frequency ? 'recurring' : 'single',
                installments: parsed.installments ?? undefined,
                frequency: parsed.frequency ?? undefined,
            },
            { onSuccess: () => setText('') },
        )
    }

    return (
        <div data-slot="quick-add" className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <Input
                ref={inputRef}
                autoFocus={autoFocus}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: 1200 em 3x na americanas no nubank"
                aria-label="Adicionar despesa por texto"
                className="h-14 rounded-2xl border-2 text-lg font-medium"
            />
            {parsed && (
                <div data-slot="quick-add-preview" className="mt-3 rounded-2xl bg-secondary/60 p-3 text-sm text-foreground-subtle">
                    {parsed.ambiguous || parsed.amount === null ? (
                        <span>Não consegui identificar o valor — confirme manualmente.</span>
                    ) : (
                        <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
                            {formatBRL(parsed.amount)}
                            {parsed.installments ? ` em ${parsed.installments}x` : ''}
                            {parsed.frequency ? ' (recorrente)' : ''}
                            {parsed.merchantName ? ` — ${parsed.merchantName}` : ''}
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}
