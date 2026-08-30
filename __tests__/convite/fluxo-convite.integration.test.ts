// ⭐⭐ CONVIDAR → ACEITAR → ENTRAR NA EMPRESA CERTA COM O PAPEL CERTO (30/08/2026).
//
// ⚠️ O CASO REAL: a Marcyelle foi convidada como OPERADOR_ESTOQUE da Caçula, criou a conta
// pelo link, e caiu num workspace VAZIO — a Caçula não aparecia pra ela. Duas causas
// independentes, e a segunda é a que ninguém veria:
//
//   1. a tela de CADASTRO ignorava o `redirect` do convite e mandava sempre pra
//      /dashboard — ela nunca voltava pra aceitar. O convite ficou `acceptedAt: null`.
//   2. ⭐⭐ e mesmo TENDO aceitado, `/api/empresas` listava só por `UserCompany` (o modelo
//      ANTIGO), enquanto o aceite grava `UserCompanyRole` (o do RBAC). **O acesso
//      funcionava por baixo (as rotas de estoque respondiam 200) e a empresa não aparecia
//      no seletor.** É o "linked tem DUAS portas" de novo — checar UMA foi o bug de 14/08.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'

const CNPJ = '56565656000156'
let companyId: string, convidadaId: string, roleOperadorId: string

async function empresasQueOUserVe(userId: string): Promise<string[]> {
  // ⚠️ ESPELHA a regra de `/api/empresas`: as DUAS portas, deduplicadas. Se a rota voltar
  // a ler só uma, este teste fica verde e o bug volta — por isso o teste de baixo confere
  // o ARQUIVO da rota também.
  const [legado, porPapel] = await Promise.all([
    prisma.userCompany.findMany({ where: { userId }, select: { companyId: true } }),
    prisma.userCompanyRole.findMany({ where: { userId }, select: { companyId: true } }),
  ])
  return [...new Set([...legado, ...porPapel].map((x) => x.companyId))]
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA CONVITE' } })).id
  convidadaId = (await prisma.user.create({
    data: { email: `convidada-${Date.now()}@teste.com`, password: 'x', name: 'Convidada' },
  })).id
  const r = await prisma.role.findFirst({ where: { name: 'OPERADOR_ESTOQUE' } })
  roleOperadorId = r?.id ?? (await prisma.role.create({ data: { name: 'OPERADOR_ESTOQUE', isSystemDefault: true } })).id
})

afterEach(async () => {
  await prisma.userCompanyRole.deleteMany({ where: { userId: convidadaId } })
  await prisma.userCompany.deleteMany({ where: { userId: convidadaId } })
  await prisma.companyInvite.deleteMany({ where: { companyId } })
  await prisma.auditLog.deleteMany({ where: { companyId } }).catch(() => {})
  await prisma.user.deleteMany({ where: { id: convidadaId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ o estado que o convite TEM que criar', () => {
  it('⭐⭐ sem aceitar: a pessoa existe e NÃO vê empresa nenhuma (o bug reportado)', async () => {
    await prisma.companyInvite.create({
      data: {
        companyId, email: 'x@y.com', roleId: roleOperadorId, token: `t${Date.now()}`,
        expiresAt: new Date(Date.now() + 7 * 86_400_000), invitedById: convidadaId,
      },
    })
    expect(await empresasQueOUserVe(convidadaId)).toEqual([])
  })

  it('⭐⭐ com o vínculo do RBAC criado, ela VÊ a empresa (a 2ª causa do bug)', async () => {
    await prisma.userCompanyRole.create({ data: { userId: convidadaId, companyId, roleId: roleOperadorId } })
    // ⚠️ com a regra ANTIGA (só `UserCompany`) isto voltaria [] — acesso funcionando e
    // empresa invisível, que é exatamente o que ela viu.
    expect(await empresasQueOUserVe(convidadaId)).toEqual([companyId])
    expect(await prisma.userCompany.count({ where: { userId: convidadaId } })).toBe(0)
  })

  it('⭐ o papel aplicado é o do CONVITE, não um genérico', async () => {
    await prisma.userCompanyRole.create({ data: { userId: convidadaId, companyId, roleId: roleOperadorId } })
    const ucr = await prisma.userCompanyRole.findFirstOrThrow({
      where: { userId: convidadaId }, include: { role: { include: { permissions: { include: { permission: true } } } } },
    })
    expect(ucr.role.name).toBe('OPERADOR_ESTOQUE')
    const chaves = ucr.role.permissions.map((p) => p.permission.key).sort()
    // ⭐ SÓ estoque: nenhuma chave de financeiro
    expect(chaves).toEqual(['stock.operate', 'stock.view'])
    for (const proibida of ['transaction.view', 'dre.view', 'bank_account.view']) {
      expect(chaves).not.toContain(proibida)
    }
  })
})

describe('⭐ o fluxo do link (o que quebrou)', () => {
  it('⭐⭐ a tela de CADASTRO honra o `redirect` do convite', () => {
    // ⚠️ ela fazia `router.push("/dashboard")` FIXO, jogando fora o redirect que o convite
    // passa — a pessoa criava a conta e nunca voltava pra aceitar.
    const src = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'app/(auth)/cadastro/page.tsx'), 'utf-8',
    ) as string
    expect(src).toMatch(/searchParams\.get\('redirect'\)/)
    expect(src).not.toMatch(/router\.push\('\/dashboard'\)\s*\n\s*router\.refresh\(\)/)
  })

  it('⭐ e pré-preenche o email do convite (cadastrar com outro email nunca casaria)', () => {
    const src = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'app/(auth)/cadastro/page.tsx'), 'utf-8',
    ) as string
    expect(src).toMatch(/searchParams\.get\('email'\)/)
  })

  it('⭐⭐ `/api/empresas` lê AS DUAS portas de vínculo', () => {
    const src = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'app/api/empresas/route.ts'), 'utf-8',
    ) as string
    expect(src).toMatch(/userCompany\.findMany/)
    expect(src).toMatch(/userCompanyRole\.findMany/)
  })
})

describe('⛔⛔ o que a operadora de estoque NÃO pode ler (vazamentos fechados em 30/08)', () => {
  // ⚠️ Medido em prod com a sessão real dela: fluxo de caixa devolvia 200 com
  // "entrou: 475.739,55". `getAuthContext(request, companyId)` só prova que a pessoa é DA
  // EMPRESA — não que ela pode ver AQUILO. Faltava `requirePermission`.
  const fonte = (p: string) =>
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), p), 'utf-8') as string

  it('⛔⛔ o FLUXO DE CAIXA exige permissão de transação', () => {
    expect(fonte('app/api/empresas/[id]/fluxo-caixa/route.ts')).toMatch(/requirePermission\('transaction\.view'\)/)
  })

  it('⛔ as VENDAS também (faturamento é dado financeiro)', () => {
    expect(fonte('app/api/empresas/[id]/vendas/route.ts')).toMatch(/requirePermission\('transaction\.view'\)/)
  })

  it('⛔⛔ o JUIZ exige financeiro em ALGUMA empresa (ele é global, não dá pra escopar)', () => {
    const src = fonte('app/api/juiz/route.ts')
    expect(src).toMatch(/podeVerOJuiz/)
    // nos DOIS handlers (GET lê o relatório, POST roda o juiz)
    expect((src.match(/podeVerOJuiz\(ctx\.user\.id\)/g) ?? []).length).toBe(2)
  })
})
