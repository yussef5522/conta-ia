// GOLDEN da fatura Banrisul **PF** (26/08) — fatura REAL do dono, anonimizada.
//
// ⚠️ A fixture preserva as COLUNAS de propósito: os nomes de estabelecimento foram
// trocados por texto genérico do MESMO comprimento, porque o parser deduz as bandas
// verticais a partir de onde as datas se alinham. Anonimizar encurtando o texto
// destruiria justamente o que se quer testar.
//
// O CAMINHO ATÉ AQUI (cada número virou um comentário no parser):
//   1ª tentativa — parser PJ direto: Brasil 26.807,47 vs 39.302,64; Exterior e IOF ZERO.
//      O corte de coluna do PJ descarta a direita, que na PF tem 46 transações.
//   2ª — corte fixo em 66: 53 → 124 linhas, mas o IOF estourou (3.874,27 vs 271,63),
//      porque a página 1 (RESUMO) foi lida como se tivesse lançamentos.
//   3ª — bandas pela coluna do CABEÇALHO: a banda direita leu ZERO. O título
//      "NR. 9113" está na col 76, mas as transações daquela coluna começam na 66.
//   4ª — bandas pelas DATAS, sem filtro: uma data solta no rodapé (col 24, col 96)
//      virou "coluna" e picou a página em 4 bandas → Brasil despencou pra 1.685,12.
//   5ª — bandas pelas datas COM filtro de densidade: fecha ao centavo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseBanrisulFaturaPF, deduzirBandas, paginasDeTransacao } from '../banrisul-fatura-pf'

const TXT = readFileSync(join(__dirname, 'fixtures/banrisul-fatura-pf.txt'), 'utf-8')
const r = parseBanrisulFaturaPF(TXT)

// Encargo declarado que NÃO é linha de transação (vem só no resumo).
const rotativo = Number(
  (TXT.match(/Encargos sobre rotativo\s+([\d.]+,\d{2})/i)?.[1] ?? '0').replace(/\./g, '').replace(',', '.'),
)

describe('⭐ a fatura FECHA AO CENTAVO', () => {
  it('despesas do período = o declarado', () => {
    // ⚠️ "Despesas / Débitos no Brasil" na fatura PF É o total de tudo (Brasil +
    // exterior convertido + IOF) — não só o doméstico. Levou 2 tentativas pra
    // perceber que o alvo de comparação é este, não o "TOTAL DE GASTOS".
    expect(r.computed.sumPositives).toBeCloseTo(39302.64, 2)
    expect(r.declared.brasil).toBeCloseTo(39302.64, 2)
  })

  it('saldo anterior negativo entra como estorno, ao centavo', () => {
    expect(r.computed.sumEstornos).toBeCloseTo(-20954.54, 2)
  })

  it('⭐ saldo anterior + despesas + rotativo = SALDO DA FATURA ATUAL', () => {
    const total = r.computed.sumEstornos + r.computed.sumPositives + rotativo
    expect(Math.round(total * 100) / 100).toBeCloseTo(18348.72, 2)
    expect(r.declared.saldoAtual).toBeCloseTo(18348.72, 2)
  })

  it('IOF sobre transações no exterior bate exato', () => {
    expect(r.computed.sumIof).toBeCloseTo(271.63, 2)
    expect(r.declared.iof).toBeCloseTo(271.63, 2)
  })
})

describe('os DOIS portadores da fatura', () => {
  const soma = (final: string) =>
    (r.extraction.lines ?? [])
      .filter((l) => (l as { cardLastDigits?: string }).cardLastDigits === final)
      .reduce((s, l) => s + l.amount, 0)

  it('detecta os dois finais de cartão', () => {
    expect(r.extraction.cardLastDigitsFound?.sort()).toEqual(['5349', '9113'])
  })

  it('⭐ o subtotal do 9113 bate com o "TOTAL DE GASTOS" dele', () => {
    expect(Math.round(soma('9113') * 100) / 100).toBeCloseTo(15654.61, 2)
  })

  it('⭐ e o do 5349 também (descontando o saldo anterior, que entra no bloco dele)', () => {
    // o `amount` é sempre positivo; o −20.954,54 do saldo anterior está no bloco 5349
    expect(Math.round((soma('5349') - 20954.54) * 100) / 100).toBeCloseTo(23648.03, 2)
  })

  it('nenhum lançamento fica sem portador', () => {
    const semDono = (r.extraction.lines ?? []).filter((l) => !(l as { cardLastDigits?: string }).cardLastDigits)
    expect(semDono).toHaveLength(0)
  })
})

describe('as bandas de coluna', () => {
  it('página do RESUMO fica de fora (lá "IOF" é total, não lançamento)', () => {
    const pgs = paginasDeTransacao(TXT)
    expect(pgs.length).toBe(3) // 3 páginas de transação de 7 do PDF
  })

  it('⭐ a fronteira sai das DATAS, não do cabeçalho — e muda por página', () => {
    const pgs = paginasDeTransacao(TXT)
    expect(deduzirBandas(pgs[0]).length).toBe(2) // pág 2: duas colunas (col 2 e 66)
    expect(deduzirBandas(pgs[1]).length).toBe(2) // pág 3: duas colunas (col 2 e 69)
    expect(deduzirBandas(pgs[2]).length).toBe(1) // pág 4: coluna única
  })

  it('data solta em rodapé NÃO vira coluna (filtro de densidade)', () => {
    const pgs = paginasDeTransacao(TXT)
    // a pág 3 tem 1 data na col 24 e 1 na col 96 — ruído, não coluna
    const bandas = deduzirBandas(pgs[1])
    expect(bandas.map((b) => b.de)).toEqual([0, 69])
  })
})

describe('o dialeto compartilhado com a PJ continua valendo', () => {
  const lines = r.extraction.lines ?? []

  it('parcelas dd/dd viram installmentNumber/Total', () => {
    const parceladas = lines.filter((l) => l.installmentTotal != null)
    expect(parceladas.length).toBeGreaterThan(10)
    for (const p of parceladas) {
      expect(p.installmentNumber!).toBeLessThanOrEqual(p.installmentTotal!)
      expect(p.installmentTotal!).toBeLessThanOrEqual(24)
    }
  })

  it('compra internacional traz o R$ convertido (não o US$)', () => {
    const intl = lines.filter((l) => l.note?.includes('internacional'))
    expect(intl.length).toBeGreaterThan(0)
    expect(r.computed.sumExterior).toBeGreaterThan(0)
  })

  it('linha "TX DÓLAR" (cotação informativa) NÃO vira lançamento', () => {
    expect(lines.some((l) => /TX D[ÓO]LAR/i.test(l.description))).toBe(false)
  })

  it('"TOTAL DE GASTOS" não vira lançamento', () => {
    expect(lines.some((l) => /TOTAL DE GASTOS/i.test(l.description))).toBe(false)
  })
})
