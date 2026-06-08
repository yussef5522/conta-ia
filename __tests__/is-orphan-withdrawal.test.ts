import { describe, it, expect } from 'vitest'
import {
  isOrphanWithdrawal,
  inferKindFromDreGroup,
  WITHDRAWAL_DRE_GROUPS,
} from '@/lib/withdrawals/is-orphan'

const base = {
  lifecycle: 'EFFECTED',
  type: 'DEBIT',
  isInternalTransfer: false,
  transferGroupId: null as string | null,
  categoryDreGroup: 'DISTRIBUICAO_LUCROS',
  hasBridge: false,
}

describe('isOrphanWithdrawal', () => {
  it('caso real Yussef: Caixa EFFECTED + Distribuição → órfã', () => {
    expect(isOrphanWithdrawal(base)).toBe(true)
  })

  it('com ponte ativa → não é órfã', () => {
    expect(isOrphanWithdrawal({ ...base, hasBridge: true })).toBe(false)
  })

  it('PAYABLE futura → não é órfã (ainda não foi paga)', () => {
    expect(isOrphanWithdrawal({ ...base, lifecycle: 'PAYABLE' })).toBe(false)
  })

  it('CREDIT (entrada) → não é órfã (só saída pode ser retirada)', () => {
    expect(isOrphanWithdrawal({ ...base, type: 'CREDIT' })).toBe(false)
  })

  it('transferência interna entre empresas → não é órfã', () => {
    expect(isOrphanWithdrawal({ ...base, isInternalTransfer: true })).toBe(false)
  })

  it('transferGroupId não-nulo (transferência mesma empresa) → não é órfã', () => {
    expect(
      isOrphanWithdrawal({ ...base, transferGroupId: 'group-abc' }),
    ).toBe(false)
  })

  it('sem categoria → não é órfã', () => {
    expect(isOrphanWithdrawal({ ...base, categoryDreGroup: null })).toBe(false)
  })

  it('dreGroup de despesa normal (DESPESAS_ADMINISTRATIVAS) → não é órfã', () => {
    expect(
      isOrphanWithdrawal({ ...base, categoryDreGroup: 'DESPESAS_ADMINISTRATIVAS' }),
    ).toBe(false)
  })

  it('OUTRAS_DESPESAS → não é órfã (não dispara o fluxo)', () => {
    expect(
      isOrphanWithdrawal({ ...base, categoryDreGroup: 'OUTRAS_DESPESAS' }),
    ).toBe(false)
  })

  it('DESPESAS_PESSOAL (pró-labore) → é órfã se EFFECTED sem ponte', () => {
    expect(
      isOrphanWithdrawal({ ...base, categoryDreGroup: 'DESPESAS_PESSOAL' }),
    ).toBe(true)
  })

  it('REEMBOLSO (decisão #4 — fica de fora) → não dispara', () => {
    // dreGroup OUTRAS_DESPESAS é comum em reembolso
    expect(
      isOrphanWithdrawal({ ...base, categoryDreGroup: 'OUTRAS_DESPESAS' }),
    ).toBe(false)
  })

  it('WITHDRAWAL_DRE_GROUPS contém exatamente 2 grupos', () => {
    expect(WITHDRAWAL_DRE_GROUPS.size).toBe(2)
    expect(WITHDRAWAL_DRE_GROUPS.has('DISTRIBUICAO_LUCROS')).toBe(true)
    expect(WITHDRAWAL_DRE_GROUPS.has('DESPESAS_PESSOAL')).toBe(true)
  })
})

describe('inferKindFromDreGroup', () => {
  it('DISTRIBUICAO_LUCROS → DISTRIBUICAO', () => {
    expect(inferKindFromDreGroup('DISTRIBUICAO_LUCROS')).toBe('DISTRIBUICAO')
  })

  it('DESPESAS_PESSOAL → PRO_LABORE', () => {
    expect(inferKindFromDreGroup('DESPESAS_PESSOAL')).toBe('PRO_LABORE')
  })

  it('outros dreGroups → null', () => {
    expect(inferKindFromDreGroup('DESPESAS_ADMINISTRATIVAS')).toBeNull()
    expect(inferKindFromDreGroup('OUTRAS_DESPESAS')).toBeNull()
    expect(inferKindFromDreGroup(null)).toBeNull()
    expect(inferKindFromDreGroup(undefined)).toBeNull()
  })
})
