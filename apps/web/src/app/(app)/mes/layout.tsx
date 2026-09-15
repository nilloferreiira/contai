import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
    title: 'Mês',
}

export default function MesLayout({ children }: { children: ReactNode }) {
    return children
}
