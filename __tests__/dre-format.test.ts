import { describe, it, expect } from 'vitest'
import {
  formatBRL,
  formatBRLCompact,
  formatPercent,
  formatPercentSigned,
  formatDateBR,
  formatDateInputBR,
} from '../lib/format/dre'

describe('formatBRL', () => {
  it('formata em padrão BR', () => {
    const r = formatBRL(1234.56)
    expect(r).toContain('1.234,56')
    expect(r).toContain('R$')
  })

  it('valor negativo', () => {
    const r = formatBRL(-100)
    // O Intl.NumberFormat usa "-" ou "−" (varia entre engines); só checa presença do dígito.
    expect(r).toMatch(/[\-−]/)
    expect(r).toContain('100,00')
  })

  it('zero', () => {
    expect(formatBRL(0)).toContain('0,00')
  })
})

describe('formatBRLCompact', () => {
  it('< 1k mostra completo (R$)', () => {
    expect(formatBRLCompact(500)).toContain('500,00')
  })

  // O helper existente em lib/format/money.ts usa K maiúsculo (consistência mantida)
  it('>= 1k mostra K (compactado)', () => {
    const r = formatBRLCompact(12500)
    expect(r).toContain('12,5K')
  })

  it('>= 1M mostra M (compactado)', () => {
    const r = formatBRLCompact(1500000)
    expect(r).toContain('1,5M')
  })
})

describe('formatPercent', () => {
  it('null retorna —', () => {
    expect(formatPercent(null)).toBe('—')
  })

  it('Infinity retorna —', () => {
    expect(formatPercent(Infinity)).toBe('—')
  })

  it('NaN retorna —', () => {
    expect(formatPercent(NaN)).toBe('—')
  })

  it('valor normal com 1 decimal', () => {
    expect(formatPercent(15.5)).toBe('15,5%')
  })

  it('zero formata como 0,0%', () => {
    expect(formatPercent(0)).toBe('0,0%')
  })

  it('valor negativo mantém sinal', () => {
    expect(formatPercent(-3.7)).toBe('-3,7%')
  })

  it('decimals customizado', () => {
    expect(formatPercent(15.567, 2)).toBe('15,57%')
  })
})

describe('formatPercentSigned', () => {
  it('positivo recebe +', () => {
    expect(formatPercentSigned(10)).toBe('+10,0%')
  })

  it('negativo mantém -', () => {
    expect(formatPercentSigned(-5)).toBe('-5,0%')
  })

  it('zero não recebe sinal', () => {
    expect(formatPercentSigned(0)).toBe('0,0%')
  })

  it('null retorna —', () => {
    expect(formatPercentSigned(null)).toBe('—')
  })
})

describe('formatDateBR', () => {
  it('formata DD/MM/YYYY', () => {
    expect(formatDateBR(new Date(2026, 4, 15))).toBe('15/05/2026')
  })

  it('aceita string ISO', () => {
    // Usa string sem timezone explícito → local time
    expect(formatDateBR('2026-05-15T12:00:00')).toBe('15/05/2026')
  })

  it('zero-pads dia e mês', () => {
    expect(formatDateBR(new Date(2026, 0, 5))).toBe('05/01/2026')
  })
})

describe('formatDateInputBR', () => {
  it('formato YYYY-MM-DD', () => {
    expect(formatDateInputBR(new Date(2026, 4, 15))).toBe('2026-05-15')
  })

  it('zero-pads dia e mês', () => {
    expect(formatDateInputBR(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})
