'use client'

import { useMemo, useState } from 'react'
import { formatBRL, monthKey, monthRange, splitRealizedForecast, type Occurrence } from '@contai/domain'
import { MonthSwitcher } from '@/components/app/month-switcher'
import { OccurrenceList } from '@/components/app/occurrence-list'
import { OccurrenceListSkeleton } from '@/components/app/occurrence-list-skeleton'
import { OccurrenceSheet } from '@/components/app/occurrence-sheet'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useOccurrences, type OccurrenceRow } from '@/hooks/use-occurrences'
import { useCategories } from '@/hooks/use-categories'
import { useCards } from '@/hooks/use-cards'

type TypeFilter = 'single' | 'installment' | 'recurring'

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

export default function MesPage() {
    const [month, setMonth] = useState(monthKey(new Date()))
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<string>()
    const [cardFilter, setCardFilter] = useState<string>()
    const [statusFilter, setStatusFilter] = useState<'pending' | 'paid' | 'cancelled'>()
    const [typeFilter, setTypeFilter] = useState<TypeFilter>()
    const [selected, setSelected] = useState<OccurrenceRow | null>(null)

    const { data: categories = [] } = useCategories()
    const { data: cards = [] } = useCards()
    const categoriesById = useMemo(
        () => Object.fromEntries(categories.map((c) => [c.id, { icon: c.icon }])),
        [categories],
    )
    const cardsById = useMemo(
        () => Object.fromEntries(cards.map((c) => [c.id, { name: c.name, color: c.color }])),
        [cards],
    )
    const { from, to } = monthRange(month)
    const {
        data: occurrences = [],
        isLoading: occurrencesLoading,
        isError: occurrencesError,
    } = useOccurrences({
        from,
        to,
        q: search || undefined,
        categoryId: categoryFilter,
        cardId: cardFilter,
        status: statusFilter,
    })

    const filtered = useMemo(() => {
        if (!typeFilter) return occurrences
        return occurrences.filter((o) => {
            const isInstallment = (o.installmentsTotal ?? 0) > 1
            const isRecurring = o.recurrenceId != null
            if (typeFilter === 'installment') return isInstallment
            if (typeFilter === 'recurring') return isRecurring
            return !isInstallment && !isRecurring
        })
    }, [occurrences, typeFilter])

    const split = useMemo(() => splitRealizedForecast(filtered.map(toDomainOccurrence)), [filtered])

    return (
        <main className="flex flex-col gap-4">
            <div>
                <MonthSwitcher month={month} onChange={setMonth} />
                <div className="text-center">
                    {occurrencesLoading ? (
                        <Skeleton className="mx-auto mt-1 h-7 w-28 rounded-lg" />
                    ) : (
                        <>
                            <p className="font-display text-2xl font-semibold tabular-nums text-foreground">
                                {formatBRL(split.total)}
                            </p>
                            {split.forecast > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    {formatBRL(split.realized)} realizado · {formatBRL(split.forecast)} previsto
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
            <Input
                placeholder="Buscar por descrição"
                aria-label="Buscar despesas"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            <div className="grid grid-cols-4 gap-2">
                <Select
                    value={categoryFilter ?? 'all'}
                    onValueChange={(v) => setCategoryFilter(v === 'all' ? undefined : v)}
                >
                    <SelectTrigger aria-label="Categoria">
                        <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                                {category.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={cardFilter ?? 'all'} onValueChange={(v) => setCardFilter(v === 'all' ? undefined : v)}>
                    <SelectTrigger aria-label="Cartão">
                        <SelectValue placeholder="Cartão" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {cards.map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                                {card.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={statusFilter ?? 'all'}
                    onValueChange={(v) => setStatusFilter(v === 'all' ? undefined : (v as typeof statusFilter))}
                >
                    <SelectTrigger aria-label="Status">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={typeFilter ?? 'all'}
                    onValueChange={(v) => setTypeFilter(v === 'all' ? undefined : (v as TypeFilter))}
                >
                    <SelectTrigger aria-label="Tipo">
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="single">Única</SelectItem>
                        <SelectItem value="installment">Parcelada</SelectItem>
                        <SelectItem value="recurring">Recorrente</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {occurrencesError && <p className="text-sm text-destructive">Erro ao carregar. Tente novamente.</p>}
            {occurrencesLoading ? (
                <OccurrenceListSkeleton rows={6} />
            ) : (
                <OccurrenceList
                    occurrences={filtered}
                    showDateHeaders
                    onSelect={setSelected}
                    categoriesById={categoriesById}
                    cardsById={cardsById}
                />
            )}
            <OccurrenceSheet occurrence={selected} onOpenChange={(open) => !open && setSelected(null)} />
        </main>
    )
}
