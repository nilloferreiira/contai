import { describe, expect, it } from 'vitest'
import { parseAmount, parseInstallmentCount, parseRecurrenceFrequency, parseExplicitDate } from './parser'

describe('parseAmount', () => {
    it('parses a plain integer', () => {
        expect(parseAmount('20 nubank alimentação')?.value).toBe(20)
    })

    it('parses comma decimal', () => {
        expect(parseAmount('netflix 55,90 todo mes')?.value).toBe(55.9)
    })

    it('parses dot-thousands + comma decimal', () => {
        expect(parseAmount('1.200,00 em 3x na americanas')?.value).toBe(1200)
    })

    it('parses an R$ prefix', () => {
        expect(parseAmount('R$ 47,90 uber')?.value).toBe(47.9)
    })

    it('returns null when there is no number', () => {
        expect(parseAmount('uber para o trabalho')).toBeNull()
    })
})

describe('parseInstallmentCount', () => {
    it('parses "3x"', () => {
        expect(parseInstallmentCount('1200 em 3x na americanas')?.count).toBe(3)
    })

    it('parses "3 vezes"', () => {
        expect(parseInstallmentCount('1200 3 vezes')?.count).toBe(3)
    })

    it('returns null when absent', () => {
        expect(parseInstallmentCount('netflix 55,90 todo mes')).toBeNull()
    })
})

describe('parseRecurrenceFrequency', () => {
    it('parses "todo mes" as monthly', () => {
        expect(parseRecurrenceFrequency('netflix 55,90 todo mes')?.frequency).toBe('monthly')
    })

    it('parses "toda semana" as weekly', () => {
        expect(parseRecurrenceFrequency('feira toda semana')?.frequency).toBe('weekly')
    })

    it('parses "anual" as yearly', () => {
        expect(parseRecurrenceFrequency('seguro anual')?.frequency).toBe('yearly')
    })
})

describe('parseExplicitDate', () => {
    const today = new Date(2026, 8, 9) // Sep 9 2026

    it('parses "hoje"', () => {
        expect(parseExplicitDate('mercado hoje', today)?.date.toDateString()).toBe(today.toDateString())
    })

    it('parses "ontem"', () => {
        const expected = new Date(2026, 8, 8)
        expect(parseExplicitDate('mercado ontem', today)?.date.toDateString()).toBe(expected.toDateString())
    })

    it('parses "dia 12" into the current month', () => {
        expect(parseExplicitDate('aluguel dia 12', today)?.date.toDateString()).toBe(new Date(2026, 8, 12).toDateString())
    })

    it('parses "12/09" as day/month', () => {
        expect(parseExplicitDate('aluguel 12/09', today)?.date.toDateString()).toBe(new Date(2026, 8, 12).toDateString())
    })
})

import { parseExpenseInput, type ParserContext } from './parser'

const context: ParserContext = {
    cards: [{ id: 'card-1', name: 'Nubank' }],
    categories: [
        { id: 'cat-1', name: 'Alimentação' },
        { id: 'cat-2', name: 'Alimentação Fora' },
    ],
    merchants: [
        { id: 'merch-1', normalized_name: 'americanas', display_name: 'Americanas', default_category_id: 'cat-1', default_card_id: 'card-1' },
    ],
}

describe('parseExpenseInput', () => {
    const today = new Date(2026, 8, 9)

    it('extracts amount, installments, card, and merchant', () => {
        const result = parseExpenseInput('1200 em 3x na americanas no nubank', context, today)
        expect(result.amount).toBe(1200)
        expect(result.installments).toBe(3)
        expect(result.cardId).toBe('card-1')
        expect(result.merchantName).toBe('americanas')
        expect(result.ambiguous).toBe(false)
    })

    it('prefers the longest explicit category match over a shorter one', () => {
        const result = parseExpenseInput('20 alimentação fora', context, today)
        expect(result.categoryId).toBe('cat-2')
    })

    it('applies the merchant default category/card when merchant is known', () => {
        const result = parseExpenseInput('50 americanas', context, today)
        expect(result.categoryId).toBe('cat-1')
        expect(result.cardId).toBe('card-1')
    })

    it('flags ambiguous when there is no amount', () => {
        const result = parseExpenseInput('almoço no shopping', context, today)
        expect(result.ambiguous).toBe(true)
        expect(result.amount).toBeNull()
    })

    it('carries the recurrence frequency through', () => {
        const result = parseExpenseInput('netflix 55,90 todo mes', context, today)
        expect(result.frequency).toBe('monthly')
        expect(result.merchantName).toBe('netflix')
    })
})
