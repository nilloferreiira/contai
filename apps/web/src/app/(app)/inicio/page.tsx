'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatBRL, monthKey, monthLabel, toISODate } from '@contai/domain'
import { QuickAdd } from '@/components/app/quick-add'
import { OccurrenceList } from '@/components/app/occurrence-list'
import { OccurrenceListSkeleton } from '@/components/app/occurrence-list-skeleton'
import { OccurrenceSheet } from '@/components/app/occurrence-sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useOccurrences, type OccurrenceRow } from '@/hooks/use-occurrences'
import { useCategories } from '@/hooks/use-categories'
import { useCards } from '@/hooks/use-cards'
import { useSummary } from '@/hooks/use-summary'

export default function InicioPage() {
    const searchParams = useSearchParams()
    const shouldFocus = searchParams.get('focus') === 'quick-add'
    const quickAddRef = useRef<HTMLInputElement>(null)
    const [selected, setSelected] = useState<OccurrenceRow | null>(null)

    // autoFocus only fires on mount (e.g. navigating in from /mes). Tapping
    // the bottom-nav FAB while already on /inicio just updates the query
    // param without remounting, so focus it imperatively here too.
    useEffect(() => {
        if (shouldFocus) {
            quickAddRef.current?.focus()
        }
    }, [shouldFocus])

    const today = toISODate(new Date())
    const month = monthKey(new Date())

    const { data: summary, isLoading: summaryLoading } = useSummary(month)
    const { data: categories = [] } = useCategories()
    const { data: cards = [] } = useCards()
    const {
        data: todayOccurrences = [],
        isLoading: occurrencesLoading,
        isError: occurrencesError,
        refetch: refetchOccurrences,
    } = useOccurrences({ from: today, to: today })

    const categoriesById = useMemo(
        () => Object.fromEntries(categories.map((c) => [c.id, { icon: c.icon }])),
        [categories],
    )
    const cardsById = useMemo(
        () => Object.fromEntries(cards.map((c) => [c.id, { name: c.name, color: c.color }])),
        [cards],
    )

    return (
        <main className="flex flex-col gap-4">
            <div>
                <p className="text-sm font-medium text-muted-foreground">{monthLabel(new Date())}</p>
                <h1 className="text-sm font-medium text-muted-foreground">Gastos no mês</h1>
                {summaryLoading ? (
                    <Skeleton className="mt-1 h-9 w-40 rounded-lg" />
                ) : (
                    <p className="font-display text-2xl font-semibold text-foreground">
                        {summary ? formatBRL(summary.total) : '—'}
                    </p>
                )}
            </div>
            <QuickAdd ref={quickAddRef} autoFocus={shouldFocus} />
            <h2 className="text-lg font-medium text-foreground">Hoje</h2>
            {occurrencesError && (
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-destructive">Erro ao carregar. Tente novamente.</p>
                    <Button variant="outline" size="sm" onClick={() => refetchOccurrences()}>
                        Tentar novamente
                    </Button>
                </div>
            )}
            {occurrencesLoading ? (
                <OccurrenceListSkeleton rows={3} showDateHeaders={false} />
            ) : (
                <OccurrenceList
                    occurrences={todayOccurrences}
                    onSelect={setSelected}
                    categoriesById={categoriesById}
                    cardsById={cardsById}
                />
            )}
            <OccurrenceSheet occurrence={selected} onOpenChange={(open) => !open && setSelected(null)} />
        </main>
    )
}
