// ⛔⛔⛔ GRAFIA IGUAL É O MESMO SABOR, POR CONSTRUÇÃO (08/09/2026).
//
// *"A tela mostra 'frango com catupiry (2) · já existe ficha via FRANGO COM CATUPIRY —
// mapear nessa ficha' me pedindo clique. Se o nome canônico é IDÊNTICO (só caixa/acento
// difere), isso não é heurística sugerindo — **é a mesma palavra**."* — o dono.
//
// ⚠️ E A FRONTEIRA É O QUE ESTE ARQUIVO MAIS PROTEGE. Automatizar o canônico igual só é
// seguro porque tudo o que exige julgamento continua pedindo clique — os nomes de teste
// abaixo são os REAIS do cardápio da Caçula, não exemplos inventados:
//   · STROGONOFF DE CARNEE × STROGONOFF DE CARNE — as DUAS grafias existem de verdade
//     (o cardápio escreve com EE, o PDV sem). "Corrigir" apagaria um sabor.
//   · MUSSARELA ACEBOLADA × MUSSARELA — dois pratos do cardápio.
//   · 4 QUEIJOS × 5 QUEIJOS — um caractere, outro produto.

import { describe, it, expect } from 'vitest'
import {
  agrupamentoAutomatico, conflitosDeGrafia, sugestoesDeTamanho, chaveDeApresentacao,
  SUFIXOS_DE_TAMANHO,
} from '../grafia-canonica'

const p = (nomeSuitable: string, ocorrencias = 1) => ({ nomeSuitable, ocorrencias })
const m = (nomeSuitable: string, fichaId: string, nomeFicha: string) => ({ nomeSuitable, fichaId, nomeFicha })

const MAPEADAS = [
  m('FRANGO COM CATUPIRY', 'f-frango-cat', 'porcao frango com catupiry'),
  m('CALABRESA ACEBOLADA', 'f-cal-aceb', 'porcao calabresa acebolada'),
  m('FILE COM PALHA', 'f-file-palha', 'porcao file com palha'),
  m('MILHO COM BACON', 'f-milho-bacon', 'porcao milho com bacon'),
  m('STROGONOFF DE CARNE', 'f-strog', 'porcao strogonoff de carne'),
  m('MUSSARELA', 'f-muss', 'porcao mussarela'),
  m('4 QUEIJOS', 'f-4q', 'porcao 4 queijos'),
  m('CHOCOLATE PRETO', 'f-choc', 'porcao chocolate preto'),
]

describe('⭐ canônico igual entra SOZINHO', () => {
  it('caixa diferente é a mesma palavra', () => {
    const r = agrupamentoAutomatico([p('frango com catupiry', 2)], MAPEADAS)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({
      nomeSuitable: 'frango com catupiry', fichaId: 'f-frango-cat',
      viaGrafia: 'FRANGO COM CATUPIRY',
    })
  })

  it('acento e espaço repetido também não separam sabor', () => {
    const r = agrupamentoAutomatico([p('Filé  com  Palha'), p('MILHO COM BACON  ')], MAPEADAS)
    expect(r.map((x) => x.fichaId).sort()).toEqual(['f-file-palha', 'f-milho-bacon'])
  })

  it('as várias grafias do mesmo canônico entram TODAS', () => {
    const r = agrupamentoAutomatico(
      [p('Calabresa Acebolada'), p('calabresa acebolada'), p('CALABRESA  ACEBOLADA')], MAPEADAS)
    expect(r).toHaveLength(3)
    expect(new Set(r.map((x) => x.fichaId))).toEqual(new Set(['f-cal-aceb']))
  })

  it('⚠️ ordena por volume — o que mais vende entra primeiro na lista do dono', () => {
    const r = agrupamentoAutomatico([p('frango com catupiry', 2), p('Mussarela', 40)], MAPEADAS)
    expect(r[0].nomeSuitable).toBe('Mussarela')
  })

  it('sem irmã mapeada, não entra nada — a regra precisa de uma ficha existente', () => {
    expect(agrupamentoAutomatico([p('PORTUGUESA'), p('portuguesa')], [])).toEqual([])
  })
})

describe('⛔⛔ A FRONTEIRA: o que CONTINUA pedindo clique', () => {
  it('TYPO não entra: uma letra a mais é palavra diferente', () => {
    // as duas grafias existem de verdade no cardápio — automatizar apagaria um sabor
    expect(agrupamentoAutomatico([p('STROGONOFF DE CARNEE', 10)], MAPEADAS)).toEqual([])
  })

  it('"começa igual" não entra: MUSSARELA ACEBOLADA ⊄ MUSSARELA', () => {
    expect(agrupamentoAutomatico([p('MUSSARELA ACEBOLADA', 8)], MAPEADAS)).toEqual([])
  })

  it('⛔ DÍGITO não entra: 5 QUEIJOS não é 4 QUEIJOS', () => {
    expect(agrupamentoAutomatico([p('5 QUEIJOS', 12)], MAPEADAS)).toEqual([])
    // ⚠️ e a versão em caixa baixa do MESMO número entra, porque aí é a mesma palavra
    expect(agrupamentoAutomatico([p('4 queijos', 3)], MAPEADAS)).toHaveLength(1)
  })

  it('⛔ sufixo de tamanho NÃO é grafia — não entra no automático', () => {
    expect(agrupamentoAutomatico([p('STROGONOFF DE CARNE FAMILIA', 10)], MAPEADAS)).toEqual([])
  })
})

describe('⭐ sufixo de tamanho/promo — sugestão FORTE, clique obrigatório', () => {
  it('acha o sabor + FAMILIA e monta a frase', () => {
    const [s] = sugestoesDeTamanho([p('STROGONOFF DE CARNE FAMILIA', 10)], MAPEADAS)
    expect(s).toMatchObject({
      fichaId: 'f-strog', base: 'STROGONOFF DE CARNE', sufixo: 'FAMILIA', ocorrencias: 10,
    })
    expect(s.frase).toBe('é porcao strogonoff de carne tamanho familia — mapear como apelido?')
  })

  it('⭐ o tamanho vindo ANTES também conta: "PIZZA PEQUENA CHOCOLATE PRETO"', () => {
    const [s] = sugestoesDeTamanho([p('PIZZA PEQUENA CHOCOLATE PRETO', 4)], MAPEADAS)
    expect(s).toMatchObject({ fichaId: 'f-choc', sufixo: 'PIZZA PEQUENA' })
  })

  it('⛔⛔ é SUGESTÃO, não mapeamento: o automático continua vazio pro mesmo nome', () => {
    const nomes = [p('STROGONOFF DE CARNE FAMILIA', 10), p('MUSSARELA PROMO', 2)]
    expect(sugestoesDeTamanho(nomes, MAPEADAS)).toHaveLength(2)
    // ⚠️ o teste que morde: se um dia alguém "otimizar" isso pra entrar sozinho,
    // uma pizza família passaria a consumir uma porção sem ninguém ter decidido.
    expect(agrupamentoAutomatico(nomes, MAPEADAS)).toEqual([])
  })

  it('⛔ a lista de sufixos é FECHADA: "CALABRESA BLACK FRIDAY" não vira sugestão', () => {
    expect(sugestoesDeTamanho([p('CALABRESA ACEBOLADA BLACK FRIDAY', 3)], MAPEADAS)).toEqual([])
    expect(SUFIXOS_DE_TAMANHO).not.toContain('BLACK FRIDAY')
  })

  it('⛔ sufixo sobre base NÃO mapeada não sugere nada — a base tem que existir', () => {
    expect(sugestoesDeTamanho([p('SABOR CREME DE AVELA PROMO', 5)], MAPEADAS)).toEqual([])
  })

  it('⚠️ "PIZZA PEQUENA KITKAT" não sugere: KITKAT ≠ KIT KAT (é typo, não tamanho)', () => {
    const comKitKat = [...MAPEADAS, m('KIT KAT', 'f-kk', 'porcao kit kat')]
    expect(sugestoesDeTamanho([p('PIZZA PEQUENA KITKAT', 2)], comKitKat)).toEqual([])
  })

  it('quem já é canônico-igual sai da lista de sugestão (é trabalho do automático)', () => {
    expect(sugestoesDeTamanho([p('mussarela', 3)], MAPEADAS)).toEqual([])
  })
})

describe('⛔ conflito de grafia: o mesmo canônico em fichas diferentes', () => {
  it('acha e NÃO escolhe — escolher seria a adivinhação que a regra proíbe', () => {
    const c = conflitosDeGrafia([
      m('CALABRESA', 'f-a', 'porcao calabresa'),
      m('calabresa', 'f-b', 'outra coisa'),
    ])
    expect(c).toHaveLength(1)
    expect(c[0].fichas.map((f) => f.fichaId).sort()).toEqual(['f-a', 'f-b'])
  })

  it('mesmo canônico na MESMA ficha não é conflito', () => {
    expect(conflitosDeGrafia([
      m('CALABRESA', 'f-a', 'porcao calabresa'),
      m('calabresa', 'f-a', 'porcao calabresa'),
    ])).toEqual([])
  })
})

describe('⭐ a tabela: UMA linha por canônico, inclusive nos pendentes', () => {
  const linha = (nomeSuitable: string, destino: string, fichaId: string | null = null) =>
    ({ nomeSuitable, destino, fichaId })

  it('⛔⛔ os três PORTUGUESA viram UMA chave (eram 3 linhas soltas)', () => {
    const chaves = ['PORTUGUESA', 'portuguesa', 'Portuguesa']
      .map((n) => chaveDeApresentacao(linha(n, 'SEM_FICHA')))
    expect(new Set(chaves).size).toBe(1)
  })

  it('quem tem ficha continua agrupando pela FICHA', () => {
    expect(chaveDeApresentacao(linha('CALABRESA', 'FICHA', 'f-1')))
      .toBe(chaveDeApresentacao(linha('calabresa', 'FICHA', 'f-1')))
  })

  it('⚠️ IGNORAR continua linha a linha — GRANDE e PEQUENO são decisões diferentes', () => {
    expect(chaveDeApresentacao(linha('GRANDE', 'IGNORAR')))
      .not.toBe(chaveDeApresentacao(linha('PEQUENO', 'IGNORAR')))
  })

  it('⛔ pendentes de canônico DIFERENTE não se juntam (a fronteira vale na tela também)', () => {
    expect(chaveDeApresentacao(linha('4 QUEIJOS', 'SEM_FICHA')))
      .not.toBe(chaveDeApresentacao(linha('5 QUEIJOS', 'SEM_FICHA')))
    expect(chaveDeApresentacao(linha('STROGONOFF DE CARNE', 'SEM_FICHA')))
      .not.toBe(chaveDeApresentacao(linha('STROGONOFF DE CARNEE', 'SEM_FICHA')))
  })
})
