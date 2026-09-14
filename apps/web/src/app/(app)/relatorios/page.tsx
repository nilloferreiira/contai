'use client'

import { useState } from 'react'
import { monthKey } from '@contai/domain'
import { SummaryTiles } from '@/components/app/summary-tiles'
import { MonthSwitcher } from '@/components/app/month-switcher'
import { useSummary } from '@/hooks/use-summary'
import { useCategories } from '@/hooks/use-categories'
import { useCards } from '@/hooks/use-cards'

function remapByName(byId: Record<string, number>, lookup: Record<string, string>) {
	return Object.fromEntries(Object.entries(byId).map(([id, amount]) => [lookup[id] ?? id, amount]))
}

export default function RelatoriosPage() {
	const [month, setMonth] = useState(monthKey(new Date()))
	const { data: summary, isError: summaryError } = useSummary(month)
	const { data: categories = [] } = useCategories()
	const { data: cards = [] } = useCards()

	const categoryNames = Object.fromEntries(categories.map((c) => [c.id, c.name]))
	const cardNames = Object.fromEntries(cards.map((c) => [c.id, c.name]))

	return (
		<main className="flex flex-col gap-4">
			<MonthSwitcher month={month} onChange={setMonth} />
			{summaryError && <p className="text-sm text-destructive">Erro ao carregar. Tente novamente.</p>}
			<SummaryTiles
				total={summary?.total ?? 0}
				byCategory={remapByName(summary?.byCategory ?? {}, categoryNames)}
				byCard={remapByName(summary?.byCard ?? {}, cardNames)}
			/>
		</main>
	)
}
