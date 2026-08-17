import { describe, it, expect } from 'vitest'
import { buildJudgeAlertEmail } from '../judge-alert-email'

const base = {
  runAt: new Date('2026-08-16T03:00:00Z'),
  totalContracts: 9,
  totalFail: 1,
  balanceIssues: 1,
  byCompany: [{ name: 'caçula mix', contracts: 9, fails: [{ contract: 'C61021346-2', fails: ['I5(#23)'] }] }],
  sharedTx: [] as { txId: string; parcelas: string[] }[],
  balanceChecks: [{ name: 'banrisul', stored: -5913.41, recomputed: -4213.41, delta: 1700 }],
  juizUrl: 'https://app.caixaos.com.br/juiz',
}

describe('buildJudgeAlertEmail — detalhe na falha, não "veja o painel"', () => {
  it('traz empresa + invariante + contrato/parcela', () => {
    const { html } = buildJudgeAlertEmail(base)
    expect(html).toContain('caçula mix')
    expect(html).toContain('C61021346-2')
    expect(html).toContain('I5(#23)')
  })

  it('traz esperado vs real do saldo (I9)', () => {
    const { html } = buildJudgeAlertEmail(base)
    expect(html).toMatch(/banrisul/)
    expect(html).toContain('gravado')
    expect(html).toContain('recalculado')
    expect(html).toMatch(/1\.700,00|R\$.*1\.700/) // a diferença
  })

  it('tem link direto pro /juiz', () => {
    const { html } = buildJudgeAlertEmail(base)
    expect(html).toContain('https://app.caixaos.com.br/juiz')
  })

  it('subject conta as falhas', () => {
    expect(buildJudgeAlertEmail(base).subject).toContain('2 falhas') // 1 fail + 0 shared + 1 balance
  })
})
