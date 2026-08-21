// ESTOQUE FASE 1 item 4 — recebimentos: "deixar pra depois" (adiada silencia), lista
// "Recebidas", RECIBO derivado, busca por chave idempotente. Executa os caminhos reais.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { listRecebimentos } from '../sefaz/recebimentos'
import { buildRecibo } from '../recibo'
import { buscarNfePorChave } from '../sefaz/buscar-por-chave'
import { persistSefazDoc } from '../sefaz/persist-doc'
import { confirmarConferencia } from '../confirmar-conferencia'
import type { SefazDoc } from '../sefaz/parse-response'

const CNPJ = '31415926000155'
const CHAVE_FILA = '43260831415926000155550100000000011111100011'
const CHAVE_CONF = '43260831415926000155550100000000022222200022'
let companyId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA ITEM4' } })
  companyId = c.id
  await prisma.stockSefazState.create({ data: { companyId, dataCorte: new Date('2026-08-20'), ultNSU: '0', maxNSU: '0' } })
  // uma nota na fila
  await prisma.stockNfe.create({ data: { companyId, chave: CHAVE_FILA, nsu: '1', status: 'AGUARDANDO_MERCADORIA', emitNome: 'FORNECEDOR A', vNF: 100, dataEmissao: new Date('2026-08-20') } })
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockMovement', 'stockConferenceItem', 'stockReceiptConference', 'stockPayableSuggestion', 'stockNfeAdiada', 'stockSaldoCache', 'stockNfeDup', 'stockNfeItem', 'stockNfe', 'stockItem', 'stockSupplier', 'stockSefazState', 'stockSefazLog'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('recebimentos item 4', () => {
  it('adiada silencia o badge (fica na fila, marcada adiada)', async () => {
    const nfe = await prisma.stockNfe.findFirst({ where: { companyId } })
    let data = await listRecebimentos(companyId)
    expect(data.fila).toHaveLength(1)
    expect(data.fila[0].adiada).toBe(false)

    await prisma.stockNfeAdiada.create({ data: { companyId, nfeId: nfe!.id, chave: nfe!.chave, motivo: 'esperar módulo' } })
    data = await listRecebimentos(companyId)
    expect(data.fila[0].adiada).toBe(true) // continua na fila, mas silenciada
    expect(data.fila[0].motivoAdiada).toBe('esperar módulo')
  })

  it('busca por chave: 44 dígitos inválidos → recusa; nota já existente → jaExistia sem bater na SEFAZ', async () => {
    expect((await buscarNfePorChave({ companyId, chave: '123' })).ok).toBe(false)
    const r = await buscarNfePorChave({ companyId, chave: CHAVE_FILA })
    expect(r.ok).toBe(true)
    expect(r.jaExistia).toBe(true)
    expect(r.naFila).toBe(true)
  })

  it('persistSefazDoc (porta única) grava a nota e é idempotente', async () => {
    const doc: SefazDoc = { nsu: '5', schema: 'resNFe_v1.01.xsd', tipo: 'resumo', chave: CHAVE_CONF, emitNome: 'FORNECEDOR B', vNF: 50, dataEmissao: '2026-08-21T10:00:00-03:00', xml: '<resNFe/>' }
    const a = await persistSefazDoc(prisma, companyId, doc, new Date('2026-08-20'))
    expect(a.status).toBe('AGUARDANDO_MERCADORIA')
    const b = await persistSefazDoc(prisma, companyId, doc, new Date('2026-08-20'))
    expect(b.nfeId).toBe(a.nfeId) // upsert idempotente
    expect(await prisma.stockNfe.count({ where: { companyId, chave: CHAVE_CONF } })).toBe(1)
  })

  it('nota confirmada aparece em Recebidas e o RECIBO deriva itens + valor', async () => {
    // cria nota confirmável
    const nfe = await prisma.stockNfe.create({ data: { companyId, chave: CHAVE_CONF, nsu: '9', status: 'AGUARDANDO_MERCADORIA', emitNome: 'FORNECEDOR B', vNF: 288 } })
    const it = await prisma.stockNfeItem.create({ data: { companyId, nfeId: nfe.id, chave: CHAVE_CONF, nItem: 1, cProd: 'X1', xProd: 'REFRI 2L', uCom: 'UN', qCom: 24, vUnCom: 12, vProd: 288 } })
    await prisma.stockNfeDup.create({ data: { companyId, nfeId: nfe.id, nDup: '001', dVenc: new Date('2026-09-10'), vDup: 288 } })

    const r = await confirmarConferencia({
      companyId, nfeId: nfe.id, userId: 'u', fornecedor: { cnpj: '10101010000101', nome: 'FORNECEDOR B' },
      itens: [{ nfeItemId: it.id, cProd: 'X1', xProd: 'REFRI 2L', uCom: 'UN', qtdNota: 24, vUnCom: 12, qtdRecebida: 24, mapeado: { itemId: 'n', nome: 'Refri 2L', unidadeControle: 'UN', categoria: 'REVENDA', fatorConversao: 1, novo: true } }],
    })

    const data = await listRecebimentos(companyId)
    const rec = data.recebidas.find((x) => x.nfeId === nfe.id)
    expect(rec).toBeTruthy()
    expect(rec!.conferenceId).toBe(r.conferenceId)

    const recibo = await buildRecibo(companyId, r.conferenceId)
    expect(recibo!.valorEntrada).toBe(288) // 24 × 12
    expect(recibo!.vNF).toBe(288)
    expect(recibo!.itens).toHaveLength(1)
    expect(recibo!.itens[0].custoTotal).toBe(288)
    expect(recibo!.duplicatas.map((d) => d.valor)).toEqual([288])
  })
})
