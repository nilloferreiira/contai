import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { BottomNav } from '@/components/app/bottom-nav'

export default async function AppLayout({ children }: { children: ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers(),
    })

    if (!session?.user) {
        redirect('/login')
    }

    return (
        <div data-slot="app-shell" className="flex min-h-screen flex-col pb-16">
            {children}
            <BottomNav />
        </div>
    )
}
