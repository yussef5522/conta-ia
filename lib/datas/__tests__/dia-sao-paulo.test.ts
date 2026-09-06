// ⛔⛔ "CONCLUÍDA ÀS 21H SOME DO HOJE" — o caso REAL de 05/09/2026, virado em teste.
//
// Medido em prod às 22:16 SP: **9 conclusões do dia (17:49–17:58 SP) e o filtro "hoje"
// mostrando ZERO**, com as mesmas 9 visíveis em "semana". Os instantes abaixo são os do
// banco, não inventados.

import { describe, it, expect } from 'vitest'
import { diaEmSaoPaulo, janelaDoDiaSP, somarDias } from '../dia-sao-paulo'

/** os 9 lotes reais de 05/09 (só os instantes; quantidade não importa aqui) */
const CONCLUSOES_DE_ONTEM_A_NOITE = [
  '2026-09-05T20:58:28.940Z', '2026-09-05T20:54:41.875Z', '2026-09-05T20:54:31.424Z',
  '2026-09-05T20:51:01.556Z', '2026-09-05T20:50:38.253Z', '2026-09-05T20:50:17.362Z',
  '2026-09-05T20:49:59.858Z', '2026-09-05T20:49:42.611Z', '2026-09-05T20:49:24.257Z',
].map((s) => new Date(s))

/** o instante em que o dono abriu a tela: 22:16 de São Paulo — já 06/09 em UTC */
const QUANDO_ELE_OLHOU = new Date('2026-09-06T01:16:25.378Z')

describe('⛔⛔ o dia é o de quem opera', () => {
  it('⛔⛔ às 22:16 de SP ainda é DIA 5 — o UTC já virou e é ele que mentia', () => {
    expect(QUANDO_ELE_OLHOU.toISOString().slice(0, 10), 'o que a tela usava').toBe('2026-09-06')
    expect(diaEmSaoPaulo(QUANDO_ELE_OLHOU), 'o que o relógio da cozinha diz').toBe('2026-09-05')
  })

  it('⭐⭐ e as 9 conclusões REAIS de 05/09 caem dentro do "hoje" de São Paulo', () => {
    const hoje = diaEmSaoPaulo(QUANDO_ELE_OLHOU)
    const j = janelaDoDiaSP(hoje, hoje)
    const dentro = CONCLUSOES_DE_ONTEM_A_NOITE.filter((d) => d >= j.de && d <= j.ate)
    expect(dentro, 'o "hoje" que mostrava zero').toHaveLength(9)
  })

  it('⛔ o recorte ANTIGO (dia UTC puro) perdia as 9 — é o red deste fix', () => {
    const diaUtc = QUANDO_ELE_OLHOU.toISOString().slice(0, 10)
    const de = new Date(`${diaUtc}T00:00:00.000Z`)
    const ate = new Date(`${diaUtc}T23:59:59.999Z`)
    expect(CONCLUSOES_DE_ONTEM_A_NOITE.filter((d) => d >= de && d <= ate)).toHaveLength(0)
  })

  it('⭐ a janela de SP começa às 03:00Z e termina às 02:59:59.999Z do dia seguinte', () => {
    const j = janelaDoDiaSP('2026-09-05')
    expect(j.de.toISOString()).toBe('2026-09-05T03:00:00.000Z')
    expect(j.ate.toISOString()).toBe('2026-09-06T02:59:59.999Z')
  })

  it('⛔ a BORDA das 21h-23h59, que é quando a cozinha fecha, é do dia CERTO', () => {
    const j = janelaDoDiaSP('2026-09-05')
    for (const hora of ['21:00:00', '22:16:25', '23:59:59']) {
      // hora de São Paulo → instante UTC (+3h)
      const [h, m, s] = hora.split(':').map(Number)
      const instante = new Date(Date.UTC(2026, 8, 5, h + 3, m, s))
      expect(instante >= j.de && instante <= j.ate, `${hora} de SP caiu fora do dia 05`).toBe(true)
    }
    // e 00:30 de SP do dia 6 NÃO pertence ao dia 5 (a janela não vaza pro vizinho)
    const madrugada = new Date(Date.UTC(2026, 8, 6, 3, 30))
    expect(madrugada > j.ate).toBe(true)
  })

  it('⭐ "últimos 7 dias" anda no calendário, e o fim é o dia de SP', () => {
    const hoje = diaEmSaoPaulo(QUANDO_ELE_OLHOU)
    expect(somarDias(hoje, -6)).toBe('2026-08-30')
    const j = janelaDoDiaSP(somarDias(hoje, -6), hoje)
    expect(CONCLUSOES_DE_ONTEM_A_NOITE.every((d) => d >= j.de && d <= j.ate), 'semana já mostrava').toBe(true)
    expect(somarDias('2026-03-01', -1), 'atravessa o mês').toBe('2026-02-28')
    expect(somarDias('2026-01-01', -1), 'atravessa o ano').toBe('2025-12-31')
  })

  it('⭐ meio-dia e meia-noite de SP não escorregam de dia', () => {
    expect(diaEmSaoPaulo(new Date('2026-09-05T15:00:00Z')), '12:00 SP').toBe('2026-09-05')
    expect(diaEmSaoPaulo(new Date('2026-09-05T03:00:00Z')), '00:00 SP').toBe('2026-09-05')
    expect(diaEmSaoPaulo(new Date('2026-09-05T02:59:59Z')), '23:59:59 SP do dia 4').toBe('2026-09-04')
  })
})
