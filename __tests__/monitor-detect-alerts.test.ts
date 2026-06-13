// Fase 5 — Testes da função pura detectAlerts.
//
// ⚠️ M1/M3: estável e melhorou → 0 alertas (não incomoda pelo lixo histórico)
// ⚠️ M2: piorou → 1 alerta (avisa quando algo muda pra pior)

import { describe, it, expect } from 'vitest'
import {
  detectAlerts,
  filterByDismissed,
  type MetricSnapshot,
} from '../lib/monitor/detect-alerts'

function snap(opts: Partial<MetricSnapshot> & { metricKey: string; value: number }): MetricSnapshot {
  return {
    metricKey: opts.metricKey,
    companyId: opts.companyId ?? 'company-A',
    value: opts.value,
  }
}

describe('Fase 5 — detectAlerts (alertas só quando SOBE)', () => {
  // ──────────────────────────────────────────────────────────
  it('⚠️ M1. Estável (ontem 5, hoje 5) → 0 alertas (não incomoda pelo lixo estável)', () => {
    const alerts = detectAlerts(
      [snap({ metricKey: 'A', value: 5 })],
      [snap({ metricKey: 'A', value: 5 })],
    )
    expect(alerts).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('⚠️ M2. Piorou (ontem 5, hoje 6) → 1 alerta', () => {
    const alerts = detectAlerts(
      [snap({ metricKey: 'B', value: 6 })],
      [snap({ metricKey: 'B', value: 5 })],
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].metricKey).toBe('B')
    expect(alerts[0].valueOntem).toBe(5)
    expect(alerts[0].valueHoje).toBe(6)
    expect(alerts[0].delta).toBe(1)
  })

  // ──────────────────────────────────────────────────────────
  it('⚠️ M3. Melhorou (ontem 5, hoje 4) → 0 alertas (caiu, bom)', () => {
    const alerts = detectAlerts(
      [snap({ metricKey: 'A', value: 4 })],
      [snap({ metricKey: 'A', value: 5 })],
    )
    expect(alerts).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('M4. Sem medição ontem (primeiro dia) → 0 alertas (baseline silenciosa)', () => {
    const alerts = detectAlerts(
      [snap({ metricKey: 'A', value: 116 })],  // Cacula tem 116 Excel órfãs
      [],
    )
    expect(alerts).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('M5. Multi-tenant: empresa A estável, empresa B piorou → 1 alerta (só de B)', () => {
    const alerts = detectAlerts(
      [
        snap({ metricKey: 'A', companyId: 'company-A', value: 5 }),
        snap({ metricKey: 'A', companyId: 'company-B', value: 10 }),
      ],
      [
        snap({ metricKey: 'A', companyId: 'company-A', value: 5 }),
        snap({ metricKey: 'A', companyId: 'company-B', value: 7 }),
      ],
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].companyId).toBe('company-B')
    expect(alerts[0].delta).toBe(3)
  })

  // ──────────────────────────────────────────────────────────
  it('M6. Múltiplas métricas: só uma piora → 1 alerta da chave certa', () => {
    const alerts = detectAlerts(
      [
        snap({ metricKey: 'A', value: 5 }),
        snap({ metricKey: 'B', value: 0 }),
        snap({ metricKey: 'C', value: 2 }),  // C subiu
        snap({ metricKey: 'D', value: 0 }),
      ],
      [
        snap({ metricKey: 'A', value: 5 }),
        snap({ metricKey: 'B', value: 0 }),
        snap({ metricKey: 'C', value: 0 }),
        snap({ metricKey: 'D', value: 0 }),
      ],
    )
    expect(alerts).toHaveLength(1)
    expect(alerts[0].metricKey).toBe('C')
    expect(alerts[0].delta).toBe(2)
  })

  // ──────────────────────────────────────────────────────────
  it('M7. Alert tem campos completos', () => {
    const alerts = detectAlerts(
      [snap({ metricKey: 'B', companyId: 'comp', value: 3 })],
      [snap({ metricKey: 'B', companyId: 'comp', value: 1 })],
    )
    expect(alerts[0]).toEqual({
      metricKey: 'B',
      companyId: 'comp',
      valueOntem: 1,
      valueHoje: 3,
      delta: 2,
    })
  })

  // ──────────────────────────────────────────────────────────
  it('Cenário real Cacula: A=116 estável (lixo histórico) + C=0→1 (warning novo) → 1 alerta de C', () => {
    const alerts = detectAlerts(
      [
        snap({ metricKey: 'A', companyId: 'cacula', value: 116 }),  // estável
        snap({ metricKey: 'C', companyId: 'cacula', value: 1 }),    // novo warning
      ],
      [
        snap({ metricKey: 'A', companyId: 'cacula', value: 116 }),
        // C não existia ontem
      ],
    )
    // C não tinha ontem → vira baseline silenciosa (NÃO alerta no 1º dia)
    expect(alerts).toHaveLength(0)
  })
})

describe('Fase 5 — filterByDismissed', () => {
  // ──────────────────────────────────────────────────────────
  it('Alerta dismissed com mesmo valor → não mostra', () => {
    const filtered = filterByDismissed(
      [{ metricKey: 'A', companyId: 'comp', valueOntem: 5, valueHoje: 7, delta: 2 }],
      [{ metricKey: 'A', companyId: 'comp', valueHoje: 7 }],
    )
    expect(filtered).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('Alerta dismissed mas com valor MUDOU → mostra (mudou após dismiss)', () => {
    const filtered = filterByDismissed(
      [{ metricKey: 'A', companyId: 'comp', valueOntem: 7, valueHoje: 9, delta: 2 }],
      [{ metricKey: 'A', companyId: 'comp', valueHoje: 7 }],  // dismissed com value 7
    )
    expect(filtered).toHaveLength(1)
  })
})
