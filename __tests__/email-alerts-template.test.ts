// Sprint 4.0.4 — testes do buildAlertEmail (função pura).

import { describe, it, expect } from 'vitest'
import { buildAlertEmail } from '@/lib/email/alerts-template'
import type { AlertasResult } from '@/lib/dashboard/alertas'

function alertas(over: Partial<AlertasResult> = {}): AlertasResult {
  return {
    vencidas: { count: 0, total: 0 },
    vencendoEm3Dias: { count: 0, total: 0 },
    vencendoSemana: { count: 0, total: 0 },
    total: { count: 0, total: 0 },
    ...over,
  }
}

const base = {
  userName: 'Yussef',
  companyName: 'Cacula Mix',
  dashboardUrl: 'https://app.caixaos.com.br/dashboard',
  configUrl: 'https://app.caixaos.com.br/configuracoes/alertas',
}

describe('buildAlertEmail', () => {
  it('zero alertas → isEmpty=true (não envia)', () => {
    const r = buildAlertEmail({ ...base, alertas: alertas() })
    expect(r.isEmpty).toBe(true)
    expect(r.subject).toBe('')
    expect(r.html).toBe('')
  })

  it('subject prioriza VENCIDAS (mais urgente)', () => {
    const r = buildAlertEmail({
      ...base,
      alertas: alertas({
        vencidas: { count: 2, total: 1000 },
        vencendoEm3Dias: { count: 5, total: 500 },
      }),
    })
    expect(r.subject).toMatch(/2 contas vencidas/)
    expect(r.isEmpty).toBe(false)
  })

  it('subject 3 dias quando NÃO há vencidas', () => {
    const r = buildAlertEmail({
      ...base,
      alertas: alertas({ vencendoEm3Dias: { count: 3, total: 500 } }),
    })
    expect(r.subject).toMatch(/3 contas vencem em até 3 dias/)
  })

  it('subject "essa semana" quando só há esse bucket', () => {
    const r = buildAlertEmail({
      ...base,
      alertas: alertas({ vencendoSemana: { count: 1, total: 100 } }),
    })
    expect(r.subject).toMatch(/1 conta essa semana/)
  })

  it('singular vs plural', () => {
    const single = buildAlertEmail({
      ...base,
      alertas: alertas({ vencidas: { count: 1, total: 100 } }),
    })
    expect(single.subject).toMatch(/1 conta vencida/)

    const plural = buildAlertEmail({
      ...base,
      alertas: alertas({ vencidas: { count: 5, total: 500 } }),
    })
    expect(plural.subject).toMatch(/5 contas vencidas/)
  })

  it('HTML escapa caracteres especiais no companyName', () => {
    const r = buildAlertEmail({
      ...base,
      companyName: '<script>alert("xss")</script>',
      alertas: alertas({ vencidas: { count: 1, total: 100 } }),
    })
    expect(r.html).not.toContain('<script>')
    expect(r.html).toContain('&lt;script&gt;')
  })

  it('HTML inclui link pro dashboard e configurações', () => {
    const r = buildAlertEmail({
      ...base,
      alertas: alertas({ vencidas: { count: 1, total: 100 } }),
    })
    expect(r.html).toContain(base.dashboardUrl)
    expect(r.html).toContain(base.configUrl)
  })

  it('HTML mostra total crítico (vencidas + 3 dias)', () => {
    const r = buildAlertEmail({
      ...base,
      alertas: alertas({
        vencidas: { count: 2, total: 1000 },
        vencendoEm3Dias: { count: 3, total: 500 },
        vencendoSemana: { count: 5, total: 200 },
      }),
    })
    // 1500 = 1000 + 500 (semana NÃO conta no crítico)
    expect(r.html).toMatch(/R\$\s*1\.500/)
  })

  it('HTML formato BRL pt-BR', () => {
    const r = buildAlertEmail({
      ...base,
      alertas: alertas({ vencidas: { count: 1, total: 1234.56 } }),
    })
    expect(r.html).toMatch(/R\$\s*1\.234,56/)
  })

  it('renderiza apenas buckets >0', () => {
    const r = buildAlertEmail({
      ...base,
      alertas: alertas({
        vencidas: { count: 1, total: 100 },
        // 3 dias e semana zerados
      }),
    })
    expect(r.html).toMatch(/🔴/)
    expect(r.html).not.toMatch(/🟡/)
    expect(r.html).not.toMatch(/🟢/)
  })
})
