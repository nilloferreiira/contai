'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatBRL, monthKey, toISODate } from '@contai/domain'
import { QuickAdd } from '@/components/app/quick-add'
import { ManualExpenseDialog } from '@/components/app/manual-expense-dialog'
import { OccurrenceList } from '@/components/app/occurrence-list'
import { OccurrenceSheet } from '@/components/app/occurrence-sheet'
import { Button } from '@/components/ui/button'
import { useOccurrences, type OccurrenceRow } from '@/hooks/use-occurrences'
import { useSummary } from '@/hooks/use-summary'

export default function InicioPage() {
    const searchParams = useSearchParams()
    const shouldFocus = searchParams.get('focus') === 'quick-add'
    const quickAddRef = useRef<HTMLInputElement>(null)
    const [manualOpen, setManualOpen] = useState(false)
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

    const { data: summary } = useSummary(month)
    const { data: todayOccurrences = [], isError: occurrencesError } = useOccurrences({ from: today, to: today })

    return (
        <main className="flex flex-col gap-4">
            <h1 className="font-display text-2xl font-semibold text-foreground">
                {summary ? formatBRL(summary.total) : '—'}
            </h1>
            <QuickAdd ref={quickAddRef} autoFocus={shouldFocus} />
            <Button variant="secondary" onClick={() => setManualOpen(true)}>
                Adicionar manualmente
            </Button>
            <h2 className="text-lg font-medium text-foreground">Hoje</h2>
            {occurrencesError && <p className="text-sm text-destructive">Erro ao carregar. Tente novamente.</p>}
            <OccurrenceList occurrences={todayOccurrences} onSelect={setSelected} />
            <ManualExpenseDialog open={manualOpen} onOpenChange={setManualOpen} />
            <OccurrenceSheet occurrence={selected} onOpenChange={(open) => !open && setSelected(null)} />
        </main>
    )
}
