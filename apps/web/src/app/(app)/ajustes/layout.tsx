import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
    title: 'Ajustes',
}

export default function AjustesLayout({ children }: { children: ReactNode }) {
    return children
}
