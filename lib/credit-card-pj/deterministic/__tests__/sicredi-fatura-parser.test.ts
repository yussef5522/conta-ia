// Sprint BUG B FASE a — REGRA 3: executa o parser determinístico da fatura Sicredi
// contra o formato REAL do pdftotext -layout, cobrindo as 7 armadilhas que o Yussef
// provou rodando, + a tripla validação (o juiz).

import { describe, it, expect } from 'vitest'
import { parseSicrediFatura, parseBRL } from '../sicredi-fatura-parser'
import { validateSicrediFatura } from '../validate-fatura'

// Fatura sintética no formato -layout (colunas separadas por 2+ espaços). Totais
// batem por construção pra a validação passar.
const FATURA = [
  'Fatura Sicredi',
  'Fechamento 28/07/2026        Vencimento 13/08/2026',
  '',
  '   27/jul 13:44    Balneario Cam    Presencial   Ross Confeitaria Ltda        R$ 99,94',
  '   19/jul 17:36    Barueri          Online       Viajanet                     R$ 922,72',
  '   10/jul 12:22    Vila Olimpia     Online       Shein Shein Co     01/04      R$ 47,94',
  '      Bnanacademy Com London',
  '   15/jul 14:14                     US$ 22,00                                  R$ 112,75',
  '      Gb',
  '   16/jul 09:00    Iof Compra Internacional                                   R$ 5,12',
  '   26/jun 12:44    Itabora          Online       Mercadolivre Tioali  01/03   R$ 13,03',
  '   26/jun 12:44    Sao Paulo        Online       Mercadolivre Tioali  01/03   R$ 24,98',
  '   05/out 08:00    Sao Paulo        Online       Loja Parcelada     10/10     R$ 50,00',
  '   25/jun 10:00    Vila Olimpia     Online       Shein Shein Co              -R$ 99,23',
  '   13/jul 23:27                                  Pagamento 024380827         -R$ 2.304,83',
  '',
  'Total cartao (final 0115)                                                     R$ 1.276,48',
  'Total Brasil                                                                  R$ 1.158,61',
  'Total Exterior                                                                R$ 117,87',
  'Total desta Fatura                                                            R$ 1.177,25',
  'Pagamentos|Creditos                                                          -R$ 2.404,06',
].join('\n')

describe('parseBRL', () => {
  it('positivo e negativo', () => {
    expect(parseBRL('R$ 99,94')).toBe(99.94)
    expect(parseBRL('-R$ 2.304,83')).toBe(-2304.83)
    expect(parseBRL('nada')).toBeNull()
  })
})

describe('parser Sicredi — 7 armadilhas', () => {
  const parsed = parseSicrediFatura(FATURA)
  const byDesc = (frag: string) => parsed.extraction.lines.find((l) => l.description.includes(frag))

  it('trap 6 — pagamento da fatura anterior NÃO entra; soma vai pro sumPayments', () => {
    expect(parsed.extraction.lines.some((l) => /pagamento/i.test(l.description))).toBe(false)
    expect(parsed.computed.sumPayments).toBe(-2304.83)
  })

  it('trap 1 — descrição internacional em múltiplas linhas: junta cima+baixo', () => {
    const intl = parsed.extraction.lines.find((l) => l.amount === 112.75)
    expect(intl?.description).toBe('Bnanacademy Com London Gb')
  })

  it('trap 2 — NÃO deduplica: 2 Mercadolivre mesma data/hora/desc/parcela, valores distintos', () => {
    const ml = parsed.extraction.lines.filter((l) => l.description.includes('Mercadolivre Tioali'))
    expect(ml).toHaveLength(2)
    expect(ml.map((l) => l.amount).sort()).toEqual([13.03, 24.98])
  })

  it('trap 4 — ano sem ano: jul→2026, out→2025 (mês > fechamento)', () => {
    expect(byDesc('Ross')?.date).toBe('2026-07-27')
    expect(byDesc('Loja Parcelada')?.date).toBe('2025-10-05')
  })

  it('trap 5 — parcela 01/04 vira installment, não data', () => {
    const shein = parsed.extraction.lines.find((l) => l.description === 'Shein Shein Co' && l.amount === 47.94)
    expect(shein?.installmentNumber).toBe(1)
    expect(shein?.installmentTotal).toBe(4)
  })

  it('trap 7 — IOF sem cidade/tipo é encargo financeiro', () => {
    const iof = byDesc('Iof')
    expect(iof?.suggestedKind).toBe('ENCARGO_FINANCEIRO')
    expect(iof?.amount).toBe(5.12)
  })

  it('estorno negativo entra como IGNORAR e soma no sumEstornos', () => {
    expect(parsed.computed.sumEstornos).toBe(-99.23)
    const est = parsed.extraction.lines.find((l) => l.amount === 99.23)
    expect(est?.suggestedKind).toBe('IGNORAR')
  })

  it('conta certo: 9 linhas importáveis (10 âncoras − 1 pagamento)', () => {
    expect(parsed.computed.count).toBe(9)
    expect(parsed.computed.sumPositives).toBe(1276.48)
  })
})

describe('validação (o juiz) — REGRA da impossibilidade', () => {
  it('tripla validação fecha → ok', () => {
    const v = validateSicrediFatura(parseSicrediFatura(FATURA))
    expect(v.ok).toBe(true)
    // os 4 checks presentes e passando
    expect(v.checks.every((c) => c.pass)).toBe(true)
    expect(v.checks.find((c) => c.name.includes('Total cartão'))?.expected).toBe(1276.48)
  })

  it('linha perdida → NÃO fecha → FALHA (não grava)', () => {
    // remove a Viajanet (922,72): a soma some, o total declarado fica maior.
    const semViajanet = FATURA.replace(/.*Viajanet.*\n/, '')
    const v = validateSicrediFatura(parseSicrediFatura(semViajanet))
    expect(v.ok).toBe(false)
    expect(v.message).toMatch(/não fecha|não vou importar/i)
  })

  it('sem nenhum total declarado → FALHA (não dá pra julgar)', () => {
    const semTotais = FATURA.split('\n').filter((l) => !/^total|pagamentos\|/i.test(l)).join('\n')
    const v = validateSicrediFatura(parseSicrediFatura(semTotais))
    expect(v.ok).toBe(false)
    expect(v.message).toMatch(/não encontrei os totais|não vou importar/i)
  })
})
