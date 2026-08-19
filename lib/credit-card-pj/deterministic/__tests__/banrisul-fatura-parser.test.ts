// Golden da fatura Banrisul (FASE 4) — trava a leitura determinística ao centavo
// contra o -layout REAL (fixture anonimizado; valores/layout idênticos ao PDF).
// REGRA 3: roda o parser real contra o texto real; se um número mudar, o teste trinca.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseBanrisulFatura } from '../banrisul-fatura-parser'
import { validateBanrisulFatura } from '../validate-banrisul-fatura'

const text = readFileSync(join(__dirname, 'fixtures/banrisul-fatura-real.txt'), 'utf-8')

describe('parseBanrisulFatura — golden agosto/2026', () => {
  const parsed = parseBanrisulFatura(text)

  it('lê os totais declarados do RESUMO', () => {
    expect(parsed.declared.totalGastos).toBe(13797.73)
    expect(parsed.declared.saldoAtual).toBe(13779.73)
    expect(parsed.declared.anterior).toBe(2677.29)
    expect(parsed.declared.pagamentosCreditos).toBe(2695.29)
    expect(parsed.declared.brasil).toBe(12224.56)
    expect(parsed.declared.exterior).toBe(1519.98)
    expect(parsed.declared.iof).toBe(53.19)
  })

  it('soma cada bucket ao centavo', () => {
    expect(parsed.computed.sumBrasil).toBe(12224.56)
    expect(parsed.computed.sumExterior).toBe(1519.98)
    expect(parsed.computed.sumIof).toBe(53.19)
    expect(parsed.computed.sumPositives).toBe(13797.73)
    expect(parsed.computed.sumEstornos).toBe(-18.0)
    expect(parsed.computed.sumPayments).toBe(-2677.29)
    expect(parsed.computed.net).toBe(13779.73) // = o que se paga
  })

  it('exclui o pagamento da fatura anterior (DEB), mantém o estorno', () => {
    // pagamento -2.677,29 NÃO vira linha; estorno -18,00 vira CREDIT
    const estornos = parsed.extraction.lines.filter((l) => l.suggestedKind === 'ESTORNO')
    expect(estornos).toHaveLength(1)
    expect(estornos[0].amount).toBe(18.0)
    expect(parsed.extraction.lines.some((l) => /DEB 0230/.test(l.description))).toBe(false)
  })

  it('marca compra internacional como EXTERIOR (2 linhas VIDAU)', () => {
    const intl = parsed.extraction.lines.filter((l) => /VIDAU/.test(l.description))
    expect(intl.map((l) => l.amount).sort((a, b) => a - b)).toEqual([467.56, 1052.42])
  })

  it('IOF exterior vira 2 encargos (continuação sem data)', () => {
    const iof = parsed.extraction.lines.filter((l) => /IOF/.test(l.description))
    expect(iof.map((l) => l.amount).sort((a, b) => a - b)).toEqual([16.36, 36.83])
  })

  it('não confunde cotação TX DÓLAR com transação', () => {
    expect(parsed.extraction.lines.some((l) => /TX D[ÓO]LAR|5,26/.test(l.description))).toBe(false)
  })

  it('extrai parcela dd/dd (BRASTELHA 01/06, MERCADOLIVRE 09/10)', () => {
    const brastelha = parsed.extraction.lines.find((l) => /BRASTELHA/.test(l.description))
    expect(brastelha?.installmentNumber).toBe(1)
    expect(brastelha?.installmentTotal).toBe(6)
  })

  it('conta 30 linhas importáveis (exclui só o pagamento DEB)', () => {
    // 25 Brasil (incl. ANUIDADEINT DIFER +18,00) + 2 Exterior + 2 IOF + 1 estorno = 30.
    // Só o pagamento da fatura anterior (-2.677,29) fica de fora. A Σ prova o número.
    expect(parsed.computed.count).toBe(30)
    expect(parsed.extraction.lines).toHaveLength(30)
    const anuidadeDebito = parsed.extraction.lines.filter((l) => /ANUIDADEINT/.test(l.description))
    expect(anuidadeDebito).toHaveLength(1)
    expect(anuidadeDebito[0].amount).toBe(18.0)
  })

  it('vencimento + cartão', () => {
    expect(parsed.extraction.dueDate).toBe('2026-08-15')
    expect(parsed.extraction.totalToPay).toBe(13779.73)
    expect(parsed.extraction.cardLastDigitsFound).toContain('0115')
  })

  it('VALIDAÇÃO fecha (as 6 checagens passam)', () => {
    const v = validateBanrisulFatura(parsed)
    expect(v.ok).toBe(true)
    expect(v.checks.every((c) => c.pass)).toBe(true)
    expect(v.checks).toHaveLength(6)
  })
})
