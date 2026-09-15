import { formatBRL, isForecast } from '@contai/domain'
import { twMerge } from 'tailwind-merge'
import type { OccurrenceRow as OccurrenceRowData } from '@/hooks/use-occurrences'
import { CardVisual } from './card-visual'

export interface OccurrenceRowProps {
    occurrence: OccurrenceRowData
    onClick: () => void
    categoryIcon?: string | null
    card?: { name: string; color?: string | null } | null
}

export function OccurrenceRow({ occurrence, onClick, categoryIcon, card }: OccurrenceRowProps) {
    const forecast =
        occurrence.status !== 'cancelled' &&
        isForecast({
            amount: Number(occurrence.amount),
            category_id: occurrence.categoryId,
            card_id: occurrence.cardId,
            status: occurrence.status,
            occurrence_date: occurrence.occurrenceDate,
        })

    return (
        <button
            type="button"
            data-slot="occurrence-row"
            data-status={occurrence.status}
            data-forecast={forecast ? '' : undefined}
            onClick={onClick}
            className={twMerge(
                'flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left hover:bg-secondary/60',
                'data-[status=cancelled]:opacity-50',
                'data-[forecast]:opacity-70 data-[forecast]:ring-1 data-[forecast]:ring-dashed data-[forecast]:ring-border',
            )}
        >
            <span className="flex min-w-0 items-center gap-2 text-foreground">
                <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-lg"
                >
                    {categoryIcon ?? '📦'}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span className="min-w-0 truncate">
                            {occurrence.description}
                            {occurrence.installmentsTotal
                                ? ` (${occurrence.installmentNumber}/${occurrence.installmentsTotal})`
                                : ''}
                        </span>
                        {forecast && (
                            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Previsto
                            </span>
                        )}
                    </span>
                    {card && (
                        <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <CardVisual color={card.color} size="xs" />
                            {card.name}
                        </span>
                    )}
                </span>
            </span>
            <span
                className={twMerge(
                    'font-display font-semibold tabular-nums text-foreground',
                    forecast && 'text-muted-foreground',
                )}
            >
                {formatBRL(Number(occurrence.amount))}
            </span>
        </button>
    )
}
