// Sprint rawOfxBlob (13/08) — guard do PONTO OBRIGATÓRIO (REGRA 3: executa o
// helper real contra um prisma-mock que captura o que foi gravado).
//
// O que prova: `createOfxImportRecord` SEMPRE grava o `rawOfxBlob` (é impossível
// criar sem — o TypeScript exige `rawOfx`), status PROCESSING; e `finalizeOfxImport`
// grava o CONTEXTO DA DECISÃO (2.4: âncora, perfil, LEDGERBAL fechou?, contadores).

import { describe, it, expect, vi } from 'vitest'
import { createOfxImportRecord, finalizeOfxImport } from '../persist-import'

function mockDb() {
  const created: any[] = []
  const updated: any[] = []
  const db: any = {
    ofxImport: {
      create: vi.fn(async ({ data }: any) => { created.push(data); return { id: 'imp_1' } }),
      update: vi.fn(async ({ where, data }: any) => { updated.push({ where, data }); return { id: where.id } }),
    },
  }
  return { db, created, updated }
}

describe('createOfxImportRecord — SEMPRE grava o blob', () => {
  it('grava rawOfxBlob = rawOfx + status PROCESSING', async () => {
    const { db, created } = mockDb()
    const r = await createOfxImportRecord(db, {
      bankAccountId: 'acc1', userId: 'u1', fileName: 'e.ofx', fileSize: 42,
      rawOfx: '<OFX>conteúdo cru</OFX>', source: 'OFX',
    })
    expect(r.id).toBe('imp_1')
    expect(created).toHaveLength(1)
    expect(created[0].rawOfxBlob).toBe('<OFX>conteúdo cru</OFX>') // ← o cru foi gravado
    expect(created[0].status).toBe('PROCESSING')
    expect(created[0].source).toBe('OFX')
  })

  it('nunca cria com blob vazio quando há rawOfx (mesmo import de 0 tx)', async () => {
    const { db, created } = mockDb()
    await createOfxImportRecord(db, {
      bankAccountId: 'acc1', userId: 'u1', fileName: 're-import.ofx', fileSize: 10,
      rawOfx: '<OFX/>', totalTransactions: 0,
    })
    expect(created[0].rawOfxBlob).toBe('<OFX/>')
    expect(created[0].rawOfxBlob.length).toBeGreaterThan(0)
  })

  it('cartão/PDF: o "cru" pode ser o JSON das linhas (mesmo ponto obrigatório)', async () => {
    const { db, created } = mockDb()
    const json = JSON.stringify([{ desc: 'x', amount: 1 }])
    await createOfxImportRecord(db, {
      bankAccountId: 'acc1', userId: 'u1', fileName: 'fatura.pdf', fileSize: json.length,
      rawOfx: json, source: 'CREDIT_CARD_PDF',
    })
    expect(created[0].rawOfxBlob).toBe(json)
    expect(created[0].source).toBe('CREDIT_CARD_PDF')
  })
})

describe('finalizeOfxImport — grava o CONTEXTO DA DECISÃO (2.4)', () => {
  it('status + contadores + âncora + perfil + LEDGERBAL fechou/dif', async () => {
    const { db, updated } = mockDb()
    await finalizeOfxImport(db, 'imp_1', {
      status: 'SUCCESS',
      newTransactions: 14, duplicates: 3, futureDiscarded: 2,
      anchorDate: new Date('2026-08-11'), anchorRule: 'LAST_REAL_TX',
      bankProfile: 'SICREDI',
      ledgerBalAmount: -55622.01, ledgerBalMatched: true, ledgerBalDiff: null,
    })
    expect(updated).toHaveLength(1)
    const d = updated[0].data
    expect(updated[0].where.id).toBe('imp_1')
    expect(d.status).toBe('SUCCESS')
    expect(d.newTransactions).toBe(14)
    expect(d.futureDiscarded).toBe(2)
    expect(d.anchorRule).toBe('LAST_REAL_TX')
    expect(d.bankProfile).toBe('SICREDI')
    expect(d.ledgerBalMatched).toBe(true)
  })

  it('não sobrescreve campos não informados (update parcial)', async () => {
    const { db, updated } = mockDb()
    await finalizeOfxImport(db, 'imp_1', { status: 'FAILED', errorMessage: 'boom' })
    const d = updated[0].data
    expect(d.status).toBe('FAILED')
    expect(d.errorMessage).toBe('boom')
    expect('newTransactions' in d).toBe(false) // não tocou o que não veio
    expect('bankProfile' in d).toBe(false)
  })
})

// Sprint Blob-no-Preview (13/08) — REGRA 3: executa o reuso por fileHash contra
// um mock STATEFUL (guarda os registros). Prova: preview salva o blob; previu 2× =
// 1 registro; confirmar depois reaproveita o PREVIEW (não duplica); SUCCESS do
// mesmo arquivo NÃO é reaproveitado (re-import ganha registro próprio).
describe('createOfxImportRecord — blob-no-preview + reuso por fileHash', () => {
  function statefulDb() {
    const rows: any[] = []
    let seq = 0
    const db: any = {
      ofxImport: {
        findFirst: vi.fn(async ({ where }: any) =>
          rows.find(
            (r) =>
              r.bankAccountId === where.bankAccountId &&
              r.fileHash === where.fileHash &&
              r.status === where.status,
          ) ?? null,
        ),
        create: vi.fn(async ({ data }: any) => {
          const row = { id: `imp_${++seq}`, ...data }
          rows.push(row)
          return { id: row.id }
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const row = rows.find((r) => r.id === where.id)
          Object.assign(row, data)
          return { id: row.id }
        }),
      },
    }
    return { db, rows }
  }
  const base = { bankAccountId: 'acc1', userId: 'u1', fileName: 'e.ofx', fileSize: 10, rawOfx: '<OFX/>', fileHash: 'H1' }

  it('preview salva o blob com status PREVIEW', async () => {
    const { db, rows } = statefulDb()
    await createOfxImportRecord(db, { ...base, status: 'PREVIEW' })
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('PREVIEW')
    expect(rows[0].rawOfxBlob).toBe('<OFX/>')
  })

  it('previu 2× (mesmo fileHash) → 1 registro só (reaproveita)', async () => {
    const { db, rows } = statefulDb()
    const a = await createOfxImportRecord(db, { ...base, status: 'PREVIEW' })
    const b = await createOfxImportRecord(db, { ...base, status: 'PREVIEW' })
    expect(rows).toHaveLength(1)
    expect(a.id).toBe(b.id)
  })

  it('confirmar depois do preview REAPROVEITA (vira PROCESSING, não duplica)', async () => {
    const { db, rows } = statefulDb()
    const prev = await createOfxImportRecord(db, { ...base, status: 'PREVIEW' })
    const conf = await createOfxImportRecord(db, { ...base }) // default PROCESSING
    expect(rows).toHaveLength(1)
    expect(conf.id).toBe(prev.id)
    expect(rows[0].status).toBe('PROCESSING')
  })

  it('SUCCESS do mesmo arquivo NÃO é reaproveitado (re-import ganha registro novo)', async () => {
    const { db, rows } = statefulDb()
    await createOfxImportRecord(db, { ...base, status: 'PREVIEW' })
    rows[0].status = 'SUCCESS' // simula import já concluído
    const novo = await createOfxImportRecord(db, { ...base }) // re-import
    expect(rows).toHaveLength(2)
    expect(novo.id).not.toBe(rows[0].id)
  })

  it('sem fileHash → não tenta reaproveitar (cria direto)', async () => {
    const { db, rows } = statefulDb()
    await createOfxImportRecord(db, { bankAccountId: 'acc1', userId: 'u1', fileName: 'x', fileSize: 1, rawOfx: '<OFX/>' })
    expect(db.ofxImport.findFirst).not.toHaveBeenCalled()
    expect(rows).toHaveLength(1)
  })
})
