// ⛔⛔⛔ BANNER E RODAPÉ LENDO A MESMA CONTA (17/09/2026)
//
// **O dono, na fatura da Caixa:** *"a tela se contradiz: o banner do topo diz 'não fecha'
// (somou compras+encargos 5.119,53 sem SUBTRAIR os estornos 12,54) enquanto o rodapé diz
// '✓ bate: 5.106,99'. Duas réguas na mesma tela."*
//
// ⭐ **A conta principal SEMPRE esteve certa** (`diferenca 0`). Quem reprovava era um **check
// secundário**: ele confere o BRUTO contra o *"Total cartão"* declarado — e **a Caixa declara
// um número só**, o que se paga. O parser o devolve nos dois campos, e o check passava a
// comparar **bruto contra líquido**.
//
// ⛔ A cura não é remover a defesa: é ela só existir quando há **duas declarações
// diferentes** pra conferir. O Banrisul PJ declara `TOTAL DE GASTOS` **e** `Saldo da fatura
// atual` (13.797,73 × 13.779,73) — lá o check continua mordendo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCaixaFatura } from '@/lib/credit-card-pj/deterministic/caixa-fatura-parser'
import { checkInvoiceTotals } from '@/lib/credit-card-pj/totals-check'

const TEXTO = readFileSync(
  join(process.cwd(), 'lib/credit-card-pj/deterministic/__tests__/fixtures/caixa-fatura-rica.txt'),
  'utf-8',
)

describe('⭐⭐ a fatura rica da Caixa fecha — e o banner diz isso', () => {
  const c = () => checkInvoiceTotals(parseCaixaFatura(TEXTO).extraction)

  it('⭐⭐ Σ débitos − Σ estornos = o declarado, ao centavo', () => {
    const r = c()
    expect(r.totalCartao, 'compras + encargos').toBe(5119.53)
    expect(r.totalEstornos).toBe(12.54)
    expect(r.totalFatura, 'o que se paga').toBe(5106.99)
    expect(r.totalDeclaradoFatura).toBe(5106.99)
    expect(r.diferenca).toBe(0)
  })

  /** ⛔ O DEFEITO DO DONO: `matches` vinha FALSE com a diferença ZERO. */
  it('⭐⭐ o veredito do BANNER concorda com a conta', () => {
    expect(c().matches, 'o banner voltou a dizer "não fecha" numa fatura que fecha').toBe(true)
  })

  it('⭐ e a mensagem mostra a conta inteira, não só o veredito', () => {
    const m = c().message
    expect(m).toContain('5.119,53')
    expect(m).toContain('12,54')
    expect(m).toContain('5.106,99')
    expect(m, 'a frase do defeito voltou').not.toMatch(/Total cartão não bate/)
  })

  it('⭐ os casos ricos estão todos no documento', () => {
    for (const caso of [/ROTATIVO/i, /MULTA/i, /MORA/i, /IOF/i, /ANUIDADE/i]) {
      expect(TEXTO, `sumiu ${caso} da fixture`).toMatch(caso)
    }
    expect(parseCaixaFatura(TEXTO).extraction.lines).toHaveLength(15)
  })
})

describe('⛔ e a defesa do "Total cartão" continua mordendo onde há DOIS declarados', () => {
  /**
   * ⚠️ Sem isto o conserto viraria um buraco: o check existe pra pegar fatura em que o BRUTO
   * declarado não bate com a soma — e o Banrisul PJ declara os dois números.
   */
  it('⭐ dois declarados DIFERENTES: o bruto errado ainda reprova', () => {
    const r = checkInvoiceTotals({
      totalDeclared: 100, // "Total cartão" declarado
      totalToPay: 90, // "Total desta Fatura"
      lines: [
        { date: '2026-09-01', description: 'compra', amount: 80, suggestedKind: 'COMPRA_AVISTA' },
        { date: '2026-09-02', description: 'estorno', amount: 10, suggestedKind: 'ESTORNO' },
      ],
    } as never)
    // o net fecha (80 − 10 = 70? não: declarado 90) — o ponto é o bruto: 80 ≠ 100
    expect(r.matches).toBe(false)
  })

  it('⭐ um declarado só (o caso da Caixa) não dispara o check do bruto', () => {
    const r = checkInvoiceTotals({
      totalDeclared: 70,
      totalToPay: 70,
      lines: [
        { date: '2026-09-01', description: 'compra', amount: 80, suggestedKind: 'COMPRA_AVISTA' },
        { date: '2026-09-02', description: 'estorno', amount: 10, suggestedKind: 'ESTORNO' },
      ],
    } as never)
    expect(r.totalFatura).toBe(70)
    expect(r.matches, 'o bruto (80) foi comparado com o líquido declarado (70)').toBe(true)
  })
})
