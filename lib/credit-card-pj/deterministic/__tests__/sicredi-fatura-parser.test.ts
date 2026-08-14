// Sprint BUG B FASE a — REGRA 3: executa o parser contra o FIXTURE REAL da fatura
// Sicredi 08/2026 (pdftotext -layout, 6 páginas, anonimizado só no nome/endereço/
// final do cartão — valores e layout idênticos ao PDF). O Yussef validou o protótipo
// contra este dado e as 4 validações fecham. Aqui o parser tem que reproduzir isso.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseSicrediFatura, parseBRL } from '../sicredi-fatura-parser'
import { validateSicrediFatura } from '../validate-fatura'

const FATURA = readFileSync(
  fileURLToPath(new URL('./fixtures/sicredi-fatura-real.txt', import.meta.url)),
  'utf8',
)
const parsed = parseSicrediFatura(FATURA)
const byAmount = (a: number) => parsed.extraction.lines.find((l) => l.amount === a)

describe('parseBRL', () => {
  it('positivo e negativo', () => {
    expect(parseBRL('R$ 99,94')).toBe(99.94)
    expect(parseBRL('-R$ 2.304,83')).toBe(-2304.83)
  })
})

describe('fixture REAL — totais e somas (as 4 validações do Yussef)', () => {
  it('extrai os totais declarados SEM cair no quadro Limite (armadilha crítica)', () => {
    expect(parsed.declared.totalCartao).toBe(7995.55) // "Total cartão (final XXXX)" com R$
    expect(parsed.declared.totalFatura).toBe(7896.32) // "Total desta Fatura" sem R$
    expect(parsed.declared.brasil).toBe(7882.8)
    expect(parsed.declared.exterior).toBe(112.75)
    expect(parsed.declared.pagamentosCreditos).toBe(-2404.06)
    // NÃO pegou o limite (R$ 25.000,00) em lugar nenhum:
    expect(Object.values(parsed.declared)).not.toContain(25000)
  })

  it('somas com sinal', () => {
    expect(parsed.computed.sumPositives).toBe(7995.55) // = Total cartão
    expect(parsed.computed.sumEstornos).toBe(-99.23)
    expect(parsed.computed.sumPayments).toBe(-2304.83)
  })

  it('a validação (juiz) FECHA nas 4 checagens', () => {
    const v = validateSicrediFatura(parsed)
    expect(v.ok).toBe(true)
    expect(v.checks.length).toBeGreaterThanOrEqual(4)
    expect(v.checks.every((c) => c.pass)).toBe(true)
  })
})

describe('fixture REAL — as 7 armadilhas', () => {
  it('trap 6 — pagamento da fatura anterior NÃO entra', () => {
    expect(parsed.extraction.lines.some((l) => /pagamento 024380827/i.test(l.description))).toBe(false)
  })

  it('trap 1 — descrição internacional em 2 linhas: junta cima+baixo', () => {
    expect(byAmount(112.75)?.description).toBe('Bnanacademy Com London Gb')
    // o estorno internacional também: "Shein Shein Co Vila Olimpia" + "Br"
    expect(byAmount(99.23)?.description).toBe('Shein Shein Co Vila Olimpia Br')
  })

  it('trap 2 — NÃO deduplica: 2 Mercadolivre Tioali 26/jun, valores distintos', () => {
    const ml = parsed.extraction.lines.filter((l) => l.description.includes('Mercadolivre Tioali'))
    expect(ml).toHaveLength(2)
    expect(ml.map((l) => l.amount).sort((a, b) => a - b)).toEqual([13.03, 24.98])
  })

  it('trap 4 — ano sem ano: out/2025 (mês > fechamento 07)', () => {
    const becker = parsed.extraction.lines.find((l) => l.description.includes('Lojas Becker'))
    expect(becker?.date).toBe('2025-10-10')
    // e uma de julho é 2026
    expect(byAmount(99.94)?.date).toBe('2026-07-27') // Ross Confeitaria
  })

  it('trap 5 — parcela 01/04 vira installment, não data', () => {
    const shein = parsed.extraction.lines.find((l) => l.amount === 47.94)
    expect(shein?.installmentNumber).toBe(1)
    expect(shein?.installmentTotal).toBe(4)
  })

  it('trap 7 — IOF sem cidade/tipo é encargo financeiro', () => {
    const iof = byAmount(3.94)
    expect(iof?.suggestedKind).toBe('ENCARGO_FINANCEIRO')
    expect(iof?.description).toMatch(/iof/i)
  })

  it('estorno negativo entra como IGNORAR', () => {
    expect(byAmount(99.23)?.suggestedKind).toBe('IGNORAR')
  })
})

describe('fixture REAL — falha quando NÃO fecha (impossibilidade)', () => {
  it('tirar uma transação → soma não bate → juiz FALHA', () => {
    const semUma = FATURA.replace(/.*Ross Confeitaria Ltda.*R\$ 99,94.*\n/, '')
    const v = validateSicrediFatura(parseSicrediFatura(semUma))
    expect(v.ok).toBe(false)
    expect(v.message).toMatch(/não fecha|não vou importar/i)
  })
})
