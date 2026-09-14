import { describe, expect, it } from 'vitest'
import { normalizeMerchantName } from '../src/merchants'

describe('normalizeMerchantName', () => {
    it('lowercases and strips accents', () => {
        expect(normalizeMerchantName('Americanas')).toBe('americanas')
        expect(normalizeMerchantName('Padaria São José')).toBe('padaria sao jose')
    })

    it('collapses extra whitespace', () => {
        expect(normalizeMerchantName('  Nubank   Pag  ')).toBe('nubank pag')
    })

    it('strips punctuation', () => {
        expect(normalizeMerchantName("McDonald's - Shopping")).toBe('mcdonalds shopping')
    })
})
