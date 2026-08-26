// REGRA 1 — o bloco 31/07–02/08 sumia da tela de agosto (competência de início em
// julho). Com `cruzaOMes` ele aparece, e `incluiMesAnterior` manda a tela avisar.

import { describe, it, expect } from 'vitest'
import { cruzaOMes, incluiMesAnterior } from '../janela-mes'

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)
const linha = (ini: string, fim: string) => ({ dataCompetencia: d(ini), dataCompetenciaFim: d(fim) })

const INICIO_AGO = d('2026-08-01')
const FIM_AGO = d('2026-09-01')

describe('janela do mês na tela de vendas', () => {
  it('o BLOCO REAL 31/07–02/08 cruza agosto (antes ele sumia) e é marcado como do mês anterior', () => {
    const bloco = linha('2026-07-31', '2026-08-02')
    expect(cruzaOMes(bloco, INICIO_AGO, FIM_AGO)).toBe(true)
    expect(incluiMesAnterior(bloco, INICIO_AGO)).toBe(true)
  })

  it('o filtro ANTIGO (competência dentro do mês) teria deixado esse bloco de fora', () => {
    const bloco = linha('2026-07-31', '2026-08-02')
    const filtroAntigo = bloco.dataCompetencia >= INICIO_AGO && bloco.dataCompetencia < FIM_AGO
    expect(filtroAntigo).toBe(false) // <- o buraco
  })

  it('bloco inteiramente dentro do mês entra e NÃO recebe aviso', () => {
    const bloco = linha('2026-08-07', '2026-08-09')
    expect(cruzaOMes(bloco, INICIO_AGO, FIM_AGO)).toBe(true)
    expect(incluiMesAnterior(bloco, INICIO_AGO)).toBe(false)
  })

  it('dia único do mês entra; dia único de julho fica fora', () => {
    expect(cruzaOMes(linha('2026-08-11', '2026-08-11'), INICIO_AGO, FIM_AGO)).toBe(true)
    expect(cruzaOMes(linha('2026-07-20', '2026-07-20'), INICIO_AGO, FIM_AGO)).toBe(false)
  })

  it('bloco que termina depois do mês (30/08–01/09) entra em agosto E em setembro', () => {
    const bloco = linha('2026-08-30', '2026-09-01')
    expect(cruzaOMes(bloco, INICIO_AGO, FIM_AGO)).toBe(true)
    expect(incluiMesAnterior(bloco, INICIO_AGO)).toBe(false)
    const INICIO_SET = d('2026-09-01'), FIM_SET = d('2026-10-01')
    expect(cruzaOMes(bloco, INICIO_SET, FIM_SET)).toBe(true)
    expect(incluiMesAnterior(bloco, INICIO_SET)).toBe(true)
  })
})
