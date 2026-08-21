// ESTOQUE FASE 1 item 4 — GOLDEN do FLUXO COMPLETO (o teste que fecha a Fase 1): NF-e
// REAL anonimizada → parse → persist → conferência → confirmar → movimentos AO CENTAVO.
// Roda o pipeline de verdade (parseNfeCompleta + saveNfeCompleta + confirmarConferencia)
// contra a fixture real (OLEO DE SOJA 926,40 = 120 UN × 7,72, dup 926,40). Dois casos:
// SEM divergência (recebido == nota) e COM divergência (faltou → movimento pela RECEBIDA).
// SEFAZ falha graciosa (sem cert). Golden trava: mexeu no cálculo do custo, quebra aqui.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '@/lib/db'
import { parseNfeCompleta } from '../sefaz/parse-nfe'
import { saveNfeCompleta } from '../sefaz/persist-nfe'
import { confirmarConferencia, type ConfirmItemInput } from '../confirmar-conferencia'
import { saldoItem } from '../saldo'

const XML = readFileSync(join(__dirname, '../sefaz/__tests__/fixtures/nfe-completa-real.xml'), 'utf-8')
const CNPJ = '77665544000122'
let companyId: string
let nfeId: string
let chave: string

// monta o input de conferência a partir dos itens JÁ persistidos (nfeItemId real do banco)
async function inputConferencia(qtdRecebidaDelta = 0): Promise<{ fornecedor: { cnpj: string; nome: string }; itens: ConfirmItemInput[] }> {
  const itensDb = await prisma.stockNfeItem.findMany({ where: { companyId, nfeId }, orderBy: { nItem: 'asc' } })
  const emit = await prisma.stockNfeEmit.findFirst({ where: { companyId, nfeId } })
  const itens: ConfirmItemInput[] = itensDb.map((it, k) => ({
    nfeItemId: it.id,
    cProd: it.cProd ?? '',
    xProd: it.xProd,
    uCom: it.uCom ?? 'UN',
    qtdNota: it.qCom ?? 0,
    vUnCom: it.vUnCom ?? 0,
    qtdRecebida: (it.qCom ?? 0) - qtdRecebidaDelta, // delta>0 → faltou
    motivo: qtdRecebidaDelta > 0 ? 'FALTOU' : null,
    mapeado: { itemId: `novo-${k}`, nome: it.xProd.trim(), unidadeControle: (it.uCom as 'KG' | 'UN' | 'LT') ?? 'UN', categoria: 'MATERIA_PRIMA', fatorConversao: 1, novo: true },
  }))
  return { fornecedor: { cnpj: emit?.cnpj ?? '', nome: emit?.xNome ?? 'FORNECEDOR' }, itens }
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA GOLDEN FLUXO' } })
  companyId = c.id
  const parsed = parseNfeCompleta(XML)
  chave = parsed.chave
  const nfe = await prisma.stockNfe.create({ data: { companyId, chave, nsu: '000000000000200', status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: true, emitCnpj: parsed.emit.cnpj ?? null, emitNome: parsed.emit.xNome, vNF: parsed.totais.vNF } })
  nfeId = nfe.id
  await saveNfeCompleta({ nfeId, companyId, chave, xml: XML, db: prisma })
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockMovement', 'stockConferenceItem', 'stockReceiptConference', 'stockPayableSuggestion', 'stockSupplierProduct', 'stockSaldoCache', 'stockNfeDup', 'stockNfeItem', 'stockNfeEmit', 'stockNfe', 'stockItem', 'stockSupplier'] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('GOLDEN fluxo completo — NF-e real → conferência → movimentos ao centavo', () => {
  it('parse persistiu o item e a duplicata da nota real', async () => {
    const itens = await prisma.stockNfeItem.findMany({ where: { companyId, nfeId } })
    expect(itens).toHaveLength(1)
    expect(itens[0].xProd).toContain('OLEO DE SOJA')
    expect(itens[0].qCom).toBe(120)
    expect(itens[0].vUnCom).toBe(7.72)
    expect(itens[0].vProd).toBe(926.4)
    const dups = await prisma.stockNfeDup.findMany({ where: { companyId, nfeId } })
    expect(dups.map((d) => d.vDup)).toEqual([926.4])
  })

  it('SEM divergência: recebido == nota → 120 UN, valor 926,40 ao centavo, dup 926,40, sai da fila', async () => {
    const inp = await inputConferencia(0)
    const r = await confirmarConferencia({ companyId, nfeId, userId: 'u', ...inp })
    expect(r.divergente).toBe(false)
    expect(r.movimentos).toBe(1)
    expect(r.valorEntrada).toBe(926.4) // 120 × 7,72
    expect(r.payableSugeridas).toBe(1)

    const item = await prisma.stockItem.findFirst({ where: { companyId } })
    const s = await saldoItem(prisma, companyId, item!.id)
    expect(s.saldo).toBe(120)
    expect(s.custoMedio).toBe(7.72)
    expect(s.valor).toBe(926.4)

    const nfe = await prisma.stockNfe.findUnique({ where: { id: nfeId }, select: { status: true } })
    expect(nfe?.status).toBe('CONFIRMADA')
    const conf = await prisma.stockReceiptConference.findFirst({ where: { companyId, nfeId } })
    expect(conf?.status).toBe('CONFIRMADA')
  })

  it('COM divergência: faltaram 2 (recebido 118) → movimento pela RECEBIDA, 910,96 ao centavo, DIVERGENTE_ACEITA', async () => {
    const inp = await inputConferencia(2)
    const r = await confirmarConferencia({ companyId, nfeId, userId: 'u', ...inp })
    expect(r.divergente).toBe(true)
    expect(r.valorEntrada).toBe(910.96) // 118 × 7,72 = 910,96 (não 926,40 da nota)

    const item = await prisma.stockItem.findFirst({ where: { companyId } })
    const s = await saldoItem(prisma, companyId, item!.id)
    expect(s.saldo).toBe(118)
    expect(s.custoMedio).toBe(7.72)
    expect(s.valor).toBe(910.96)

    const conf = await prisma.stockReceiptConference.findFirst({ where: { companyId, nfeId } })
    expect(conf?.status).toBe('DIVERGENTE_ACEITA')
    // a duplicata (o que se PAGA) segue o total da nota, não o recebido
    const pag = await prisma.stockPayableSuggestion.findMany({ where: { companyId, nfeId } })
    expect(pag.map((p) => p.valor)).toEqual([926.4])
  })
})
