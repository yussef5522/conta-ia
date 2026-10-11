// REGRA 1 — o bloco 31/07–02/08 sumia da tela de agosto (competência de início em
// julho). Com `cruzaOMes` ele aparece, e `incluiMesAnterior` manda a tela avisar.

import { describe, it, expect } from 'vitest'
import {
  cruzaOMes, incluiMesAnterior, whereCruzaOMes, type LinhaCompetencia,
} from '../janela-mes'

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

/**
 * ⭐⭐ AS DUAS FORMAS DA MESMA RÉGUA CONCORDAM — o teste que faltava (10/10).
 *
 * ⚠️⚠️ A sobreposição existe em DUAS línguas: `cruzaOMes` (predicado, decide sobre UMA
 * linha na mão) e `whereCruzaOMes` (fragmento do `where`, filtra no banco). ***Duas formas
 * sem teste de concordância é como esta decisão divergiu DUAS vezes*** — 25/08 escondeu
 * R$ 43.106,03 da tela e 26/08 produziu 111 alarmes falsos no juiz, as duas pela mesma
 * causa: um leitor corrigido, o outro não.
 *
 * ⛔ Não dá pra rodar o `where` do Prisma aqui sem banco, então o teste **simula o filtro**
 * com a semântica exata dos operadores (`gte`/`lt`) e exige o MESMO conjunto, linha a linha.
 * Se alguém trocar o `gte` do fim pelo `gte` do início (o defeito de 25/08), os dois
 * passam a discordar e isto fica vermelho.
 */
describe('⛔⛔ predicado × where — uma decisão, duas línguas', () => {
  const comoOPrisma = (
    linhas: LinhaCompetencia[],
    w: ReturnType<typeof whereCruzaOMes>,
  ) => linhas.filter((v) =>
    v.dataCompetenciaFim.getTime() >= w.dataCompetenciaFim.gte.getTime()
    && v.dataCompetencia.getTime() < w.dataCompetencia.lt.getTime(),
  )

  const UNIVERSO: LinhaCompetencia[] = [
    linha('2026-07-20', '2026-07-20'), // julho puro — fora
    linha('2026-07-31', '2026-08-02'), // ⭐ o bloco de borda: os R$ 43.106,03
    linha('2026-08-07', '2026-08-09'), // dentro
    linha('2026-08-11', '2026-08-11'), // dia único dentro
    linha('2026-08-30', '2026-09-01'), // sai pela borda de cima
    linha('2026-09-10', '2026-09-10'), // setembro puro — fora
  ]

  it('⭐ o conjunto é IDÊNTICO nos dois caminhos, em agosto e em setembro', () => {
    for (const [ini, fim] of [
      [INICIO_AGO, FIM_AGO],
      [d('2026-09-01'), d('2026-10-01')],
    ] as const) {
      const pelaMao = UNIVERSO.filter((v) => cruzaOMes(v, ini, fim))
      const peloBanco = comoOPrisma(UNIVERSO, whereCruzaOMes(ini, fim))
      expect(peloBanco, 'o where tem que devolver o mesmo que o predicado').toEqual(pelaMao)
    }
  })

  it('⛔ e o bloco de borda está DENTRO do conjunto nos dois (o buraco de 25/08)', () => {
    const peloBanco = comoOPrisma(UNIVERSO, whereCruzaOMes(INICIO_AGO, FIM_AGO))
    expect(peloBanco.some((v) => v.dataCompetencia.getTime() === d('2026-07-31').getTime()))
      .toBe(true)
  })
})
