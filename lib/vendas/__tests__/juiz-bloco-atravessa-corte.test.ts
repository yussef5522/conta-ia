// REGRA 1 — o juiz gritou 111 alarmes FALSOS em 26/08.
//
// O QUE ACONTECEU: ao estender a janela de vendas pra 01/08, o bloco de fim de semana
// 31/07–02/08 (R$ 43.106,03, cartão + PIX Sicredi) passou a ser computado — o dinheiro
// entrou na segunda 03/08, depois do corte. O bloco FOI gravado certo. Mas o juiz
// buscava as VendaDiaria com `dataCompetencia >= inicio`, e a competência do bloco é a
// SEXTA (31/07), antes do corte → o juiz não via o que estava gravado e acusava:
//   V1 (2×)   "gravado 0.00 vs esperado 35113.82 / 7992.21"
//   V2 (109×) "venda-tx tem competência >= corte mas NÃO está em nenhuma VendaDiaria"
// As 109 tx eram todas de 03/08 e somavam EXATAMENTE 43.106,03 — o bloco inteiro.
//
// ⚠️ Alarme falso é pior que alarme nenhum: o e-mail noturno vira ruído e o dono para
// de ler (é a razão de o N1 não empilhar sobre o N3 no juiz de infra).
//
// Este teste roda o pipeline REAL contra o Postgres/SQLite de teste (REGRA 3).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { checkVendasForCompany } from '../vendas-invariants'

const db = new PrismaClient()
const CORTE = new Date(Date.UTC(2026, 7, 1)) // 01/08 — o corte estendido

let companyId = ''
let bankAccountId = ''
let categoryId = ''

beforeAll(async () => {
  const company = await db.company.create({
    data: { name: 'bloco-atravessa-corte', cnpj: `${Date.now()}`.slice(-14).padStart(14, '9') },
  })
  companyId = company.id
  const acc = await db.bankAccount.create({
    data: { companyId, name: 'sicredi teste', bankCode: '748', accountNumber: '1', balance: 0 },
  })
  bankAccountId = acc.id
  const cat = await db.category.create({
    data: { companyId, name: 'Receita de Vendas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' },
  })
  categoryId = cat.id

  // A regra REAL da Cacula pro cartão: D+1 ÚTIL, não recebe sábado/domingo →
  // o dinheiro de sex+sáb+dom cai junto na segunda, formando o BLOCO.
  const perfil = await db.perfilRecebimento.create({ data: { companyId } })
  await db.regraRecebimento.create({
    data: {
      perfilId: perfil.id, companyId, bankAccountId, meio: 'CARTAO', diasUteisAtraso: 1,
      recebeSabDom: false, vigenteDe: CORTE, confirmadoPeloDono: true,
    },
  })

  // O dinheiro entra na SEGUNDA 03/08 (depois do corte) e a venda é do fim de semana
  // 31/07–02/08 (a sexta cai ANTES do corte — é esse o ponto).
  await db.transaction.create({
    data: {
      bankAccountId, categoryId, date: new Date(Date.UTC(2026, 7, 3)),
      description: 'OP.CREDITO C/GARANTIA', amount: 35113.82, type: 'CREDIT',
      status: 'RECONCILED', lifecycle: 'EFFECTED',
    },
  })
})

afterAll(async () => {
  await db.company.delete({ where: { id: companyId } }).catch(() => {})
  await db.$disconnect()
})

describe('juiz de vendas × bloco que ATRAVESSA o corte', () => {
  it('recomputa e o bloco 31/07–02/08 fica gravado com competência ANTES do corte', async () => {
    const { recomputeVendas } = await import('../recompute-vendas')
    await recomputeVendas(db, companyId, CORTE)
    const linhas = await db.vendaDiaria.findMany({ where: { companyId } })
    expect(linhas).toHaveLength(1)
    expect(linhas[0].valorLiquido).toBeCloseTo(35113.82, 2)
    // a competência COMEÇA antes do corte — é isso que o filtro antigo escondia
    expect(linhas[0].dataCompetencia.getTime()).toBeLessThan(CORTE.getTime())
    expect(linhas[0].dataCompetenciaFim.getTime()).toBeGreaterThanOrEqual(CORTE.getTime())
  })

  it('⭐ o juiz NÃO acusa nada — o bloco está gravado e ele tem que enxergar', async () => {
    const fails = await checkVendasForCompany(db, companyId, 'bloco-atravessa-corte', CORTE)
    const detalhes = fails.map((f) => `${f.invariante}: ${f.detalhe}`)
    expect(detalhes).toEqual([]) // com o filtro antigo: V1 "gravado 0.00" + V2 por tx
  })

  it('o filtro ANTIGO (pertencimento) teria escondido a linha — a prova do bug', async () => {
    const comFiltroAntigo = await db.vendaDiaria.findMany({
      where: { companyId, origem: 'EXTRATO_INFERIDO', dataCompetencia: { gte: CORTE } },
    })
    const comFiltroNovo = await db.vendaDiaria.findMany({
      where: { companyId, origem: 'EXTRATO_INFERIDO', dataCompetenciaFim: { gte: CORTE } },
    })
    expect(comFiltroAntigo).toHaveLength(0) // <- a causa dos 111 alarmes
    expect(comFiltroNovo).toHaveLength(1)
  })
})
