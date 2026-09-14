import { twMerge } from 'tailwind-merge'
import type { ComponentProps } from 'react'
import { resolveCardColor } from '@/lib/finance/card-colors'

type Size = 'lg' | 'sm' | 'xs'

const sizes: Record<Size, string> = {
    lg: 'aspect-[1.586] w-full max-h-44 rounded-2xl p-3',
    sm: 'h-10 w-16 rounded-lg p-1.5',
    xs: 'h-4 w-6 rounded-[4px] p-0',
}

export interface CardVisualProps extends Omit<ComponentProps<'div'>, 'color'> {
    size: Size
    color?: string | null
    name?: string
}

export function CardVisual({ size, color, name, className, ...props }: CardVisualProps) {
    const base = resolveCardColor(color)
    const background = `linear-gradient(135deg, color-mix(in oklab, ${base} 88%, white) 0%, ${base} 55%, color-mix(in oklab, ${base} 78%, black) 100%)`

    return (
        <div
            data-slot="card-visual"
            aria-hidden={!name}
            className={twMerge(sizes[size], 'relative overflow-hidden shadow-sm', className)}
            style={{ background }}
            {...props}
        >
            <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{ background: 'radial-gradient(120% 80% at 15% 0%, rgb(255 255 255 / 0.45), transparent 60%)' }}
            />
            {size === 'lg' && (
                <div className="relative flex h-full flex-col justify-between">
                    <span className="truncate font-display text-sm font-semibold text-white drop-shadow-sm">{name}</span>
                    <div className="flex items-end justify-between">
                        <div className="h-4 w-6 rounded-[4px] bg-white/35" />
                        <div className="flex items-center">
                            <div className="size-5 rounded-full bg-white/85" />
                            <div className="-ml-2 size-5 rounded-full bg-white/45" />
                        </div>
                    </div>
                </div>
            )}
            {size === 'sm' && (
                <div className="relative mt-auto flex items-center self-end">
                    <div className="size-3 rounded-full bg-white/85" />
                    <div className="-ml-1.5 size-3 rounded-full bg-white/45" />
                </div>
            )}
        </div>
    )
}
