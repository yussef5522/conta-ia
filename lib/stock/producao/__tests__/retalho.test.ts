/**
 * ⭐⭐⭐ RETALHO DE MASSA — A CONTA (09/10/2026, Parte 1).
 *
 * O caso real do dono: *"bolinhas de tarde; de noite o serviço corta e sobra retalho; no dia
 * seguinte o retalho entra na massa nova — pedir 200 e sair 246 é NORMAL e hoje o fiscal acusa
 * à toa."*
 */
import { describe, it, expect } from 'vitest'
import {
  PESO_DA_METADE_G, RETALHO_ALTO_KG,
  unidadesDoRetalho, esperadoComRetalho, fraseDoRetalho,
} from '../retalho'
import { fiscalDoDeclarado, fraseDoFiscal, resumoDoFiscal } from '../eficiencia-da-ordem'

describe('⭐⭐ a conta do retalho', () => {
  it('⭐ o exemplo do dono: 1 kg ÷ 200 g = +5', () => {
    expect(unidadesDoRetalho(1, PESO_DA_METADE_G)).toBe(5)
    expect(esperadoComRetalho(200, 5)).toBe(205)
    expect(fraseDoRetalho({ pedido: 200, kg: 1, pesoUnidadeG: 200, unidade: 'UN' }))
      .toBe('vai sair ~205 UN no total')
  })

  it('⭐⭐ O CASO REAL: pedido 200 + 9,2 kg → +46 → esperado ~246', () => {
    const bonus = unidadesDoRetalho(9.2, 200)
    expect(bonus).toBe(46)
    expect(esperadoComRetalho(200, bonus)).toBe(246)
    expect(fraseDoRetalho({ pedido: 200, kg: 9.2, pesoUnidadeG: 200, unidade: 'UN' }))
      .toBe('vai sair ~246 UN no total')
  })

  /**
   * ⛔ ausência NÃO é zero: *"o retalho não rendeu nada"* é uma afirmação, e o que houve é
   * *"não houve retalho"* — a régua do "sem contagem" do estoque.
   */
  it('⛔ sem kg, sem peso, ou peso ≤ 0 devolve null — nunca 0', () => {
    expect(unidadesDoRetalho(null, 200)).toBeNull()
    expect(unidadesDoRetalho(0, 200)).toBeNull()
    expect(unidadesDoRetalho(-3, 200)).toBeNull()
    expect(unidadesDoRetalho(9.2, null)).toBeNull()
    expect(unidadesDoRetalho(9.2, 0)).toBeNull()
  })

  /** ⛔ sem pedido não existe esperado: somar o bônus a nada daria "esperado 46" numa ordem
   *  que não pediu nada — a régua do "a apurar", nunca zero */
  it('⛔ pedido nulo não ganha esperado nem frase', () => {
    expect(esperadoComRetalho(null, 46)).toBeNull()
    expect(fraseDoRetalho({ pedido: null, kg: 9.2, pesoUnidadeG: 200, unidade: 'UN' })).toBeNull()
  })

  /** ⛔ sem retalho a tela NÃO diz nada — repetir o pedido com cara de novidade é ruído */
  it('⛔ sem retalho não existe frase', () => {
    expect(fraseDoRetalho({ pedido: 200, kg: null, pesoUnidadeG: 200, unidade: 'UN' })).toBeNull()
  })

  /**
   * ⭐⭐ SEM ARREDONDAR NO MEIO (a régua da casa desde a reunitização do pão): o bônus entra em
   * precisão cheia e quem arredonda é a leitura.
   */
  it('⭐ o bônus NÃO é arredondado — a tela arredonda', () => {
    expect(unidadesDoRetalho(1.1, 200)).toBeCloseTo(5.5, 10)
    expect(esperadoComRetalho(200, 5.5)).toBeCloseTo(205.5, 10)
    /** ⚠️ UN é unidade de CONTAGEM → a tela mostra 206 (round normal), o dado segue 205,5 */
    expect(fraseDoRetalho({ pedido: 200, kg: 1.1, pesoUnidadeG: 200, unidade: 'UN' }))
      .toBe('vai sair ~206 UN no total')
  })
})

describe('⭐⭐⭐ O FISCAL CONTA CERTO: material + retalho', () => {
  /** o cenário do dono: a massa rende 1 metade por 0,2 KG de farinha; saiu farinha pra 200 */
  const comps = (consumido: number) => [
    { nome: 'farinha', unidade: 'KG', plano: 40, real: consumido, gap: consumido - 40 },
  ]

  it('⛔⛔ SEM o retalho, declarar 246 contra material de 200 é ACUSADO — o alarme falso', () => {
    const f = fiscalDoDeclarado(200, 246, comps(40))
    expect(f.permitido).toBe(200)
    expect(f.bonusDeRetalho).toBe(0)
    /** 246 ÷ 200 = 123% > 120% → impossível. **Era o que o dono media todo dia.** */
    expect(f.impossivel).toBe(true)
  })

  it('⭐⭐ COM 9,2 kg de retalho (+46), o mesmo lote CONFERE', () => {
    const f = fiscalDoDeclarado(200, 246, comps(40), 46)
    expect(f.permitido).toBe(246)
    expect(f.bonusDeRetalho).toBe(46)
    expect(f.impossivel).toBe(false)
    expect(resumoDoFiscal(f)).toBe('confere')
  })

  /** ⭐ o RETALHO VAI NOMEADO: bônus silencioso é bônus que ninguém confere */
  it('⭐ a frase longa nomeia o retalho', () => {
    const f = fiscalDoDeclarado(200, 246, comps(40), 46)
    expect(fraseDoFiscal(f, 246, 'UN')).toContain('inclui +46 UN do retalho de ontem')
  })

  /** ⛔ e ele NÃO é passe livre: o teto só subiu o que o retalho rende */
  it('⛔ o retalho não cala o fiscal — 400 contra 246 segue impossível', () => {
    const f = fiscalDoDeclarado(200, 400, comps(40), 46)
    expect(f.impossivel).toBe(true)
    expect(resumoDoFiscal(f)).toBe('dava ~246')
  })

  /**
   * ⛔⛔ SEM COMPONENTE COM DOSE, o bônus sozinho NÃO vira fiscal: *"não há material pra
   * fiscalizar"*, e somar o retalho ali inventaria um limite a partir de uma declaração.
   */
  it('⛔⛔ sem material pra medir, o retalho não cria limite', () => {
    const f = fiscalDoDeclarado(200, 246, [{ nome: 'x', unidade: 'KG', plano: 0, real: 0, gap: 0 }], 46)
    expect(f.permitido).toBeNull()
    expect(f.impossivel).toBe(false)
    expect(resumoDoFiscal(f)).toBeNull()
  })

  /** ⚠️ bônus negativo ou lixo não afrouxa nada */
  it('⚠️ bônus inválido conta como zero', () => {
    expect(fiscalDoDeclarado(200, 246, comps(40), -50).permitido).toBe(200)
    expect(fiscalDoDeclarado(200, 246, comps(40), Number.NaN).permitido).toBe(200)
  })
})

describe('⚠️ a sanidade', () => {
  it('⭐ o degrau é 20 kg (ordem do dono)', () => {
    expect(RETALHO_ALTO_KG).toBe(20)
  })
  /** ⚠️ o 200 g é SEMENTE (vive no banco, editável com rastro) — aqui só se afirma a semente */
  it('⭐ a semente é a metade de 200 g (bolinha inteira 400)', () => {
    expect(PESO_DA_METADE_G).toBe(200)
  })
})
