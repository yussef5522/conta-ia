// VENDAS — o gatilho do motor no LANÇAMENTO MANUAL (25/08).
//
// CASO REAL: o dono lançou a venda em dinheiro do cofre à mão. A transação nasceu
// categorizada como Receita de Vendas e RECONCILED — e o calendário de vendas NUNCA
// soube dela. Os dois lançamentos órfãos em prod:
//   24/08 R$ 3.135,00 (venda de domingo 23, por D+1 corrido)
//   25/08 R$   942,00 (venda de segunda 24)
// O hook existia no import OFX, na categorização em lote e na edição — não na CRIAÇÃO.
//
// REGRA 3: roda o motor de verdade contra o banco, com o perfil real do cofre.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { recomputeVendasSafe } from '../recompute-hook'

const CNPJ = '50607080000233'
const INICIO = new Date('2026-08-12T00:00:00.000Z')
let companyId: string
let cofreId: string
let catVendaId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA GATILHO' } })).id
  cofreId = (await prisma.bankAccount.create({
    data: { companyId, name: 'caixa loja/cofre', bankName: 'Caixa', accountType: 'CASH', balance: 0 },
  })).id
  catVendaId = (await prisma.category.create({
    data: { companyId, name: 'Receita de Vendas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
  })).id
  // perfil REAL do cofre: dinheiro D+1 CORRIDO (recebe todo dia, inclusive fim de semana)
  const perfil = await prisma.perfilRecebimento.create({ data: { companyId } })
  await prisma.regraRecebimento.create({
    data: { perfilId: perfil.id, companyId, bankAccountId: cofreId, meio: 'DINHEIRO', diasUteisAtraso: 1, recebeSabDom: true, vigenteDe: INICIO, origemHint: 'Caixa loja/cofre' },
  })
})

afterEach(async () => {
  await prisma.vendaDiariaTransacao.deleteMany({ where: { venda: { companyId } } })
  await prisma.vendaDiaria.deleteMany({ where: { companyId } })
  await prisma.transaction.deleteMany({ where: { bankAccount: { companyId } } })
  await prisma.regraRecebimento.deleteMany({ where: { companyId } })
  await prisma.perfilRecebimento.deleteMany({ where: { companyId } })
  await prisma.category.deleteMany({ where: { companyId } })
  await prisma.bankAccount.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

/** simula o lançamento manual: cria a tx como a rota POST /api/transacoes cria */
async function lancarManual(dataISO: string, valor: number) {
  return prisma.transaction.create({
    data: {
      bankAccountId: cofreId, categoryId: catVendaId, date: new Date(`${dataISO}T00:00:00.000Z`),
      description: 'receita de venda dinheiro', amount: valor, type: 'CREDIT',
      status: 'RECONCILED', origin: 'MANUAL',
    },
  })
}

describe('lançamento manual no cofre dispara o motor de vendas', () => {
  it('SEM o recompute, a venda fica órfã — o bug que aconteceu em prod', async () => {
    await lancarManual('2026-08-24', 3135)
    // criar a transação sozinha NÃO cria VendaDiaria
    expect(await prisma.vendaDiaria.count({ where: { companyId } })).toBe(0)
  })

  it('COM o gatilho, os 2 lançamentos reais viram venda no dia certo (D+1 corrido)', async () => {
    await lancarManual('2026-08-24', 3135) // entrou segunda → venda de DOMINGO 23
    await lancarManual('2026-08-25', 942)  // entrou terça  → venda de SEGUNDA 24
    await recomputeVendasSafe(prisma, companyId)

    const vendas = await prisma.vendaDiaria.findMany({ where: { companyId }, orderBy: { dataCompetencia: 'asc' } })
    expect(vendas).toHaveLength(2)

    const [dom, seg] = vendas
    expect(dom.dataCompetencia.toISOString().slice(0, 10)).toBe('2026-08-23') // domingo
    expect(dom.valorLiquido).toBe(3135)
    expect(dom.meio).toBe('DINHEIRO')

    expect(seg.dataCompetencia.toISOString().slice(0, 10)).toBe('2026-08-24') // segunda
    expect(seg.valorLiquido).toBe(942)
  })

  it('o RASTRO liga a venda de volta ao lançamento do extrato', async () => {
    const tx = await lancarManual('2026-08-24', 3135)
    await recomputeVendasSafe(prisma, companyId)
    const origem = await prisma.vendaDiariaTransacao.findFirst({ where: { transactionId: tx.id } })
    expect(origem).toBeTruthy()
    expect(origem!.valor).toBe(3135)
  })

  it('dinheiro NÃO vira bloco de fim de semana (recebe todo dia, cada dia é 1 dia)', async () => {
    await lancarManual('2026-08-24', 3135)
    await recomputeVendasSafe(prisma, companyId)
    const v = await prisma.vendaDiaria.findFirstOrThrow({ where: { companyId } })
    expect(v.isBloco).toBe(false)
    expect(v.dataCompetencia.getTime()).toBe(v.dataCompetenciaFim.getTime())
  })

  it('lançamento SEM categoria de venda não vira venda nenhuma', async () => {
    await prisma.transaction.create({
      data: { bankAccountId: cofreId, categoryId: null, date: new Date('2026-08-24T00:00:00.000Z'),
        description: 'saque', amount: 500, type: 'CREDIT', status: 'PENDING', origin: 'MANUAL' },
    })
    await recomputeVendasSafe(prisma, companyId)
    expect(await prisma.vendaDiaria.count({ where: { companyId } })).toBe(0)
  })
})
