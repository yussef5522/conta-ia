// Sprint 5.0.2.f — Validadores de elegibilidade dos regimes.

import { describe, it, expect } from 'vitest'
import {
  validateSimplesNacional,
  validateLucroPresumido,
  validateLucroReal,
  calcularRBAProjecada,
  isCNAEVedadoSimples,
} from '@/lib/tax/regime-validators'

describe('validateSimplesNacional — limite R$ 4,8M', () => {
  it('aplicável quando RBA projetada ≤ R$ 4,8M', () => {
    const r = validateSimplesNacional({ rbaProjecada12m: 4_500_000 })
    expect(r.aplicavel).toBe(true)
  })

  it('aplicável exatamente no limite R$ 4,8M', () => {
    const r = validateSimplesNacional({ rbaProjecada12m: 4_800_000 })
    expect(r.aplicavel).toBe(true)
  })

  it('NÃO aplicável quando > R$ 4,8M (caso Cacula Mix 5,4M)', () => {
    const r = validateSimplesNacional({ rbaProjecada12m: 5_400_000 })
    expect(r.aplicavel).toBe(false)
    expect(r.motivoNaoAplicavel).toContain('5,4M')
    expect(r.motivoNaoAplicavel).toContain('4,8M')
    expect(r.baseLegal).toBe('LC 123/2006 art. 3º, II')
  })

  it('NÃO aplicável quando 1 real acima do limite', () => {
    const r = validateSimplesNacional({ rbaProjecada12m: 4_800_001 })
    expect(r.aplicavel).toBe(false)
  })
})

describe('validateSimplesNacional — CNAE vedado', () => {
  it('CNAE bancário 6422-1/00 → vedado', () => {
    const r = validateSimplesNacional({
      rbaProjecada12m: 1_000_000,
      cnaeCode: '6422-1/00',
    })
    expect(r.aplicavel).toBe(false)
    expect(r.motivoNaoAplicavel).toMatch(/CNAE.*vedado/i)
    expect(r.baseLegal).toContain('art. 17')
  })

  it('CNAE factoring 6491-3/00 → vedado', () => {
    const r = validateSimplesNacional({
      rbaProjecada12m: 1_000_000,
      cnaeCode: '6491-3/00',
    })
    expect(r.aplicavel).toBe(false)
  })

  it('Restaurante 5611-2/01 → permitido', () => {
    const r = validateSimplesNacional({
      rbaProjecada12m: 1_000_000,
      cnaeCode: '5611-2/01',
    })
    expect(r.aplicavel).toBe(true)
  })
})

describe('validateSimplesNacional — outros impedimentos', () => {
  it('hasSocioPJ → vedado', () => {
    const r = validateSimplesNacional({
      rbaProjecada12m: 1_000_000,
      hasSocioPJ: true,
    })
    expect(r.aplicavel).toBe(false)
    expect(r.motivoNaoAplicavel).toMatch(/sócio.*jurídica/i)
  })

  it('hasDebitos → vedado', () => {
    const r = validateSimplesNacional({
      rbaProjecada12m: 1_000_000,
      hasDebitos: true,
    })
    expect(r.aplicavel).toBe(false)
    expect(r.motivoNaoAplicavel).toMatch(/débitos/i)
  })

  it('ordem de validação: limite tem prioridade sobre outras', () => {
    const r = validateSimplesNacional({
      rbaProjecada12m: 5_000_000,
      cnaeCode: '6422-1/00',
      hasSocioPJ: true,
    })
    expect(r.aplicavel).toBe(false)
    expect(r.motivoNaoAplicavel).toContain('4,8M')
  })
})

describe('validateLucroPresumido — limite R$ 78M', () => {
  it('aplicável quando RBA projetada ≤ R$ 78M', () => {
    const r = validateLucroPresumido({ rbaProjecada12m: 50_000_000 })
    expect(r.aplicavel).toBe(true)
  })

  it('aplicável exatamente no limite', () => {
    const r = validateLucroPresumido({ rbaProjecada12m: 78_000_000 })
    expect(r.aplicavel).toBe(true)
  })

  it('NÃO aplicável quando > R$ 78M', () => {
    const r = validateLucroPresumido({ rbaProjecada12m: 80_000_000 })
    expect(r.aplicavel).toBe(false)
    expect(r.motivoNaoAplicavel).toContain('78M')
    expect(r.baseLegal).toBe('Lei 9.718/1998 art. 13')
  })

  it('CNAE bancário → obrigado ao Real', () => {
    const r = validateLucroPresumido({
      rbaProjecada12m: 1_000_000,
      cnaeCode: '6422-1/00',
    })
    expect(r.aplicavel).toBe(false)
    expect(r.motivoNaoAplicavel).toMatch(/obriga.*Lucro Real/i)
    expect(r.baseLegal).toBe('Lei 9.718/1998 art. 14')
  })
})

describe('validateLucroReal — sempre aplicável', () => {
  it('sempre retorna aplicavel:true', () => {
    expect(validateLucroReal().aplicavel).toBe(true)
  })
})

describe('calcularRBAProjecada — pega o MAIOR', () => {
  it('histórico baixo + receita mensal alta → usa projeção 12×', () => {
    // Caso Cacula Mix em teste: histórico 0, simula 450k/mês → projeção 5,4M
    expect(calcularRBAProjecada(0, 450_000)).toBe(5_400_000)
  })

  it('histórico alto + simulação baixa → usa histórico', () => {
    expect(calcularRBAProjecada(10_000_000, 100_000)).toBe(10_000_000)
  })

  it('valores iguais → pega qualquer um', () => {
    expect(calcularRBAProjecada(1_200_000, 100_000)).toBe(1_200_000)
  })

  it('zero/zero → zero', () => {
    expect(calcularRBAProjecada(0, 0)).toBe(0)
  })
})

describe('isCNAEVedadoSimples', () => {
  it('Restaurante 5611-2/01 → não vedado', () => {
    expect(isCNAEVedadoSimples('5611-2/01')).toBe(false)
  })

  it('Bancário 6422-1/00 → vedado', () => {
    expect(isCNAEVedadoSimples('6422-1/00')).toBe(true)
  })

  it('Factoring 6491-3/00 → vedado', () => {
    expect(isCNAEVedadoSimples('6491-3/00')).toBe(true)
  })
})
