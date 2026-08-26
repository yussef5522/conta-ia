// REGRA 1 — o recompute deixou de ser IDEMPOTENTE em silêncio (26/08) e inflou a tela
// de Vendas de 380 mil pra 595 mil.
//
// CAUSA: o DELETE do recompute filtrava por `dataCompetencia >= corte` (pertencimento).
// O BLOCO de fim de semana tem competência na SEXTA — 31/07, ANTES do corte de 01/08.
// O delete nunca o alcançava; o create o inseria de novo. Uma cópia por import.
// Em prod: 5 cópias (43.106,03 → 215.530,15).
//
// E o juiz não pegou porque o V1 montava o mapa com `set` (a última linha sobrescrevia
// as outras) — cego pra duplicata por construção.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { recomputeVendas } from '../recompute-vendas'
import { checkVendasForCompany } from '../vendas-invariants'

const db = new PrismaClient()
const CORTE = new Date(Date.UTC(2026, 7, 1))
let companyId = ''

beforeAll(async () => {
  const c = await db.company.create({ data: { name: 'recompute-idempotente', cnpj: `${Date.now()}`.slice(-14).padStart(14, '8') } })
  companyId = c.id
  const acc = await db.bankAccount.create({ data: { companyId, name: 'banrisul t', bankCode: '041', accountNumber: '1', balance: 0 } })
  const cat = await db.category.create({ data: { companyId, name: 'Receita de Vendas', type: 'INCOME', dreGroup: 'RECEITA_BRUTA' } })
  const perfil = await db.perfilRecebimento.create({ data: { companyId } })
  await db.regraRecebimento.create({ data: { perfilId: perfil.id, companyId, bankAccountId: acc.id, meio: 'CARTAO',
    diasUteisAtraso: 1, recebeSabDom: false, vigenteDe: CORTE, confirmadoPeloDono: true } })
  // dinheiro entra segunda 03/08 → competência é o fim de semana 31/07–02/08
  await db.transaction.create({ data: { bankAccountId: acc.id, categoryId: cat.id, date: new Date(Date.UTC(2026, 7, 3)),
    description: 'OP.CREDITO C/GARANTIA', amount: 35113.82, type: 'CREDIT', status: 'RECONCILED', lifecycle: 'EFFECTED' } })
})
afterAll(async () => { await db.company.delete({ where: { id: companyId } }).catch(() => {}); await db.$disconnect() })

describe('recompute é IDEMPOTENTE mesmo com bloco atravessando o corte', () => {
  it('⭐ rodar 5× (como 5 imports fizeram em prod) deixa UMA linha, não cinco', async () => {
    for (let i = 0; i < 5; i++) await recomputeVendas(db, companyId, CORTE)
    const linhas = await db.vendaDiaria.findMany({ where: { companyId } })
    expect(linhas).toHaveLength(1) // antes do fix: 5
    expect(linhas[0].valorLiquido).toBeCloseTo(35113.82, 2)
  })

  it('o TOTAL não infla — era 5× em prod (43.106,03 → 215.530,15)', async () => {
    const linhas = await db.vendaDiaria.findMany({ where: { companyId } })
    const total = linhas.reduce((s, l) => s + l.valorLiquido, 0)
    expect(Math.round(total * 100) / 100).toBe(35113.82)
  })

  it('o juiz fica verde depois do fix', async () => {
    const fails = await checkVendasForCompany(db, companyId, 'recompute-idempotente', CORTE)
    expect(fails.map((f) => `${f.invariante}: ${f.detalhe}`)).toEqual([])
  })

  it('⭐ e se a duplicata VOLTAR, o juiz PEGA (V5) — antes era cego', async () => {
    const orig = await db.vendaDiaria.findFirst({ where: { companyId } })
    await db.vendaDiaria.create({ data: {
      companyId, dataCompetencia: orig!.dataCompetencia, dataCompetenciaFim: orig!.dataCompetenciaFim,
      meio: orig!.meio, tipo: orig!.tipo, valorLiquido: orig!.valorLiquido, isBloco: orig!.isBloco,
      origem: 'EXTRATO_INFERIDO', status: orig!.status, confirmadoPerfil: orig!.confirmadoPerfil,
    } })
    const fails = await checkVendasForCompany(db, companyId, 'recompute-idempotente', CORTE)
    const v5 = fails.filter((f) => f.invariante === 'V5')
    expect(v5).toHaveLength(1)
    expect(v5[0].detalhe).toMatch(/2 linhas/)
    // e o V1 também grita, porque agora SOMA em vez de sobrescrever
    expect(fails.some((f) => f.invariante === 'V1' && /70227\.64|gravado/.test(f.detalhe))).toBe(true)
  })
})
