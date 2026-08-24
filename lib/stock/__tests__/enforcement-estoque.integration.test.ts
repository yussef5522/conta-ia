// ESTOQUE Fase 3 Parte 1 — ENFORCEMENT (a fechadura). REGRA 3: chama os HANDLERS REAIS
// das rotas, com token assinado de verdade, contra o banco — não mock de permissão.
//
// O risco desta mudança é ASSIMÉTRICO: apertar demais tranca o DONO fora do próprio
// sistema (aconteceu: o OWNER em prod tinha lista CONCRETA de 33 permissões porque o `*`
// foi expandido num seed antigo, então `stock.view` dava 403 até pra ele); apertar de
// menos deixa a equipe de loja mexendo no financeiro. Os dois lados são testados aqui.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { signToken, COOKIE_NAME } from '@/lib/auth'
import { PERMISSIONS, DEFAULT_ROLES, expandPermissions } from '@/lib/auth/permissions'
import { getAuthContext, ForbiddenError } from '@/lib/auth/rbac'

// handlers REAIS (um por camada de permissão)
import { GET as posicaoGET } from '@/app/api/empresas/[id]/estoque/posicao/route'
import { POST as saidaPOST } from '@/app/api/empresas/[id]/estoque/saida/route'
import { POST as contagemPOST } from '@/app/api/empresas/[id]/estoque/contagem/route'
import { GET as itensGET, POST as itensPOST } from '@/app/api/empresas/[id]/estoque/itens/route'
import { POST as fichasPOST } from '@/app/api/empresas/[id]/estoque/fichas/route'
import { POST as mapearPOST } from '@/app/api/empresas/[id]/estoque/vendas/mapear/route'
import { PATCH as itemPATCH } from '@/app/api/empresas/[id]/estoque/itens/[itemId]/route'

const CNPJ = '50607080000200'
let companyId: string
let itemId: string
const tokens: Record<string, string> = {}

/** chaves do financeiro que a equipe de loja NÃO pode ter (o dono pediu explicitamente) */
const FINANCEIRO = ['transaction.view', 'transaction.create', 'dre.view', 'report.view', 'bank_account.view', 'category.update', 'user.invite'] as const

async function garantirRbac() {
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key: p.key }, create: p, update: { name: p.name, description: p.description, group: p.group } })
  }
  for (const def of Object.values(DEFAULT_ROLES)) {
    let role = await prisma.role.findFirst({ where: { name: def.name, companyId: null, isSystemDefault: true } })
    if (!role) role = await prisma.role.create({ data: { name: def.name, description: def.description, isSystemDefault: true, companyId: null } })
    const keys = expandPermissions([...def.permissions])
    const perms = await prisma.permission.findMany({ where: { key: { in: keys } } })
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: { notIn: perms.map((p) => p.id) } } })
    for (const perm of perms) {
      await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } }, create: { roleId: role.id, permissionId: perm.id }, update: {} })
    }
  }
}

async function criarUsuario(email: string, papel: string) {
  const u = await prisma.user.create({ data: { email, name: email.split('@')[0], password: 'x' } })
  const role = await prisma.role.findFirstOrThrow({ where: { name: papel, companyId: null, isSystemDefault: true } })
  await prisma.userCompanyRole.create({ data: { userId: u.id, companyId, roleId: role.id } })
  // `role` do token é o papel GLOBAL do User (legado) — o RBAC por empresa vem do
  // UserCompanyRole, não daqui; por isso 'USER' basta pro teste.
  tokens[papel] = await signToken({ sub: u.id, email, name: u.name, role: 'USER' })
  return u.id
}

/** request com cookie assinado de verdade — o mesmo caminho do browser */
function req(papel: string, url: string, init?: { method?: string; body?: unknown }) {
  const r = new NextRequest(`http://localhost${url}`, {
    method: init?.method ?? 'GET',
    ...(init?.body ? { body: JSON.stringify(init.body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
  r.cookies.set(COOKIE_NAME, tokens[papel])
  return r
}
const params = () => ({ params: Promise.resolve({ id: companyId }) })

beforeAll(async () => {
  await garantirRbac()
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA FECHADURA' } })).id
  itemId = (await prisma.stockItem.create({ data: { companyId, nome: 'Tomate', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' } })).id
  await prisma.stockMovement.create({ data: { companyId, itemId, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 5, custoTotal: 50, origem: 'SEFAZ' } })
  await criarUsuario('dono.fechadura@teste.com', 'OWNER')
  await criarUsuario('operador.fechadura@teste.com', 'OPERADOR_ESTOQUE')
  await criarUsuario('leitura.fechadura@teste.com', 'LEITURA_ESTOQUE')
})

afterAll(async () => {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_update;`).catch(() => {})
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS trg_stock_movement_no_delete;`).catch(() => {})
  await prisma.userCompanyRole.deleteMany({ where: { companyId } })
  for (const t of ['stockContagemItem', 'stockContagem', 'stockSaida', 'stockMovement', 'stockSaldoCache', 'stockItem'] as const) {
    // @ts-expect-error acesso dinâmico
    await prisma[t].deleteMany({ where: { companyId } })
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: '.fechadura@teste.com' } } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('O DONO (OWNER) continua fazendo TUDO — o lado que tranca é o perigoso', () => {
  it('vê a posição', async () => {
    expect((await posicaoGET(req('OWNER', `/api/empresas/${companyId}/estoque/posicao`), params())).status).toBe(200)
  })
  it('opera (registra saída)', async () => {
    const r = await saidaPOST(req('OWNER', '/x', { method: 'POST', body: { itemId, quantidade: 1, motivo: 'ESTRAGOU' } }), params())
    expect(r.status).toBe(200)
  })
  it('gerencia (cria item no catálogo)', async () => {
    const r = await itensPOST(req('OWNER', '/x', { method: 'POST', body: { nome: 'Sal do dono', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA' } }), params())
    expect([200, 201]).toContain(r.status)
  })
  it('gerencia (edita mín/máx do item)', async () => {
    const r = await itemPATCH(req('OWNER', '/x', { method: 'PATCH', body: { estoqueMin: 2, estoqueMax: 20 } }), { params: Promise.resolve({ id: companyId, itemId }) })
    expect(r.status).toBe(200)
  })
})

describe('OPERADOR_ESTOQUE — OPERA mas não GERENCIA', () => {
  it('VÊ a posição', async () => {
    expect((await posicaoGET(req('OPERADOR_ESTOQUE', `/api/empresas/${companyId}/estoque/posicao`), params())).status).toBe(200)
  })
  it('OPERA: registra saída', async () => {
    const r = await saidaPOST(req('OPERADOR_ESTOQUE', '/x', { method: 'POST', body: { itemId, quantidade: 1, motivo: 'CAIU_QUEBROU' } }), params())
    expect(r.status).toBe(200)
  })
  it('OPERA: abre contagem', async () => {
    const r = await contagemPOST(req('OPERADOR_ESTOQUE', '/x', { method: 'POST', body: {} }), params())
    expect(r.status).toBe(200)
    await prisma.stockContagem.deleteMany({ where: { companyId } }) // libera a sessão única
  })

  it('NÃO GERENCIA: catálogo (criar item) → 403', async () => {
    const r = await itensPOST(req('OPERADOR_ESTOQUE', '/x', { method: 'POST', body: { nome: 'Item proibido', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA' } }), params())
    expect(r.status).toBe(403)
    expect((await r.json()).permission).toBe('stock.manage')
    // e não gravou nada
    expect(await prisma.stockItem.count({ where: { companyId, nome: 'Item proibido' } })).toBe(0)
  })
  it('NÃO GERENCIA: ficha técnica → 403', async () => {
    const r = await fichasPOST(req('OPERADOR_ESTOQUE', '/x', { method: 'POST', body: { nomeProduzido: 'X', unidadeProduzido: 'UN', tipoProduto: 'PRODUTO_FINAL', loteBase: 1, componentes: [] } }), params())
    expect(r.status).toBe(403)
  })
  it('NÃO GERENCIA: mín/máx do item → 403', async () => {
    const r = await itemPATCH(req('OPERADOR_ESTOQUE', '/x', { method: 'PATCH', body: { estoqueMin: 99 } }), { params: Promise.resolve({ id: companyId, itemId }) })
    expect(r.status).toBe(403)
    const item = await prisma.stockItem.findUnique({ where: { id: itemId } })
    expect(item!.estoqueMin).not.toBe(99)
  })
  it('NÃO GERENCIA: mapeamento de vendas → 403', async () => {
    const r = await mapearPOST(req('OPERADOR_ESTOQUE', '/x', { method: 'POST', body: { nomeSuitable: 'XIS', destinoTipo: 'REVENDA', destinoId: itemId } }), params())
    expect(r.status).toBe(403)
  })

  it('NÃO VÊ O FINANCEIRO: nenhuma chave passa', async () => {
    const ctx = await getAuthContext(req('OPERADOR_ESTOQUE', '/x'), companyId)
    for (const k of FINANCEIRO) {
      expect(ctx.hasPermission(k), `operador NÃO pode ter ${k}`).toBe(false)
      expect(() => ctx.requirePermission(k)).toThrow(ForbiddenError)
    }
    // ...e tem exatamente as duas do estoque
    expect(ctx.permissions.sort()).toEqual(['stock.operate', 'stock.view'])
  })
})

describe('LEITURA_ESTOQUE — vê e NÃO mexe', () => {
  it('VÊ a posição e o catálogo', async () => {
    expect((await posicaoGET(req('LEITURA_ESTOQUE', `/api/empresas/${companyId}/estoque/posicao`), params())).status).toBe(200)
    expect((await itensGET(req('LEITURA_ESTOQUE', `/api/empresas/${companyId}/estoque/itens`), params())).status).toBe(200)
  })
  it('NÃO opera: saída → 403', async () => {
    const r = await saidaPOST(req('LEITURA_ESTOQUE', '/x', { method: 'POST', body: { itemId, quantidade: 1, motivo: 'VENCEU' } }), params())
    expect(r.status).toBe(403)
    expect((await r.json()).permission).toBe('stock.operate')
  })
  it('NÃO opera: abrir contagem → 403', async () => {
    expect((await contagemPOST(req('LEITURA_ESTOQUE', '/x', { method: 'POST', body: {} }), params())).status).toBe(403)
  })
  it('NÃO gerencia: catálogo → 403', async () => {
    expect((await itensPOST(req('LEITURA_ESTOQUE', '/x', { method: 'POST', body: { nome: 'N', unidadeControle: 'KG', categoria: 'MATERIA_PRIMA' } }), params())).status).toBe(403)
  })
  it('NÃO VÊ O FINANCEIRO e tem só stock.view', async () => {
    const ctx = await getAuthContext(req('LEITURA_ESTOQUE', '/x'), companyId)
    for (const k of FINANCEIRO) expect(ctx.hasPermission(k)).toBe(false)
    expect(ctx.permissions).toEqual(['stock.view'])
  })
})

describe('quem não é da empresa não entra', () => {
  it('usuário sem UserCompanyRole → 403 na posição', async () => {
    const u = await prisma.user.create({ data: { email: 'estranho.fechadura@teste.com', name: 'Estranho', password: 'x' } })
    tokens.ESTRANHO = await signToken({ sub: u.id, email: u.email, name: u.name, role: 'USER' })
    const r = await posicaoGET(req('ESTRANHO', `/api/empresas/${companyId}/estoque/posicao`), params())
    expect(r.status).toBe(403)
  })
})
