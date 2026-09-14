'use client'

import { useMemo, useState, type KeyboardEvent, type Ref } from 'react'
import { parseExpenseInput, formatBRL, toISODate } from '@contai/domain'
import { useCards } from '@/hooks/use-cards'
import { useCategories } from '@/hooks/use-categories'
import { useMerchants } from '@/hooks/use-merchants'
import { useCreateExpense } from '@/hooks/use-create-expense'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ManualExpenseDialog } from '@/components/app/manual-expense-dialog'
import { CardVisual } from '@/components/app/card-visual'

export interface QuickAddProps {
    autoFocus?: boolean
    ref?: Ref<HTMLInputElement>
}

export function QuickAdd({ autoFocus, ref }: QuickAddProps) {
    const [text, setText] = useState('')
    const [manualOpen, setManualOpen] = useState(false)
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

    const outrosCategory = categories.find((c) => c.name === 'Outros')
    const categoryId = parsed?.categoryId ?? outrosCategory?.id ?? null
    const category = categories.find((c) => c.id === categoryId)
    const card = cards.find((c) => c.id === parsed?.cardId)
    const installmentValue =
        parsed?.amount && parsed.installments && parsed.installments > 1 ? parsed.amount / parsed.installments : null

    function handleConfirm() {
        if (!parsed || parsed.ambiguous || parsed.amount === null) return
        if (createExpense.isPending) return

        createExpense.mutate(
            {
                amount: parsed.amount,
                description: parsed.merchantName ?? text,
                merchantName: parsed.merchantName ?? undefined,
                categoryId,
                cardId: parsed.cardId,
                purchaseDate: toISODate(parsed.purchaseDate),
                type: parsed.installments ? 'installment' : parsed.frequency ? 'recurring' : 'single',
                installments: parsed.installments ?? undefined,
                frequency: parsed.frequency ?? undefined,
            },
            { onSuccess: () => setText('') },
        )
    }

    function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        if (event.key !== 'Enter') return
        handleConfirm()
    }

    const canConfirm = Boolean(parsed) && !parsed?.ambiguous && parsed?.amount !== null

    return (
        <div data-slot="quick-add" className="rounded-3xl border border-border bg-card p-4 shadow-sm">
            <Input
                ref={ref}
                autoFocus={autoFocus}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={createExpense.isPending}
                placeholder="Ex: 1200 em 3x na americanas no nubank"
                aria-label="Adicionar despesa por texto"
                className="h-14 rounded-2xl border-2 text-lg font-medium"
            />
            {parsed && (
                <div data-slot="quick-add-preview" className="mt-3 rounded-2xl bg-secondary/60 p-3 text-sm text-foreground-subtle">
                    {parsed.ambiguous || parsed.amount === null ? (
                        <span>Não consegui identificar o valor — confirme manualmente.</span>
                    ) : (
                        <>
                            <div className="flex items-baseline justify-between">
                                <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
                                    {formatBRL(parsed.amount)}
                                </span>
                                <span className="text-sm font-medium text-foreground">{parsed.merchantName ?? '—'}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <span className="rounded-full bg-card px-2 py-1">
                                    {category ? `${category.icon ?? ''} ${category.name}` : 'Sem categoria'}
                                </span>
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2 py-1">
                                    {card ? (
                                        <CardVisual color={card.color} size="xs" />
                                    ) : (
                                        <span className="h-4 w-6 rounded-[4px] border border-dashed border-muted-foreground/50" />
                                    )}
                                    {card ? card.name : 'Sem cartão'}
                                </span>
                                {installmentValue !== null && (
                                    <span className="rounded-full bg-card px-2 py-1">
                                        🔢 {parsed.installments}x de {formatBRL(installmentValue)}
                                    </span>
                                )}
                                {parsed.frequency && (
                                    <span className="rounded-full bg-card px-2 py-1">🔁 Recorrente</span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
            <div className="mt-3 flex gap-2">
                <Button
                    type="button"
                    variant="outline"
                    className="h-12 flex-1 rounded-2xl"
                    onClick={() => setManualOpen(true)}
                >
                    Detalhar
                </Button>
                <Button
                    type="button"
                    className="h-12 flex-[2] rounded-2xl text-base"
                    disabled={!canConfirm || createExpense.isPending}
                    onClick={handleConfirm}
                >
                    {createExpense.isPending ? 'Salvando...' : 'Confirmar'}
                </Button>
            </div>
            <ManualExpenseDialog open={manualOpen} onOpenChange={setManualOpen} />
        </div>
    )
}
