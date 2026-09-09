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
                'fixed inset-x-0 bottom-0 z-50 flex items-center justify-between border-t border-border bg-surface px-2 py-1',
                className,
            )}
            {...props}
        >
            {tabs.slice(0, 2).map((tab) => (
                <NavLink key={tab.href} {...tab} active={pathname === tab.href} />
            ))}
            <Link
                href="/inicio?focus=quick-add"
                aria-label="Adicionar despesa"
                className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
                <Plus className="size-5" />
            </Link>
            {tabs.slice(2).map((tab) => (
                <NavLink key={tab.href} {...tab} active={pathname === tab.href} />
            ))}
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
                'flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground data-[active]:text-primary',
            )}
        >
            <Icon className="size-5" />
            {label}
        </Link>
    )
}
