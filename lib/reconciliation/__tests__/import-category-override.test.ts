// Fix regressão OFX V2 (06/08/2026) — as categorias escolhidas no preview
// voltam a ser aplicadas no import com a flag RECONCILE_V2 ligada.
//
// O CRUX (item 1.3 do plano): o client casa o override por `dedupHashOFX`
// (fitid|date|valor|memo), NÃO pelo stableKey nem pelo dedupHash de linha
// (stableKey#importId:occ). O orchestrator recomputa o MESMO dedupHashOFX a
// partir da StatementLine. Estes testes provam que a chave bate e que a
// decisão de status espelha o V1 (categoria → RECONCILED, sem → PENDING).

import { describe, it, expect } from 'vitest'
import { resolveLineOverride } from '../import-orchestrator'
import { dedupHashOFX } from '@/lib/ofx/dedup'
import type { StatementLine } from '../types'

const D = (s: string) => new Date(`${s}T12:00:00Z`)

// Lado CLIENT: a OFXTransaction que o preview vê (filtrarNovasOFX → dedupHashOFX).
const clientTx = {
  datePosted: D('2026-07-15'),
  type: 'DEBIT' as const,
  amount: 100.5,
  memo: 'PIX ENVIADO JOAO',
  fitid: 'ABC123',
}
// Lado ORCHESTRATOR: a mesma linha vira StatementLine (signedAmount negativo).
const orchestratorLine: StatementLine = {
  datePosted: D('2026-07-15'),
  signedAmount: -100.5,
  memo: 'PIX ENVIADO JOAO',
  fitid: 'ABC123',
}

describe('OFX V2 override — a chave (dedupHashOFX) casa entre client e orchestrator', () => {
  it('1.3: dedupHashOFX da StatementLine == dedupHashOFX da OFXTransaction (o que o client envia)', () => {
    const clientKey = dedupHashOFX(clientTx)
    // Reproduz o que resolveLineOverride recomputa internamente:
    const orchestratorKey = dedupHashOFX({
      datePosted: orchestratorLine.datePosted,
      type: orchestratorLine.signedAmount >= 0 ? 'CREDIT' : 'DEBIT',
      amount: Math.abs(orchestratorLine.signedAmount),
      memo: orchestratorLine.memo,
      fitid: orchestratorLine.fitid ?? '',
    })
    expect(orchestratorKey).toBe(clientKey)
  })

  it('CREDIT: sinal positivo produz a mesma chave que o client (type CREDIT)', () => {
    const tx = { datePosted: D('2026-07-16'), type: 'CREDIT' as const, amount: 2500, memo: 'TED RECEBIDA', fitid: 'X9' }
    const line: StatementLine = { datePosted: D('2026-07-16'), signedAmount: 2500, memo: 'TED RECEBIDA', fitid: 'X9' }
    const map = new Map<string, string | null>([[dedupHashOFX(tx), 'cat-receita']])
    expect(resolveLineOverride(map, line).categoryId).toBe('cat-receita')
  })
})

describe('OFX V2 override — decisão de status espelha o V1', () => {
  const clientKey = dedupHashOFX(clientTx)

  it('4.1: com categoria escolhida → RECONCILED + MANUAL + conf 1.0 + categoryId', () => {
    const map = new Map<string, string | null>([[clientKey, 'cat-despesa-op']])
    const r = resolveLineOverride(map, orchestratorLine)
    expect(r).toEqual({
      categoryId: 'cat-despesa-op',
      status: 'RECONCILED',
      classificationSource: 'MANUAL',
      aiConfidence: 1.0,
    })
  })

  it('2.5: SEM override → PENDING, sem categoria (vai pra Pendentes como antes)', () => {
    const r = resolveLineOverride(new Map(), orchestratorLine)
    expect(r).toEqual({
      categoryId: null,
      status: 'PENDING',
      classificationSource: null,
      aiConfidence: null,
    })
  })

  it('override explícito NULL ("A classificar") → PENDING, sem categoria', () => {
    const map = new Map<string, string | null>([[clientKey, null]])
    const r = resolveLineOverride(map, orchestratorLine)
    expect(r.status).toBe('PENDING')
    expect(r.categoryId).toBeNull()
  })

  it('override de OUTRA linha não vaza pra esta (chave diferente → PENDING)', () => {
    const outraKey = dedupHashOFX({ ...clientTx, memo: 'OUTRA COISA' })
    const map = new Map<string, string | null>([[outraKey, 'cat-x']])
    expect(resolveLineOverride(map, orchestratorLine).status).toBe('PENDING')
  })

  it('4.1 misto: numa lista, só as com override entram RECONCILED; as demais PENDING', () => {
    const linhas: StatementLine[] = [
      orchestratorLine, // tem override
      { datePosted: D('2026-07-17'), signedAmount: -30, memo: 'TARIFA', fitid: 'T1' }, // sem
      { datePosted: D('2026-07-18'), signedAmount: 900, memo: 'DEPOSITO', fitid: 'T2' }, // sem
    ]
    const map = new Map<string, string | null>([[clientKey, 'cat-despesa-op']])
    const res = linhas.map((l) => resolveLineOverride(map, l))
    expect(res.filter((r) => r.status === 'RECONCILED')).toHaveLength(1)
    expect(res.filter((r) => r.status === 'PENDING')).toHaveLength(2)
    expect(res[0].categoryId).toBe('cat-despesa-op')
  })
})
