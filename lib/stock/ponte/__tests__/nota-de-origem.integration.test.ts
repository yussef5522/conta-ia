// ⭐ "VER NOTA DE ORIGEM" — a seta de volta da ponte, contra o banco (REGRA 3).
//
// A conta a pagar mora no financeiro; a mercadoria mora no estoque. Este é o link que
// deixa as duas coisas serem verdade ao mesmo tempo — e o que ele NÃO pode fazer é
// aparecer em conta que não veio de nota (o dono clicaria num link que não leva a lugar
// nenhum, ou pior, à nota errada).

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { buildAuthContextForTest } from '@/lib/auth/rbac'
import { createContaPendente } from '@/lib/contas-ap-ar/create'
import { notasDeOrigem } from '../nota-de-origem'

const CNPJ = '50607080000212'
const CNPJ_FORN = '88728027000146'
// nº da NF nas posições 26..34 da chave → 000012345 → "12345"
const CHAVE = '43260888728027000146550010000123451234567890'

let companyId: string
let userId: string
let supplierId: string
let nfeId: string

const ctx = () => buildAuthContextForTest({ user: { id: userId }, company: { id: companyId }, permissions: ['*'] })

async function criarConta(descricao: string) {
  const t = await createContaPendente(
    {
      companyId, description: descricao, amount: 100, dueDate: new Date('2026-09-10'),
      lifecycle: 'PAYABLE', supplierId,
    } as Parameters<typeof createContaPendente>[0],
    ctx(),
  )
  return t.id
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA VOLTA' } })).id
  userId = (await prisma.user.create({ data: { email: `volta-${Date.now()}@teste.com`, name: 'Dono', password: 'x' } })).id
  supplierId = (await prisma.supplier.create({ data: { companyId, razaoSocial: 'FRIGORIFICO SILVA', cnpj: CNPJ_FORN } })).id
  nfeId = (await prisma.stockNfe.create({
    data: { companyId, chave: CHAVE, nsu: '1', status: 'CONFIRMADA', temXmlCompleto: true, emitNome: 'FRIGORIFICO SILVA', emitCnpj: CNPJ_FORN, vNF: 6006.45 },
  })).id
})

afterEach(async () => {
  await prisma.stockPayableLink.deleteMany({ where: { companyId } })
  await prisma.stockReceiptConference.deleteMany({ where: { companyId } })
  await prisma.stockNfe.deleteMany({ where: { companyId } })
  await prisma.transaction.deleteMany({ where: { supplier: { companyId } } })
  await prisma.supplier.deleteMany({ where: { companyId } })
  await prisma.user.deleteMany({ where: { id: userId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐ da conta a pagar de volta pra nota', () => {
  it('⭐⭐ nota JÁ CONFERIDA → o link abre o RECIBO (é onde está o que entrou)', async () => {
    const txId = await criarConta('FRIGORIFICO SILVA — parcela 001')
    const conf = await prisma.stockReceiptConference.create({
      data: { companyId, nfeId, chave: CHAVE, status: 'CONFIRMADA' },
    })
    await prisma.stockPayableLink.create({
      data: { companyId, origem: 'NFE', refId: nfeId, nDup: '001', chave: CHAVE, transactionId: txId, supplierId, valor: 6006.45, dVenc: new Date('2026-08-27') },
    })

    const mapa = await notasDeOrigem(companyId, [txId], prisma)
    const n = mapa.get(txId)
    expect(n).toBeTruthy()
    expect(n!.nfeId).toBe(nfeId)
    expect(n!.nNF).toBe('12345') // ⭐ o número que o dono lê no boleto, tirado da chave
    expect(n!.href).toBe(`/empresas/${companyId}/estoque/recibos/${conf.id}`)
  })

  it('⚠️ nota ainda SEM conferência → cai na fila de Recebimentos, nunca num recibo que não existe', async () => {
    const txId = await criarConta('FRIGORIFICO SILVA — parcela 002')
    await prisma.stockPayableLink.create({
      data: { companyId, origem: 'NFE', refId: nfeId, nDup: '002', chave: CHAVE, transactionId: txId, supplierId, valor: 6006.44, dVenc: new Date('2026-09-03') },
    })

    const n = (await notasDeOrigem(companyId, [txId], prisma)).get(txId)
    expect(n!.href).toBe(`/empresas/${companyId}/estoque/recebimentos/${nfeId}`)
  })

  it('⛔ conta que NÃO veio do estoque não ganha link (nem por engano)', async () => {
    const txId = await criarConta('ALUGUEL — digitado no financeiro')
    const mapa = await notasDeOrigem(companyId, [txId], prisma)
    expect(mapa.size).toBe(0)
    expect(mapa.get(txId)).toBeUndefined()
  })

  it('⛔ multi-tenant: a nota de OUTRA empresa não vaza (REGRA 8)', async () => {
    const txId = await criarConta('FRIGORIFICO SILVA — parcela 001')
    await prisma.stockPayableLink.create({
      data: { companyId, origem: 'NFE', refId: nfeId, nDup: '001', chave: CHAVE, transactionId: txId, supplierId, valor: 6006.45, dVenc: new Date('2026-08-27') },
    })
    const outra = await prisma.company.create({ data: { cnpj: '50607080000213', name: 'OUTRA' } })
    const mapa = await notasDeOrigem(outra.id, [txId], prisma)
    expect(mapa.size).toBe(0)
    await prisma.company.delete({ where: { id: outra.id } })
  })

  it('⚠️ lista vazia não vai ao banco (a tela pagina; resolver o universo seria caro à toa)', async () => {
    const mapa = await notasDeOrigem(companyId, [], prisma)
    expect(mapa.size).toBe(0)
  })
})
