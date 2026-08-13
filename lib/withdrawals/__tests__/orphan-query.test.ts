// Sprint Unificar-Retirada-Órfã (13/08) — REGRA 3: executa a fonte única contra
// prisma-mock e prova que count e list usam o MESMO where (impossível divergir).

import { describe, it, expect, vi } from 'vitest'
import { orphanWithdrawalWhere, countOrphanWithdrawals, listOrphanWithdrawals } from '../orphan-query'

describe('orphanWithdrawalWhere — o WHERE canônico (fonte única)', () => {
  it('tem os filtros que evitam falso positivo: EFFECTED + não-interna + não-agrupada + só DISTRIBUICAO + sem bridge', () => {
    const w: any = orphanWithdrawalWhere('co1')
    expect(w.bankAccount).toEqual({ companyId: 'co1' })
    expect(w.type).toBe('DEBIT')
    expect(w.lifecycle).toBe('EFFECTED') // pago (não status=RECONCILED, mais correto)
    expect(w.isInternalTransfer).toBe(false) // exclui transferência entre contas próprias
    expect(w.transferGroupId).toBeNull() // exclui par agrupado
    expect(w.bridge).toEqual({ is: null }) // sem ponte
    expect(w.category.dreGroup.in).toEqual(['DISTRIBUICAO_LUCROS']) // pró-labore fica de fora
  })
})

describe('count e list usam a MESMA fonte', () => {
  it('countOrphanWithdrawals chama transaction.count com o where canônico', async () => {
    const db: any = { transaction: { count: vi.fn(async () => 3) } }
    const n = await countOrphanWithdrawals(db, 'co1')
    expect(n).toBe(3)
    expect(db.transaction.count).toHaveBeenCalledWith({ where: orphanWithdrawalWhere('co1') })
  })

  it('listOrphanWithdrawals usa o MESMO where do count', async () => {
    const db: any = { transaction: { findMany: vi.fn(async () => []) } }
    await listOrphanWithdrawals(db, 'co1')
    const arg = db.transaction.findMany.mock.calls[0][0]
    expect(arg.where).toEqual(orphanWithdrawalWhere('co1'))
    expect(arg.orderBy).toEqual({ date: 'desc' })
  })
})
