// REGRA 1 — a busca de componente da ficha oferecia MATERIAL DE LIMPEZA como ingrediente.
//
// O dono pegou montando a receita do xis: a busca sugeria **DESENGRAXANTE, SACO DE LIXO e
// JAPONA DE CÂMARA**. O editor pedia o catálogo INTEIRO; ingrediente é matéria-prima,
// intermediário produzido ou revenda (combo leva refri) — limpeza/uso interno/embalagem não.
//
// ⚠️ POR QUE O FILTRO É NO SERVIDOR e não no cliente: a query tem `take: 50`. Filtrar depois
// deixaria itens bons de fora sempre que o material de limpeza ocupasse as vagas — o bug
// mudaria de cara em vez de sumir.
//
// REGRA 3: chama o HANDLER REAL com token assinado, não mock.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { signToken, COOKIE_NAME } from '@/lib/auth'
import { GET as itensGET } from '@/app/api/empresas/[id]/estoque/itens/route'
import { criarFicha } from '../../producao/fichas'

const CNPJ = '33333333000133'
let companyId: string
let token = ''

const req = (qs: string) => {
  const r = new NextRequest(`http://localhost/api/empresas/${companyId}/estoque/itens${qs}`)
  r.cookies.set(COOKIE_NAME, token)
  return r
}
const params = () => ({ params: Promise.resolve({ id: companyId }) })
const nomes = async (qs: string) => {
  const res = await itensGET(req(qs), params())
  expect(res.status).toBe(200)
  return ((await res.json()).itens as { nome: string; categoria: string }[])
}

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'BUSCA' } })).id
  const user = await prisma.user.create({ data: { email: `busca-${Date.now()}@t.com`, password: 'x', name: 'Dono', role: 'ADMIN' } })
  await prisma.userCompany.create({ data: { userId: user.id, companyId } })
  const role = await prisma.role.findFirst({ where: { name: 'OWNER', isSystemDefault: true } })
  if (role) await prisma.userCompanyRole.create({ data: { userId: user.id, companyId, roleId: role.id } })
  token = await signToken({ sub: user.id, email: user.email, name: 'Dono', role: 'ADMIN' })

  const cria = (nome: string, categoria: string) =>
    prisma.stockItem.create({ data: { companyId, nome, unidadeControle: 'UN', categoria, criadoVia: 'MANUAL' } })
  // os 3 que o dono viu sugeridos + os que DEVEM aparecer
  await cria('DESENGRAXANTE', 'LIMPEZA')
  await cria('SACO DE LIXO', 'LIMPEZA')
  await cria('JAPONA DE CAMARA', 'USO_INTERNO')
  await cria('EMBALAGEM DELIVERY', 'EMBALAGEM')
  await cria('Coxão mole', 'MATERIA_PRIMA')
  await cria('Refri lata', 'REVENDA')
  // intermediário nasce pela ficha (categoria = tipoProduto)
  const mp = await cria('Carne moída', 'MATERIA_PRIMA')
  await criarFicha({ companyId, nomeProduzido: 'Gessado', unidadeProduzido: 'KG', tipoProduto: 'INTERMEDIARIO', loteBase: 1, unidadeLoteBase: 'KG', componentes: [{ itemId: mp.id, qtdPlanejada: 1, unidade: 'KG' }] }, prisma)
})

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  for (const t of ['stockFichaComponente', 'stockFichaVersao', 'stockFicha', 'stockMovement', 'stockItem'] as const) {
    // @ts-expect-error dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.userCompanyRole.deleteMany({ where: { companyId } })
  await prisma.userCompany.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('busca de ingrediente (escopo=receita)', () => {
  it('⭐⭐ os 3 que o dono viu NÃO aparecem mais', async () => {
    const r = (await nomes('?escopo=receita')).map((i) => i.nome)
    expect(r).not.toContain('DESENGRAXANTE')
    expect(r).not.toContain('SACO DE LIXO')
    expect(r).not.toContain('JAPONA DE CAMARA')
    expect(r).not.toContain('EMBALAGEM DELIVERY')
  })

  it('⭐ e o que É ingrediente continua aparecendo', async () => {
    const r = (await nomes('?escopo=receita')).map((i) => i.nome)
    expect(r).toContain('Coxão mole') // matéria-prima
    expect(r).toContain('Gessado') // intermediário produzido
    expect(r).toContain('Refri lata') // revenda (combo leva refri)
  })

  it('⭐ ordena por relevância: intermediário e matéria-prima antes da revenda', async () => {
    const cats = (await nomes('?escopo=receita')).map((i) => i.categoria)
    const posInter = cats.indexOf('INTERMEDIARIO')
    const posRevenda = cats.indexOf('REVENDA')
    expect(posInter).toBeGreaterThanOrEqual(0)
    expect(posInter).toBeLessThan(posRevenda)
    expect(cats.indexOf('MATERIA_PRIMA')).toBeLessThan(posRevenda)
  })

  it('⚠️ o comportamento ANTIGO (sem escopo) ainda traz tudo — é o toggle "mostrar tudo"', async () => {
    const r = (await nomes('')).map((i) => i.nome)
    expect(r).toContain('DESENGRAXANTE') // some por default, NÃO desaparece
    expect(r).toContain('Coxão mole')
  })

  it('a busca por texto continua funcionando dentro do escopo', async () => {
    const r = (await nomes('?escopo=receita&busca=Cox')).map((i) => i.nome)
    expect(r).toEqual(['Coxão mole'])
  })
})

describe('lista de REVENDA — o dropdown do mapeamento inline no hub', () => {
  it('⭐ traz só item de revenda (é o que a venda pode baixar direto)', async () => {
    const r = await nomes('?categoria=REVENDA')
    expect(r.map((i) => i.nome)).toEqual(['Refri lata'])
    expect(r.every((i) => i.categoria === 'REVENDA')).toBe(true)
  })
})
