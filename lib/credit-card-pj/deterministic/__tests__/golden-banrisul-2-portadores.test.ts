// ⭐⭐⭐ O GOLDEN DA FATURA QUE RECUSOU TRÊS VEZES — E ELE VEIO DA QUARENTENA (17/09/2026)
//
// **A régua de processo do dono, cumprida aqui pela primeira vez:** *"correção de parser SÓ
// é aceita com o texto real do caso na suíte (quarentena → teste). Reconstrução nunca mais
// vira prova."*
//
// A fixture é o texto que o motor leu **em produção** quando recusou (registro
// `cmu4xpfv00064z0ci36uz0q8n`, cartão "Carter banrisul"), anonimizado com trocas do MESMO
// comprimento — a geometria das colunas é justamente o que está sob teste.
//
// ⛔⛔ **O DEFEITO QUE ELE CONGELA:** a empresa ganhou um **cartão adicional** (`0123`) cujo
// histórico mora na **coluna direita** da página de lançamentos. O parser PJ cortava a
// direita fora **por desenho** (`cutCol`, ~68) — a defesa contra BanriClube/pontos/limites —
// e junto ia o `ANUIDADEINT DIFER 05/12 0123 · +18,00`. A conferência acusava **−18,00**,
// três vezes, sempre o mesmo número.
//
// ⚠️ E "ler a direita inteira" **não** era a cura: medido neste mesmo texto, isso inventa um
// `IOF de 1.585,81` colhido da tabela de taxas do painel. O corte existia por um motivo
// real; o que faltava era distinguir **painel** de **coluna**.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseBanrisulFatura } from '../banrisul-fatura-parser'
import { escolherParser } from '../../extract-invoice-smart'
import { classificarLinhas, readVenc } from '@/lib/fatura-banrisul/nucleo'

const TEXTO = readFileSync(
  join(process.cwd(), 'lib/credit-card-pj/deterministic/__tests__/fixtures/banrisul-pj-2-portadores.txt'),
  'utf-8',
)

describe('⭐⭐ a fatura de 2 portadores do Banrisul PJ fecha ao centavo', () => {
  it('⭐ o registry escolhe o parser do Banrisul', () => {
    expect(escolherParser(TEXTO)?.bank).toBe('Banrisul')
  })

  /** ⭐⭐ O NÚMERO DO DONO: 11.376,89 = 11.225,33 do titular + 151,56 do adicional. */
  it('⭐⭐ V1/V4 — a soma das linhas bate com os dois totais declarados', () => {
    const r = parseBanrisulFatura(TEXTO)
    expect(r.declared.brasil, 'Despesas / Débitos no Brasil').toBe(11376.89)
    expect(r.declared.totalGastos, 'Σ dos TOTAL DE GASTOS dos dois portadores').toBe(11376.89)
    expect(r.computed.sumBrasil, 'perdeu lançamento do portador adicional').toBe(11376.89)
    expect(r.computed.sumPositives).toBe(11376.89)
  })

  it('⭐ a validação do import passa (é ela que autoriza gravar)', () => {
    const det = escolherParser(TEXTO)!
    const v = det.validate(det.parse(TEXTO) as never)
    expect(v.ok, v.message ?? 'a fatura não fecha').toBe(true)
  })

  it('⭐ os dois portadores, 33 lançamentos e o vencimento', () => {
    const e = parseBanrisulFatura(TEXTO).extraction
    expect(e.cardLastDigitsFound).toEqual(['0115', '0123'])
    expect(e.lines).toHaveLength(33)
    expect(e.dueDate).toBe('2026-09-15')
    expect(e.totalToPay, 'Saldo da fatura atual').toBe(8626.98)
  })

  /**
   * ⛔ O PAR DE ANUIDADE DO ADICIONAL — **as duas linhas**, e marcadas com o cartão DELE.
   * Elas se anulam no saldo, mas o débito entra em Brasil e é ele que sumia.
   */
  it('⭐ o par de anuidade do 0123 entra inteiro, marcado com o cartão dele', () => {
    const linhas = parseBanrisulFatura(TEXTO).extraction.lines ?? []
    const anuidade = linhas.filter((l) => /ANUID/i.test(l.description))
    expect(anuidade, 'o par de anuidade sumiu').toHaveLength(2)
    for (const l of anuidade) {
      expect(l.amount).toBe(18)
      expect((l as { cardLastDigits?: string }).cardLastDigits).toBe('0123')
    }
    expect(anuidade.filter((l) => l.note?.includes('estorno')), 'o DESC. ANUID. é crédito').toHaveLength(1)
  })
})

describe('⛔ o contrafactual: por que o corte fixo recusava', () => {
  /**
   * ⭐ Este teste executa a régua ANTIGA (ler só `[0, cutCol)`) contra o texto real e mostra
   * o número que o dono viu três vezes. ⚠️ Ele não protege código nenhum — ele **documenta
   * a causa com o documento na mão**, que é o que faltava nas duas rodadas anteriores.
   */
  it('⛔ lendo só a coluna esquerda, a soma dá 11.358,89 — a dif de −18,00', () => {
    const linhas = TEXTO.split(/\r?\n/).map((l) => l.replace(/\s+$/, '').slice(0, 68))
    const bucketed = classificarLinhas(linhas, readVenc(TEXTO))
    const soma = Math.round(
      bucketed.filter((b) => b.bucket === 'BRASIL').reduce((a, b) => a + b.value, 0) * 100,
    ) / 100
    expect(soma).toBe(11358.89)
    expect(Math.round((soma - 11376.89) * 100) / 100).toBe(-18)
  })

  /**
   * ⛔⛔ E POR QUE "LER A DIREITA INTEIRA" TAMBÉM ESTAVA ERRADO: o painel de taxas entrega
   * um IOF que não existe. É a razão de o corte ter sido criado — e a razão de a cura ser
   * a geometria por bandas, não a remoção da defesa.
   */
  it('⛔ lendo a direita crua, o painel inventa um IOF de 1.585,81', () => {
    const direita = TEXTO.split(/\r?\n/).map((l) => l.replace(/\s+$/, '').slice(68))
    const bucketed = classificarLinhas(direita, readVenc(TEXTO))
    const iof = bucketed.filter((b) => b.bucket === 'IOF').reduce((a, b) => a + b.value, 0)
    expect(Math.round(iof * 100) / 100).toBe(1585.81)
    expect(parseBanrisulFatura(TEXTO).computed.sumIof, 'o parser real não cai nessa').toBe(0)
  })
})
