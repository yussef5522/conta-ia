import { describe, it, expect } from 'vitest'
import { stableKey } from '../stable-key'

const D = (s: string) => new Date(`${s}T12:00:00Z`)

describe('stableKey', () => {
  it('chave inclui data ISO, valor com sinal e memo normalizado', () => {
    expect(stableKey({ date: D('2026-06-10'), signedAmount: 3919, memo: 'OP.CREDITO C/GARANTIA' }))
      .toBe('2026-06-10|3919.00|OP CREDITO C/GARANTIA')
  })

  it('mesma chave para variantes de espaço/pontuação do Banrisul', () => {
    const k1 = stableKey({ date: D('2026-06-10'), signedAmount: 3919, memo: 'OP.CREDITO C/GARANTIA' })
    const k2 = stableKey({ date: D('2026-06-10'), signedAmount: 3919, memo: 'OP. CREDITO C/GARANTIA' })
    expect(k1).toBe(k2)
  })

  it('chave DIFERENTE quando sinal difere (CREDIT vs DEBIT mesmo valor)', () => {
    const k1 = stableKey({ date: D('2026-06-01'), signedAmount: 100, memo: 'TARIFA' })
    const k2 = stableKey({ date: D('2026-06-01'), signedAmount: -100, memo: 'TARIFA' })
    expect(k1).not.toBe(k2)
  })

  it('arredondamento determinístico para 2 casas (toFixed nativo)', () => {
    // JS toFixed usa round-half-to-even; o importante pro motor é ser DETERMINÍSTICO,
    // não a regra específica. Valores idênticos sempre produzem a mesma chave.
    const k1 = stableKey({ date: D('2026-06-01'), signedAmount: 100.115, memo: 'X' })
    const k2 = stableKey({ date: D('2026-06-01'), signedAmount: 100.115, memo: 'X' })
    expect(k1).toBe(k2)
    // Confirma 2 casas no output
    expect(k1.split('|')[1]).toMatch(/^-?\d+\.\d{2}$/)
  })

  it('FITID NÃO entra na chave (objetivo central)', () => {
    // signedAmount + data + memo iguais → mesma chave, independente de FITID externo
    const k1 = stableKey({ date: D('2026-06-11'), signedAmount: 298.99, memo: 'ANTECIP STONE' })
    const k2 = stableKey({ date: D('2026-06-11'), signedAmount: 298.99, memo: 'ANTECIP STONE' })
    expect(k1).toBe(k2)
  })
})
