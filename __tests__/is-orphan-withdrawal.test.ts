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

  it('DESPESAS_PESSOAL (folha CLT — Salários, FGTS, etc) → NÃO dispara (Opção 3)', () => {
    expect(
      isOrphanWithdrawal({ ...base, categoryDreGroup: 'DESPESAS_PESSOAL' }),
    ).toBe(false)
  })

  it('CUSTO_PRODUTO_VENDIDO (Salários Cozinha CLT) → NÃO dispara', () => {
    expect(
      isOrphanWithdrawal({ ...base, categoryDreGroup: 'CUSTO_PRODUTO_VENDIDO' }),
    ).toBe(false)
  })

  it('REEMBOLSO (OUTRAS_DESPESAS) → não dispara', () => {
    expect(
      isOrphanWithdrawal({ ...base, categoryDreGroup: 'OUTRAS_DESPESAS' }),
    ).toBe(false)
  })

  it('WITHDRAWAL_DRE_GROUPS contém exatamente 1 grupo (Opção 3)', () => {
    expect(WITHDRAWAL_DRE_GROUPS.size).toBe(1)
    expect(WITHDRAWAL_DRE_GROUPS.has('DISTRIBUICAO_LUCROS')).toBe(true)
    expect(WITHDRAWAL_DRE_GROUPS.has('DESPESAS_PESSOAL')).toBe(false)
  })
})

describe('inferKindFromDreGroup', () => {
  it('DISTRIBUICAO_LUCROS sem nome → DISTRIBUICAO (default)', () => {
    expect(inferKindFromDreGroup('DISTRIBUICAO_LUCROS')).toBe('DISTRIBUICAO')
  })

  it('DISTRIBUICAO_LUCROS + "Distribuição de Lucros" → DISTRIBUICAO', () => {
    expect(
      inferKindFromDreGroup('DISTRIBUICAO_LUCROS', 'Distribuição de Lucros'),
    ).toBe('DISTRIBUICAO')
  })

  it('DISTRIBUICAO_LUCROS + "Pró-labore Sócios" → PRO_LABORE', () => {
    expect(
      inferKindFromDreGroup('DISTRIBUICAO_LUCROS', 'Pró-labore Sócios'),
    ).toBe('PRO_LABORE')
  })

  it('DISTRIBUICAO_LUCROS + "Pro labore" (sem acento) → PRO_LABORE', () => {
    expect(inferKindFromDreGroup('DISTRIBUICAO_LUCROS', 'Pro labore')).toBe(
      'PRO_LABORE',
    )
  })

  it('DISTRIBUICAO_LUCROS + "INSS sobre Pró-labore" → PRO_LABORE', () => {
    expect(
      inferKindFromDreGroup('DISTRIBUICAO_LUCROS', 'INSS sobre Pró-labore'),
    ).toBe('PRO_LABORE')
  })

  it('DESPESAS_PESSOAL → null (Opção 3 — não dispara)', () => {
    expect(inferKindFromDreGroup('DESPESAS_PESSOAL')).toBeNull()
    expect(inferKindFromDreGroup('DESPESAS_PESSOAL', 'Salários')).toBeNull()
  })

  it('outros dreGroups → null', () => {
    expect(inferKindFromDreGroup('DESPESAS_ADMINISTRATIVAS')).toBeNull()
    expect(inferKindFromDreGroup('OUTRAS_DESPESAS')).toBeNull()
    expect(inferKindFromDreGroup(null)).toBeNull()
    expect(inferKindFromDreGroup(undefined)).toBeNull()
  })
})
