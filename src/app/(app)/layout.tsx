import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/app/bottom-nav'

export default async function AppLayout({ children }: { children: ReactNode }) {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()

    if (!data.user) {
        redirect('/login')
    }

    return (
        <div data-slot="app-shell" className="flex min-h-screen flex-col pb-16">
            {children}
            <BottomNav />
        </div>
    )
}
