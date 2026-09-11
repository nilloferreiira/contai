'use client'

import type { ComponentProps } from 'react'
import { Home, Calendar, PieChart, Settings, Plus, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const tabs = [
    { href: '/inicio', label: 'Início', icon: Home },
    { href: '/mes', label: 'Mês', icon: Calendar },
    { href: '/relatorios', label: 'Relatórios', icon: PieChart },
    { href: '/ajustes', label: 'Ajustes', icon: Settings },
] as const

export type BottomNavProps = ComponentProps<'nav'>

export function BottomNav({ className, ...props }: BottomNavProps) {
    const pathname = usePathname()

    return (
        <nav
            data-slot="bottom-nav"
            className={twMerge(
                'fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur',
                className,
            )}
            {...props}
        >
            <div className="mx-auto flex max-w-lg items-center px-1">
                {tabs.slice(0, 2).map((tab) => (
                    <NavLink key={tab.href} {...tab} active={pathname === tab.href} />
                ))}
                <Link
                    href="/inicio?focus=quick-add"
                    aria-label="Adicionar despesa"
                    className="-mt-6 flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
                >
                    <Plus className="size-6" />
                </Link>
                {tabs.slice(2).map((tab) => (
                    <NavLink key={tab.href} {...tab} active={pathname === tab.href} />
                ))}
            </div>
        </nav>
    )
}

interface NavLinkProps {
    href: string
    label: string
    icon: LucideIcon
    active: boolean
}

function NavLink({ href, label, icon: Icon, active }: NavLinkProps) {
    return (
        <Link
            href={href}
            data-active={active ? '' : undefined}
            className={twMerge(
                'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs text-muted-foreground data-[active]:text-primary',
            )}
        >
            <Icon className="size-5" />
            {label}
        </Link>
    )
}
