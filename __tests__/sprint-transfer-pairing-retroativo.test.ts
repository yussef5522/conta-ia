// Sprint Transfer-Pairing-Retroativo (16/06/2026) — testes do scan + gate.
//
// Cobre:
//   1) algoritmo greedy 1-to-1
//   2) gate nameMatchOk (RECARGA TELEFONE bloqueado, PIX ENVIADO + YUSSEF passa)
//   3) thresholds HIGH / MEDIUM
//   4) own-entity-signals (CNPJ, sócio PF)
//   5) integração no importar-ofx (presença do auto-pareamento)
//   6) DRE ignora type=TRANSFER (regressão)

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  scanRetroativo,
  CONFIRM_THRESHOLD,
  PAIR_THRESHOLD,
  type OrphanTxForScan,
} from '@/lib/transfers/scan-retroativo'

const D = (s: string) => new Date(s + 'T00:00:00.000Z')

const refs = {
  cnpj: '29756732000198',
  names: ['caçula mix', 'yussef'],
  accountNames: ['banrisul', 'sicredi', 'stone'],
  ownerCpfs: [] as string[],
  ownerNames: [] as string[],
}

function tx(
  partial: Partial<OrphanTxForScan> & {
    id: string
    bankAccountId: string
    type: 'CREDIT' | 'DEBIT'
    amount: number
    date: Date
    description: string
  },
): OrphanTxForScan {
  return {
    bankAccountName: partial.bankAccountId,
    ...partial,
  }
}

// ============================================================================
// 1) Caso real Cacula — Banrisul→Stone (4 reais + 1 RECARGA TELEFONE)
// ============================================================================
describe('Sprint Transfer-Pairing-Retroativo — caso real Cacula', () => {
  it('pareia HIGH+nameOk dos 4 reais (PIX ENVIADO + YUSSEF Transferência)', () => {
    const txs: OrphanTxForScan[] = [
      tx({ id: 'b1', bankAccountId: 'banrisul', type: 'DEBIT', amount: 34000, date: D('2026-06-08'), description: 'PIX ENVIADO' }),
      tx({ id: 's1', bankAccountId: 'stone', type: 'CREDIT', amount: 34000, date: D('2026-06-08'), description: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix' }),
      tx({ id: 'b2', bankAccountId: 'banrisul', type: 'DEBIT', amount: 1100, date: D('2026-06-09'), description: 'PIX ENVIADO' }),
      tx({ id: 's2', bankAccountId: 'stone', type: 'CREDIT', amount: 1100, date: D('2026-06-09'), description: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix' }),
    ]
    const r = scanRetroativo({ txs, refs })
    expect(r.pairs.length).toBe(2)
    expect(r.high).toBe(2)
    expect(r.pairableSafely).toBe(2)
    expect(r.pairs.every((p) => p.level === 'HIGH' && p.nameMatchOk)).toBe(true)
  })

  it('RECARGA TELEFONE bate score HIGH mas falha nameMatchOk (gate bloqueia)', () => {
    const txs: OrphanTxForScan[] = [
      tx({ id: 'b1', bankAccountId: 'banrisul', type: 'DEBIT', amount: 50, date: D('2026-06-15'), description: 'RECARGA TELEFONE' }),
      tx({ id: 's1', bankAccountId: 'stone', type: 'CREDIT', amount: 50, date: D('2026-06-15'), description: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix' }),
    ]
    const r = scanRetroativo({ txs, refs })
    expect(r.pairs.length).toBe(1) // detecta como candidato
    expect(r.pairs[0].confidence).toBeGreaterThanOrEqual(PAIR_THRESHOLD) // HIGH por valor+dia+own name
    expect(r.pairs[0].nameMatchOk).toBe(false) // 🚨 GATE bloqueia
    expect(r.pairableSafely).toBe(0)
  })

  it('mistura: 1 real + 1 RECARGA + 1 par 50 PIX_ENVIADO/YUSSEF (greedy escolhe melhor)', () => {
    const txs: OrphanTxForScan[] = [
      // par real grande
      tx({ id: 'b1', bankAccountId: 'banrisul', type: 'DEBIT', amount: 34000, date: D('2026-06-08'), description: 'PIX ENVIADO' }),
      tx({ id: 's1', bankAccountId: 'stone', type: 'CREDIT', amount: 34000, date: D('2026-06-08'), description: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix' }),
      // RECARGA (50)
      tx({ id: 'b2', bankAccountId: 'banrisul', type: 'DEBIT', amount: 50, date: D('2026-06-15'), description: 'RECARGA TELEFONE' }),
      // CREDIT Stone Yussef 50 — pode parear com RECARGA (errado) ou com PIX ENVIADO (certo)
      tx({ id: 's2', bankAccountId: 'stone', type: 'CREDIT', amount: 50, date: D('2026-06-15'), description: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix' }),
    ]
    const r = scanRetroativo({ txs, refs })
    // Pelo menos o par real sai HIGH+nameOk
    expect(r.pairs.length).toBeGreaterThanOrEqual(1)
    const realPair = r.pairs.find((p) => p.from.amount === 34000)
    expect(realPair?.level).toBe('HIGH')
    expect(realPair?.nameMatchOk).toBe(true)
  })
})

// ============================================================================
// 2) Thresholds e direção
// ============================================================================
describe('Sprint Transfer-Pairing-Retroativo — thresholds', () => {
  it('mesma conta NÃO pareia (cross-account hard)', () => {
    const txs: OrphanTxForScan[] = [
      tx({ id: 'a1', bankAccountId: 'banrisul', type: 'DEBIT', amount: 1000, date: D('2026-06-08'), description: 'PIX ENVIADO' }),
      tx({ id: 'a2', bankAccountId: 'banrisul', type: 'CREDIT', amount: 1000, date: D('2026-06-08'), description: 'YUSSEF Transferência' }),
    ]
    const r = scanRetroativo({ txs, refs })
    expect(r.pairs.length).toBe(0)
  })

  it('valor distinto > tolerance NÃO pareia', () => {
    const txs: OrphanTxForScan[] = [
      tx({ id: 'b1', bankAccountId: 'banrisul', type: 'DEBIT', amount: 1000, date: D('2026-06-08'), description: 'PIX ENVIADO' }),
      tx({ id: 's1', bankAccountId: 'stone', type: 'CREDIT', amount: 1100, date: D('2026-06-08'), description: 'YUSSEF Transferência' }),
    ]
    const r = scanRetroativo({ txs, refs })
    expect(r.pairs.length).toBe(0)
  })

  it('janela > 3 dias NÃO pareia', () => {
    const txs: OrphanTxForScan[] = [
      tx({ id: 'b1', bankAccountId: 'banrisul', type: 'DEBIT', amount: 1000, date: D('2026-06-01'), description: 'PIX ENVIADO' }),
      tx({ id: 's1', bankAccountId: 'stone', type: 'CREDIT', amount: 1000, date: D('2026-06-08'), description: 'YUSSEF Transferência' }),
    ]
    const r = scanRetroativo({ txs, refs })
    expect(r.pairs.length).toBe(0)
  })

  it('greedy 1-to-1: uma tx só entra em 1 par', () => {
    const txs: OrphanTxForScan[] = [
      tx({ id: 'b1', bankAccountId: 'banrisul', type: 'DEBIT', amount: 1000, date: D('2026-06-08'), description: 'PIX ENVIADO' }),
      tx({ id: 's1', bankAccountId: 'stone', type: 'CREDIT', amount: 1000, date: D('2026-06-08'), description: 'YUSSEF Transferência' }),
      tx({ id: 's2', bankAccountId: 'stone', type: 'CREDIT', amount: 1000, date: D('2026-06-08'), description: 'YUSSEF Transferência' }),
    ]
    const r = scanRetroativo({ txs, refs })
    expect(r.pairs.length).toBe(1)
  })

  it('aceita CONFIRM_THRESHOLD por default; minConfidence custom funciona', () => {
    const txs: OrphanTxForScan[] = [
      tx({ id: 'b1', bankAccountId: 'banrisul', type: 'DEBIT', amount: 1000, date: D('2026-06-08'), description: 'fornecedor X' }), // sem keyword
      tx({ id: 's1', bankAccountId: 'stone', type: 'CREDIT', amount: 1000, date: D('2026-06-08'), description: 'fornecedor Y' }),
    ]
    const defaultRun = scanRetroativo({ txs, refs })
    const tighter = scanRetroativo({ txs, refs, minConfidence: 0.85 })
    expect(tighter.pairs.length).toBeLessThanOrEqual(defaultRun.pairs.length)
  })

  it('exporta CONFIRM_THRESHOLD=0.70 e PAIR_THRESHOLD=0.85', () => {
    expect(CONFIRM_THRESHOLD).toBe(0.7)
    expect(PAIR_THRESHOLD).toBe(0.85)
  })
})

// ============================================================================
// 3) own-entity: CNPJ próprio + sócio PF
// ============================================================================
describe('Sprint Transfer-Pairing-Retroativo — own-entity signals', () => {
  it('YUSSEF como sócio PF — own name bate em "YUSSEF Transferência"', () => {
    const txs: OrphanTxForScan[] = [
      tx({ id: 'b1', bankAccountId: 'banrisul', type: 'DEBIT', amount: 5000, date: D('2026-06-08'), description: 'PIX ENVIADO' }),
      tx({ id: 's1', bankAccountId: 'stone', type: 'CREDIT', amount: 5000, date: D('2026-06-08'), description: 'YUSSEF ABU ZAHRY MUSA - Transferência | Pix' }),
    ]
    const r = scanRetroativo({ txs, refs })
    expect(r.pairs[0].level).toBe('HIGH')
    expect(r.pairs[0].nameMatchOk).toBe(true)
  })

  it('CNPJ próprio no memo bate own-cnpj', () => {
    const txs: OrphanTxForScan[] = [
      tx({ id: 'b1', bankAccountId: 'banrisul', type: 'DEBIT', amount: 5000, date: D('2026-06-08'), description: 'PAGAMENTO PIX-PIX_DEB 29756732000198 CACULA MIX' }),
      tx({ id: 's1', bankAccountId: 'stone', type: 'CREDIT', amount: 5000, date: D('2026-06-08'), description: 'RECEBIMENTO PIX 29756732000198' }),
    ]
    const r = scanRetroativo({ txs, refs })
    expect(r.pairs.length).toBe(1)
    expect(r.pairs[0].nameMatchOk).toBe(true)
  })
})

// ============================================================================
// 4) Integração: presença do auto-pareamento no importer
// ============================================================================
describe('Sprint Transfer-Pairing-Retroativo — integração importer OFX', () => {
  const PATH = join(__dirname, '..', 'app/api/contas-bancarias/[id]/importar-ofx/route.ts')
  const code = readFileSync(PATH, 'utf-8')

  it('importa scanRetroativo dinamicamente após createMany', () => {
    expect(code).toMatch(/import\(['"]@\/lib\/transfers\/scan-retroativo['"]\)/)
  })

  it('inclui sociosPF nas refs (via loadOwnEntityRefs)', () => {
    // Sprint Owner Detection (28/06/2026): refatorado pra usar helper
    // centralizado loadOwnEntityRefs (que internamente faz select de
    // sociosPF.nome e .cpf). Caller ficou DRY — assertion atualizada.
    expect(code).toMatch(/loadOwnEntityRefs/)
  })

  it('gate: SOMENTE HIGH + nameMatchOk auto-pareia', () => {
    expect(code).toMatch(/level === 'HIGH' && p\.nameMatchOk/)
  })

  it('falha silenciosa: try/catch ao redor pra não matar import', () => {
    expect(code).toMatch(/IMPORT-OFX\] auto-pareamento falhou/)
  })

  it('reporta transferenciasAutoPareadas na response', () => {
    expect(code).toMatch(/transferenciasAutoPareadas:\s*autoPairedCount/)
  })

  it('rollback parcial: se 1 lado pareou e outro não, desfaz', () => {
    expect(code).toMatch(/transferGroupId:\s*null,\s+transferDirection:\s*null/)
  })
})

// ============================================================================
// 5) Endpoint scan-retroativo — presença
// ============================================================================
describe('Sprint Transfer-Pairing-Retroativo — endpoint', () => {
  const PATH = join(__dirname, '..', 'app/api/empresas/[id]/transferencias/scan-retroativo/route.ts')
  const code = readFileSync(PATH, 'utf-8')

  it('aceita params dias (1-90, default 7) e dryRun (default true)', () => {
    expect(code).toMatch(/dias:\s*z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(90\)\.default\(7\)/)
    expect(code).toMatch(/dryRun:\s*z\.coerce\.boolean\(\)\.default\(true\)/)
  })

  it('inclui SocioPF.nome via loadOwnEntityRefs (helper centralizado)', () => {
    // Sprint Owner Detection (28/06/2026): refatorado pra usar helper.
    expect(code).toMatch(/loadOwnEntityRefs/)
  })

  it('filtra transferGroupId NULL e reconciledWithId NULL', () => {
    expect(code).toMatch(/transferGroupId:\s*null/)
    expect(code).toMatch(/reconciledWithId:\s*null/)
  })

  it('aplica $transaction com anti-race (where transferGroupId null)', () => {
    expect(code).toMatch(/prisma\.\$transaction/)
    expect(code).toMatch(/transferGroupId:\s*null,\s+\/\/\s*anti-race/)
  })
})

// ============================================================================
// 6) DRE ignora TRANSFER — regressão (já existia antes mas reconfirmamos)
// ============================================================================
describe('Sprint Transfer-Pairing-Retroativo — DRE ignora TRANSFER', () => {
  it('lib/dre/calculator.ts pula tx.type === TRANSFER', () => {
    const code = readFileSync(join(__dirname, '..', 'lib/dre/calculator.ts'), 'utf-8')
    expect(code).toMatch(/if\s*\(tx\.type\s*===\s*'TRANSFER'\)\s*continue/)
  })
})
