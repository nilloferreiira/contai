export function parseAmount(input: string): { value: number; remainder: string } | null {
    const match = input.match(/(?:R\$?\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/i)
    if (!match) return null

    const raw = match[1]
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw
    const value = Number.parseFloat(normalized)
    if (Number.isNaN(value)) return null

    return { value, remainder: (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length)).trim() }
}

export function parseInstallmentCount(input: string): { count: number; remainder: string } | null {
    const match = input.match(/\b(?:em\s+)?(\d{1,2})\s*(?:x|vezes)\b/i)
    if (!match) return null

    return {
        count: Number.parseInt(match[1], 10),
        remainder: (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length)).trim(),
    }
}

const RECURRENCE_PATTERNS: Array<{ pattern: RegExp; frequency: 'weekly' | 'monthly' | 'yearly' }> = [
    { pattern: /\btoda\s+semana\b|\bsemanal\b/i, frequency: 'weekly' },
    { pattern: /\btodo\s+m[eê]s\b|\bmensal\b/i, frequency: 'monthly' },
    { pattern: /\banual\b|\btodo\s+ano\b/i, frequency: 'yearly' },
]

export function parseRecurrenceFrequency(input: string): { frequency: 'weekly' | 'monthly' | 'yearly'; remainder: string } | null {
    for (const { pattern, frequency } of RECURRENCE_PATTERNS) {
        const match = input.match(pattern)
        if (match) {
            return {
                frequency,
                remainder: (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length)).trim(),
            }
        }
    }
    return null
}

export function parseExplicitDate(input: string, today: Date): { date: Date; remainder: string } | null {
    const strip = (match: RegExpMatchArray) =>
        (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length)).trim()

    const hoje = input.match(/\bhoje\b/i)
    if (hoje) return { date: new Date(today), remainder: strip(hoje) }

    const ontem = input.match(/\bontem\b/i)
    if (ontem) return { date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1), remainder: strip(ontem) }

    const diaMatch = input.match(/\bdia\s+(\d{1,2})\b/i)
    if (diaMatch) {
        return {
            date: new Date(today.getFullYear(), today.getMonth(), Number.parseInt(diaMatch[1], 10)),
            remainder: strip(diaMatch),
        }
    }

    const slashMatch = input.match(/\b(\d{1,2})\/(\d{1,2})\b/)
    if (slashMatch) {
        return {
            date: new Date(today.getFullYear(), Number.parseInt(slashMatch[2], 10) - 1, Number.parseInt(slashMatch[1], 10)),
            remainder: strip(slashMatch),
        }
    }

    return null
}
