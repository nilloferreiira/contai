export function parseAmount(input: string): { value: number; remainder: string } | null {
    const match = input.match(/(?:R\$?\s*)?(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:,\d{2})?)/i)
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

import { normalizeMerchantName } from './merchants'

export interface ParserCard {
    id: string
    name: string
}

export interface ParserCategory {
    id: string
    name: string
}

export interface ParserMerchant {
    id: string
    normalized_name: string
    display_name: string
    default_category_id: string | null
    default_card_id: string | null
}

export interface ParserContext {
    cards: ParserCard[]
    categories: ParserCategory[]
    merchants: ParserMerchant[]
}

export interface ParsedExpense {
    amount: number | null
    installments: number | null
    frequency: 'weekly' | 'monthly' | 'yearly' | null
    cardId: string | null
    categoryId: string | null
    merchantName: string | null
    purchaseDate: Date
    ambiguous: boolean
}

function matchCard(input: string, cards: ParserCard[]): { id: string; remainder: string } | null {
    for (const card of cards) {
        const pattern = new RegExp(`\\b${escapeRegExp(card.name)}\\b`, 'i')
        const match = input.match(pattern)
        if (match) {
            return { id: card.id, remainder: (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length)).trim() }
        }
    }
    return null
}

function matchExplicitCategory(input: string, categories: ParserCategory[]): { id: string; remainder: string } | null {
    const sorted = [...categories].sort((a, b) => b.name.length - a.name.length)
    for (const category of sorted) {
        const pattern = new RegExp(`\\b${escapeRegExp(category.name)}\\b`, 'i')
        const match = input.match(pattern)
        if (match) {
            return { id: category.id, remainder: (input.slice(0, match.index) + input.slice((match.index ?? 0) + match[0].length)).trim() }
        }
    }
    return null
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const CONNECTOR_WORDS = new Set(['na', 'no', 'em', 'de', 'do', 'da'])

// Strips connector words only from the leading/trailing edges of the
// remainder (leftover words like "na"/"no" from "na americanas no nubank"
// after the card token is removed) — never from the middle, so a real
// merchant name that legitimately contains one of these words internally
// (e.g. "Casa do Pão", "Casa de Carnes") is left intact.
function stripConnectorWords(input: string): string {
    const words = input.trim().split(/\s+/).filter((word) => word.length > 0)

    let start = 0
    let end = words.length
    while (start < end && CONNECTOR_WORDS.has(words[start].toLowerCase())) start++
    while (end > start && CONNECTOR_WORDS.has(words[end - 1].toLowerCase())) end--

    return words.slice(start, end).join(' ')
}

export function parseExpenseInput(input: string, context: ParserContext, today: Date): ParsedExpense {
    let remainder = input

    const amountResult = parseAmount(remainder)
    if (amountResult) remainder = amountResult.remainder

    const installmentResult = parseInstallmentCount(remainder)
    if (installmentResult) remainder = installmentResult.remainder

    const recurrenceResult = parseRecurrenceFrequency(remainder)
    if (recurrenceResult) remainder = recurrenceResult.remainder

    const cardResult = matchCard(remainder, context.cards)
    if (cardResult) remainder = cardResult.remainder

    const categoryResult = matchExplicitCategory(remainder, context.categories)
    if (categoryResult) remainder = categoryResult.remainder

    const dateResult = parseExplicitDate(remainder, today)
    if (dateResult) remainder = dateResult.remainder

    const merchantName = stripConnectorWords(remainder) || null
    const matchedMerchant = merchantName
        ? context.merchants.find((m) => m.normalized_name === normalizeMerchantName(merchantName))
        : undefined

    return {
        amount: amountResult?.value ?? null,
        installments: installmentResult?.count ?? null,
        frequency: recurrenceResult?.frequency ?? null,
        cardId: cardResult?.id ?? matchedMerchant?.default_card_id ?? null,
        categoryId: categoryResult?.id ?? matchedMerchant?.default_category_id ?? null,
        merchantName: merchantName ? normalizeMerchantName(merchantName) : null,
        purchaseDate: dateResult?.date ?? today,
        ambiguous: amountResult === null,
    }
}
