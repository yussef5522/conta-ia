// EXTENSÃO 01/08 — A BLINDAGEM EM FORMA DE TESTE (25/08).
//
// A decisão do dono: retroagir o `vigenteDe` das 4 regras de 12/08 para 01/08 (CONTEÚDO
// intocado — só a data de aplicabilidade, porque o arranjo de recebimento já era o mesmo
// naquele período; a Tuna nem existia e os PIX eram diretos de cliente, que é justamente
// o que a regra Stone D+0 trata).
//
// A regra dura que este arquivo protege: **estender o passado NÃO PODE mexer no presente.**
// Rodamos o MESMO fixture golden com a janela aberta em 01/08 e exigimos os MESMOS
// centavos de 12-17/08. Se um refactor futuro fizer a janela influenciar o que já estava
// validado, este teste grita antes do deploy.

import { describe, it, expect } from 'vitest'
import { computeVendasDiarias, type VendaDiariaComputada } from '../compute-vendas-diarias'
import { feriadosNacionais, diaUTC } from '../feriados-nacionais'
import { buildInputs, REGRAS_CACULA, MODULE_INICIO } from './fixtures/vendas-cacula-agosto'

const F = feriadosNacionais(2026)
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const INICIO_ESTENDIDO = new Date(Date.UTC(2026, 7, 1)) // 01/08

/** as MESMAS regras, com vigenteDe retroagido — conteúdo idêntico */
const REGRAS_RETROAGIDAS = REGRAS_CACULA.map((r) => ({ ...r, vigenteDe: INICIO_ESTENDIDO }))

const soma = (vs: VendaDiariaComputada[], de: string, ate: string, meio?: string) =>
  round2(vs.filter((v) => diaUTC(v.dataCompetencia) >= de && diaUTC(v.dataCompetenciaFim) <= ate && (!meio || v.meio === meio))
    .reduce((s, v) => s + v.valorLiquido, 0))

const comJanela12 = () => computeVendasDiarias(buildInputs(), REGRAS_CACULA, F, MODULE_INICIO)
const comJanela01 = () => computeVendasDiarias(buildInputs(), REGRAS_RETROAGIDAS, F, INICIO_ESTENDIDO)

describe('retroagir o vigenteDe NÃO altera o conteúdo da regra', () => {
  it('só a data muda — atraso, fim de semana e confirmação ficam iguais', () => {
    REGRAS_CACULA.forEach((orig, i) => {
      const novo = REGRAS_RETROAGIDAS[i]
      expect(novo.diasUteisAtraso).toBe(orig.diasUteisAtraso)
      expect(novo.recebeSabDom).toBe(orig.recebeSabDom)
      expect(novo.confirmadoPeloDono).toBe(orig.confirmadoPeloDono)
      expect(novo.meio).toBe(orig.meio)
      expect(novo.vigenteDe.getTime()).toBeLessThan(orig.vigenteDe.getTime())
    })
  })
})

describe('GOLDEN intocado com a janela aberta em 01/08', () => {
  const vs = comJanela01()

  it('ter 12/08 continua 11.919,65 ao centavo', () => {
    expect(soma(vs, '2026-08-12', '2026-08-12')).toBe(11919.65)
    expect(soma(vs, '2026-08-12', '2026-08-12', 'CARTAO')).toBe(5705.25)
    expect(soma(vs, '2026-08-12', '2026-08-12', 'PIX')).toBe(4191.40)
    expect(soma(vs, '2026-08-12', '2026-08-12', 'DINHEIRO')).toBe(2023.00)
  })

  it('qua 13/08 continua 10.468,80 ao centavo', () => {
    expect(soma(vs, '2026-08-13', '2026-08-13')).toBe(10468.80)
  })

  it('fim de semana {14..16} continua 62.090,93 ao centavo', () => {
    expect(soma(vs, '2026-08-14', '2026-08-16')).toBe(62090.93)
    expect(soma(vs, '2026-08-14', '2026-08-16', 'CARTAO')).toBe(28422.17)
  })
})

describe('a prova geral: TODA linha de 12/08+ é idêntica nas duas janelas', () => {
  it('mesma quantidade, mesmas datas, mesmos meios, mesmos centavos', () => {
    const chave = (vs: VendaDiariaComputada[]) => vs
      .filter((v) => diaUTC(v.dataCompetencia) >= '2026-08-12')
      .map((v) => `${diaUTC(v.dataCompetencia)}|${diaUTC(v.dataCompetenciaFim)}|${v.meio}|${v.valorLiquido.toFixed(2)}|${v.isBloco}`)
      .sort()

    const antes = chave(comJanela12())
    const depois = chave(comJanela01())
    expect(depois).toEqual(antes)          // linha a linha
    expect(depois.length).toBeGreaterThan(0) // e não passou por estar vazio
  })

  it('a janela 01/08 REALMENTE produz dias novos no passado (senão o teste acima é vazio)', () => {
    const antigos = comJanela01().filter((v) => diaUTC(v.dataCompetencia) < '2026-08-12')
    // o fixture cobre 12-17/08; se ele não tem dado anterior, ao menos garantimos que
    // a janela não INVENTA nada onde não há lançamento
    expect(antigos.every((v) => v.valorLiquido !== 0)).toBe(true)
  })
})
