// Fix Scan Retroativo — Sprint Import Idempotente FASE 7 (18/06/2026).
//
// Cenário Cacula 06/2026: Stone tem 17 PIX "YUSSEF ABU ZAHRY MUSA"
// vindos do Banrisul. Detector pareou 14 mas deixou 3 órfãos
// (R$ 8.000 / R$ 650 / R$ 50) que foram classificados como CUSTO.
//
// Causa: greedy iterava DEBITs em ordem natural. Quando 2 DEBITs
// disputavam o mesmo CREDIT, o primeiro "roubava" mesmo tendo
// nameMatchOk INFERIOR. Fix: ordenar TODOS candidatos por
// (nameMatchOk DESC, confidence DESC, deltaDays ASC) antes do greedy.

import { describe, it, expect } from 'vitest'
import {
  scanRetroativo,
  type OrphanTxForScan,
} from '@/lib/transfers/scan-retroativo'

const D = (s: string) => new Date(s + 'T00:00:00.000Z')

const refs = {
  cnpj: '29756732000198',
  names: ['cacula mix', 'yussef'],
  accountNames: ['banrisul', 'sicredi', 'stone'],
}

function tx(p: {
  id: string
  bankAccountId: string
  type: 'CREDIT' | 'DEBIT'
  amount: number
  date: Date
  description: string
}): OrphanTxForScan {
  return { bankAccountName: p.bankAccountId, ...p }
}

describe('FASE 7: nameMatchOk DESC vence ordem natural', () => {
  it('pareia primeiro o candidato com nome próprio em AMBOS os lados, não o primeiro insertado', () => {
    // Banrisul tem 2 DEBITs R$ 1000 mesmo dia.
    // Stone tem 1 CREDIT R$ 1000 com "YUSSEF ABU ZAHRY MUSA".
    // - DEBIT b-frio: "PAGAMENTO PIX" (sem name match em refs)
    // - DEBIT b-yussef: "PIX YUSSEF ABU ZAHRY" (name match)
    // Esperado: par escolhe b-yussef (nameMatchOk=true), b-frio fica órfão.
    const txs: OrphanTxForScan[] = [
      tx({
        id: 'b-frio',
        bankAccountId: 'banrisul',
        type: 'DEBIT',
        amount: 1000,
        date: D('2026-06-08'),
        // SEM keyword PIX/TED/TRANSF e SEM nome próprio
        description: 'COMPRA MERCADO LIVRE',
      }),
      tx({
        id: 'b-yussef',
        bankAccountId: 'banrisul',
        type: 'DEBIT',
        amount: 1000,
        date: D('2026-06-08'),
        description: 'PIX YUSSEF ABU ZAHRY MUSA',
      }),
      tx({
        id: 's-yussef',
        bankAccountId: 'stone',
        type: 'CREDIT',
        amount: 1000,
        date: D('2026-06-08'),
        description: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix',
      }),
    ]
    const r = scanRetroativo({ txs, refs })
    // b-frio + s-yussef talvez nem entra (sem intent no DEBIT).
    // b-yussef + s-yussef DEVE entrar (nameMatchOk=true).
    expect(r.pairs.length).toBe(1)
    expect(r.pairs[0].from.id).toBe('b-yussef')
    expect(r.pairs[0].to.id).toBe('s-yussef')
    expect(r.pairs[0].nameMatchOk).toBe(true)
  })

  it('idempotência par: tx só entra em 1 par mesmo se múltiplos candidatos', () => {
    // 1 DEBIT, 3 CREDITs todos R$ 500 mesmo dia. Só deve formar 1 par.
    const txs: OrphanTxForScan[] = [
      tx({
        id: 'd',
        bankAccountId: 'banrisul',
        type: 'DEBIT',
        amount: 500,
        date: D('2026-06-08'),
        description: 'PIX ENVIADO YUSSEF',
      }),
      tx({
        id: 'c1',
        bankAccountId: 'stone',
        type: 'CREDIT',
        amount: 500,
        date: D('2026-06-08'),
        description: 'YUSSEF ABU ZAHRY',
      }),
      tx({
        id: 'c2',
        bankAccountId: 'sicredi',
        type: 'CREDIT',
        amount: 500,
        date: D('2026-06-08'),
        description: 'YUSSEF ABU ZAHRY',
      }),
      tx({
        id: 'c3',
        bankAccountId: 'banco-caixa',
        type: 'CREDIT',
        amount: 500,
        date: D('2026-06-08'),
        description: 'OUTRO MOTIVO',
      }),
    ]
    const r = scanRetroativo({ txs, refs })
    // Só forma 1 par (DEBIT entrou no primeiro = idempotência)
    expect(r.pairs.length).toBe(1)
    expect(r.pairs[0].from.id).toBe('d')
    // Os 2 candidatos não escolhidos ficam órfãos (não vão pra 2º par usando os mesmos)
    const idsUsed = new Set(r.pairs.flatMap((p) => [p.from.id, p.to.id]))
    expect(idsUsed.size).toBe(2)
  })
})
