'use client'

import { useMemo, useState } from 'react'
import {
    breakdownByType,
    byCardTotals,
    byCategoryTotals,
    formatBRL,
    fromISODate,
    monthKey,
    monthLabel,
    monthRange,
    monthlyForecast,
    toISODate,
    upcomingInvoices,
    type Occurrence,
} from '@contai/domain'
import { CardVisual } from '@/components/app/card-visual'
import { MonthSwitcher } from '@/components/app/month-switcher'
import { OccurrenceList } from '@/components/app/occurrence-list'
import { OccurrenceSheet } from '@/components/app/occurrence-sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useOccurrences, type OccurrenceRow } from '@/hooks/use-occurrences'
import { useCategories } from '@/hooks/use-categories'
import { useCards } from '@/hooks/use-cards'
import { useSummary } from '@/hooks/use-summary'

// Duplicated from /mes's page-local mapping (not exported from there) — a
// small, stable shape conversion that isn't worth a shared module for two
// call sites. See task-5-report.md for the extraction call.
function toDomainOccurrence(o: OccurrenceRow): Occurrence {
    return {
        amount: Number(o.amount),
        category_id: o.categoryId,
        card_id: o.cardId,
        status: o.status,
        recurrence_id: o.recurrenceId,
        installments_total: o.installmentsTotal,
        occurrence_date: o.occurrenceDate,
        due_date: o.dueDate,
    }
}

function formatDayMonth(iso: string) {
    const [, month, day] = iso.split('-')
    return `${day}/${month}`
}

export default function RelatoriosPage() {
    const [month, setMonth] = useState(monthKey(new Date()))
    const [categoryFilter, setCategoryFilter] = useState<string>()
    const [selected, setSelected] = useState<OccurrenceRow | null>(null)

    const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError } = useCategories()
    const { data: cards = [], isLoading: cardsLoading, isError: cardsError } = useCards()
    const { data: summary, isLoading: summaryLoading } = useSummary(month)

    const { from, to } = monthRange(month)
    const {
        data: occurrences = [],
        isLoading: occurrencesLoading,
        isError: occurrencesError,
    } = useOccurrences({ from, to })

    // Look back to the start of last month so charges already incurred this
    // billing cycle (occurrence_date in the past, due_date still upcoming)
    // are included in the fetch. upcomingInvoices() applies the real
    // due_date-based filtering itself and drops anything with due_date
    // before `from` internally.
    const now = new Date()
    const invoiceLookback = toISODate(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    const {
        data: pending = [],
        isLoading: pendingLoading,
        isError: pendingError,
    } = useOccurrences({ from: invoiceLookback, status: 'pending' })

    const hasError = categoriesError || cardsError || occurrencesError || pendingError

    const categoryNames = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.name])), [categories])
    const cardNames = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c.name])), [cards])
    const cardsById = useMemo(() => Object.fromEntries(cards.map((c) => [c.id, c])), [cards])

    const domainOccurrences = useMemo(() => occurrences.map(toDomainOccurrence), [occurrences])
    const domainPending = useMemo(() => pending.map(toDomainOccurrence), [pending])

    const typeBreakdown = useMemo(() => breakdownByType(domainOccurrences), [domainOccurrences])
    const categorySlices = useMemo(() => byCategoryTotals(domainOccurrences), [domainOccurrences])
    const cardSlices = useMemo(() => byCardTotals(domainOccurrences), [domainOccurrences])
    const maxCategoryTotal = categorySlices[0]?.total ?? 1

    const invoices = useMemo(() => upcomingInvoices(domainPending, new Date()).slice(0, 6), [domainPending])

    const forecastMonths = useMemo(() => {
        const now = new Date()
        const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        return monthlyForecast(domainPending, nextMonthStart, 3)
    }, [domainPending])

    const categoryDetail = useMemo(() => {
        if (!categoryFilter) return []
        return occurrences.filter((o) => (o.categoryId ?? 'none') === categoryFilter)
    }, [occurrences, categoryFilter])

    return (
        <main className="flex flex-col gap-4">
            <MonthSwitcher month={month} onChange={setMonth} />

            {hasError && <p className="text-sm text-destructive">Erro ao carregar. Tente novamente.</p>}

            <section>
                {occurrencesLoading || summaryLoading ? (
                    <div className="grid grid-cols-2 gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-2xl border border-border bg-card p-3">
                                <Skeleton className="h-3 w-16" />
                                <Skeleton className="mt-1 h-5 w-20" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {(
                            [
                                // Matches /inicio's basis (useSummary, filtered server-side on
                                // invoiceMonth) so the two pages agree under the same label —
                                // the other 3 tiles intentionally stay occurrenceDate-based.
                                ['Gastos no mês', summary?.total ?? 0],
                                ['Faturas atuais', typeBreakdown.invoicesTotal],
                                ['Recorrentes', typeBreakdown.recurringTotal],
                                ['Parcelamentos', typeBreakdown.installmentsTotal],
                            ] as const
                        ).map(([label, value]) => (
                            <div key={label} className="rounded-2xl border border-border bg-card p-3">
                                <p className="text-xs text-muted-foreground">{label}</p>
                                <p className="font-display text-lg font-semibold tabular-nums text-foreground">
                                    {formatBRL(value)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section>
                <h2 className="text-sm font-semibold text-foreground">Gastos por categoria</h2>
                {occurrencesLoading || categoriesLoading ? (
                    <div className="mt-2 space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="rounded-2xl border border-border bg-card p-3">
                                <div className="flex items-center justify-between">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-14" />
                                </div>
                                <Skeleton className="mt-2 h-2 w-full rounded-full" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-2 space-y-2">
                        {categorySlices.length === 0 && (
                            <p className="text-sm text-muted-foreground">Sem gastos neste mês.</p>
                        )}
                        {categorySlices.map((slice) => (
                            <button
                                key={slice.id}
                                type="button"
                                onClick={() => setCategoryFilter(categoryFilter === slice.id ? undefined : slice.id)}
                                className="w-full rounded-2xl border border-border bg-card p-3 text-left"
                            >
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-foreground">{categoryNames[slice.id] ?? 'Sem categoria'}</span>
                                    <span className="font-medium tabular-nums text-foreground">{formatBRL(slice.total)}</span>
                                </div>
                                <div className="mt-2 h-2 rounded-full bg-secondary">
                                    <div
                                        className="h-2 rounded-full bg-primary"
                                        style={{ width: `${Math.max(4, (slice.total / maxCategoryTotal) * 100)}%` }}
                                    />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                {categoryFilter && (
                    <div className="mt-3 rounded-2xl border border-border bg-card p-2">
                        <OccurrenceList occurrences={categoryDetail} onSelect={setSelected} />
                    </div>
                )}
            </section>

            <section>
                <h2 className="text-sm font-semibold text-foreground">Gastos por cartão</h2>
                {occurrencesLoading || cardsLoading ? (
                    <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between p-3">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-4 w-14" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
                        {cardSlices.length === 0 && (
                            <p className="p-3 text-sm text-muted-foreground">Sem gastos neste mês.</p>
                        )}
                        {cardSlices.map((slice) => {
                            const card = cardsById[slice.id]
                            return (
                                <div key={slice.id} className="flex items-center justify-between p-3 text-sm">
                                    <span className="flex items-center gap-2 text-foreground">
                                        {card && <CardVisual size="xs" color={card.color} />}
                                        {cardNames[slice.id] ?? 'Sem cartão'}
                                    </span>
                                    <span className="font-medium tabular-nums text-foreground">{formatBRL(slice.total)}</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            <section>
                <h2 className="text-sm font-semibold text-foreground">Próximas faturas</h2>
                {pendingLoading || cardsLoading ? (
                    <div className="mt-2 space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between rounded-2xl border border-border bg-card p-3"
                            >
                                <div>
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="mt-1 h-3 w-16" />
                                </div>
                                <Skeleton className="h-5 w-16" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-2 space-y-2">
                        {invoices.length === 0 && (
                            <p className="text-sm text-muted-foreground">Nenhuma fatura em aberto.</p>
                        )}
                        {invoices.map((invoice) => (
                            <div
                                key={`${invoice.cardId}-${invoice.dueDate}`}
                                className="flex items-center justify-between rounded-2xl border border-border bg-card p-3"
                            >
                                <div>
                                    <p className="font-medium text-foreground">{cardNames[invoice.cardId] ?? 'Sem cartão'}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Vence {formatDayMonth(invoice.dueDate)}
                                        {invoice.forecastTotal > 0 ? ` · ${formatBRL(invoice.forecastTotal)} previsto` : ''}
                                    </p>
                                </div>
                                <p className="font-display font-semibold tabular-nums text-foreground">
                                    {formatBRL(invoice.total)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section>
                <h2 className="text-sm font-semibold text-foreground">Previsão dos próximos meses</h2>
                <p className="text-xs text-muted-foreground">Inclui parcelas futuras e assinaturas ativas.</p>
                {pendingLoading ? (
                    <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between p-3">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-14" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
                        {forecastMonths.map((m) => (
                            <div key={m.key} className="flex items-center justify-between p-3 text-sm">
                                <span className="capitalize text-foreground">{monthLabel(fromISODate(`${m.key}-01`))}</span>
                                <span className="font-medium tabular-nums text-foreground">{formatBRL(m.total)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <OccurrenceSheet occurrence={selected} onOpenChange={(open) => !open && setSelected(null)} />
        </main>
    )
}
