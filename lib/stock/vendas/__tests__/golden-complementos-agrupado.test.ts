// ⭐⭐ GOLDEN DO RELATÓRIO DE COMPLEMENTOS (02/09/2026) — onde vivem os sabores de pizza.
//
// ⛔ SEM ELE O ESTOQUE NÃO BAIXA SABOR NENHUM: o relatório de PRODUTOS diz que saíram N
// pizzas grandes, mas não diz de QUE sabor. Quem sabe é este arquivo — `CALABRESA 1.220`
// é a linha maior dele.
//
// ⭐⭐ A REGRA DE NEGÓCIO, decidida pelo dono e travada aqui:
//     **1 ocorrência de complemento = 1 explosão da ficha dele, SEMPRE**, independente do
//     tamanho da pizza. Quem garante isso é o CARDÁPIO: pizza pequena obriga escolher 2
//     sabores, grande 4 — então uma pizza grande inteira de calabresa aparece como
//     **4 ocorrências** de CALABRESA neste relatório, não como 1 pizza × fator 4.
//     ⚠️ NADA de fração por tamanho, NADA de média. O PDV já entregou a conta feita.
//
// ⚠️ E a conferência é por CONTAGEM, não por dinheiro. MEDIDO: 73 das 215 linhas valem
// **R$ 0,00** (34%) — mas elas carregam **3.660 das 7.648 ocorrências (48%)**, porque são
// os sabores inclusos no preço da pizza. Um gate por valor descartaria quase METADE das
// baixas, e justamente as que este import existe pra capturar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SuitableParseError, parseSuitable, COLUNAS_COMPLEMENTOS, COLUNAS_PRODUTOS } from '../parse-suitable'

const fx = (n: string) => readFileSync(join(__dirname, 'fixtures', n), 'utf-8')
const HTML = fx('fixture-complementos-agrupado.xls')
const REF = fx('referencia-complementos.csv')

/** gabarito: Descrição,Quantidade,Valor médio (R$),Valor Total (R$) */
function referencia() {
  const [, ...linhas] = REF.trim().split('\n')
  return linhas.map((l) => {
    const p = l.split(',')
    const valorTotal = Number(p.pop())
    const valorMedio = Number(p.pop())
    const quantidade = Number(p.pop())
    return { descricao: p.join(','), quantidade, valorMedio, valorTotal }
  })
}

describe('⭐⭐ GOLDEN — complementos', () => {
  const r = parseSuitable(HTML, COLUNAS_COMPLEMENTOS)

  it('⭐⭐ 215 linhas e 7.648 ocorrências', () => {
    expect(r.linhas).toHaveLength(215)
    expect(r.linhas.reduce((s, l) => s + l.quantidade, 0)).toBe(7648)
  })

  it('⭐⭐ Valor Total Σ 25.586,98 ao centavo', () => {
    const soma = Math.round(r.linhas.reduce((s, l) => s + l.valorTotal, 0) * 100) / 100
    expect(soma).toBeCloseTo(25586.98, 2)
  })

  it('⭐ CALABRESA é a maior, com 1.220 ocorrências e R$ 0,00', () => {
    const cal = r.linhas.find((l) => l.produto === 'CALABRESA')
    expect(cal).toEqual({ produto: 'CALABRESA', quantidade: 1220, valorExtra: 0, valorTotal: 0 })
    // ⚠️ e ela é a MAIOR: se um dia sair do topo, o mapeamento de sabor mudou de nome
    expect(Math.max(...r.linhas.map((l) => l.quantidade))).toBe(1220)
  })

  it('⭐⭐ bate com o gabarito LINHA A LINHA', () => {
    const ref = referencia()
    expect(ref).toHaveLength(215)
    expect(r.linhas).toHaveLength(ref.length)
    for (let i = 0; i < ref.length; i++) {
      expect(r.linhas[i].produto, `linha ${i + 1}`).toBe(ref[i].descricao)
      expect(r.linhas[i].quantidade, `linha ${i + 1} (${ref[i].descricao})`).toBe(ref[i].quantidade)
      expect(r.linhas[i].valorTotal, `linha ${i + 1} (${ref[i].descricao})`).toBeCloseTo(ref[i].valorTotal, 2)
    }
  })

  it('⭐⭐ os R$ 0,00 são MINORIA em linhas mas quase METADE das ocorrências', () => {
    // ⚠️ CORREÇÃO DE UM ERRO MEU: eu tinha afirmado "a maioria vale R$ 0,00" e o teste
    // caiu — são **73 de 215 linhas (34%)**. Mas o número que importa não é o de linhas:
    // essas 73 carregam **3.660 das 7.648 ocorrências (48%)**, e são exatamente os
    // SABORES DE PIZZA (CALABRESA 1.220, FRANGO 371, BACON 328, PAULISTA 254…).
    //
    // ⛔ Por isso a conferência é por CONTAGEM: um gate "só conta se tem valor" descartaria
    // quase METADE das baixas — e justamente as que este import existe pra capturar.
    const zeradas = r.linhas.filter((l) => l.valorTotal === 0)
    expect(zeradas).toHaveLength(73)
    const ocorrenciasZeradas = zeradas.reduce((s, l) => s + l.quantidade, 0)
    expect(ocorrenciasZeradas).toBe(3660)
    expect(ocorrenciasZeradas / 7648).toBeGreaterThan(0.45)
    // e a maior de todas é uma delas
    expect(zeradas.sort((a, b) => b.quantidade - a.quantidade)[0].produto).toBe('CALABRESA')
  })
})

// ⚠️⚠️ TESTES INVERTIDOS COM O MOTIVO ESCRITO (11/09/2026), não apagados.
//
// Eles AFIRMAVAM o estrago: *"142 linhas e 142.255 unidades — o estado de antes do mapa
// de colunas"*. A casa já sabia que ler o arquivo com o mapa errado produzia número
// absurdo — **e transformou isso em teste em vez de RECUSA**.
//
// ⛔ Em 10/09 esse exato caminho rodou em PROD: o Relatório de COMPLEMENTOS foi subido na
// aba de PRODUTOS, `R$ 14,99` virou **1499**, o import baixou **1.499 FANTA UVA** (o real
// era **1**) e a Posição ficou com **valor negativo e saldo positivo**.
//
// ⭐ A LIÇÃO: **número absurdo conhecido é para BARRAR, não para documentar.** Agora o
// parser resolve a coluna pelo NOME do cabeçalho e RECUSA o arquivo trocado, dizendo o que
// achou. O que era "o estado de antes" virou erro.
describe('⛔⛔ o arquivo trocado agora é RECUSADO (era só documentado)', () => {
  it('complementos na aba de PRODUTOS para, em vez de virar 142.255 unidades', () => {
    expect(() => parseSuitable(HTML, COLUNAS_PRODUTOS)).toThrow(SuitableParseError)
  })

  it('⛔ e o inverso também para: produtos lidos como complementos', () => {
    expect(() => parseSuitable(fx('fixture-produtos-agrupado.xls'), COLUNAS_COMPLEMENTOS))
      .toThrow(SuitableParseError)
  })
})
