import { describe, expect, it } from 'vitest'
import { formatBRL } from './money'

describe('formatBRL', () => {
    it('formats with the BRL symbol and comma decimal', () => {
        expect(formatBRL(1234.5)).toBe('R$ 1.234,50')
    })

    it('formats zero', () => {
        expect(formatBRL(0)).toBe('R$ 0,00')
    })
})
