import { describe, it, expect } from 'vitest'
import { normalizeExact, normalizeDescription } from '../normalize'

// REGRA 1 — O BANRISUL ALTERNA A GRAFIA E A REGRA APRENDIDA PERDIA METADE (28/08/2026).
//
// Dado real da Caçula: a MESMA rubrica aparece como "OP. CREDITO C/GARANTIA" (24×, com
// espaço) e "OP.CREDITO C/GARANTIA" (30×, sem) — e no MESMO arquivo: dias 25-27/08 com
// espaço, dia 28/08 sem. A regra casava uma e ignorava a outra; o dono chegou a criar uma
// SEGUNDA regra na mão ("OP CREDITO C/GARANTIA", 0 aplicações) tentando cobrir a variante.
describe('grafia alternada do banco — ponto entre letras', () => {
  // as DUAS grafias que o banco realmente usa (diferem só pelo espaço depois do ponto)
  const VARIANTES = ['OP. CREDITO C/GARANTIA', 'OP.CREDITO C/GARANTIA']

  it('⭐⭐ as duas grafias viram o mesmo texto normalizado', () => {
    const normalizadas = VARIANTES.map(normalizeExact)
    expect(new Set(normalizadas).size).toBe(1)
    expect(normalizadas[0]).toBe('op.credito c/garantia')
  })

  it('⚠️ "Apple.Com/Bill" fica INTACTO — a 1ª tentativa quebrou o detector do cartão', () => {
    expect(normalizeExact('Apple.Com/Bill')).toBe('apple.com/bill')
  })

  it('⭐ vale no normalizeDescription também (é ele que o CONTAINS usa)', () => {
    expect(new Set(VARIANTES.map(normalizeDescription)).size).toBe(1)
  })

  it('⚠️ NÃO quebra número decimal (o ponto entre dígitos fica)', () => {
    expect(normalizeExact('TARIFA 1.234,56')).toBe('tarifa 1.234,56')
    expect(normalizeExact('PIX 2.500,00 ENVIADO')).toContain('2.500,00')
  })

  it('outras rubricas com ponto colapsam igual (consistente dos dois lados)', () => {
    expect(normalizeExact('IOF S/ OPER. CREDITO PJ')).toBe('iof s/ oper.credito pj')
  })

  it('⚠️ descrições genuinamente diferentes continuam diferentes', () => {
    expect(normalizeExact('OP CREDITO C/GARANTIA')).not.toBe(normalizeExact('LIBERACAO CREDITO'))
    expect(normalizeExact('DEBITO STONE')).not.toBe(normalizeExact('ANTECIP STONE'))
  })
})
