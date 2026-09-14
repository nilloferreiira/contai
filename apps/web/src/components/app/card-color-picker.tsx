import { twMerge } from 'tailwind-merge'
import { CARD_COLORS } from '@/lib/finance/card-colors'

export interface CardColorPickerProps {
    value: string
    onChange: (value: string) => void
}

export function CardColorPicker({ value, onChange }: CardColorPickerProps) {
    return (
        <div data-slot="card-color-picker" className="flex gap-2">
            {CARD_COLORS.map((color) => (
                <button
                    key={color.value}
                    type="button"
                    aria-label={`Cor ${color.label}`}
                    data-selected={value === color.value ? '' : undefined}
                    onClick={() => onChange(color.value)}
                    className={twMerge('size-8 rounded-full border-2 border-transparent data-[selected]:border-ring')}
                    style={{ backgroundColor: color.value }}
                />
            ))}
        </div>
    )
}
