// ⛔⛔⛔ O CRONÔMETRO PARADO NO TABLET (08/09/2026) — o caso real, com os números dele.
//
// *"Funcionário clica INICIAR e o relógio fica no ZERO — não anda."*
//
// ⭐ E a primeira coisa medida foi a que o dono perguntou: **o `iniciadoEm` grava?** Grava —
// em prod, 4 das 12 etapas recentes têm o carimbo e as durações fecham. Era só a pintura.

import { describe, it, expect } from 'vitest'
import { relogioDaTarefa, desvioDoAparelho } from '../cronometro'

const T0 = new Date('2026-09-08T17:12:00.000Z').getTime()
const iso = (ms: number) => new Date(ms).toISOString()

describe('⭐ o relógio anda', () => {
  it('2 segundos depois de iniciar, a tela mostra 00:02', () => {
    expect(relogioDaTarefa(iso(T0), T0 + 2_000).texto).toBe('00:02')
  })

  it('90 segundos → 01:30', () => {
    expect(relogioDaTarefa(iso(T0), T0 + 90_000)).toMatchObject({ segundos: 90, texto: '01:30' })
  })

  it('mais de uma hora continua contando em minutos (a cozinha não usa hh)', () => {
    expect(relogioDaTarefa(iso(T0), T0 + 3_725_000).texto).toBe('62:05')
  })

  it('sem início, zero — e sem alarme', () => {
    expect(relogioDaTarefa(null, T0)).toMatchObject({ segundos: 0, relogioTorto: false })
  })
})

describe('⛔⛔ O TABLET COM A HORA ERRADA — a causa do bug', () => {
  // o aparelho está 3 minutos ATRASADO: `Date.now()` local é menor que o `iniciadoEm`
  const ATRASO = 3 * 60_000

  it('⛔ REPONDO O DEFEITO: sem corrigir o desvio, o relógio fica parado em 00:00', () => {
    // é literalmente o que o dono viu: aperta INICIAR e não anda
    expect(relogioDaTarefa(iso(T0), T0 - ATRASO).texto).toBe('00:00')
    expect(relogioDaTarefa(iso(T0), T0 - ATRASO + 30_000).texto).toBe('00:00')
    // ⚠️ e agora ele ACUSA em vez de mentir zero calado
    expect(relogioDaTarefa(iso(T0), T0 - ATRASO).relogioTorto).toBe(true)
  })

  it('⭐ com o desvio MEDIDO contra o servidor, o mesmo tablet conta certo', () => {
    const localNoMomento = T0 - ATRASO
    const desvio = desvioDoAparelho(iso(T0), localNoMomento)
    expect(desvio).toBe(ATRASO)
    // 45s depois, pelo relógio (errado) do aparelho
    const r = relogioDaTarefa(iso(T0), localNoMomento + 45_000 + desvio)
    expect(r.texto).toBe('00:45')
    expect(r.relogioTorto).toBe(false)
  })

  it('⚠️ 2s de folga: latência de rede não vira alarme de relógio torto', () => {
    expect(relogioDaTarefa(iso(T0), T0 - 1_500).relogioTorto).toBe(false)
    expect(relogioDaTarefa(iso(T0), T0 - 5_000).relogioTorto).toBe(true)
  })

  it('aparelho ADIANTADO não quebra nada — só conta a mais até recalibrar', () => {
    expect(relogioDaTarefa(iso(T0), T0 + 60_000).segundos).toBe(60)
  })
})
