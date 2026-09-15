import { twMerge } from 'tailwind-merge'
import { CARD_COLORS } from '@/lib/finance/card-colors'

export interface CardColorPickerProps {
    value: string
    onChange: (value: string) => void
}

export function CardColorPicker({ value, onChange }: CardColorPickerProps) {
    return (
        <div data-slot="card-color-picker" className="flex flex-wrap gap-2">
            {CARD_COLORS.map((color) => (
                <button
                    key={color.value}
                    type="button"
                    aria-label={`Cor ${color.label}`}
                    onClick={() => onChange(color.value)}
                    className="flex size-11 items-center justify-center rounded-full outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                    <span
                        data-selected={value === color.value ? '' : undefined}
                        className={twMerge('size-8 rounded-full border-2 border-transparent data-[selected]:border-ring')}
                        style={{ backgroundColor: color.value }}
                    />
                </button>
            ))}
        </div>
    )
}
