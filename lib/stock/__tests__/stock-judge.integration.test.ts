// ESTOQUE — o JUIZ (E1/E2/E3/E15). Confirma uma conferência real → 0 issues pra a
// empresa; quebra CADA invariante → o juiz pega. REGRA 1: falha antes, passa depois.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { confirmarConferencia } from '../confirmar-conferencia'
import { checkStockInvariants } from '../stock-invariants'

const CNPJ = '40506070000188'
const FORN = '88776655000133'
let companyId: string
let nfeId: string
const failsDaEmpresa = async () => (await checkStockInvariants(prisma)).filter((f) => f.companyId === companyId)

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA JUIZ ESTOQUE' } })
  companyId = c.id
  const nfe = await prisma.stockNfe.create({ data: { companyId, chave: '43260888776655000133550100000000019876543210', nsu: '1', status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: true, emitNome: 'FORN JUIZ' } })
  nfeId = nfe.id
  const it = await prisma.stockNfeItem.create({ data: { companyId, nfeId, chave: nfe.chave, nItem: 1, cProd: 'A', xProd: 'CARNE', ncm: '0201', uCom: 'KG', qCom: 10, vUnCom: 40, vProd: 400 } })
  await prisma.stockNfeDup.create({ data: { companyId, nfeId, nDup: '001', dVenc: new Date('2026-09-10'), vDup: 400 } })
  await confirmarConferencia({ companyId, nfeId, userId: 'u', fornecedor: { cnpj: FORN, nome: 'FORN JUIZ' }, itens: [{ nfeItemId: it.id, cProd: 'A', xProd: 'CARNE', uCom: 'KG', qtdNota: 10, vUnCom: 40, qtdRecebida: 10, mapeado: { itemId: 'novo-1', nome: 'Carne', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', fatorConversao: 1, novo: true } }] })
})
afterEach(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  for (const t of ['stockMovement', 'stockConferenceItem', 'stockReceiptConference', 'stockPayableSuggestion', 'stockSupplierProduct', 'stockSaldoCache', 'stockSefazEvent', 'stockNfeDup', 'stockNfeItem', 'stockNfe', 'stockItem', 'stockSupplier'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('juiz do estoque', () => {
  it('conferência válida → 0 issues (E1/E2/E3 passam)', async () => {
    expect(await failsDaEmpresa()).toHaveLength(0)
  })

  it('E1: cache de saldo ≠ Σ movimentos → pega', async () => {
    await prisma.stockSaldoCache.updateMany({ where: { companyId }, data: { saldo: 999 } })
    const f = await failsDaEmpresa()
    expect(f.some((x) => x.invariante === 'E1')).toBe(true)
  })

  it('E2: conferência sem movimento suficiente → pega', async () => {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
    await prisma.stockMovement.deleteMany({ where: { companyId } })
    const f = await failsDaEmpresa()
    expect(f.some((x) => x.invariante === 'E2')).toBe(true)
  })

  // ⚠️ REGRA 1 (27/08) — o E2 era INCOMPATÍVEL com a disciplina de correção do próprio
  // módulo. Ele contava ENTRADA_NF cru; correção aqui é sempre **ESTORNO + movimento novo**
  // (o ledger é imutável), então bastava corrigir um item de nota pra o juiz acusar um rombo
  // que não existe — 1 item, 2 ENTRADA_NF. Achado ao reunitizar o pão (pacote → unidade).
  // Este teste falha com o `count` antigo e passa com a contagem LÍQUIDA.
  it('⭐ E2: correção (estorno + movimento novo) NÃO é rombo — o juiz conta o que vale', async () => {
    const orig = await prisma.stockMovement.findFirstOrThrow({ where: { companyId, tipo: 'ENTRADA_NF' } })
    // a correção documentada do módulo: estorna e recria (nunca edita)
    await prisma.stockMovement.create({ data: { companyId, itemId: orig.itemId, tipo: 'ESTORNO', quantidade: -orig.quantidade, custoUnitario: orig.custoUnitario, custoTotal: -orig.custoTotal, receiptId: orig.receiptId, estornoDeId: orig.id, origem: orig.origem } })
    await prisma.stockMovement.create({ data: { companyId, itemId: orig.itemId, tipo: 'ENTRADA_NF', quantidade: orig.quantidade * 12, custoUnitario: orig.custoUnitario / 12, custoTotal: orig.custoTotal, receiptId: orig.receiptId, origem: orig.origem } })
    const { recomputeSaldoCache } = await import('../saldo')
    await recomputeSaldoCache(prisma, companyId)

    const f = await failsDaEmpresa()
    expect(f.filter((x) => x.invariante === 'E2')).toHaveLength(0) // 3 movimentos, mas só 2 valem
  })

  it('E2 continua mordendo quando falta movimento de verdade (o estorno não vira desculpa)', async () => {
    const orig = await prisma.stockMovement.findFirstOrThrow({ where: { companyId, tipo: 'ENTRADA_NF' } })
    // estorna e NÃO recria → a conferência fica sem entrada vigente
    await prisma.stockMovement.create({ data: { companyId, itemId: orig.itemId, tipo: 'ESTORNO', quantidade: -orig.quantidade, custoUnitario: orig.custoUnitario, custoTotal: -orig.custoTotal, receiptId: orig.receiptId, estornoDeId: orig.id, origem: orig.origem } })
    const f = await failsDaEmpresa()
    expect(f.some((x) => x.invariante === 'E2')).toBe(true)
  })

  it('E3: nota confirmada com duplicata sem payable → pega', async () => {
    await prisma.stockPayableSuggestion.deleteMany({ where: { companyId } })
    const f = await failsDaEmpresa()
    expect(f.some((x) => x.invariante === 'E3')).toBe(true)
  })

  it('E15: evento SEFAZ pendente > 24h → pega', async () => {
    await prisma.stockSefazEvent.create({ data: { companyId, chave: '43260888776655000133550100000000019876543210', tpEvento: '210200', status: 'ERRO', criadoEm: new Date(Date.now() - 48 * 3600_000) } })
    const f = await failsDaEmpresa()
    expect(f.some((x) => x.invariante === 'E15')).toBe(true)
  })
})
