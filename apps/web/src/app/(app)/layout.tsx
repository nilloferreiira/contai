import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@contai/api'
import { BottomNav } from '@/components/app/bottom-nav'

export default async function AppLayout({ children }: { children: ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session?.user) {
        redirect('/login')
    }

    return (
        <div data-slot="app-shell" className="min-h-screen bg-background pb-28">
            <div className="mx-auto w-full max-w-lg px-4 pt-6">{children}</div>
            <BottomNav />
        </div>
    )
}
