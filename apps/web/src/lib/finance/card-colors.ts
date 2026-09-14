export interface CardColor {
    id: string
    label: string
    value: string
}

export const CARD_COLORS: CardColor[] = [
    { id: 'orange', label: 'Laranja', value: 'oklch(0.65 0.21 38)' },
    { id: 'purple', label: 'Roxo', value: 'oklch(0.5 0.24 300)' },
    { id: 'blue', label: 'Azul', value: 'oklch(0.55 0.18 255)' },
    { id: 'teal', label: 'Verde-água', value: 'oklch(0.6 0.13 190)' },
    { id: 'green', label: 'Verde', value: 'oklch(0.58 0.16 150)' },
    { id: 'pink', label: 'Rosa', value: 'oklch(0.65 0.2 350)' },
    { id: 'yellow', label: 'Amarelo', value: 'oklch(0.78 0.16 85)' },
    { id: 'graphite', label: 'Grafite', value: 'oklch(0.32 0.02 265)' },
]

export const DEFAULT_CARD_COLOR = CARD_COLORS[0].value

export function resolveCardColor(color?: string | null): string {
    if (!color) return DEFAULT_CARD_COLOR
    const preset = CARD_COLORS.find((c) => c.id === color || c.value === color)
    return preset?.value ?? color
}
