'use client'

import { useState } from 'react'
import { monthKey, toISODate } from '@contai/domain'
import { MonthSwitcher } from '@/components/app/month-switcher'
import { OccurrenceList } from '@/components/app/occurrence-list'
import { OccurrenceSheet } from '@/components/app/occurrence-sheet'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useOccurrences, type OccurrenceRow } from '@/hooks/use-occurrences'
import { useCategories } from '@/hooks/use-categories'
import { useCards } from '@/hooks/use-cards'

function monthRange(month: string) {
    const [year, m] = month.split('-').map(Number)
    const start = new Date(year, m - 1, 1)
    const end = new Date(year, m, 0)
    return { from: toISODate(start), to: toISODate(end) }
}

export default function MesPage() {
    const [month, setMonth] = useState(monthKey(new Date()))
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState<string>()
    const [cardFilter, setCardFilter] = useState<string>()
    const [statusFilter, setStatusFilter] = useState<'pending' | 'paid' | 'cancelled'>()
    const [selected, setSelected] = useState<OccurrenceRow | null>(null)

    const { data: categories = [] } = useCategories()
    const { data: cards = [] } = useCards()
    const { from, to } = monthRange(month)
    const { data: occurrences = [] } = useOccurrences({
        from,
        to,
        q: search || undefined,
        categoryId: categoryFilter,
        cardId: cardFilter,
        status: statusFilter,
    })

    return (
        <main className="flex flex-col gap-4">
            <MonthSwitcher month={month} onChange={setMonth} />
            <Input
                placeholder="Buscar por descrição"
                aria-label="Buscar despesas"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger aria-label="Categoria">
                        <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                        {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                                {category.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={cardFilter} onValueChange={setCardFilter}>
                    <SelectTrigger aria-label="Cartão">
                        <SelectValue placeholder="Cartão" />
                    </SelectTrigger>
                    <SelectContent>
                        {cards.map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                                {card.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                    <SelectTrigger aria-label="Status">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <OccurrenceList occurrences={occurrences} showDateHeaders onSelect={setSelected} />
            <OccurrenceSheet occurrence={selected} onOpenChange={(open) => !open && setSelected(null)} />
        </main>
    )
}
