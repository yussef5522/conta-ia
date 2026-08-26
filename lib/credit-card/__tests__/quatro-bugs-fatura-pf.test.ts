// REGRA 1 — os 4 bugs que o dono provou comparando a TELA com o PDF (26/08).
// Cada bloco falha antes do fix e passa depois, com a fatura REAL.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseBanrisulFaturaPF } from '../../fatura-banrisul/banrisul-fatura-pf'
import { estadoDaFatura } from '../estado-fatura'

const TXT = readFileSync(
  join(__dirname, '../../fatura-banrisul/__tests__/fixtures/banrisul-fatura-pf.txt'),
  'utf-8',
)
const r = parseBanrisulFaturaPF(TXT)

// A fatura real: fecha 29/07, vence 10/08, total 18.348,72.
const FECHOU = new Date(Date.UTC(2026, 6, 29))
const VENCEU = new Date(Date.UTC(2026, 7, 10))
const TOTAL = 18348.72

describe('BUG 1 — faltavam R$ 0,62 (encargos sobre rotativo)', () => {
  it('o encargo está declarado no resumo e NÃO é linha de transação', () => {
    const m = TXT.match(/Encargos sobre rotativo\s+([\d.]+,\d{2})/i)
    expect(m?.[1]).toBe('0,62')
    // ⚠️ EXISTE uma linha de 0,62 na fatura, mas é IOF de uma compra pequena (uma das
    // 60 que somam 271,63) — coincidência de valor. O ENCARGO DE ROTATIVO não é linha
    // de transação nenhuma, e é por isso que a Σ ficava 0,62 curta.
    const rotativo = (r.extraction.lines ?? []).filter((l) => /rotativo/i.test(l.description))
    expect(rotativo).toHaveLength(0)
    const iof062 = (r.extraction.lines ?? []).filter((l) => Math.abs(l.amount - 0.62) < 0.001)
    expect(iof062).toHaveLength(1)
    expect(iof062[0].description).toMatch(/IOF/i) // é IOF, não encargo de rotativo
  })

  it('⭐ Σ das linhas + encargo = o que o BOLETO cobra, ao centavo', () => {
    const somaLinhas = r.computed.sumEstornos + r.computed.sumPositives
    expect(Math.round(somaLinhas * 100) / 100).toBeCloseTo(18348.10, 2) // era o que gravava
    expect(Math.round((somaLinhas + 0.62) * 100) / 100).toBeCloseTo(TOTAL, 2)
    expect(r.declared.saldoAtual).toBeCloseTo(TOTAL, 2)
  })
})

describe('BUG 2 — "fecha em −29 dias"', () => {
  const agora = new Date(Date.UTC(2026, 7, 26)) // hoje, bem depois do vencimento

  it('⭐ NUNCA sai número negativo de dias', () => {
    const e = estadoDaFatura({ closingDate: FECHOU, dueDate: VENCEU, totalAmount: TOTAL, paidAmount: 0 }, agora)
    expect(e.detalhe).not.toMatch(/-\d/)
    expect(e.detalhe).not.toMatch(/−\d/)
  })

  it('diz o que aconteceu, não a conta pro dono fazer', () => {
    const e = estadoDaFatura({ closingDate: FECHOU, dueDate: VENCEU, totalAmount: TOTAL, paidAmount: 0 }, agora)
    expect(e.detalhe).toBe('fechou 29/07 · venceu 10/08 (há 16 dias)')
  })

  it('fatura ABERTA fala no futuro, sem negativo', () => {
    const antes = new Date(Date.UTC(2026, 6, 20))
    const e = estadoDaFatura({ closingDate: FECHOU, dueDate: VENCEU, totalAmount: 100, paidAmount: 0 }, antes)
    expect(e.estado).toBe('ABERTA')
    expect(e.detalhe).toBe('fecha 29/07 (em 9 dias) · vence 10/08')
  })

  it('hoje/amanhã em vez de "em 0 dias" e "em 1 dias"', () => {
    const noDia = estadoDaFatura({ closingDate: FECHOU, dueDate: VENCEU, totalAmount: 100, paidAmount: 0 }, FECHOU)
    expect(noDia.detalhe).toMatch(/hoje/)
    const vespera = new Date(Date.UTC(2026, 6, 28))
    expect(estadoDaFatura({ closingDate: FECHOU, dueDate: VENCEU, totalAmount: 100, paidAmount: 0 }, vespera).detalhe).toMatch(/amanhã/)
  })
})

describe('BUG 3 — os 4 estados da fatura', () => {
  const f = (paid: number, agora: Date) =>
    estadoDaFatura({ closingDate: FECHOU, dueDate: VENCEU, totalAmount: TOTAL, paidAmount: paid }, agora)

  it('ABERTA — dentro do ciclo', () => {
    expect(f(0, new Date(Date.UTC(2026, 6, 20))).estado).toBe('ABERTA')
  })

  it('FECHADA / a pagar — fechou, ainda não venceu', () => {
    const e = f(0, new Date(Date.UTC(2026, 7, 5)))
    expect(e.estado).toBe('FECHADA')
    expect(e.rotulo).toBe('A pagar')
    expect(e.tom).toBe('amber')
  })

  it('⭐ VENCIDA — é o estado da fatura HOJE, e sai em VERMELHO', () => {
    const e = f(0, new Date(Date.UTC(2026, 7, 26)))
    expect(e.estado).toBe('VENCIDA')
    expect(e.rotulo).toBe('Vencida')
    expect(e.tom).toBe('rose')
    expect(e.devido).toBeCloseTo(TOTAL, 2)
  })

  it('PAGA — quando o pagamento casa no extrato', () => {
    const e = f(TOTAL, new Date(Date.UTC(2026, 7, 26)))
    expect(e.estado).toBe('PAGA')
    expect(e.tom).toBe('emerald')
    expect(e.devido).toBe(0)
  })

  it('⚠️ paga com ATRASO é PAGA, não vencida — vermelho é pra cobrar ação', () => {
    const e = f(TOTAL, new Date(Date.UTC(2026, 8, 30)))
    expect(e.estado).toBe('PAGA')
  })

  it('paga em parte fica âmbar e mostra o que falta', () => {
    const e = f(10000, new Date(Date.UTC(2026, 7, 26)))
    expect(e.estado).toBe('PARCIAL')
    expect(e.devido).toBeCloseTo(8348.72, 2)
  })
})

describe('BUG 4 — preview da próxima fatura', () => {
  it('⭐ o parser EXTRAI a seção que o banco declara', () => {
    expect(r.proximas.proxima).toBeCloseTo(10747.10, 2)
    expect(r.proximas.seguinte).toBeCloseTo(5012.90, 2)
    expect(r.proximas.demais).toBeCloseTo(13229.62, 2)
    expect(r.proximas.total).toBeCloseTo(28989.62, 2)
  })

  it('as partes somam o total declarado, ao centavo', () => {
    const soma = (r.proximas.proxima ?? 0) + (r.proximas.seguinte ?? 0) + (r.proximas.demais ?? 0)
    expect(Math.round(soma * 100) / 100).toBeCloseTo(r.proximas.total!, 2)
  })

  it('⭐⭐ a PROJEÇÃO calculada NÃO bate — e por isso ela não pode ser a fonte', () => {
    // Motivo, medido na fatura real: uma compra grande tem 4 parcelas cobradas na MESMA
    // fatura (01/05..04/05) e um estorno de −20.954,54 — o parcelamento foi antecipado.
    // Projetar "restam N × valor" inventa ~47 mil que nunca serão cobrados.
    let projetado = 0
    for (const l of r.extraction.lines ?? []) {
      if (l.installmentNumber != null && l.installmentTotal != null && l.installmentNumber < l.installmentTotal) {
        projetado += l.amount
      }
    }
    expect(projetado).toBeGreaterThan(20000) // muito acima dos 10.747,10 declarados
    expect(Math.abs(projetado - r.proximas.proxima!)).toBeGreaterThan(1000)
  })

  it('o estorno grande que explica a divergência está nas linhas', () => {
    const estornos = (r.extraction.lines ?? []).filter((l) => l.note?.includes('estorno'))
    expect(estornos.some((l) => Math.abs(l.amount - 20954.54) < 0.01)).toBe(true)
  })
})

describe('EXTERIOR — as linhas de dólar estão gravadas', () => {
  const lines = r.extraction.lines ?? []

  it('⭐ as compras internacionais entraram, com o R$ convertido', () => {
    const intl = lines.filter((l) => l.note?.includes('internacional'))
    expect(intl.length).toBeGreaterThan(50)
    expect(intl.every((l) => l.amount > 0)).toBe(true)
  })

  it('o IOF sobre transação no exterior bate com o declarado, ao centavo', () => {
    expect(r.computed.sumIof).toBeCloseTo(271.63, 2)
    expect(r.declared.iof).toBeCloseTo(271.63, 2)
  })

  it('⚠️ o BALDE exterior soma menos que o declarado — diferença de CLASSIFICAÇÃO', () => {
    // 7.124,23 lidos vs 7.769,30 declarados = 645,07. São linhas que o PDF conta como
    // exterior e o parser vê como doméstica (só o R$ na linha, sem a coluna US$).
    // ⚠️ NENHUM dinheiro se perde: o TOTAL fecha. É fronteira de balde, não buraco.
    expect(r.computed.sumExterior).toBeCloseTo(7124.23, 2)
    expect(r.declared.exterior).toBeCloseTo(7769.30, 2)
    expect(r.computed.sumPositives).toBeCloseTo(39302.64, 2) // o total continua exato
  })

  it('a cotação ("TX DÓLAR") não virou lançamento', () => {
    expect(lines.some((l) => /TX D[ÓO]LAR/i.test(l.description))).toBe(false)
  })
})
