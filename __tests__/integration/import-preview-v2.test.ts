// Sub-fase 2A — testes das funções puras do payload do preview.
//
// Cenários:
//   1. Import limpo (DB vazio) → tudo em novasGenuinas
//   2. Reimport idêntico → tudo em skipDup (sem hash, simula FITID novo)
//   3. FITID reciclado (mesmo valor+data+desc, FITID diferente) → skipDup
//   4. ⚠️ COMPRA REPETIDA REAL (1 sistema, 2 arquivo) → 1 skip + 1 nova
//   5. PIX 7.400 (MANUAL TRANSFER) → replaceManual com isTransferGroup
//   6. Excel PAYABLE exata → conciliatePayable
//   7. Excel PAYABLE com diff > tolerância → CREATE_NEW (defesa)
//   8. ⚠️ FLAG V2=false: payload IDÊNTICO ao legado (anti-regressão)
//   9. ⚠️ /confirm legado preserva campos `novas`, `total`, `duplicadas` na resposta legacy
//
// Funções testadas:
//   - buildV2PreviewPayload (puro)
//   - buildLegacyPreviewPayload (puro)
//   - isV2PreviewEnabled (puro)

import { describe, it, expect } from 'vitest'
import {
  buildV2PreviewPayload,
  buildLegacyPreviewPayload,
  isV2PreviewEnabled,
} from '../../lib/ofx/preview-v2'
import type { OFXTransaction } from '../../lib/ofx/parser'

const BANK = 'bank-A'

function ofx(opts: Partial<OFXTransaction> & { dedupHash?: string }): OFXTransaction & { dedupHash: string } {
  return {
    fitid: opts.fitid ?? 'fitid-' + Math.random().toString(36).slice(2, 8),
    datePosted: opts.datePosted ?? new Date('2026-06-10T00:00:00.000Z'),
    amount: opts.amount ?? 100,
    type: opts.type ?? 'DEBIT',
    memo: opts.memo ?? 'PAGAMENTO X',
    dedupHash: opts.dedupHash ?? 'hash-' + Math.random().toString(36).slice(2, 12),
  } as OFXTransaction & { dedupHash: string }
}

function existingTx(opts: {
  id: string
  amount?: number
  date?: Date
  dueDate?: Date | null
  description?: string
  type?: string
  origin?: string
  lifecycle?: string
  bankAccountId?: string | null
  reconciledWithId?: string | null
  transferGroupId?: string | null
  categoryName?: string | null
  supplierName?: string | null
}) {
  return {
    id: opts.id,
    bankAccountId: opts.bankAccountId === undefined ? BANK : opts.bankAccountId,
    amount: opts.amount ?? 100,
    date: opts.date ?? new Date('2026-06-10T00:00:00.000Z'),
    dueDate: opts.dueDate ?? null,
    description: opts.description ?? 'PAGAMENTO X',
    type: opts.type ?? 'DEBIT',
    origin: opts.origin ?? 'OFX',
    lifecycle: opts.lifecycle ?? 'EFFECTED',
    reconciledWithId: opts.reconciledWithId ?? null,
    transferGroupId: opts.transferGroupId ?? null,
    category: opts.categoryName ? { name: opts.categoryName } : null,
    supplier: opts.supplierName ? { razaoSocial: opts.supplierName } : null,
  }
}

const BASE_INPUT = {
  totalArquivo: 0,
  duplicadasHashLegado: 0,
  errosParser: [],
  banco: null,
  contaId: BANK,
}

describe('Sub-fase 2A — buildV2PreviewPayload', () => {
  // ──────────────────────────────────────────────────────────
  it('1. Import limpo (DB vazio) → tudo em novasGenuinas', () => {
    const novas = [
      ofx({ amount: 100 }), ofx({ amount: 200 }), ofx({ amount: 300 }),
      ofx({ amount: 400 }), ofx({ amount: 500 }),
    ]
    const result = buildV2PreviewPayload({
      ...BASE_INPUT,
      novas, totalArquivo: 5, candidates: [],
    })

    expect(result.classificacao.novasGenuinas).toHaveLength(5)
    expect(result.classificacao.skipDup).toHaveLength(0)
    expect(result.classificacao.replaceManual).toHaveLength(0)
    expect(result.classificacao.conciliatePayable).toHaveLength(0)
    expect(result.classificacao.contagens.novasGenuinas).toBe(5)
  })

  // ──────────────────────────────────────────────────────────
  it('2. Reimport idêntico (5 OFX no DB, 5 no arquivo) → 5 skipDup', () => {
    const candidates = [
      existingTx({ id: 'sys-1', amount: 351.14, description: 'DEBITO STONE' }),
      existingTx({ id: 'sys-2', amount: 326.93, description: 'ANTECIP STONE' }),
      existingTx({ id: 'sys-3', amount: 128.97, description: 'BANRI A VISTA' }),
      existingTx({ id: 'sys-4', amount: 72.95, description: 'ANTECIPACAO BANRICOMPRAS' }),
      existingTx({ id: 'sys-5', amount: 54.45, description: 'VERO ANTECIPACAO BANRICARD' }),
    ]
    // No reimport o tipo é CREDIT (entradas Banrisul)
    const novas = candidates.map((c, i) =>
      ofx({ amount: c.amount, memo: c.description, type: 'CREDIT' }),
    )
    candidates.forEach((c) => { c.type = 'CREDIT' })

    const result = buildV2PreviewPayload({
      ...BASE_INPUT,
      novas, totalArquivo: 5, candidates,
    })

    expect(result.classificacao.skipDup).toHaveLength(5)
    expect(result.classificacao.novasGenuinas).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('3. FITID reciclado (descrição com IDs voláteis) → SKIP_DUP via valor+data+desc', () => {
    const candidates = [
      existingTx({ id: 'sys-1', amount: 100, description: 'PIX ENVIADO 12345' }),
    ]
    const novas = [
      // mesmo valor, mesma data, FITID e ID embutidos diferentes
      ofx({ amount: 100, memo: 'PIX ENVIADO 99999' }),
    ]

    const result = buildV2PreviewPayload({
      ...BASE_INPUT,
      novas, totalArquivo: 1, candidates,
    })

    expect(result.classificacao.skipDup).toHaveLength(1)
    expect(result.classificacao.novasGenuinas).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('⚠️ 4. COMPRA REPETIDA REAL (1 sistema, 2 arquivo) → 1 skip + 1 nova (protege dado)', () => {
    const candidates = [
      existingTx({ id: 'sys-1', amount: 105, description: 'PAGAMENTO FORNECEDOR X' }),
    ]
    const novas = [
      ofx({ amount: 105, memo: 'PAGAMENTO FORNECEDOR X' }),
      ofx({ amount: 105, memo: 'PAGAMENTO FORNECEDOR X' }),  // 2ª real
    ]

    const result = buildV2PreviewPayload({
      ...BASE_INPUT,
      novas, totalArquivo: 2, candidates,
    })

    expect(result.classificacao.skipDup).toHaveLength(1)
    expect(result.classificacao.novasGenuinas).toHaveLength(1)
    // A 1ª casou com sys-1; a 2ª NÃO pôde reusar
    expect(result.classificacao.skipDup[0].matchedTxId).toBe('sys-1')
  })

  // ──────────────────────────────────────────────────────────
  it('5. PIX 7.400 — MANUAL TRANSFER → REPLACE_MANUAL com isTransferGroup', () => {
    const candidates = [
      existingTx({
        id: 'manual-banrisul', amount: 7400, type: 'TRANSFER',
        origin: 'MANUAL', lifecycle: 'EFFECTED',
        description: 'YUSSEF ABU ZAHRY MUSA - Transferência Pix',
        transferGroupId: '1ec907e5-grupo',
      }),
    ]
    const novas = [
      ofx({ amount: 7400, memo: 'PIX ENVIADO', type: 'DEBIT' }),
    ]

    const result = buildV2PreviewPayload({
      ...BASE_INPUT,
      novas, totalArquivo: 1, candidates,
    })

    expect(result.classificacao.replaceManual).toHaveLength(1)
    expect(result.classificacao.replaceManual[0].matchedTxId).toBe('manual-banrisul')
    expect(result.classificacao.replaceManual[0].isTransferGroup).toBe(true)
    expect(result.classificacao.replaceManual[0].transferGroupId).toBe('1ec907e5-grupo')
  })

  // ──────────────────────────────────────────────────────────
  it('6. Excel PAYABLE exata (RM2) → CONCILIATE_PAYABLE diff=0', () => {
    const candidates = [
      existingTx({
        id: 'excel-rm2',
        bankAccountId: null,
        amount: 198.80,
        description: 'RM2 COMERCIO DE MATERIAIS PARA INFORMATICA LTDA',
        type: 'DEBIT', origin: 'IMPORT_EXCEL', lifecycle: 'PAYABLE',
        dueDate: new Date('2026-06-10T00:00:00.000Z'),
        categoryName: 'Material de Escritório',
        supplierName: 'RM2 COMERCIO',
      }),
    ]
    const novas = [
      ofx({ amount: 198.80, memo: 'RM2 COMERCIO DE MATERIAIS PARA INFORMATICA LTDA - Pagamento', type: 'DEBIT' }),
    ]

    const result = buildV2PreviewPayload({
      ...BASE_INPUT,
      novas, totalArquivo: 1, candidates,
    })

    expect(result.classificacao.conciliatePayable).toHaveLength(1)
    expect(result.classificacao.conciliatePayable[0].matchedTxId).toBe('excel-rm2')
    expect(result.classificacao.conciliatePayable[0].diff).toBeCloseTo(0, 2)
    expect(result.classificacao.conciliatePayable[0].matchedCategoryName).toBe('Material de Escritório')
    expect(result.classificacao.conciliatePayable[0].matchedSupplierName).toBe('RM2 COMERCIO')
  })

  // ──────────────────────────────────────────────────────────
  it('7. Excel PAYABLE com diff > tolerância (TOZZO juros) → CREATE_NEW (defesa)', () => {
    // OFX 1.191,13 vs Excel 1.165,50 = diff 25,63 → fora da tolerância amount (0,02)
    // → não casa. Vai pra novasGenuinas. UI mostra esse caso pro user decidir
    // (Fase 2D vai oferecer "conciliar com adjustment Juros" quando UI permitir).
    const candidates = [
      existingTx({
        id: 'excel-tozzo',
        bankAccountId: null,
        amount: 1165.50,
        description: 'TOZZO ALIMENTOS LTDA',
        type: 'DEBIT', origin: 'IMPORT_EXCEL', lifecycle: 'PAYABLE',
        dueDate: new Date('2026-06-10T00:00:00.000Z'),
      }),
    ]
    const novas = [
      ofx({ amount: 1191.13, memo: 'TOZZO ALIMENTOS LTDA - Pagamento', type: 'DEBIT' }),
    ]

    const result = buildV2PreviewPayload({
      ...BASE_INPUT,
      novas, totalArquivo: 1, candidates,
    })

    expect(result.classificacao.novasGenuinas).toHaveLength(1)
    expect(result.classificacao.conciliatePayable).toHaveLength(0)
  })

  // ──────────────────────────────────────────────────────────
  it('contagens batem com arrays', () => {
    const candidates = [
      existingTx({ id: 'sys-1', amount: 100 }),
      existingTx({
        id: 'manual-1', amount: 200, type: 'TRANSFER',
        origin: 'MANUAL', lifecycle: 'EFFECTED', transferGroupId: 'gid',
      }),
    ]
    const novas = [
      ofx({ amount: 100, memo: 'PAGAMENTO X' }),
      ofx({ amount: 200, memo: 'PIX ENVIADO', type: 'DEBIT' }),
      ofx({ amount: 999, memo: 'NOVA DE VERDADE' }),
    ]
    const result = buildV2PreviewPayload({
      ...BASE_INPUT,
      novas, totalArquivo: 3, candidates,
    })

    expect(result.classificacao.contagens).toEqual({
      total: 3,
      skipDup: 1,
      replaceManual: 1,
      conciliatePayable: 0,
      novasGenuinas: 1,
      duplicadasHashLegado: 0,
    })
  })
})

describe('Sub-fase 2A — buildLegacyPreviewPayload (anti-regressão)', () => {
  // ──────────────────────────────────────────────────────────
  it('⚠️ 8. Flag V2=false: payload IDÊNTICO ao legado (campos preservados bit-pra-bit)', () => {
    // Verifica shape exato que UI antiga e /confirm consomem.
    const novas = [
      ofx({
        fitid: 'fitid-X', dedupHash: 'hash-X',
        amount: 100, memo: 'PAGAMENTO A',
        datePosted: new Date('2026-06-10T00:00:00.000Z'), type: 'DEBIT',
      }),
    ]
    const legacy = buildLegacyPreviewPayload({
      novas, totalArquivo: 5, duplicadas: 3,
      errosParser: ['warning x'], banco: null,
    })

    // Campos chave esperados pela UI antiga
    expect(legacy).toHaveProperty('preview')
    expect(legacy).toHaveProperty('total', 5)
    expect(legacy).toHaveProperty('novas', 1)
    expect(legacy).toHaveProperty('duplicadas', 3)
    expect(legacy).toHaveProperty('errosParser')
    expect(legacy).toHaveProperty('banco', null)

    // Shape de cada item do preview bate exatamente com o histórico
    expect(legacy.preview[0]).toEqual({
      fitid: 'fitid-X',
      dedupHash: 'hash-X',
      date: new Date('2026-06-10T00:00:00.000Z'),
      amount: 100,
      type: 'DEBIT',
      memo: 'PAGAMENTO A',
    })

    // NÃO tem campos de V2 (classificacao etc) na resposta legada
    expect(legacy).not.toHaveProperty('classificacao')
  })

  // ──────────────────────────────────────────────────────────
  it('⚠️ 9. /confirm legado: payload contém os campos `novas` e `duplicadas` que /confirm espera', () => {
    // /confirm legado lê do mesmo `novas` array que vem no preview.
    // Esse teste prova que a estrutura usada pelo /confirm NÃO mudou.
    const item1 = ofx({ amount: 100 })
    const item2 = ofx({ amount: 200 })
    const legacy = buildLegacyPreviewPayload({
      novas: [item1, item2], totalArquivo: 5, duplicadas: 3,
      errosParser: [], banco: null,
    })

    // Itens trazem fitid + dedupHash + datePosted + amount + type + memo
    // (= exatamente os campos que filtrarNovasOFX retorna e /confirm usa)
    for (const item of legacy.preview) {
      expect(item).toHaveProperty('fitid')
      expect(item).toHaveProperty('dedupHash')
      expect(item).toHaveProperty('date')
      expect(item).toHaveProperty('amount')
      expect(item).toHaveProperty('type')
      expect(item).toHaveProperty('memo')
    }
    expect(legacy.novas).toBe(2)
  })
})

describe('Sub-fase 2A — isV2PreviewEnabled', () => {
  it('flag true', () => {
    expect(isV2PreviewEnabled({ IMPORT_PREVIEW_V2: 'true' } as unknown as NodeJS.ProcessEnv)).toBe(true)
  })
  it('flag false', () => {
    expect(isV2PreviewEnabled({ IMPORT_PREVIEW_V2: 'false' } as unknown as NodeJS.ProcessEnv)).toBe(false)
  })
  it('flag ausente', () => {
    expect(isV2PreviewEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(false)
  })
  it('flag valor estranho', () => {
    expect(isV2PreviewEnabled({ IMPORT_PREVIEW_V2: '1' } as unknown as NodeJS.ProcessEnv)).toBe(false)
  })
})
