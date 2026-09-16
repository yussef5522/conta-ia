// ⭐⭐⭐ N PORTADORES NUMA FATURA SÓ — O HISTÓRICO DO ADICIONAL NÃO PODE SUMIR (16/09/2026)
//
// **O caso do dono, medido por ele contra o PDF:** `Débitos no Brasil 11.376,89` =
// `TOTAL do principal 11.225,33` + `TOTAL do adicional 0123 151,56`. O parser lia o lado
// esquerdo e o `DESC. ANUID. 0123 −18,00`, e **perdia o `ANUIDADEINT DIFER 05/12 0123
// +18,00`** — a diferença de −18,00 era exatamente ele.
//
// ⚠️⚠️ **ESTA FIXTURE É UMA RECONSTRUÇÃO, NÃO O PDF DELE.** O texto da fatura real nunca
// foi guardado (a quarentena subiu depois da tentativa), então o que está aqui é a
// ESTRUTURA que ele descreveu com os NÚMEROS que ele mediu: dois portadores, um
// `TOTAL DE GASTOS` cada, o par de anuidade (crédito num, débito no outro) e o lançamento
// do adicional dividindo a linha física com o do principal. **Ela não substitui o golden
// do documento real** — vale como trava da estrutura, e está dito no nome do arquivo.
//
// ⛔ O QUE ELA PEGA (três mecanismos de sumiço silencioso, todos medidos aqui):
//   1. a banda com POUCAS linhas datadas sendo descartada inteira;
//   2. a apara do dinheiro cortando a linha ENTRE a data e o valor do vizinho;
//   3. a calha apagada por uma linha que atravessa as colunas (cabeçalho, totais).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseBanrisulFaturaPF } from '../banrisul-fatura-pf'
import { lerBanrisulPF } from '@/lib/credit-card/adaptadores-fatura-pf'

const TEXTO = readFileSync(
  join(process.cwd(), 'lib/fatura-banrisul/__tests__/fixtures/banrisul-pf-dois-portadores.txt'),
  'utf-8',
)

describe('⭐⭐ a fatura de DOIS portadores fecha ao centavo', () => {
  it('⭐ os dois portadores são reconhecidos', () => {
    expect(parseBanrisulFaturaPF(TEXTO).extraction.cardLastDigitsFound).toEqual(['5349', '0123'])
  })

  /**
   * ⭐ V4 — `TOTAL DE GASTOS` aparece **uma vez por portador** e a conferência soma TODOS.
   * ⚠️ Era o defeito de 31/08 registrado como latente: o `match` pegava só a primeira.
   */
  it('⭐ o V4 soma o TOTAL DE GASTOS de TODOS os portadores', () => {
    const r = parseBanrisulFaturaPF(TEXTO)
    expect(r.declared.totalGastos, '11.225,33 + 151,56').toBe(11376.89)
    expect(r.declared.totalGastos).toBe(r.declared.brasil)
  })

  /** ⭐⭐ O NÚMERO QUE O DONO PEDIU: a conferência fecha ao centavo. */
  it('⭐⭐ V1 — despesas lidas == 11.376,89 declarados, e a fatura FECHA', () => {
    const c = lerBanrisulPF(TEXTO).conferencia
    expect(c.despesasCalculado, 'perdeu lançamento do portador adicional').toBe(11376.89)
    expect(c.despesasDeclarado).toBe(11376.89)
    expect(c.saldoCalculado).toBe(11358.89)
    expect(c.saldoDeclarado).toBe(11358.89)
    expect(c.fecha).toBe(true)
  })

  /**
   * ⛔ O PAR DE ANUIDADE — **as duas linhas existem** (trap 5 do núcleo). Elas se anulam no
   * total, mas nenhuma pode ser deduplicada: são dois lançamentos da fatura, um crédito e
   * um débito, e é justamente o débito que sumia.
   */
  it('⭐ o par de anuidade entra INTEIRO: o crédito e o débito', () => {
    const linhas = lerBanrisulPF(TEXTO).linhas
    const desc = linhas.filter((l) => /DESC\. ANUID/i.test(l.descricao))
    const deb = linhas.filter((l) => /ANUIDADEINT/i.test(l.descricao))
    expect(desc, 'o desconto de anuidade sumiu').toHaveLength(1)
    expect(deb, 'a anuidade do adicional sumiu — a dif de −18,00 do dono').toHaveLength(1)
    expect(desc[0]!.valor).toBe(18)
    expect(desc[0]!.credito, 'DESC. ANUID. é crédito').toBe(true)
    expect(deb[0]!.valor).toBe(18)
    expect(deb[0]!.credito, 'ANUIDADEINT é débito').toBe(false)
  })

  /** ⭐ e o lançamento do adicional sai marcado com o cartão DELE, não com o do principal */
  it('⭐ cada linha carrega o portador de quem gastou', () => {
    const linhas = lerBanrisulPF(TEXTO).linhas
    expect(linhas.find((l) => /ANUIDADEINT/i.test(l.descricao))?.portador).toBe('0123')
    expect(linhas.find((l) => /FARMACIA/i.test(l.descricao))?.portador).toBe('0123')
    expect(linhas.find((l) => /MERCADOLIVRE/i.test(l.descricao))?.portador).toBe('5349')
  })

  /** ⭐ o total do adicional bate com a soma das linhas DELE */
  it('⭐ as linhas do 0123 somam os 151,56 que a fatura declara pra ele', () => {
    const doAdicional = lerBanrisulPF(TEXTO).linhas.filter((l) => l.portador === '0123' && !l.credito)
    const soma = Math.round(doAdicional.reduce((a, l) => a + l.valor, 0) * 100) / 100
    expect(soma).toBe(151.56)
  })
})
