// ESTOQUE FASE 2 item 2.0 — criar item manual (molho/sal que nunca veio em nota): nasce
// SEM custo (custoMedio null → "a definir") e SEM movimento; dedup por nome. Prova o gap
// que deixaria a ficha incompleta pra sempre. (Testa a lógica do POST direto no banco.)

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'

const CNPJ = '99001122000133'
let companyId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA ITEM MANUAL' } })
  companyId = c.id
})
afterEach(async () => {
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

// replica a regra do POST: cria se não existir pelo nome; nasce sem custo/movimento
async function criarItemManual(nome: string, unidade: string) {
  const existente = await prisma.stockItem.findFirst({ where: { companyId, nome: nome.trim() } })
  if (existente) return { item: existente, jaExistia: true }
  const item = await prisma.stockItem.create({ data: { companyId, nome: nome.trim(), unidadeControle: unidade, categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })
  return { item, jaExistia: false }
}

describe('criar item manual (componente sem nota)', () => {
  it('nasce sem custoMedio e sem movimento', async () => {
    const { item } = await criarItemManual('Molho caseiro', 'LT')
    expect(item.custoMedio).toBeNull()
    expect(item.criadoVia).toBe('MANUAL')
    expect(await prisma.stockMovement.count({ where: { companyId, itemId: item.id } })).toBe(0)
  })
  it('dedup por nome: criar 2× o mesmo devolve o existente (não duplica)', async () => {
    const a = await criarItemManual('Sal', 'KG')
    const b = await criarItemManual('Sal', 'KG')
    expect(b.jaExistia).toBe(true)
    expect(b.item.id).toBe(a.item.id)
    expect(await prisma.stockItem.count({ where: { companyId, nome: 'Sal' } })).toBe(1)
  })
})
