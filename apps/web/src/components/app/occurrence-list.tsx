import { toISODate } from '@contai/domain'
import { OccurrenceRow } from './occurrence-row'
import type { OccurrenceRow as OccurrenceRowData } from '@/hooks/use-occurrences'

export interface OccurrenceListProps {
    occurrences: OccurrenceRowData[]
    showDateHeaders?: boolean
    onSelect: (occurrence: OccurrenceRowData) => void
}

export function OccurrenceList({ occurrences, showDateHeaders = false, onSelect }: OccurrenceListProps) {
    if (occurrences.length === 0) {
        return <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma despesa encontrada.</p>
    }

    if (!showDateHeaders) {
        return (
            <div data-slot="occurrence-list" className="flex flex-col">
                {occurrences.map((occurrence) => (
                    <OccurrenceRow key={occurrence.id} occurrence={occurrence} onClick={() => onSelect(occurrence)} />
                ))}
            </div>
        )
    }

    const grouped = occurrences.reduce<Record<string, OccurrenceRowData[]>>((acc, occurrence) => {
        acc[occurrence.occurrenceDate] = [...(acc[occurrence.occurrenceDate] ?? []), occurrence]
        return acc
    }, {})

    const todayISO = toISODate(new Date())

    return (
        <div data-slot="occurrence-list" className="flex flex-col gap-4">
            {Object.entries(grouped).map(([date, group]) => (
                <div key={date}>
                    <h3 className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {date === todayISO ? 'Hoje' : date}
                    </h3>
                    <div className="divide-y divide-border/60">
                        {group.map((occurrence) => (
                            <OccurrenceRow key={occurrence.id} occurrence={occurrence} onClick={() => onSelect(occurrence)} />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
