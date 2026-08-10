// Sprint A/B-no-Painel (10/08/2026) — Regra 1. Antes do fix o WithdrawalPanel
// não mandava `spend` → fluxo B ("já gastei") sumiu → saldo do PF inflava. Este
// teste EXECUTA a montagem do payload (Regra 3) e prova: A/B marcado → spend
// presente; desmarcado → ausente (fluxo A, saldo sobe).

import { describe, it, expect } from 'vitest'
import { buildPontePayload, type BuildPontePayloadInput } from '../build-ponte-payload'

const base: BuildPontePayloadInput = {
  companyId: 'co',
  pjTransactionId: 'tx',
  profileId: 'prof',
  pfBankAccountId: 'acc',
  pfCategoryId: 'incomeCat',
  kind: 'DISTRIBUICAO',
  socioPFId: 'socio',
  spendChecked: false,
  spendCategoryId: '',
}

describe('buildPontePayload — fluxo A vs B', () => {
  it('fluxo A (não gastei): SEM spend → só entrada, saldo PF sobe', () => {
    const p = buildPontePayload(base)
    expect(p.spend).toBeUndefined()
    expect(p.pfCategoryId).toBe('incomeCat')
    expect(p.createdVia).toBe('CREATED_MANUAL')
  })

  it('fluxo B (já gastei + categoria): spend presente → entrada + saída atomic', () => {
    const p = buildPontePayload({ ...base, spendChecked: true, spendCategoryId: 'escola' })
    expect(p.spend).toEqual({ categoryId: 'escola' })
  })

  it('marcou "já gastei" mas sem categoria → spend ausente (canSubmit bloqueia antes)', () => {
    const p = buildPontePayload({ ...base, spendChecked: true, spendCategoryId: '' })
    expect(p.spend).toBeUndefined()
  })
})
