// ⭐⭐ GOLDEN DO RELATÓRIO DE PRODUTOS — travado ANTES de generalizar o parser (02/09/2026).
//
// O dono foi explícito: *"red-then-green no import de produtos ANTES de generalizar: ele
// não pode mudar de comportamento"*. O parser vai ganhar um mapa de colunas para atender
// também o Relatório de Complementos (que tem a QUANTIDADE na 3ª coluna, não na 2ª) — e
// esta é a rede que garante que a generalização não mexeu no caminho que já funciona.
//
// ⭐ MEDIDO ANTES DE QUALQUER MUDANÇA: o parser atual já bate estes números ao centavo.
// Se algum deles se mexer, a generalização quebrou o import que roda todo dia.
//
// ⚠️ A fixture é o relatório CRU do PDV, HTML disfarçado de .xls (`file` diz "HTML
// document"). Nada de parser de xls binário.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSuitable } from '../parse-suitable'

const fx = (n: string) => readFileSync(join(__dirname, 'fixtures', n), 'utf-8')
const HTML = fx('fixture-produtos-agrupado.xls')
const REF = fx('referencia-produtos.csv')

/** o gabarito da extração, linha a linha */
function referencia() {
  const [, ...linhas] = REF.trim().split('\n')
  return linhas.map((l) => {
    // ⚠️ nome do produto pode ter vírgula → parse posicional pelos 3 ÚLTIMOS campos
    const p = l.split(',')
    const valorTotal = Number(p.pop())
    const valorExtra = Number(p.pop())
    const quantidade = Number(p.pop())
    return { produto: p.join(','), quantidade, valorExtra, valorTotal }
  })
}

describe('⭐⭐ GOLDEN — o relatório de produtos não pode mudar de comportamento', () => {
  const r = parseSuitable(HTML)

  it('⭐⭐ 195 linhas e 10.384 itens', () => {
    expect(r.linhas).toHaveLength(195)
    expect(r.linhas.reduce((s, l) => s + l.quantidade, 0)).toBe(10384)
  })

  it('⭐⭐ os dois somatórios de dinheiro, ao centavo', () => {
    const soma = (f: (l: (typeof r.linhas)[number]) => number) =>
      Math.round(r.linhas.reduce((s, l) => s + f(l), 0) * 100) / 100
    expect(soma((l) => l.valorExtra)).toBeCloseTo(26016.7, 2)
    expect(soma((l) => l.valorTotal)).toBeCloseTo(328577.79, 2)
  })

  it('⭐ a 1ª linha, campo a campo', () => {
    expect(r.linhas[0]).toEqual({
      produto: 'XIS - COMPLETO', quantidade: 1699, valorExtra: 1806.23, valorTotal: 36614.24,
    })
  })

  it('⭐⭐ bate com o gabarito LINHA A LINHA — não só nos totais', () => {
    // ⚠️ totais fecham mesmo com duas linhas trocadas entre si. O gabarito pega isso.
    const ref = referencia()
    expect(ref).toHaveLength(195)
    expect(r.linhas).toHaveLength(ref.length)
    for (let i = 0; i < ref.length; i++) {
      expect(r.linhas[i].produto, `linha ${i + 1}`).toBe(ref[i].produto)
      expect(r.linhas[i].quantidade, `linha ${i + 1} (${ref[i].produto})`).toBe(ref[i].quantidade)
      expect(r.linhas[i].valorExtra, `linha ${i + 1} (${ref[i].produto})`).toBeCloseTo(ref[i].valorExtra, 2)
      expect(r.linhas[i].valorTotal, `linha ${i + 1} (${ref[i].produto})`).toBeCloseTo(ref[i].valorTotal, 2)
    }
  })

  it('⚠️ o cabeçalho não vira linha, e nada com quantidade 0 entra', () => {
    expect(r.linhas.some((l) => /^produto$/i.test(l.produto))).toBe(false)
    expect(r.linhas.every((l) => l.quantidade > 0)).toBe(true)
  })
})

describe('⛔ e o arquivo de COMPLEMENTOS não pode ser lido por este caminho', () => {
  it('⛔⛔ com as colunas de produto, o de complementos dá número absurdo', () => {
    // ⚠️ É O ESTADO DE HOJE, e é a razão de o parser precisar do mapa de colunas:
    // em complementos a ordem é `Descrição | Valor médio | Quantidade | Valor Total`.
    // Lendo a 2ª coluna como quantidade, "R$ 0,00" vira 0 → a linha é DESCARTADA; sobram
    // só as de valor médio não-zero, com quantidade lixo tirada do dinheiro.
    const c = parseSuitable(fx('fixture-complementos-agrupado.xls'))
    expect(c.linhas.length).toBe(142) // ⛔ deveriam ser 215
    expect(c.linhas.reduce((s, l) => s + l.quantidade, 0)).toBe(142255) // ⛔ deveriam ser 7.648
    // ⭐ este teste vira o "antes" do red-then-green da generalização.
  })
})
