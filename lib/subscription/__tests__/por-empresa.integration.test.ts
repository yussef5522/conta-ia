// ⭐⭐ ASSINATURA É DA EMPRESA — FUNCIONÁRIO NUNCA PAGA (30/08/2026).
//
// CASO REAL: a Marcyelle, convidada como OPERADOR_ESTOQUE da Caçula, logou e viu
// *"TRIAL 14 dias restantes · Ver planos"*. O sistema criou um trial **pra ela**.
//
// ⚠️ ERAM TRÊS PORTAS criando assinatura, e fechar uma só seria enxugar gelo: o cadastro,
// o LOGIN (`getOrCreateSubscription` cria "por defesa" a cada login) e o
// `/api/subscription/me`. Este teste trava a REGRA; os guards de rota travam as portas.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { assinaturaEfetiva, podeGerenciarPlano, amarrarAssinaturaAEmpresa } from '../por-empresa'

const CNPJ = '57575757000157'
let companyId: string, donoId: string, funcionarioId: string, roleOwnerId: string, roleOperadorId: string

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  companyId = (await prisma.company.create({ data: { cnpj: CNPJ, name: 'EMPRESA BILLING' } })).id
  const stamp = Date.now()
  donoId = (await prisma.user.create({ data: { email: `dono-${stamp}@t.com`, password: 'x', name: 'Dono' } })).id
  funcionarioId = (await prisma.user.create({ data: { email: `func-${stamp}@t.com`, password: 'x', name: 'Func' } })).id

  roleOwnerId = (await prisma.role.findFirst({ where: { name: 'OWNER' } }))?.id
    ?? (await prisma.role.create({ data: { name: 'OWNER', isSystemDefault: true } })).id
  roleOperadorId = (await prisma.role.findFirst({ where: { name: 'OPERADOR_ESTOQUE' } }))?.id
    ?? (await prisma.role.create({ data: { name: 'OPERADOR_ESTOQUE', isSystemDefault: true } })).id

  await prisma.userCompanyRole.create({ data: { userId: donoId, companyId, roleId: roleOwnerId } })
  await prisma.userCompanyRole.create({ data: { userId: funcionarioId, companyId, roleId: roleOperadorId } })
  // o DONO tem a assinatura, amarrada à empresa
  await prisma.subscription.create({
    data: { userId: donoId, companyId, planId: 'inteligencia', status: 'ACTIVE' },
  })
})

afterEach(async () => {
  await prisma.subscription.deleteMany({ where: { userId: { in: [donoId, funcionarioId] } } })
  await prisma.userCompanyRole.deleteMany({ where: { companyId } })
  await prisma.user.deleteMany({ where: { id: { in: [donoId, funcionarioId] } } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

describe('⭐⭐ o funcionário HERDA e não paga', () => {
  it('⭐⭐ ele enxerga a assinatura da EMPRESA, sem ser titular', async () => {
    const a = await assinaturaEfetiva(funcionarioId, prisma)
    expect(a).not.toBeNull()
    expect(a!.status).toBe('ACTIVE')
    expect(a!.companyId).toBe(companyId)
    expect(a!.ehTitular).toBe(false) // ⭐ herda, não é dele
  })

  it('⭐⭐ e NÃO tem assinatura própria — nem é criada por consultar', async () => {
    // ⚠️ `assinaturaEfetiva` não cria nada. Era `getOrCreateSubscription` que criava, e
    // foi por isso que ela ganhou trial no primeiro login.
    await assinaturaEfetiva(funcionarioId, prisma)
    expect(await prisma.subscription.findUnique({ where: { userId: funcionarioId } })).toBeNull()
  })

  it('⭐⭐ não pode gerenciar plano (checkout e /assinar recusam)', async () => {
    expect(await podeGerenciarPlano(funcionarioId, prisma)).toBe(false)
  })

  it('⭐ o DONO continua vendo o plano dele normalmente', async () => {
    const a = await assinaturaEfetiva(donoId, prisma)
    expect(a!.ehTitular).toBe(true)
    expect(await podeGerenciarPlano(donoId, prisma)).toBe(true)
  })
})

describe('⭐ usuário SEM empresa nenhuma não entra em billing', () => {
  it('⭐⭐ devolve null — sem banner, sem trial, sem "assinar"', async () => {
    const solto = await prisma.user.create({ data: { email: `solto-${Date.now()}@t.com`, password: 'x', name: 'S' } })
    expect(await assinaturaEfetiva(solto.id, prisma)).toBeNull()
    await prisma.user.delete({ where: { id: solto.id } })
  })

  it('⚠️ SEM assinatura ≠ EXPIRADO — o convidado não tem o que expirar', async () => {
    // ⚠️ marcar "expirado" o jogaria em /assinar, que é a tela que ele nunca deveria ver.
    const a = await assinaturaEfetiva(funcionarioId, prisma)
    expect(a?.status).not.toBe('EXPIRED')
  })
})

describe('⭐ multi-empresa: herda POR EMPRESA', () => {
  it('⭐⭐ a assinatura vem da empresa em que ele está', async () => {
    const outra = await prisma.company.create({ data: { cnpj: '58585858000158', name: 'OUTRA' } })
    const dono2 = await prisma.user.create({ data: { email: `dono2-${Date.now()}@t.com`, password: 'x', name: 'D2' } })
    await prisma.userCompanyRole.create({ data: { userId: dono2.id, companyId: outra.id, roleId: roleOwnerId } })
    await prisma.subscription.create({ data: { userId: dono2.id, companyId: outra.id, planId: 'inicio', status: 'TRIAL', trialEndsAt: new Date(Date.now() + 5 * 86_400_000) } })

    // o funcionário só está na 1ª → herda a dela (ACTIVE/inteligencia), não a da outra
    const a = await assinaturaEfetiva(funcionarioId, prisma)
    expect(a!.companyId).toBe(companyId)
    expect(a!.planId).toBe('inteligencia')

    await prisma.subscription.deleteMany({ where: { userId: dono2.id } })
    await prisma.userCompanyRole.deleteMany({ where: { companyId: outra.id } })
    await prisma.user.delete({ where: { id: dono2.id } })
    await prisma.company.delete({ where: { id: outra.id } })
  })
})

describe('⭐ amarrar a assinatura à empresa (backfill)', () => {
  it('amarra na empresa onde o titular é DONO', async () => {
    await prisma.subscription.update({ where: { userId: donoId }, data: { companyId: null } })
    const r = await amarrarAssinaturaAEmpresa(donoId, prisma)
    expect(r.companyId).toBe(companyId)
    expect((await prisma.subscription.findUniqueOrThrow({ where: { userId: donoId } })).companyId).toBe(companyId)
  })

  it('⚠️ idempotente: já amarrada, não mexe', async () => {
    const r = await amarrarAssinaturaAEmpresa(donoId, prisma)
    expect(r.jaEstava).toBe(true)
  })

  it('⚠️ funcionário não ganha amarração (ele não tem assinatura pra amarrar)', async () => {
    const r = await amarrarAssinaturaAEmpresa(funcionarioId, prisma)
    expect(r.companyId).toBeNull()
  })
})

describe('⛔ as portas que criavam assinatura estão fechadas', () => {
  const fonte = (p: string) =>
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), p), 'utf-8') as string

  it('⛔⛔ o LOGIN não cria mais (era a porta que recriava a cada acesso)', () => {
    const src = fonte('app/api/auth/login/route.ts')
    expect(src).toMatch(/assinaturaEfetiva/)
    // ⚠️ o teste pegou a si mesmo na 1ª rodada: a chamada antiga é CITADA no comentário
    // que explica o fix. Olha CÓDIGO, não comentário.
    const codigo = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')
    expect(codigo).not.toMatch(/getOrCreateSubscription\(user\.id\)/)
  })

  it('⛔ o /api/subscription/me não cria e devolve null pro funcionário', () => {
    const src = fonte('app/api/subscription/me/route.ts')
    expect(src).toMatch(/assinaturaEfetiva/)
    expect(src).toMatch(/subscription: null/)
  })

  it('⛔ o CHECKOUT (pix e cartão) exige quem pode gerenciar plano', () => {
    for (const p of ['app/api/subscription/checkout/pix/route.ts', 'app/api/subscription/checkout/cartao/route.ts']) {
      expect(fonte(p), p).toMatch(/podeGerenciarPlano/)
    }
  })

  it('⛔ o BANNER de trial some pra quem não gerencia plano', () => {
    expect(fonte('components/layout/trial-banner.tsx')).toMatch(/podeGerenciarPlano/)
  })
})
