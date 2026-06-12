// Sub-fase 2B — buildLedgerBalCheck (função pura).
//
// Rede de segurança matemática estilo Conta Azul. O check valida que o saldo
// após aplicar o delta do import bate com o LEDGERBAL do extrato.
//
// ⚠️ Atenção especial ao teste #8 — prova que o check ALERTA corretamente
// quando o saldo base já está errado por estrago histórico, sem fingir que
// está tudo bem.

import { describe, it, expect } from 'vitest'
import { buildLedgerBalCheck } from '../../lib/ofx/preview-v2'
import type { V2NovaGenuinaItem, V2ConciliatePayableItem } from '../../lib/ofx/preview-v2'

function nova(opts: { ofxIndex?: number; amount: number; type: 'CREDIT' | 'DEBIT' }): V2NovaGenuinaItem {
  return {
    ofxIndex: opts.ofxIndex ?? 0,
    amount: opts.amount,
    date: '2026-06-12T00:00:00.000Z',
    memo: 'X',
    type: opts.type,
    fitid: 'fitid-' + (opts.ofxIndex ?? 0),
    dedupHash: 'hash-' + (opts.ofxIndex ?? 0),
  }
}

function conciliate(opts: { ofxIndex?: number; amount: number; type: 'CREDIT' | 'DEBIT' }): V2ConciliatePayableItem {
  return {
    ofxIndex: opts.ofxIndex ?? 99,
    amount: opts.amount,
    date: '2026-06-12T00:00:00.000Z',
    memo: 'Y',
    type: opts.type,
    matchedTxId: 'excel-1',
    matchedAmount: opts.amount,
    matchedDate: '2026-06-12T00:00:00.000Z',
    matchedDescription: 'EXCEL X',
    matchedOrigin: 'IMPORT_EXCEL',
    matchedCategoryName: null,
    matchedSupplierName: null,
    diff: 0,
    similarity: 1,
    reason: 'concilia',
  }
}

const LEDGER = (amount: number) => ({ amount, asOfDate: new Date('2026-06-12T00:00:00.000Z') })

describe('Sub-fase 2B — buildLedgerBalCheck', () => {
  // ──────────────────────────────────────────────────────────
  it('1. Import que BATE: delta entrada +200 + balance -100 = +100 = LEDGERBAL +100', () => {
    const r = buildLedgerBalCheck({
      ledgerBalance: LEDGER(100),
      balanceAtual: -100,
      novasGenuinas: [nova({ amount: 200, type: 'CREDIT' })],
      conciliatePayable: [],
    })

    expect(r.available).toBe(true)
    expect(r.bate).toBe(true)
    expect(r.diff).toBeCloseTo(0, 2)
    expect(r.deltaImportProposto).toBe(200)
    expect(r.saldoPosImport).toBe(100)
    expect(r.hipoteses).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('2. Import com 1 dup escapando (criou nova de mais): bate=false, hipotese aponta', () => {
    // balance -100 + delta 200 = saldoPos 100. LEDGERBAL diz que deveria ser -100
    // → diff = -200 = uma das novas (R$ 200) era dup. Hipótese 1 deve apontar.
    const r = buildLedgerBalCheck({
      ledgerBalance: LEDGER(-100),
      balanceAtual: -100,
      novasGenuinas: [nova({ ofxIndex: 7, amount: 200, type: 'CREDIT' })],
      conciliatePayable: [],
    })

    expect(r.bate).toBe(false)
    expect(r.diff).toBeCloseTo(-200, 2)
    const dupHip = r.hipoteses.find((h) => h.tipo === 'dup_marcada_nova')
    expect(dupHip).toBeDefined()
    expect(dupHip!.maisProvavel).toBe(true)
    expect(dupHip!.suspeitos).toContain(7)
  })

  // ──────────────────────────────────────────────────────────
  it('3. OFX sem LEDGERBAL: available=false (verificação indisponível)', () => {
    const r = buildLedgerBalCheck({
      ledgerBalance: null,
      balanceAtual: 100,
      novasGenuinas: [nova({ amount: 50, type: 'CREDIT' })],
      conciliatePayable: [],
    })

    expect(r.available).toBe(false)
    expect(r.bate).toBe(false)
    expect(r.ledgerBalAmount).toBeNull()
    expect(r.ledgerBalDate).toBeNull()
    // Cálculo do delta segue sendo útil mesmo sem ledgerbal
    expect(r.deltaImportProposto).toBe(50)
    expect(r.saldoPosImport).toBe(150)
    expect(r.hipoteses).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('4. CONCILIATE_PAYABLE entra no delta (cria saída real)', () => {
    const r = buildLedgerBalCheck({
      ledgerBalance: LEDGER(-300),
      balanceAtual: -100,
      novasGenuinas: [],
      conciliatePayable: [conciliate({ amount: 200, type: 'DEBIT' })],
    })

    expect(r.deltaImportProposto).toBe(-200)
    expect(r.saldoPosImport).toBe(-300)
    expect(r.bate).toBe(true)
  })

  // ──────────────────────────────────────────────────────────
  it('5. Caso reimport Banrisul: 0 novas, balance == LEDGERBAL → bate', () => {
    // Reimport com todas tx classificadas como SKIP ou REPLACE_MANUAL
    // (não entram no delta). Balance atual já reflete a verdade.
    const r = buildLedgerBalCheck({
      ledgerBalance: LEDGER(-7816.71),
      balanceAtual: -7816.71,
      novasGenuinas: [],
      conciliatePayable: [],
    })

    expect(r.bate).toBe(true)
    expect(r.deltaImportProposto).toBe(0)
  })

  // ──────────────────────────────────────────────────────────
  it('6. Banrisul + 1 nova de +200 → balance final bate com extrato', () => {
    const r = buildLedgerBalCheck({
      ledgerBalance: LEDGER(-7616.71),
      balanceAtual: -7816.71,
      novasGenuinas: [nova({ amount: 200, type: 'CREDIT' })],
      conciliatePayable: [],
    })

    expect(r.bate).toBe(true)
    expect(r.saldoPosImport).toBeCloseTo(-7616.71, 2)
  })

  // ──────────────────────────────────────────────────────────
  it('7. Banrisul: 1 nova falsamente marcada como dup (faltando) → bate=false, diff aponta', () => {
    // Banco diz que houve entrada de +200; sistema marcou ela como dup
    // e por isso não está nas novasGenuinas → saldoPos fica menor.
    // LEDGERBAL > saldoPos → diff positivo. hipótese 'real_marcada_dup'.
    const r = buildLedgerBalCheck({
      ledgerBalance: LEDGER(-7616.71),
      balanceAtual: -7816.71,
      novasGenuinas: [],  // a tx +200 não está aqui (marcada como dup falsa)
      conciliatePayable: [],
    })

    expect(r.bate).toBe(false)
    expect(r.diff).toBeCloseTo(200, 2)
    // Como NÃO tem nada nas novasGenuinas, a hipótese mais provável é
    // 'historico_errado' (não tem suspeito nas novas)
    const histHip = r.hipoteses.find((h) => h.tipo === 'historico_errado')
    expect(histHip).toBeDefined()
    expect(histHip!.maisProvavel).toBe(true)
  })

  // ──────────────────────────────────────────────────────────
  it('⚠️ 8. ESTRAGO HISTÓRICO: balance base errado + import perfeito → ALERTA HONESTO', () => {
    // Cenário Stone: balance cacheado +29.211,21 (estrago histórico),
    // LEDGERBAL real +105,20. Import perfeito (0 novas) → saldoPos = balanceAtual.
    // diff = LEDGERBAL - saldoPos = enorme negativo.
    //
    // O check NÃO finge que está tudo bem. Mostra:
    //   bate=false, diff grande, hipótese 'historico_errado' como mais provável.
    // Isso é a HONESTIDADE matemática: chama atenção do user pra investigar.
    const r = buildLedgerBalCheck({
      ledgerBalance: LEDGER(105.20),
      balanceAtual: 29211.21,
      novasGenuinas: [],
      conciliatePayable: [],
    })

    expect(r.bate).toBe(false)
    expect(r.diff).toBeCloseTo(105.20 - 29211.21, 2)  // = -29106.01
    expect(r.diff).toBeLessThan(-1000)

    // ⚠️ A hipótese mais provável é "historico_errado" (não tem suspeito
    // nas novas, então o check sabe que problema NÃO é do import atual)
    const histHip = r.hipoteses.find((h) => h.tipo === 'historico_errado')
    expect(histHip).toBeDefined()
    expect(histHip!.maisProvavel).toBe(true)

    // E as outras hipóteses estão listadas, mas NÃO marcadas como prováveis
    const dupHip = r.hipoteses.find((h) => h.tipo === 'dup_marcada_nova')
    expect(dupHip!.maisProvavel).toBe(false)
    const realHip = r.hipoteses.find((h) => h.tipo === 'real_marcada_dup')
    expect(realHip!.maisProvavel).toBe(false)

    // Cada hipótese tem label explicativa em pt-BR
    expect(histHip!.label).toMatch(/histórico/i)
  })

  // ──────────────────────────────────────────────────────────
  it('9. Tolerância R$ 0,02: diff de R$ 0,02 bate; R$ 0,03 não', () => {
    const r1 = buildLedgerBalCheck({
      ledgerBalance: LEDGER(100.02),
      balanceAtual: 100,
      novasGenuinas: [],
      conciliatePayable: [],
    })
    expect(r1.bate).toBe(true)

    const r2 = buildLedgerBalCheck({
      ledgerBalance: LEDGER(100.03),
      balanceAtual: 100,
      novasGenuinas: [],
      conciliatePayable: [],
    })
    expect(r2.bate).toBe(false)
  })

  // ──────────────────────────────────────────────────────────
  it('10. SKIP_DUP e REPLACE_MANUAL NÃO entram no delta', () => {
    // O check só recebe novasGenuinas e conciliatePayable. SKIP e REPLACE
    // não chegam — equivalente a não contribuir pro delta (já estavam no balance).
    const r = buildLedgerBalCheck({
      ledgerBalance: LEDGER(50),
      balanceAtual: 50,
      novasGenuinas: [],         // SKIP/REPLACE não entram aqui
      conciliatePayable: [],
    })

    expect(r.deltaImportProposto).toBe(0)
    expect(r.bate).toBe(true)
  })

  // ──────────────────────────────────────────────────────────
  it('11. Sempre lista as 3 hipóteses quando não bate', () => {
    const r = buildLedgerBalCheck({
      ledgerBalance: LEDGER(100),
      balanceAtual: 0,
      novasGenuinas: [],
      conciliatePayable: [],
    })
    expect(r.bate).toBe(false)
    expect(r.hipoteses).toHaveLength(3)
    expect(r.hipoteses.map((h) => h.tipo).sort()).toEqual([
      'dup_marcada_nova',
      'historico_errado',
      'real_marcada_dup',
    ])
    // Exatamente 1 é marcada como maisProvavel
    expect(r.hipoteses.filter((h) => h.maisProvavel)).toHaveLength(1)
  })
})
