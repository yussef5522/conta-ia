// ⛔⛔ ACEITAR CONVITE NUNCA AUTENTICA COMO OUTRA PESSOA (06/09/2026).
//
// O incidente foi no PROXY (o link caía no dashboard de quem estava logado), mas a pergunta
// do dono é mais larga e é a certa: *"aceitar convite NUNCA autentica como outra pessoa"*.
// Este arquivo executa os handlers REAIS contra o banco pra travar isso — e trava também o
// buraco que a perícia achou de brinde: **o login de quem entra por convite não era auditado**.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { POST as aceitar, GET as verConvite } from '@/app/api/aceitar-convite/route'

const CNPJ = '77665544000199'
let companyId = ''
let dono = { id: '', email: 'dono-convite@teste.com' }
let convidado = { id: '', email: 'convidado@teste.com' }
let roleId = ''
let token = ''

const SEGREDO = () => new TextEncoder().encode(process.env.JWT_SECRET)

async function sessaoDe(userId: string, email: string) {
  return new SignJWT({ sub: userId, email, name: email })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(SEGREDO())
}

function req(url: string, body?: unknown, sessao?: string) {
  const r = new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: body ? 'POST' : 'GET',
    ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  })
  if (sessao) r.cookies.set('auth_token', sessao)
  return r
}

beforeEach(async () => {
  process.env.JWT_SECRET ??= 'segredo-de-teste-com-tamanho-suficiente-pra-hs256'
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  await prisma.user.deleteMany({ where: { email: { in: [dono.email, convidado.email] } } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'CONVITE' } })).id
  dono.id = (await prisma.user.create({ data: { email: dono.email, password: 'x', name: 'Dono' } })).id
  convidado.id = (await prisma.user.create({ data: { email: convidado.email, password: 'x', name: 'Convidado' } })).id
  roleId = (await prisma.role.create({ data: { companyId, name: 'PAPEL DO TESTE', description: 'estoque' } })).id
  // ⚠️ 64 hex, como o real: o schema exige 32+ e um token curto reprovaria por FORMATO,
  // escondendo o que o teste quer medir (quem pode aceitar).
  token = randomBytes(32).toString('hex')
  await prisma.companyInvite.create({
    data: {
      companyId, email: convidado.email, roleId, token,
      expiresAt: new Date(Date.now() + 7 * 86400000), invitedById: dono.id,
    },
  })
})

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { companyId } })
  await prisma.companyInvite.deleteMany({ where: { companyId } })
  await prisma.userCompanyRole.deleteMany({ where: { companyId } })
  await prisma.rolePermission.deleteMany({ where: { roleId } })
  await prisma.role.deleteMany({ where: { companyId } })
  await prisma.user.deleteMany({ where: { id: { in: [dono.id, convidado.id] } } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⛔⛔ o aceite nunca vira outra pessoa', () => {
  it('⛔⛔ logado como o DONO, aceitar o convite do convidado é RECUSADO', async () => {
    const r = await aceitar(req('/api/aceitar-convite', { token }, await sessaoDe(dono.id, dono.email)))
    expect(r.status).toBe(400)
    const j = await r.json()
    // ⭐ e vem com CÓDIGO, não só frase: é o que deixa a tela oferecer a SAÍDA
    expect(j.code).toBe('CONTA_DIFERENTE')
    expect(j.conviteEmail).toBe(convidado.email)
    expect(j.contaEmail).toBe(dono.email)
    // ⛔ e NADA foi gravado: o dono não ganhou papel, o convite segue aberto
    expect(await prisma.userCompanyRole.count({ where: { companyId, userId: dono.id } })).toBe(0)
    expect((await prisma.companyInvite.findUnique({ where: { token } }))!.acceptedAt).toBeNull()
  })

  it('⛔ sem sessão nenhuma, aceitar é 401 — e o convite continua intacto', async () => {
    const r = await aceitar(req('/api/aceitar-convite', { token }))
    expect(r.status).toBe(401)
    expect(await prisma.userCompanyRole.count({ where: { companyId } })).toBe(0)
    expect((await prisma.companyInvite.findUnique({ where: { token } }))!.acceptedAt).toBeNull()
  })

  it('⭐⭐ logado como o CONVIDADO, aceita — e o papel é o DO CONVITE', async () => {
    const r = await aceitar(req('/api/aceitar-convite', { token }, await sessaoDe(convidado.id, convidado.email)))
    expect(r.status).toBe(200)
    const ucr = await prisma.userCompanyRole.findFirst({ where: { companyId, userId: convidado.id } })
    expect(ucr, 'o convidado virou membro').toBeTruthy()
    expect(ucr!.roleId, 'com o papel escolhido no convite, nunca "tudo liberado"').toBe(roleId)
    // ⛔ e o DONO não ganhou nada de novo
    expect(await prisma.userCompanyRole.count({ where: { companyId, userId: dono.id } })).toBe(0)
  })

  it('⛔ e o mesmo convite não serve DUAS vezes', async () => {
    await aceitar(req('/api/aceitar-convite', { token }, await sessaoDe(convidado.id, convidado.email)))
    const r2 = await aceitar(req('/api/aceitar-convite', { token }, await sessaoDe(dono.id, dono.email)))
    expect(r2.status).toBe(400)
    expect((await r2.json()).erro).toMatch(/já foi aceito/)
  })

  it('⛔⛔ convite EXPIRADO não aceita nem pelo dono do e-mail', async () => {
    await prisma.companyInvite.update({ where: { token }, data: { expiresAt: new Date(Date.now() - 1000) } })
    const r = await aceitar(req('/api/aceitar-convite', { token }, await sessaoDe(convidado.id, convidado.email)))
    expect(r.status).toBe(400)
    expect((await r.json()).erro).toMatch(/expirou/)
    expect(await prisma.userCompanyRole.count({ where: { companyId } })).toBe(0)
  })
})

describe('⭐ a tela sabe ANTES do clique quem está logado', () => {
  it('⭐⭐ o GET diz "logadoComo" e se a conta é a certa', async () => {
    const comDono = await verConvite(req(`/api/aceitar-convite?token=${token}`, undefined, await sessaoDe(dono.id, dono.email)))
    const jd = await comDono.json()
    expect(jd.logadoComo).toBe(dono.email)
    expect(jd.contaCorreta, 'a tela precisa saber ANTES de o dono apertar aceitar').toBe(false)

    const comConvidado = await verConvite(req(`/api/aceitar-convite?token=${token}`, undefined, await sessaoDe(convidado.id, convidado.email)))
    expect((await comConvidado.json()).contaCorreta).toBe(true)
  })

  it('⭐ e deslogado não inventa ninguém', async () => {
    const j = await (await verConvite(req(`/api/aceitar-convite?token=${token}`))).json()
    expect(j.logadoComo).toBeNull()
    // ⚠️ `null` (não `false`): "não sei" ≠ "conta errada" — a tela mostra login, não o susto
    expect(j.contaCorreta).toBeNull()
  })

  it('⛔ o GET não vaza nada além do necessário (nem token, nem id de ninguém)', async () => {
    const cru = JSON.stringify(await (await verConvite(req(`/api/aceitar-convite?token=${token}`))).json())
    expect(cru).not.toContain(token)
    expect(cru).not.toContain(dono.id)
    expect(cru).not.toContain(convidado.id)
  })
})

describe('⛔⛔ o login de quem entra por CONVITE é auditado', () => {
  // A perícia de 06/09 achou 144 registros de USER_LOGIN e TODOS de quem tinha linha no
  // modelo antigo (`UserCompany`). Quem entra por convite só ganha `UserCompanyRole` — e
  // sumia do log em silêncio. Era a pessoa que mais interessa vigiar.
  it('⛔⛔ o convidado tem empresa resolvível pela porta do RBAC (a que o auditor usava não)', async () => {
    await aceitar(req('/api/aceitar-convite', { token }, await sessaoDe(convidado.id, convidado.email)))
    const antigo = await prisma.userCompany.count({ where: { userId: convidado.id } })
    const novo = await prisma.userCompanyRole.count({ where: { userId: convidado.id } })
    expect(antigo, 'o convite NÃO escreve no modelo antigo').toBe(0)
    expect(novo, 'só no RBAC — por isso o auditor tem que olhar aqui').toBe(1)

    const { empresaDoUsuarioParaAuditoria } = await import('@/lib/auth/empresa-do-usuario')
    expect(await empresaDoUsuarioParaAuditoria(convidado.id, prisma)).toBe(companyId)
  })

  it('⭐ e quem só tem o modelo antigo continua resolvendo (o legado não quebrou)', async () => {
    await prisma.userCompany.create({ data: { userId: dono.id, companyId } })
    const { empresaDoUsuarioParaAuditoria } = await import('@/lib/auth/empresa-do-usuario')
    expect(await empresaDoUsuarioParaAuditoria(dono.id, prisma)).toBe(companyId)
    await prisma.userCompany.deleteMany({ where: { userId: dono.id } })
  })

  it('⚠️ conta sem empresa nenhuma devolve null — exceção NOMEADA, não tabela errada', async () => {
    const { empresaDoUsuarioParaAuditoria } = await import('@/lib/auth/empresa-do-usuario')
    expect(await empresaDoUsuarioParaAuditoria(dono.id, prisma)).toBeNull()
  })
})
