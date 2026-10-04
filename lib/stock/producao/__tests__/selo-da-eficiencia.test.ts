/**
 * ⭐⭐ O SELO, A HORA E O AVATAR — as três peças PURAS que a tela nova usa (04/10/2026).
 *
 * **Pedido do dono:** *"a cor segue a régua que o P8/eficienciaDaOrdem já usa, a tela só pinta"*
 * e *"avatar circular com iniciais, cor estável por pessoa (hash do nome → paleta)"*.
 *
 * ⛔⛔ **O QUE ESTE ARQUIVO EXISTE PRA IMPEDIR: um `0.85` ou um `0.25` digitado no componente.**
 * As três bandas do selo saem de DUAS constantes que já existiam (`DESVIO_ALERTA` do P8/P3 e o
 * `DESVIO_GRAVE` do P3) — então os degraus são **derivados das constantes dentro do próprio
 * teste**. Se o dono mudar a faixa, este arquivo acompanha de graça; se alguém digitar o número
 * no selo, a derivação deixa de bater e fica vermelho.
 */
import { describe, it, expect } from 'vitest'
import {
  faixaDoSelo, EFICIENCIA_MINIMA, EFICIENCIA_MAXIMA, DESVIO_GRAVE,
} from '../eficiencia-da-ordem'
import { horaDeEncerramento } from '../relatorio-por-dia'
import { corDaPessoa, iniciais } from '@/components/estoque/avatar-pessoa'

describe('⭐⭐ as três faixas do selo saem das réguas da casa', () => {
  it('⭐ as bordas são EXATAMENTE as constantes, não números digitados', () => {
    // ⚠️ derivado das constantes: o teste não sabe que é 85/115/75/125 — ele pergunta
    const min = EFICIENCIA_MINIMA * 100
    const max = EFICIENCIA_MAXIMA * 100
    const graveBaixo = (1 - DESVIO_GRAVE) * 100
    const graveAlto = (1 + DESVIO_GRAVE) * 100

    expect(faixaDoSelo(min), 'a borda de baixo do verde INCLUI').toBe('DENTRO')
    expect(faixaDoSelo(max), 'a borda de cima do verde INCLUI').toBe('DENTRO')
    expect(faixaDoSelo(min - 0.01)).toBe('FORA')
    expect(faixaDoSelo(max + 0.01)).toBe('FORA')
    expect(faixaDoSelo(graveBaixo), 'a borda do grave ainda é ÂMBAR').toBe('FORA')
    expect(faixaDoSelo(graveAlto)).toBe('FORA')
    expect(faixaDoSelo(graveBaixo - 0.01), 'abaixo do grave vira EXTREMO').toBe('EXTREMO')
    expect(faixaDoSelo(graveAlto + 0.01)).toBe('EXTREMO')
  })

  /**
   * ⭐ OS CASOS REAIS DA CAÇULA — os números que o dono viu na tela, não exemplos inventados.
   * O 205% é o `porçao frango frito` que ele citou no pedido; o 2% e o 333% são as duas
   * conclusões outlier de 27 e 29/09 que este doc já registra.
   */
  it('⭐ os casos REAIS caem onde o dono espera', () => {
    expect(faixaDoSelo(205), 'os 205% do frango frito: VERMELHO').toBe('EXTREMO')
    expect(faixaDoSelo(2), 'os 2% do outlier: VERMELHO').toBe('EXTREMO')
    expect(faixaDoSelo(333), 'os 333% do outlier: VERMELHO').toBe('EXTREMO')
    expect(faixaDoSelo(100), 'bateu a ficha: VERDE').toBe('DENTRO')
    expect(faixaDoSelo(112), 'o beef de xis a 112%: VERDE (dentro de ±15%)').toBe('DENTRO')
    expect(faixaDoSelo(122), 'o beef de xis a 122%: ÂMBAR — cabe perda de trim').toBe('FORA')
    expect(faixaDoSelo(62), 'a metade de bolinha a 62%: VERMELHO').toBe('EXTREMO')
  })

  /**
   * ⛔ Sem pedido não existe eficiência — e pintar a ausência de VERDE seria afirmar que bateu.
   * É a mesma régua do *"sem contagem"* do Radar e do *"a apurar"* do tempo medido.
   */
  it('⛔ ausência tem faixa PRÓPRIA, nunca verde', () => {
    expect(faixaDoSelo(null)).toBe('SEM_PEDIDO')
    expect(faixaDoSelo(undefined)).toBe('SEM_PEDIDO')
    expect(faixaDoSelo(Number.NaN)).toBe('SEM_PEDIDO')
    expect(faixaDoSelo(Infinity)).toBe('SEM_PEDIDO')
  })
})

describe('⭐ "encerrou às" — a hora da ÚLTIMA ordem do dia, no fuso do Brasil', () => {
  it('⭐ pega o MÁXIMO, não o mínimo (encerrar é fechar o dia)', () => {
    const hora = horaDeEncerramento([
      { encerradoAs: '2026-10-04T08:12:00.000Z' },
      { encerradoAs: '2026-10-04T20:47:00.000Z' },
      { encerradoAs: '2026-10-04T13:05:00.000Z' },
    ])
    // ⚠️ 20:47 UTC = 17:47 em São Paulo. Formatar no relógio cru diria 20:47.
    expect(hora).toBe('17:47')
  })

  /**
   * ⚠️⚠️ **A REGRA 11 REPROVOU A 1ª VERSÃO DESTE TESTE — e o furo é a MÁQUINA, não o código.**
   * Repus o defeito (tirar o `timeZone: 'America/Sao_Paulo'` do formatador) e o teste acima ficou
   * **VERDE**: o Mac do dono roda em `America/Sao_Paulo`, então o relógio cru dá a MESMA resposta.
   * **O defeito só aparece onde ele machuca: no servidor, que roda em UTC** — e lá o "encerrou às"
   * mostraria 20:47 pra um lote fechado às 17:47, errado em 3 horas, todo dia.
   *
   * ⭐ O que morde é rodar com o fuso DO SERVIDOR. É a cicatriz do card do cartão (09/09), do
   * Contas a Pagar (13/09) e do dashboard PF (27/08) — *"o servidor roda em UTC"* — virando teste
   * em vez de lembrança.
   */
  it('⭐⭐ a hora não muda com o fuso do PROCESSO — o defeito mora no servidor (UTC)', () => {
    const tzOriginal = process.env.TZ
    try {
      process.env.TZ = 'UTC' // ⚠️ o fuso REAL de prod
      expect(horaDeEncerramento([{ encerradoAs: '2026-10-04T20:47:00.000Z' }])).toBe('17:47')
      process.env.TZ = 'America/Sao_Paulo'
      expect(horaDeEncerramento([{ encerradoAs: '2026-10-04T20:47:00.000Z' }])).toBe('17:47')
      process.env.TZ = 'Asia/Tokyo' // ⭐ e nem com um fuso absurdo: a resposta é do BRASIL
      expect(horaDeEncerramento([{ encerradoAs: '2026-10-04T20:47:00.000Z' }])).toBe('17:47')
    } finally {
      process.env.TZ = tzOriginal
    }
  })

  it('⛔ lote sem instante não entra; nenhum com instante devolve null (a tela cala)', () => {
    expect(horaDeEncerramento([{ encerradoAs: null }, { encerradoAs: undefined }])).toBeNull()
    expect(horaDeEncerramento([])).toBeNull()
    // o que TEM instante manda, mesmo com antigos ao lado
    expect(horaDeEncerramento([
      { encerradoAs: null },
      { encerradoAs: '2026-10-04T12:30:00.000Z' },
    ])).toBe('09:30')
  })
})

describe('⭐ o avatar de QUEM — cor ESTÁVEL, iniciais reconhecíveis', () => {
  it('⭐⭐ a MESMA pessoa tem SEMPRE a mesma cor (é o ponto da coluna)', () => {
    const a = corDaPessoa('rodrigo')
    expect(corDaPessoa('rodrigo')).toEqual(a)
    // ⚠️ caixa e espaço no fim são a MESMA pessoa (a cicatriz da conta `'sicredi '`)
    expect(corDaPessoa('Rodrigo')).toEqual(a)
    expect(corDaPessoa('rodrigo ')).toEqual(a)
    expect(corDaPessoa(' RODRIGO')).toEqual(a)
  })

  it('⛔ NENHUMA pessoa é pintada de CORAL — nesta casa coral significa erro', () => {
    const nomes = ['rodrigo', 'marcyelle', 'Carlisle', 'eliane', 'edmar', 'nadine', 'lucas', 'michelle', 'Cristian', 'viviane']
    for (const n of nomes) {
      expect(corDaPessoa(n).cor.toLowerCase(), `${n} não pode ser coral`).not.toBe('#e5484d')
    }
  })

  it('⭐ as iniciais são 1ª + ÚLTIMO nome — é como uma pessoa é reconhecida', () => {
    expect(iniciais('Yussef Abu Zahry Musa')).toBe('YM')
    expect(iniciais('rodrigo')).toBe('R')
    expect(iniciais('marcyelle silva')).toBe('MS')
    expect(iniciais('  eliane   garcia  ')).toBe('EG')
  })

  it('⛔ vazio devolve `?`, nunca string vazia (um círculo mudo é pior)', () => {
    expect(iniciais('')).toBe('?')
    expect(iniciais('   ')).toBe('?')
  })
})
