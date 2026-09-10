// ⛔⛔⛔ REGRA DE UM PARSER NÃO VAZA PROS OUTROS (09/09/2026) — pedido do dono ao entrar
// o 7º layout: *"o guard de isolamento (regra nova não vaza pros outros 6 parsers —
// fixtures deles travadas)"*.
//
// **Por que isto existe, com nome e data:** o Banrisul PF e o Banrisul PJ COMPARTILHAM o
// `lib/fatura-banrisul/nucleo.ts` (extraído em 26/08 justamente pra não duplicar a leitura
// de linha). Compartilhamento é o certo — e é exatamente por isso que uma régua nova
// escrita "pro Itaú" dentro de um trecho comum sai de graça pros outros e **muda um
// número que já estava certo**, sem ninguém notar.
//
// ⚠️ E não é hipótese: a extração de linha do Banrisul PJ já divergiu em **R$ 8.736,17**
// quando o anonimizador comeu a palavra "PAGAMENTO" (26/08), e 12 testes do ciclo PF
// caíram quando ele comeu "Banrisul" (31/08). Mexeu no import de fatura, roda tudo.
//
// ⭐ AQUI OS SETE FICAM TRAVADOS AO CENTAVO, cada um contra a SUA fixture real.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseBanrisulFatura } from '@/lib/credit-card-pj/deterministic/banrisul-fatura-parser'
import { parseCaixaFatura } from '@/lib/credit-card-pj/deterministic/caixa-fatura-parser'
import { parseSicrediFatura } from '@/lib/credit-card-pj/deterministic/sicredi-fatura-parser'
import { parseMercadoPagoFatura } from '@/lib/credit-card-pj/deterministic/mercadopago-fatura-parser'
import { parseBanrisulFaturaPF } from '@/lib/fatura-banrisul/banrisul-fatura-pf'
import { parseNubankFaturaPF, conferirNubank } from '@/lib/fatura-nubank/parser'
import { parseItauFaturaPF, conferirItau } from '@/lib/fatura-itau/parser'
import { PARSERS_FATURA_PF, reconhecerBancoPF } from '../registry-fatura-pf'

const PJ = (n: string) =>
  readFileSync(join(__dirname, '../../credit-card-pj/deterministic/__tests__/fixtures', n), 'utf-8')
const PF_BANRISUL = readFileSync(
  join(__dirname, '../../fatura-banrisul/__tests__/fixtures/banrisul-fatura-pf.txt'), 'utf-8')
const PF_NUBANK = readFileSync(
  join(__dirname, '../../fatura-nubank/__tests__/fixtures/nubank-fatura-pf.txt'), 'utf-8')
const PF_ITAU = readFileSync(
  join(__dirname, '../../fatura-itau/__tests__/fixtures/itau-luizacred-pf.txt'), 'utf-8')

describe('⛔⛔ OS 4 PARSERS PJ seguem com os MESMOS números', () => {
  it('Banrisul PJ — 13.797,73 de gastos · 13.779,73 a pagar', () => {
    const t = parseBanrisulFatura(PJ('banrisul-fatura-real.txt')).declared
    expect(t.totalGastos).toBeCloseTo(13797.73, 2)
    expect(t.saldoAtual).toBeCloseTo(13779.73, 2)
  })

  it('Caixa PJ — 7.280,39, com os 3 créditos que o Vision perdia', () => {
    const t = parseCaixaFatura(PJ('caixa-fatura-real.txt')).declared
    expect(t.valorTotalFatura).toBeCloseTo(7280.39, 2)
  })

  it('Sicredi PJ — 7.896,32', () => {
    const t = parseSicrediFatura(PJ('sicredi-fatura-real.txt')).declared
    expect(t.totalFatura).toBeCloseTo(7896.32, 2)
    expect(t.totalCartao).toBeCloseTo(7995.55, 2)
  })

  it('Mercado Pago PJ — 2.666,44', () => {
    const r = parseMercadoPagoFatura(PJ('mercadopago-fatura-2026-08.txt'))
    expect(r.totalDeclared).toBeCloseTo(2666.44, 2)
    expect(r.totalToPay).toBeCloseTo(2666.44, 2)
  })
})

describe('⛔⛔ OS 3 PARSERS PF seguem com os MESMOS números', () => {
  it('Banrisul PF — 18.348,72 · e ele divide o núcleo com o PJ', () => {
    const r = parseBanrisulFaturaPF(PF_BANRISUL)
    expect(r.declared.saldoAtual).toBeCloseTo(18348.72, 2)
  })

  it('Nubank PF — a composição fecha em 3.053,32', () => {
    const c = conferirNubank(parseNubankFaturaPF(PF_NUBANK))
    expect(c.composicao).toBeCloseTo(3053.32, 2)
    expect(c.fecha).toBe(true)
  })

  it('⭐ Itaú/Luizacred PF — 4.370,79 de lançamentos, 4.491,18 de fatura', () => {
    const c = conferirItau(parseItauFaturaPF(PF_ITAU))
    expect(c.lancamentos).toBeCloseTo(4370.79, 2)
    expect(c.totalRecomposto).toBeCloseTo(4491.18, 2)
    expect(c.fecha && c.cartoesFecham && c.totalFecha).toBe(true)
  })
})

describe('⛔⛔⛔ CADA FIXTURE CAI NO SEU PARSER — nenhum banco pega o documento do outro', () => {
  const FIXTURES: [string, string][] = [
    ['Banrisul', PF_BANRISUL],
    ['Nubank', PF_NUBANK],
    ['Itaú/Luizacred', PF_ITAU],
  ]

  it.each(FIXTURES)('a fatura do %s é reconhecida como %s', (banco, texto) => {
    expect(reconhecerBancoPF(texto)?.banco).toBe(banco)
  })

  it('⛔ e a ORDEM do registry não pode salvar um match frouxo: cada um casa 1 fixture só', () => {
    // ⚠️ `reconhecerBancoPF` devolve o PRIMEIRO que casa — então um `match` largo demais
    // no Banrisul (que vem primeiro) sequestraria o Itaú em silêncio. Aqui cada parser é
    // testado contra TODAS as fixtures, sem a proteção da ordem.
    for (const p of PARSERS_FATURA_PF) {
      const casam = FIXTURES.filter(([, texto]) => p.match.test(texto)).map(([b]) => b)
      expect(casam, `o match do ${p.banco} casa com: ${casam.join(', ')}`).toEqual([p.banco])
    }
  })

  it('⛔ documento que não é fatura de nenhum deles NÃO é reconhecido', () => {
    expect(reconhecerBancoPF('EXTRATO DE CONTA CORRENTE\nSALDO ANTERIOR 100,00')).toBeNull()
  })
})

describe('⛔⛔ TODO parser do registry entra pela MESMA porta', () => {
  it('⭐ nenhum banco pode ficar sem `ler` — o campo que passou 9 dias decorativo', () => {
    // ⛔ O registry nasceu em 31/08 com um campo `parse` que o import NUNCA chamou: ele
    // reconhecia o banco e em seguida rodava o parser do Banrisul cravado, pra qualquer
    // documento. Este teste é o que impede o campo de voltar a ser enfeite.
    for (const p of PARSERS_FATURA_PF) {
      expect(typeof p.ler, `${p.banco} sem \`ler\``).toBe('function')
    }
  })

  it('⭐ e a forma da leitura é a MESMA nos três', () => {
    for (const [banco, texto] of [['Banrisul', PF_BANRISUL], ['Nubank', PF_NUBANK], ['Itaú/Luizacred', PF_ITAU]] as const) {
      const lida = reconhecerBancoPF(texto)!.ler(texto)
      expect(lida.banco).toBe(banco)
      expect(Array.isArray(lida.linhas)).toBe(true)
      expect(lida.linhas.length).toBeGreaterThan(0)
      expect(typeof lida.conferencia.fecha).toBe('boolean')
      // ⛔ valor SEMPRE positivo — o sinal mora em `credito`, nos três
      expect(lida.linhas.every((l) => l.valor >= 0)).toBe(true)
    }
  })
})

describe('⛔⛔⛔ NENHUM PARSER PODE DEPENDER DA POSIÇÃO DAS LINHAS (09/09/2026)', () => {
  // ⛔ A CLASSE, com nome e data: o parser do Itaú lia o bloco do resumo por **contagem
  // de linhas** (`slice(i, i + 14)`). Funcionava na extração do meu Mac e falhava na do
  // servidor, que devolve o MESMO PDF com uma linha em branco a mais — o
  // "Total desta fatura" caía fora da janela **por UMA linha**, e a tela pedia o total
  // digitado com o número impresso na página 1.
  //
  // ⚠️ Extrator muda de versão sozinho (poppler do Mac × do Ubuntu), e a fixture de cada
  // parser foi gravada numa máquina só. Este teste é o que impede a próxima janela por
  // contagem de linha de nascer: **empurra o documento inteiro pra baixo e exige o mesmo
  // número**. Não precisa do PDF original de cada banco pra rodar.
  const empurrar = (t: string) => `\n\n\n${t}`

  it('Banrisul PJ — 13.797,73 com o documento deslocado', () => {
    const d = parseBanrisulFatura(empurrar(PJ('banrisul-fatura-real.txt'))).declared
    expect(d.totalGastos).toBeCloseTo(13797.73, 2)
    expect(d.saldoAtual).toBeCloseTo(13779.73, 2)
  })

  it('Caixa PJ — 7.280,39 com o documento deslocado', () => {
    expect(parseCaixaFatura(empurrar(PJ('caixa-fatura-real.txt'))).declared.valorTotalFatura)
      .toBeCloseTo(7280.39, 2)
  })

  it('Sicredi PJ — 7.896,32 com o documento deslocado', () => {
    expect(parseSicrediFatura(empurrar(PJ('sicredi-fatura-real.txt'))).declared.totalFatura)
      .toBeCloseTo(7896.32, 2)
  })

  it('Mercado Pago PJ — 2.666,44 com o documento deslocado', () => {
    expect(parseMercadoPagoFatura(empurrar(PJ('mercadopago-fatura-2026-08.txt'))).totalDeclared)
      .toBeCloseTo(2666.44, 2)
  })

  it('Banrisul PF — 18.348,72 com o documento deslocado', () => {
    expect(parseBanrisulFaturaPF(empurrar(PF_BANRISUL)).declared.saldoAtual)
      .toBeCloseTo(18348.72, 2)
  })

  it('Nubank PF — 3.053,32 com o documento deslocado', () => {
    expect(conferirNubank(parseNubankFaturaPF(empurrar(PF_NUBANK))).composicao)
      .toBeCloseTo(3053.32, 2)
  })

  it('⭐ Itaú PF — 4.370,79 e 4.491,18 com o documento deslocado', () => {
    const c = conferirItau(parseItauFaturaPF(empurrar(PF_ITAU)))
    expect(c.lancamentos).toBeCloseTo(4370.79, 2)
    // ⛔ era ESTE que virava null quando as linhas andavam
    expect(c.totalDeclarado).toBeCloseTo(4491.18, 2)
  })
})
