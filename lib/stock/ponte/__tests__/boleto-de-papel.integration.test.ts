// ⭐⭐ O BOLETO DE PAPEL — a outra ponta do "sem duplicata no XML" (04/09/2026).
//
// CASO REAL: **CEREALISTA GIRUA, R$ 550,62, 1 item**. O XML não traz duplicata, mas o boleto
// chegou **junto com a mercadoria** e o dono SABE o vencimento. Sem lugar pra digitar, essa
// nota caía no "A DEFINIR" de ontem — e ele teria que voltar depois pra dizer uma coisa que
// já estava na mão dele.
//
// ⚠️ E O CAMPO É OPCIONAL, de propósito: nota de pix combinado segue direto pro A DEFINIR.
// **A apurar > número inventado** — obrigar data aqui só produziria data falsa.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { confirmarConferencia } from '../../confirmar-conferencia'
import { conferirPagamentoDoPapel, parcelasSemData, rastroDoVencimento } from '../vencimento'
import { checkPonteInvariants } from '../../ponte-invariants'

const CNPJ = '66778899000155'
const TOTAL = 550.62
let companyId = ''
let userId = ''
let nfeId = ''
let itemNfeId = ''

async function notaSemDuplicata() {
  const nfe = await prisma.stockNfe.create({
    data: {
      companyId, chave: `4126${Date.now()}`.padEnd(44, '0'), status: 'EM_CONFERENCIA',
      temXmlCompleto: true, vNF: TOTAL, dataEmissao: new Date('2026-09-04T00:00:00Z'), nsu: `${Date.now()}`,
    },
  })
  const item = await prisma.stockNfeItem.create({
    data: {
      companyId, nfeId: nfe.id, chave: nfe.chave, nItem: 1, cProd: 'X1', xProd: 'ARROZ 5KG',
      uCom: 'FD', qCom: 10, vUnCom: 55.062, vProd: TOTAL,
    },
  })
  return { nfeId: nfe.id, itemId: item.id }
}

const confirmar = (pagamento?: { parcelas: { dVenc: Date; valor: number }[] }) =>
  confirmarConferencia({
    companyId, nfeId, userId,
    fornecedor: { cnpj: '11222333000144', nome: 'CEREALISTA GIRUA LTDA' },
    itens: [{
      nfeItemId: itemNfeId, cProd: 'X1', xProd: 'ARROZ 5KG', uCom: 'FD',
      qtdNota: 10, vUnCom: 55.062, qtdRecebida: 10,
      mapeado: { itemId: '', nome: 'ARROZ 5KG', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', fatorConversao: 1, novo: true },
    }],
    pagamento,
  })

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'PAPEL' } })).id
  userId = (await prisma.user.create({ data: { email: `papel-${companyId}@t.com`, password: 'x', name: 'Yussef' } })).id
  const n = await notaSemDuplicata()
  nfeId = n.nfeId; itemNfeId = n.itemId
})

afterEach(async () => {
  for (const t of ['stockVencimentoEvento', 'stockPayableLink', 'stockPayableSuggestion', 'stockConferenceItem',
    'stockReceiptConference', 'stockMovement', 'stockSaldoCache', 'stockItem', 'stockSupplierProduct',
    'stockSupplier', 'stockNfeItem', 'stockNfe'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ digitei a data do boleto de papel', () => {
  it('⭐⭐ o payable nasce COM vencimento, direto no fluxo normal', async () => {
    await confirmar({ parcelas: [{ dVenc: new Date('2026-09-18T00:00:00Z'), valor: TOTAL }] })

    const sug = await prisma.stockPayableSuggestion.findMany({ where: { companyId } })
    expect(sug).toHaveLength(1)
    expect(sug[0].dVenc?.toISOString().slice(0, 10)).toBe('2026-09-18')
    expect(sug[0].valor).toBe(TOTAL)
    // ⭐ e fora do A DEFINIR: o trabalho já foi feito na hora certa
    expect(await parcelasSemData(companyId, prisma)).toHaveLength(0)
  })

  it('⭐⭐ e o rastro grava DONO_NO_RECEBIMENTO', async () => {
    await confirmar({ parcelas: [{ dVenc: new Date('2026-09-18T00:00:00Z'), valor: TOTAL }] })
    const sug = await prisma.stockPayableSuggestion.findFirstOrThrow({ where: { companyId } })
    const rastro = await rastroDoVencimento(companyId, sug.id, prisma)
    expect(rastro).toHaveLength(1)
    expect(rastro[0]).toMatchObject({ origem: 'DONO_NO_RECEBIMENTO', criadoPorNome: 'Yussef' })
  })

  it('⛔⛔ e o F5 NÃO cobra essa nota (ela não é trabalho pendente)', async () => {
    await confirmar({ parcelas: [{ dVenc: new Date('2026-09-18T00:00:00Z'), valor: TOTAL }] })
    const f5 = (await checkPonteInvariants(prisma)).filter((f) => f.companyId === companyId && f.invariante === 'F5')
    expect(f5).toHaveLength(0)
  })

  it('⭐ 30/60/90: três parcelas viram três sugestões numeradas', async () => {
    await confirmar({ parcelas: [
      { dVenc: new Date('2026-10-04T00:00:00Z'), valor: 183.54 },
      { dVenc: new Date('2026-11-04T00:00:00Z'), valor: 183.54 },
      { dVenc: new Date('2026-12-04T00:00:00Z'), valor: 183.54 },
    ] })
    const sug = await prisma.stockPayableSuggestion.findMany({ where: { companyId }, orderBy: { dVenc: 'asc' } })
    expect(sug).toHaveLength(3)
    expect(sug.map((s) => s.nDup)).toEqual(['P01', 'P02', 'P03'])
    expect(sug.reduce((s, x) => s + x.valor, 0)).toBeCloseTo(TOTAL, 2)
  })
})

describe('⛔⛔ as parcelas têm que FECHAR com a nota', () => {
  it('⛔⛔ soma diferente do total é RECUSADA, e nada é gravado', async () => {
    // ⚠️ a nota é fato assinado pela SEFAZ: parcela que não soma o total é erro de digitação,
    // e deixar passar criaria dívida com valor errado no fluxo de caixa.
    await expect(confirmar({ parcelas: [{ dVenc: new Date('2026-09-18T00:00:00Z'), valor: 500 }] }))
      .rejects.toThrow(/falta R\$ 50,62|falta R\$ 50.62/)
    expect(await prisma.stockPayableSuggestion.count({ where: { companyId } })).toBe(0)
    // ⛔ e a nota NÃO foi confirmada: recusa cedo, sem meia-gravação
    const nfe = await prisma.stockNfe.findUniqueOrThrow({ where: { id: nfeId }, select: { status: true } })
    expect(nfe.status).toBe('EM_CONFERENCIA')
    expect(await prisma.stockMovement.count({ where: { companyId } })).toBe(0)
  })

  it('⭐ a régua pura: fecha ao centavo, sobra e falta são nomeadas', () => {
    expect(conferirPagamentoDoPapel([{ dVenc: new Date(), valor: 550.62 }], 550.62).ok).toBe(true)
    expect(conferirPagamentoDoPapel([{ dVenc: new Date(), valor: 550.61 }], 550.62).ok).toBe(true) // 1 centavo de folga
    const falta = conferirPagamentoDoPapel([{ dVenc: new Date(), valor: 500 }], 550.62)
    expect(falta.ok).toBe(false)
    expect(falta.erros[0]).toMatch(/falta/)
    const sobra = conferirPagamentoDoPapel([{ dVenc: new Date(), valor: 600 }], 550.62)
    expect(sobra.erros[0]).toMatch(/sobra/)
  })

  it('⭐ lista VAZIA é válida — é o "a definir", não um erro', () => {
    expect(conferirPagamentoDoPapel([], 550.62).ok).toBe(true)
  })
})

describe('⭐ sem preencher, o caminho de ontem continua', () => {
  it('⭐⭐ nota sem boleto e sem digitar → A DEFINIR, como antes', async () => {
    await confirmar()
    const sug = await prisma.stockPayableSuggestion.findMany({ where: { companyId } })
    expect(sug).toHaveLength(1)
    expect(sug[0].dVenc, 'o sistema inventou uma data').toBeNull()
    expect(await parcelasSemData(companyId, prisma)).toHaveLength(1)
  })

  it('⭐ e sem rastro nenhum: ninguém definiu nada ainda', async () => {
    await confirmar()
    const sug = await prisma.stockPayableSuggestion.findFirstOrThrow({ where: { companyId } })
    expect(await rastroDoVencimento(companyId, sug.id, prisma)).toEqual([])
  })
})
