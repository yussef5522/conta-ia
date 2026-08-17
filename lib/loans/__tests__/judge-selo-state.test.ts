import { describe, it, expect } from 'vitest'
import { judgeSeloState, type SeloLatest } from '../judge-selo-state'

const NOW = new Date('2026-08-17T18:00:00Z').getTime()
const rep = (over: Partial<SeloLatest>): SeloLatest => ({
  runAt: '2026-08-17T17:00:00Z', passed: true, totalContracts: 9, totalFail: 0, balanceIssues: 0, ...over,
})

describe('judgeSeloState — 4 estados DISTINTOS (bug do amarelo, 16/08)', () => {
  // O BUG: relatório de 25h atrás virava CINZA "nunca rodou" em vez de AMARELO.
  // Este é o teste REGRA 1 — falhava antes (caía no cinza), passa depois.
  it('AMARELO: existe relatório mas o último passou de 24h → "não roda desde"', () => {
    const s = judgeSeloState(rep({ runAt: new Date(NOW - 25 * 3.6e6).toISOString() }), NOW)
    expect(s.tone).toBe('yellow')
    expect(s.label).toContain('não roda desde')
    expect(s.label).not.toContain('nunca') // NÃO é o cinza
  })

  it('CINZA: zero relatórios → "nunca rodou" (só no 1º dia)', () => {
    const s = judgeSeloState(null, NOW)
    expect(s.tone).toBe('gray')
    expect(s.label).toContain('nunca rodou')
  })

  it('VERDE: último < 24h e 0 falhas → "Juiz 9/9 · HH:MM"', () => {
    const s = judgeSeloState(rep({ passed: true, totalFail: 0 }), NOW)
    expect(s.tone).toBe('green')
    expect(s.label).toContain('9/9')
  })

  it('VERMELHO: último < 24h e N falhas → "Juiz: N falhas"', () => {
    const s = judgeSeloState(rep({ passed: false, totalFail: 1, balanceIssues: 1 }), NOW)
    expect(s.tone).toBe('red')
    expect(s.label).toContain('2 falhas')
  })

  it('a IDADE decide (não a existência): mesmo relatório, 23h=verde vs 25h=amarelo', () => {
    expect(judgeSeloState(rep({ runAt: new Date(NOW - 23 * 3.6e6).toISOString() }), NOW).tone).toBe('green')
    expect(judgeSeloState(rep({ runAt: new Date(NOW - 25 * 3.6e6).toISOString() }), NOW).tone).toBe('yellow')
  })
})
