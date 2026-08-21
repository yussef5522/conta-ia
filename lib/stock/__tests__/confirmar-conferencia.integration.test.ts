// ESTOQUE FASE 1 item 2 — integração do CONFIRMAR. Prova o coração da fase ANTES do
// dono clicar na nota real: cria nota+itens+duplicatas → confirma → movimentos gerados,
// conferência gravada, contas a pagar sugerido, item novo cadastrado + mapeamento
// aprendido, nota sai da fila, saldo bate, ISOLAMENTO. (SEFAZ falha graciosa: sem cert.)

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { confirmarConferencia } from '../confirmar-conferencia'
import { saldoItem } from '../saldo'
import { snapshotClosedModules, isolationHeld } from '../stock-invariants'

const CNPJ = '10203040000155'
const FORN = '99887766000144'
let companyId: string
let nfeId: string
let itemExistenteId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA CONFIRMAR TESTE' } })
  companyId = c.id
  const item = await prisma.stockItem.create({ data: { companyId, nome: 'Refrigerante Cola 2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'MANUAL' } })
  itemExistenteId = item.id
  const nfe = await prisma.stockNfe.create({ data: { companyId, chave: '43260899887766000144550100000000011234567890', nsu: '000000000000100', status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: true, emitCnpj: FORN, emitNome: 'FORNECEDOR CONFIRMAR' } })
  nfeId = nfe.id
  await prisma.stockNfeItem.createMany({ data: [
    { companyId, nfeId, chave: nfe.chave, nItem: 1, cProd: 'C1', xProd: 'COXAO MOLE KG', ncm: '02013000', uCom: 'KG', qCom: 30, vUnCom: 40, vProd: 1200 },
    { companyId, nfeId, chave: nfe.chave, nItem: 2, cProd: 'C2', xProd: 'REFRIGERANTE COLA 2L', ncm: '22021000', uCom: 'UN', qCom: 24, vUnCom: 12, vProd: 288 },
  ] })
  await prisma.stockNfeDup.createMany({ data: [
    { companyId, nfeId, nDup: '001', dVenc: new Date('2026-09-10'), vDup: 744 },
    { companyId, nfeId, nDup: '002', dVenc: new Date('2026-10-10'), vDup: 744 },
  ] })
})
afterEach(async () => {
  // dev.db compartilhado: dropa o trigger de imutabilidade (do teste do ledger) antes
  // de limpar movimentos, senão o delete é bloqueado.
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockMovement', 'stockConferenceItem', 'stockReceiptConference', 'stockPayableSuggestion', 'stockSupplierProduct', 'stockSaldoCache', 'stockNfeDup', 'stockNfeItem', 'stockNfe', 'stockItem', 'stockSupplier'] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('confirmarConferencia', () => {
  it('gera movimentos, conferência, contas a pagar, cadastra item novo, aprende e tira da fila', async () => {
    const r = await confirmarConferencia({
      companyId, nfeId, userId: 'user-teste',
      fornecedor: { cnpj: FORN, nome: 'FORNECEDOR CONFIRMAR', uf: 'RS' },
      itens: [
        // COXÃO MOLE — NOVO item, criado na conferência
        { nfeItemId: (await prisma.stockNfeItem.findFirst({ where: { companyId, cProd: 'C1' } }))!.id, cProd: 'C1', xProd: 'COXAO MOLE KG', uCom: 'KG', qtdNota: 30, vUnCom: 40, qtdRecebida: 28, motivo: 'FALTOU', mapeado: { itemId: 'novo-1', nome: 'Coxão Mole', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', fatorConversao: 1, novo: true } },
        // REFRI — item JÁ existente (mapeado)
        { nfeItemId: (await prisma.stockNfeItem.findFirst({ where: { companyId, cProd: 'C2' } }))!.id, cProd: 'C2', xProd: 'REFRIGERANTE COLA 2L', uCom: 'UN', qtdNota: 24, vUnCom: 12, qtdRecebida: 24, mapeado: { itemId: itemExistenteId, nome: 'Refrigerante Cola 2L', unidadeControle: 'UN', fatorConversao: 1, novo: false } },
      ],
    })

    expect(r.movimentos).toBe(2)
    expect(r.itensCadastrados).toBe(1) // Coxão Mole
    expect(r.payableSugeridas).toBe(2)
    expect(r.divergente).toBe(true) // FALTOU no coxão

    // item novo cadastrado + mapeamento aprendido
    const coxao = await prisma.stockItem.findFirst({ where: { companyId, nome: 'Coxão Mole' } })
    expect(coxao?.unidadeControle).toBe('KG')
    const mapa = await prisma.stockSupplierProduct.findFirst({ where: { companyId, supplierCnpj: FORN, cProd: 'C1' } })
    expect(mapa?.itemId).toBe(coxao!.id) // próxima nota do Frigorífico com C1 já vem mapeada

    // movimento pela qtd RECEBIDA (28, não 30) — custo 40/un
    const s = await saldoItem(prisma, companyId, coxao!.id)
    expect(s.saldo).toBe(28)
    expect(s.valor).toBe(1120) // 28 × 40
    expect(s.custoMedio).toBe(40)

    // nota saiu da fila
    const nfe = await prisma.stockNfe.findUnique({ where: { id: nfeId }, select: { status: true } })
    expect(nfe?.status).toBe('CONFIRMADA')

    // conferência DIVERGENTE_ACEITA (teve FALTOU)
    const conf = await prisma.stockReceiptConference.findFirst({ where: { companyId, nfeId } })
    expect(conf?.status).toBe('DIVERGENTE_ACEITA')
    expect(await prisma.stockConferenceItem.count({ where: { conferenceId: conf!.id } })).toBe(2)

    // contas a pagar sugerido (as 2 parcelas)
    const pag = await prisma.stockPayableSuggestion.findMany({ where: { companyId, nfeId }, orderBy: { dVenc: 'asc' } })
    expect(pag.map((p) => p.valor)).toEqual([744, 744])
  })

  it('idempotente: confirmar 2× a mesma nota → erro (não duplica)', async () => {
    const item1 = (await prisma.stockNfeItem.findFirst({ where: { companyId, cProd: 'C2' } }))!
    const payload = { companyId, nfeId, userId: 'u', fornecedor: { cnpj: FORN, nome: 'X' }, itens: [{ nfeItemId: item1.id, cProd: 'C2', xProd: 'REFRI', uCom: 'UN', qtdNota: 24, vUnCom: 12, qtdRecebida: 24, mapeado: { itemId: itemExistenteId, nome: 'Refri', unidadeControle: 'UN' as const, fatorConversao: 1, novo: false } }] }
    await confirmarConferencia(payload)
    await expect(confirmarConferencia(payload)).rejects.toThrow(/já foi conferida/)
  })

  it('ISOLAMENTO: confirmar não muda nenhum módulo fechado', async () => {
    const antes = await snapshotClosedModules(prisma)
    const item1 = (await prisma.stockNfeItem.findFirst({ where: { companyId, cProd: 'C2' } }))!
    await confirmarConferencia({ companyId, nfeId, userId: 'u', fornecedor: { cnpj: FORN, nome: 'X' }, itens: [{ nfeItemId: item1.id, cProd: 'C2', xProd: 'REFRI', uCom: 'UN', qtdNota: 24, vUnCom: 12, qtdRecebida: 24, mapeado: { itemId: itemExistenteId, nome: 'Refri', unidadeControle: 'UN', fatorConversao: 1, novo: false } }] })
    expect(isolationHeld(antes, await snapshotClosedModules(prisma))).toBe(true)
  })
})
