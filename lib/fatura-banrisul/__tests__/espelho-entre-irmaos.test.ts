// ⛔⛔⛔ A LEI DE FAMÍLIA ENTRE IRMÃOS — o MESMO caso roda nos DOIS caminhos (20/10/2026)
//
// **A lei, ditada pelo dono:** *"cura de família num parser obriga TESTE-ESPELHO nos parsers
// irmãos (PF/PJ/outros bancos) com o mesmo caso — foi exatamente o que faltou em 26/08. E
// golden com campo 0,00 não protege: os goldens dos irmãos ganham variante com encargo > 0."*
//
// ⛔⛔ **A PROVA DE QUE A LEI É NECESSÁRIA ESTÁ NO HISTÓRICO DESTE ARQUIVO.** A classe
// *"encargo declarado só no resumo"* foi curada **no caminho PF duas vezes** — em 26/08 (os
// R$ 0,62 de rotativo) e em 10/09 (o `IOF sobre operações de crédito` de 1,45) — e o **PJ
// nunca aprendeu**. Ficou latente até 15/10, quando chegou uma fatura PJ com os campos
// diferentes de zero e a conferência recusou 5× seguidas.
//
// ⭐ Hoje o `nucleo.ts` é compartilhado, então a cura serve os dois **por construção** — e é
// justamente isso que este arquivo existe pra PROVAR, em vez de supor.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseBanrisulFaturaPF } from '../banrisul-fatura-pf'
import { parseBanrisulFatura } from '@/lib/credit-card-pj/deterministic/banrisul-fatura-parser'
import { readEncargosDoResumo, round2 } from '../nucleo'
import { lerBanrisulPF } from '@/lib/credit-card/adaptadores-fatura-pf'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')

/** ⭐ as 4 fixtures reais do Banrisul — 2 de cada caminho */
const FIXTURES = {
  pjOutubro: 'lib/credit-card-pj/deterministic/__tests__/fixtures/banrisul-pj-encargo-no-resumo.txt',
  pjAgosto: 'lib/credit-card-pj/deterministic/__tests__/fixtures/banrisul-fatura-real.txt',
  pfAgosto: 'lib/fatura-banrisul/__tests__/fixtures/banrisul-fatura-pf.txt',
  pfSetembro: 'lib/fatura-banrisul/__tests__/fixtures/banrisul-fatura-pf-setembro.txt',
} as const

describe('⭐⭐⭐ ESPELHO: o caso dos 110,39 roda no caminho PF também', () => {
  const TXT = ler(FIXTURES.pjOutubro)

  /**
   * ⭐ O parser PJ é **casca fina** sobre o PF (ele chama `parseBanrisulFaturaPF` e tira o
   * `proximas`). Este teste é o que prova isso em vez de prometer: o MESMO texto, lido
   * pelos dois pontos de entrada, devolve os MESMOS números.
   */
  it('⭐⭐ os DOIS pontos de entrada leem os mesmos 110,39 e fecham em 12.696,23', () => {
    const pj = parseBanrisulFatura(TXT)
    const pf = parseBanrisulFaturaPF(TXT)

    expect(pf.declared.encargosResumo).toBeCloseTo(110.39, 2)
    expect(pf.computed.net).toBeCloseTo(12696.23, 2)
    expect(pf.computed.net).toBeCloseTo(pj.computed.net, 2)
    expect(pf.declared.encargosResumoItens).toEqual(pj.declared.encargosResumoItens)
    expect(pf.extraction.lines?.length).toBe(pj.extraction.lines?.length)
  })

  /**
   * ⭐⭐ E O ADAPTADOR PF FECHA — é ele que a TELA do cartão PF consome. Sem este espelho, a
   * cura poderia estar certa no parser e o adaptador seguir somando o encargo "por fora",
   * contando a cobrança 2× (foi o 1º risco que a cura de hoje criou).
   */
  it('⭐⭐ o ADAPTADOR PF fecha a conferência e NÃO soma o encargo por fora', () => {
    const lida = lerBanrisulPF(TXT)
    expect(lida.conferencia.saldoDeclarado).toBeCloseTo(12696.23, 2)
    expect(lida.conferencia.saldoCalculado).toBeCloseTo(12696.23, 2)
    expect(lida.conferencia.fecha).toBe(true)
    expect(lida.conferencia.encargosDeclarados).toBeCloseTo(110.39, 2)

    // ⛔⛔ A TRAVA DA DUPLA GRAVAÇÃO: o parser já entregou o encargo como LINHA, então o
    // confirm **não cria a dele**. Sem este campo a cobrança entraria 2× na fatura.
    expect(lida.conferencia.encargoJaEhLinha).toBe(true)

    // as duas linhas de encargo fluem pro import, sem portador
    const doResumo = lida.linhas.filter((l) => /encargos sobre rotativo|iof sobre opera/i.test(l.descricao))
    expect(doResumo).toHaveLength(2)
    expect(doResumo.every((l) => l.portador == null)).toBe(true)

    // ⭐ e a Σ das linhas que o import grava É o saldo — o K1/KP1 do juiz continua de pé
    const soma = lida.linhas.reduce((s, l) => s + (l.credito ? -l.valor : l.valor), 0)
    expect(round2(soma)).toBeCloseTo(12696.23, 2)
  })
})

describe('⭐⭐ os IRMÃOS continuam fechando — a cura não vazou pra ninguém', () => {
  /**
   * ⚠️ Os números vêm do congelador, e cada um fecha por uma composição que o PRÓPRIO
   * documento declara. Aqui a pergunta é só uma: *a cura mexeu em algum deles?*
   */
  const casos = [
    { nome: 'PF agosto (os R$ 0,62 de 26/08)', fx: FIXTURES.pfAgosto, encargo: 0.62, net: 18348.72 },
    { nome: 'PF setembro (rotativo + IOF de crédito, 10/09)', fx: FIXTURES.pfSetembro, encargo: 115.76, net: 18593.16 },
    { nome: 'PJ agosto (encargo ZERO — e é por isso que ele não protegia)', fx: FIXTURES.pjAgosto, encargo: 0, net: 13779.73 },
  ] as const

  for (const c of casos) {
    it(`⭐ ${c.nome}`, () => {
      const r = parseBanrisulFaturaPF(ler(c.fx))
      expect(r.declared.encargosResumo).toBeCloseTo(c.encargo, 2)
      expect(r.computed.net).toBeCloseTo(c.net, 2)
      expect(r.computed.net).toBeCloseTo(r.declared.saldoAtual ?? 0, 2)
    })
  }
})

describe('⛔⛔ "GOLDEN COM CAMPO 0,00 NÃO PROTEGE" — a lei virou executável', () => {
  /**
   * ⭐⭐ ESTE É O GUARD DA LEI DE FAMÍLIA, e ele é o que impede a reincidência: **cada
   * caminho precisa de pelo menos UMA fixture com o campo DIFERENTE DE ZERO**.
   *
   * ⛔ Era exatamente esta a falha de 18/08 a 15/10: as duas fixtures PJ têm os encargos em
   * `0,00`, então o PJ tinha golden, tinha validador, tinha runner — e **nada daquilo
   * exercitava o campo**. Campo zerado passa verde com a régua certa E com a errada.
   *
   * ⚠️ Apagar a fixture nova do PJ (ou trocá-la por uma de encargo zero) deixa ESTE teste
   * vermelho, e é esse o ponto: a variante com encargo > 0 deixou de ser opcional.
   */
  it('⛔ o caminho PJ tem fixture com encargo > 0', () => {
    const pj = [FIXTURES.pjOutubro, FIXTURES.pjAgosto].map((f) => readEncargosDoResumo(ler(f)).total ?? 0)
    expect(
      pj.some((v) => v > 0),
      'nenhuma fixture PJ exercita o encargo do resumo — foi assim que o buraco viveu de 18/08 a 15/10',
    ).toBe(true)
  })

  it('⛔ o caminho PF tem fixture com encargo > 0', () => {
    const pf = [FIXTURES.pfAgosto, FIXTURES.pfSetembro].map((f) => readEncargosDoResumo(ler(f)).total ?? 0)
    expect(pf.some((v) => v > 0), 'nenhuma fixture PF exercita o encargo do resumo').toBe(true)
  })

  /**
   * ⚠️ E as 4 têm que ter o bloco do resumo LEGÍVEL. `null` aqui significaria que a âncora
   * não achou o recorte — e aí o teste acima passaria por outro motivo (ausência), não por
   * a leitura estar certa.
   */
  it('⭐ e as 4 fixtures têm o bloco do resumo legível (nunca `null`)', () => {
    for (const [nome, fx] of Object.entries(FIXTURES)) {
      expect(readEncargosDoResumo(ler(fx)).total, `${nome}: o bloco do resumo não foi achado`).not.toBeNull()
    }
  })
})
