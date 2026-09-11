// ⛔⛔⛔ SUCESSO DISFARÇADO — A CORREÇÃO VIRAVA A ENTRADA E NÃO VIRAVA O ITEM (11/09/2026)
//
// **O caso real:** NF 179646 LATICINIOS SANTO CRISTO, `QUEIJO MUSSARELA FATIADO 2KG`. O dono
// trocou pra KG na conferência (1 peça = 2 KG), o recibo disse *"16 UN → Recebido 32 · custo
// 34,45"* — **conta certa** — e no estoque o item seguiu **"controle em UN"**, com os 32 KG
// somando com as 8 peças antigas. `59,2 UN` é um número sem significado físico.
//
// ⚠️⚠️ **E O LEDGER DESTE ITEM É MISTO** — foi o que a medição em prod mostrou e o que
// impede o `reunitizar` global de servir aqui:
// ```
// 24/08  8 × R$ 69,90   nota disse UN   → 8 PEÇAS  → precisa ×2
// 03/09  19,2 × 33,90   nota disse KG   → 19,2 KG  → já certo (outro fornecedor, a granel)
// 11/09  32 × 34,45     corrigida UN→KG → 32 KG    → já certo
// ```
// Converter tudo ×2 daria **118,4** — **51,2 kg de queijo inventados**.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { confirmarConferencia } from '../confirmar-conferencia'
import { saldoItem } from '../saldo'
import { previewReunitizar } from '../reunitizar-item'

const CNPJ = '10203040000177'
const FORN = '05248242000112'          // LATICINIOS SANTO CRISTO (o real)
const FORN_GRANEL = '02436957000100'   // o que manda a granel, em KG
let companyId = ''
let queijoId = ''
let nfeId = ''

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'QUEIJO TESTE' } })).id
  queijoId = (await prisma.stockItem.create({ data: {
    companyId, nome: 'QUEIJO MUSSARELA FATIADO 2KG', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'CONFERENCIA',
  } })).id

  // ── a história que já estava no ledger, com as conferências que dizem a unidade ──
  const conf = async (chave: string, cnpj: string, unidadeNota: string, qtdNota: number, qtdRecebida: number, custoUn: number) => {
    const nfe = await prisma.stockNfe.create({ data: { companyId, chave, nsu: chave.slice(-15), status: 'CONFIRMADA', temXmlCompleto: true, emitCnpj: cnpj, emitNome: 'F' } })
    const c = await prisma.stockReceiptConference.create({ data: { companyId, nfeId: nfe.id, chave, status: 'CONFIRMADA', conferidoPorId: 'u' } })
    await prisma.stockConferenceItem.create({ data: { companyId, conferenceId: c.id, nfeItemId: `ni-${chave.slice(-4)}`, itemId: queijoId, xProd: 'QUEIJO', cProd: '70', qtdNota, unidadeNota, qtdRecebida, divergencia: false } })
    await prisma.stockMovement.create({ data: { companyId, itemId: queijoId, tipo: 'ENTRADA_NF', quantidade: qtdRecebida, custoUnitario: custoUn, custoTotal: round2(qtdRecebida * custoUn), receiptId: c.id, nfeChave: chave, origem: 'SEFAZ' } })
  }
  await conf('43260805248242000112550100000001790801234567', FORN, 'UN', 8, 8, 69.90)          // 8 peças
  await conf('43260802436957000100550100000005065541234567', FORN_GRANEL, 'KG', 19.2, 19.2, 33.90) // 19,2 KG
  // o mapa de cada fornecedor
  await prisma.stockSupplierProduct.createMany({ data: [
    { companyId, supplierCnpj: FORN, cProd: '70', xProd: 'QUEIJO', itemId: queijoId, fatorConversao: 1, unidadeNota: 'UN' },
    { companyId, supplierCnpj: FORN_GRANEL, cProd: '1', xProd: 'QUEIJO GR', itemId: queijoId, fatorConversao: 1, unidadeNota: 'KG' },
  ] })

  // ── a nota de HOJE, esperando conferência ──
  const nfe = await prisma.stockNfe.create({ data: { companyId, chave: '43260805248242000112550100000001796461234567', nsu: '000000000000999', status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: true, emitCnpj: FORN, emitNome: 'LATICINIOS SANTO CRISTO' } })
  nfeId = nfe.id
  await prisma.stockNfeItem.create({ data: { companyId, nfeId, chave: nfe.chave, nItem: 1, cProd: '70', xProd: 'QUEIJO MUSSARELA FATIADO 2KG', ncm: '04061010', uCom: 'UN', qCom: 16, vUnCom: 68.90, vProd: 1102.40 } })
})

afterEach(async () => {
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_stock_movement_no_update;').catch(() => {})
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;').catch(() => {})
  for (const t of ['stockProductionOrder', 'stockMovement', 'stockUnidadeCorrigida', 'stockConferenceItem', 'stockReceiptConference', 'stockPayableSuggestion', 'stockSupplierProduct', 'stockSaldoCache', 'stockNfeItem', 'stockNfe', 'stockItem', 'stockSupplier'] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

const conferirTrocandoPraKg = () => confirmarConferencia({
  companyId, nfeId, userId: 'u', fornecedor: { cnpj: FORN, nome: 'LATICINIOS SANTO CRISTO' },
  itens: [{
    nfeItemId: (undefined as unknown as string), cProd: '70', xProd: 'QUEIJO MUSSARELA FATIADO 2KG',
    uCom: 'UN', qtdNota: 16, vUnCom: 68.90, qtdRecebida: 32, unidadeEntrada: 'KG',
    mapeado: { itemId: queijoId, nome: 'QUEIJO MUSSARELA FATIADO 2KG', unidadeControle: 'UN', fatorConversao: 2, novo: false },
  }],
})

describe('⛔⛔ corrigir a unidade na CONFERÊNCIA vira o ITEM, não só a entrada', () => {
  it('⭐⭐ o item passa a falar KG — a tela e o estoque dizem a mesma coisa', async () => {
    const ni = await prisma.stockNfeItem.findFirst({ where: { companyId, nfeId }, select: { id: true } })
    await confirmarConferencia({
      companyId, nfeId, userId: 'u', fornecedor: { cnpj: FORN, nome: 'LATICINIOS SANTO CRISTO' },
      itens: [{ nfeItemId: ni!.id, cProd: '70', xProd: 'QUEIJO MUSSARELA FATIADO 2KG', uCom: 'UN', qtdNota: 16, vUnCom: 68.90, qtdRecebida: 32, unidadeEntrada: 'KG',
        mapeado: { itemId: queijoId, nome: 'QUEIJO MUSSARELA FATIADO 2KG', unidadeControle: 'UN', fatorConversao: 2, novo: false } }],
    })
    const item = await prisma.stockItem.findUnique({ where: { id: queijoId }, select: { unidadeControle: true } })
    expect(item!.unidadeControle).toBe('KG')     // ⛔ era isto que NÃO acontecia
  })

  it('⭐⭐⭐ o saldo vira 67,2 KG — e NÃO 118,4 (o reunitizar global inventaria 51,2 kg)', async () => {
    const ni = await prisma.stockNfeItem.findFirst({ where: { companyId, nfeId }, select: { id: true } })
    await confirmarConferencia({
      companyId, nfeId, userId: 'u', fornecedor: { cnpj: FORN, nome: 'L' },
      itens: [{ nfeItemId: ni!.id, cProd: '70', xProd: 'Q', uCom: 'UN', qtdNota: 16, vUnCom: 68.90, qtdRecebida: 32, unidadeEntrada: 'KG',
        mapeado: { itemId: queijoId, nome: 'Q', unidadeControle: 'UN', fatorConversao: 2, novo: false } }],
    })
    const s = await saldoItem(prisma, companyId, queijoId)
    // 8 peças → 16 KG · 19,2 KG (intacto) · 32 KG (a de hoje) = 67,2
    expect(s.saldo).toBe(67.2)
    expect(s.valor).toBe(round2(559.20 + 650.88 + 1102.40))
    expect(s.custoMedio).toBeCloseTo(2312.48 / 67.2, 2)
  })

  it('⛔⛔ o VALOR do estoque é invariante ao centavo — a régua mudou, o dinheiro não', async () => {
    const antes = await saldoItem(prisma, companyId, queijoId)
    const ni = await prisma.stockNfeItem.findFirst({ where: { companyId, nfeId }, select: { id: true } })
    await confirmarConferencia({
      companyId, nfeId, userId: 'u', fornecedor: { cnpj: FORN, nome: 'L' },
      itens: [{ nfeItemId: ni!.id, cProd: '70', xProd: 'Q', uCom: 'UN', qtdNota: 16, vUnCom: 68.90, qtdRecebida: 32, unidadeEntrada: 'KG',
        mapeado: { itemId: queijoId, nome: 'Q', unidadeControle: 'UN', fatorConversao: 2, novo: false } }],
    })
    const depois = await saldoItem(prisma, companyId, queijoId)
    // o que entrou de novo é a nota de hoje, nada mais: o histórico só mudou de régua
    expect(round2(depois.valor - antes.valor)).toBe(1102.40)
  })

  it('⭐ o fator do fornecedor A GRANEL não se mexe — ele já manda em KG', async () => {
    const ni = await prisma.stockNfeItem.findFirst({ where: { companyId, nfeId }, select: { id: true } })
    await confirmarConferencia({
      companyId, nfeId, userId: 'u', fornecedor: { cnpj: FORN, nome: 'L' },
      itens: [{ nfeItemId: ni!.id, cProd: '70', xProd: 'Q', uCom: 'UN', qtdNota: 16, vUnCom: 68.90, qtdRecebida: 32, unidadeEntrada: 'KG',
        mapeado: { itemId: queijoId, nome: 'Q', unidadeControle: 'UN', fatorConversao: 2, novo: false } }],
    })
    const granel = await prisma.stockSupplierProduct.findFirst({ where: { companyId, supplierCnpj: FORN_GRANEL } })
    expect(granel!.fatorConversao).toBe(1)     // ⛔ dobrar aqui faria a próxima nota entrar com 2× queijo
    const santo = await prisma.stockSupplierProduct.findFirst({ where: { companyId, supplierCnpj: FORN, cProd: '70' } })
    expect(santo!.fatorConversao).toBe(2)      // ⭐ este aprendeu: a próxima nota já entra convertida
  })

  it('⛔⛔ produção ABERTA com o item → a conferência INTEIRA para, nada grava pela metade', async () => {
    const ordem = await prisma.stockProductionOrder.create({ data: {
      companyId, fichaId: 'f-x', versaoFicha: 1, itemProduzidoId: queijoId, escalaReceitas: 1,
      estado: 'SEPARADA', criadoPorId: 'u', dataProducao: new Date(),
    } })
    await prisma.stockMovement.create({ data: { companyId, itemId: queijoId, tipo: 'SEPARACAO_SAIDA', quantidade: -2, custoUnitario: 69.90, custoTotal: -139.80, receiptId: ordem.id, origem: 'MANUAL' } })

    const ni = await prisma.stockNfeItem.findFirst({ where: { companyId, nfeId }, select: { id: true } })
    const antesMov = await prisma.stockMovement.count({ where: { companyId, itemId: queijoId } })
    await expect(confirmarConferencia({
      companyId, nfeId, userId: 'u', fornecedor: { cnpj: FORN, nome: 'L' },
      itens: [{ nfeItemId: ni!.id, cProd: '70', xProd: 'Q', uCom: 'UN', qtdNota: 16, vUnCom: 68.90, qtdRecebida: 32, unidadeEntrada: 'KG',
        mapeado: { itemId: queijoId, nome: 'Q', unidadeControle: 'UN', fatorConversao: 2, novo: false } }],
    })).rejects.toThrow(/troca de unidade não pôde ser aplicada/)

    // ⭐ NADA gravou: nem a entrada, nem a conferência, nem a troca do item
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: queijoId } })).toBe(antesMov)
    expect((await prisma.stockItem.findUnique({ where: { id: queijoId } }))!.unidadeControle).toBe('UN')
    expect(await prisma.stockReceiptConference.count({ where: { companyId, nfeId } })).toBe(0)
  })

  it('⭐ o PREVIEW mostra os três grupos antes de qualquer gravação', async () => {
    const p = await previewReunitizar(companyId, queijoId, 2, prisma, 'KG')
    expect(p.plano.converte).toHaveLength(1)        // as 8 peças
    expect(p.plano.jaEstaCerto).toHaveLength(1)     // os 19,2 KG do granel
    expect(p.plano.naoSeiConverter).toHaveLength(0)
    expect(p.depois.saldo).toBe(35.2)               // 16 + 19,2 (a nota de hoje ainda não entrou)
    expect(p.depois.valor).toBe(p.antes.valor)      // ⭐ o dinheiro não muda
  })
})
