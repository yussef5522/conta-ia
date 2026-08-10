// Sprint Preview-Futuro (09/08/2026) — Regra 1 + 3. Antes do fix o preview do
// PDF oferecia linhas agendadas (data futura) e o fechamento não batia. Testa o
// helper que a rota usa pra separar futuro do passado (comportamental).

import { describe, it, expect } from 'vitest'
import { partitionFutureStatementLines } from '../partition-future'

const HOJE = new Date('2026-08-09T18:00:00Z')

describe('partitionFutureStatementLines — descarte de futuro no PDF', () => {
  it('separa datas > hoje (agendadas) das passadas', () => {
    const lines = [
      { date: '2026-08-07', description: 'PIX RECEBIDO', amount: 100, type: 'CREDIT' },
      { date: '2026-08-09', description: 'TARIFA', amount: 10, type: 'DEBIT' },
      { date: '2026-08-10', description: 'CAPITALIZACAO RG', amount: 70.02, type: 'DEBIT' },
      { date: '2026-08-17', description: 'PAGAMENTO CARTAO', amount: 13779.73, type: 'DEBIT' },
    ]
    const { real, future } = partitionFutureStatementLines(lines, HOJE)
    expect(future.map((f) => f.date)).toEqual(['2026-08-10', '2026-08-17'])
    expect(real.map((r) => r.date)).toEqual(['2026-08-07', '2026-08-09'])
  })

  it('data de hoje NÃO é futura', () => {
    const { real, future } = partitionFutureStatementLines(
      [{ date: '2026-08-09', description: 'x', amount: 1, type: 'DEBIT' }],
      HOJE,
    )
    expect(future).toHaveLength(0)
    expect(real).toHaveLength(1)
  })

  it('data inválida → conservador: mantém como real (não descarta por engano)', () => {
    const { real, future } = partitionFutureStatementLines(
      [{ date: 'sem-data', description: 'x', amount: 1, type: 'DEBIT' }],
      HOJE,
    )
    expect(future).toHaveLength(0)
    expect(real).toHaveLength(1)
  })
})
