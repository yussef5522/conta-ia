// Golden da fatura Caixa (FASE 4) — trava a leitura determinística ao centavo contra
// o -layout REAL (fixture anonimizado). O ponto central: os 3 créditos (sufixo C,
// 12,58) que o Vision PERDEU têm que entrar — é o K1/K4/REGRA 6. REGRA 3: roda o
// parser real contra o texto real.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCaixaFatura } from '../caixa-fatura-parser'
import { validateCaixaFatura } from '../validate-caixa-fatura'

const text = readFileSync(join(__dirname, 'fixtures/caixa-fatura-real.txt'), 'utf-8')

describe('parseCaixaFatura — golden agosto/2026', () => {
  const parsed = parseCaixaFatura(text)

  it('lê os totais declarados (âncora "Valor total desta fatura")', () => {
    expect(parsed.declared.valorTotalFatura).toBe(7280.39)
    expect(parsed.declared.totalFinalByCard['2937']).toBe(7.55)
    expect(parsed.declared.totalFinalByCard['3883']).toBe(7285.42)
    expect(parsed.declared.totalCompras).toBe(5490.21)
    expect(parsed.declared.totalParceladas).toBe(1782.71)
    expect(parsed.declared.totalDemonstrativo).toBe(12.58)
  })

  it('recupera os 3 créditos quebrados no -layout (o que o Vision perdeu)', () => {
    const creditos = parsed.extraction.lines.filter((l) => l.suggestedKind === 'ESTORNO')
    expect(creditos).toHaveLength(3)
    expect(creditos.map((l) => l.amount).sort((a, b) => a - b)).toEqual([0.04, 0.04, 12.5])
    expect(parsed.computed.sumCredits).toBe(-12.58)
  })

  it('soma por cartão ao centavo (V1/V2)', () => {
    expect(parsed.computed.debitsByCard['2937']).toBe(7.55)
    expect(parsed.computed.debitsByCard['3883']).toBe(7285.42)
  })

  it('soma por seção ao centavo', () => {
    expect(parsed.computed.comprasSum).toBe(5490.21)
    expect(parsed.computed.parceladasSum).toBe(1782.71)
    expect(parsed.computed.sumDebits).toBe(7292.97) // 7,55 + 7.285,42
  })

  it('net = Valor total desta fatura (débitos − créditos)', () => {
    expect(parsed.computed.net).toBe(7280.39) // 7.292,97 − 12,58
  })

  it('exclui informativo (TOTAL FATURA ANTERIOR) e pagamento (OBRIGADO)', () => {
    expect(parsed.extraction.lines.some((l) => /FATURA ANTERIOR|OBRIGADO/i.test(l.description))).toBe(false)
  })

  it('parcela "08 DE 10" (DUFRIO) vira 8/10, data da compra ano-1', () => {
    const dufrio = parsed.extraction.lines.find((l) => /DUFRIO/.test(l.description))
    expect(dufrio?.installmentNumber).toBe(8)
    expect(dufrio?.installmentTotal).toBe(10)
    expect(dufrio?.date).toBe('2025-12-10') // 10/12, mês > venc(08) ⇒ ano anterior
  })

  it('conta 18 linhas importáveis (15 débitos + 3 créditos)', () => {
    expect(parsed.computed.count).toBe(18)
    expect(parsed.extraction.lines).toHaveLength(18)
    expect(parsed.extraction.lines.filter((l) => l.suggestedKind !== 'ESTORNO')).toHaveLength(15)
  })

  it('multi-cartão: 2937 e 3883 detectados', () => {
    expect(parsed.extraction.cardLastDigitsFound.sort()).toEqual(['2937', '3883'])
  })

  it('VALIDAÇÃO fecha (as 6 checagens passam)', () => {
    const v = validateCaixaFatura(parsed)
    expect(v.ok).toBe(true)
    expect(v.checks.every((c) => c.pass)).toBe(true)
    expect(v.checks).toHaveLength(6) // 2 cartões + compras + parceladas + créditos + total
  })
})
