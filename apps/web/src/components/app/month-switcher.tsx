'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

export interface MonthSwitcherProps {
    month: string // YYYY-MM
    onChange: (month: string) => void
}

export function MonthSwitcher({ month, onChange }: MonthSwitcherProps) {
    function shift(delta: number) {
        const [year, m] = month.split('-').map(Number)
        const next = new Date(year, m - 1 + delta, 1)
        onChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`)
    }

    return (
        <div data-slot="month-switcher" className={twMerge('flex items-center justify-between')}>
            <button type="button" aria-label="Mês anterior" onClick={() => shift(-1)} className="flex size-11 items-center justify-center">
                <ChevronLeft className="size-5" />
            </button>
            <span className="font-medium text-foreground">{month}</span>
            <button type="button" aria-label="Próximo mês" onClick={() => shift(1)} className="flex size-11 items-center justify-center">
                <ChevronRight className="size-5" />
            </button>
        </div>
    )
}
