// ESTOQUE — o fator vem da PRÓPRIA NF-e (dupla unidade qTrib/uTrib). Skol: 1 CX comercial,
// 20 UN tributadas → a conferência sugere fator 20 sem perguntar. E o mapa aprendido tem
// prioridade. REGRA 1 do bug da Skol (fator não aparecia).

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { buildConferenceView } from '../conference'

const CNPJ = '12121212000112'
let companyId: string
let nfeId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'FATOR NOTA' } })
  companyId = c.id
  const nfe = await prisma.stockNfe.create({ data: { companyId, chave: '43260812121212000112550100000000019999900019', nsu: '1', status: 'AGUARDANDO_MERCADORIA', temXmlCompleto: true, emitCnpj: '99999999000199', emitNome: 'BEBIDAS X' } })
  nfeId = nfe.id
  await prisma.stockNfeItem.createMany({ data: [
    // Skol: 1 CX comercial, 20 UN tributadas → fator da nota = 20
    { companyId, nfeId, chave: nfe.chave, nItem: 1, cProd: 'SKOL', xProd: 'CERV SKOL 600ML', ncm: '22030000', uCom: 'CX', qCom: 1, vUnCom: 169.2, vProd: 169.2, uTrib: 'UN', qTrib: 20 },
    // Óleo: comercial já em UN (uTrib = uCom) → sem conversão (fatorNota null)
    { companyId, nfeId, chave: nfe.chave, nItem: 2, cProd: 'OLEO', xProd: 'OLEO SOJA 900ML', ncm: '15079011', uCom: 'UN', qCom: 12, vUnCom: 7.72, vProd: 92.64, uTrib: 'UN', qTrib: 12 },
  ] })
})
afterEach(async () => {
  for (const t of ['stockNfeItem', 'stockNfe', 'stockSupplierProduct', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('fator da nota (qTrib/uTrib)', () => {
  it('Skol 1 CX = 20 UN tributadas → fatorNota 20 (a nota resolve, sem perguntar)', async () => {
    const v = (await buildConferenceView(companyId, nfeId))!
    const skol = v.itens.find((i) => i.cProd === 'SKOL')!
    expect(skol.uCom).toBe('CX')
    expect(skol.uTrib).toBe('UN')
    expect(skol.fatorNota).toBe(20) // 20 garrafas por caixa, DA NOTA
  })
  it('quando uTrib == uCom (já em UN) → sem conversão (fatorNota null)', async () => {
    const v = (await buildConferenceView(companyId, nfeId))!
    const oleo = v.itens.find((i) => i.cProd === 'OLEO')!
    expect(oleo.fatorNota).toBeNull()
  })
})
