// ⭐⭐ ASSINATURA É DA EMPRESA — FUNCIONÁRIO NUNCA PAGA (30/08/2026).
//
// REGRA DE PRODUTO (do dono, vale pra todo cliente daqui pra frente):
//   · QUEM ASSINA É A EMPRESA. O plano e o trial pertencem ao CNPJ, pagos pelo dono/admin.
//   · FUNCIONÁRIO CONVIDADO **herda** o acesso da empresa: nunca tem trial próprio, nunca
//     vê banner de plano, nunca vê "assinar".
//   · Empresa inadimplente é problema do DONO. O funcionário vê, no máximo, "acesso
//     suspenso — fale com o responsável".
//
// ⚠️ O QUE ACONTECEU SEM ISSO: a Marcyelle, convidada como OPERADOR_ESTOQUE, logou e viu
// *"TRIAL 14 dias restantes · Ver planos"*. O sistema criou uma assinatura **pra ela** —
// duas vezes, aliás: no cadastro E no login (`getOrCreateSubscription` cria "por defesa").
// Apagar a dela sem fechar as duas portas seria enxugar gelo.
//
// ⚠️ E POR QUE A COLUNA `userId` CONTINUA: o Asaas (customer, checkout, webhook) resolve
// por usuário. Reescrever a integração de PAGAMENTO no mesmo passo trocaria um problema de
// regra por um risco de cobrança. A regra nova mora na LEITURA: a empresa manda; o
// `userId` vira o portador histórico de quem contratou.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export interface AssinaturaEfetiva {
  /** a assinatura que governa o acesso (pode ser de OUTRO usuário: o dono) */
  subscriptionId: string
  companyId: string | null
  planId: string
  status: string
  trialEndsAt: Date | null
  /** o usuário é o DONO desta assinatura (paga) ou herdeiro (funcionário)? */
  ehTitular: boolean
}

/** empresas do usuário — as DUAS portas de vínculo (a lição de 30/08) */
export async function empresasDoUsuario(userId: string, db: PrismaClient = defaultPrisma): Promise<string[]> {
  const [legado, porPapel] = await Promise.all([
    db.userCompany.findMany({ where: { userId }, select: { companyId: true } }),
    db.userCompanyRole.findMany({ where: { userId }, select: { companyId: true } }),
  ])
  return [...new Set([...legado, ...porPapel].map((x) => x.companyId))]
}

/**
 * A assinatura que vale pra este usuário.
 *
 * A cascata, e cada degrau tem motivo:
 *   1. a assinatura da(s) EMPRESA(s) dele → é a regra nova
 *   2. a do DONO de uma dessas empresas → cobre o histórico, enquanto `companyId` não foi
 *      preenchido em todas
 *   3. a própria, SE ele for dono/admin de alguma empresa → quem contratou
 *   4. **null** → ⭐ é o caso da Marcyelle: convidada, sem empresa própria. Sem assinatura,
 *      sem banner, sem trial. **E `null` aqui nunca vira "expirado"**: o convidado não tem
 *      o que expirar.
 */
export async function assinaturaEfetiva(
  userId: string, db: PrismaClient = defaultPrisma,
): Promise<AssinaturaEfetiva | null> {
  const empresas = await empresasDoUsuario(userId, db)
  // ⭐ usuário sem empresa nenhuma NÃO entra em fluxo de billing (item 3 do dono)
  if (empresas.length === 0) return null

  const monta = (s: { id: string; companyId: string | null; planId: string; status: string; trialEndsAt: Date | null; userId: string }): AssinaturaEfetiva => ({
    subscriptionId: s.id, companyId: s.companyId, planId: s.planId,
    status: s.status, trialEndsAt: s.trialEndsAt, ehTitular: s.userId === userId,
  })

  // 1. assinatura amarrada à empresa
  const daEmpresa = await db.subscription.findFirst({ where: { companyId: { in: empresas } } })
  if (daEmpresa) return monta(daEmpresa)

  // 2. a do DONO da empresa (histórico: `companyId` ainda não preenchido)
  const donos = await db.userCompanyRole.findMany({
    where: { companyId: { in: empresas }, role: { name: { in: ['OWNER', 'ADMIN'] } } },
    select: { userId: true },
  })
  const donosLegado = await db.userCompany.findMany({
    where: { companyId: { in: empresas }, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  })
  const idsDonos = [...new Set([...donos, ...donosLegado].map((d) => d.userId))]
  if (idsDonos.length) {
    const doDono = await db.subscription.findFirst({ where: { userId: { in: idsDonos } } })
    if (doDono) return monta(doDono)
  }

  // 3. a própria — só vale se ele for dono/admin de alguma empresa
  if (idsDonos.includes(userId)) {
    const propria = await db.subscription.findUnique({ where: { userId } })
    if (propria) return monta(propria)
  }

  return null
}

/**
 * ⭐ Este usuário pode VER/GERENCIAR plano?
 *
 * ⚠️ É o mesmo princípio da fronteira de papel dos boletos: **decisão que gasta dinheiro
 * da empresa é do dono**. Operador de estoque não assina plano, nem por engano.
 */
export async function podeGerenciarPlano(userId: string, db: PrismaClient = defaultPrisma): Promise<boolean> {
  const papeis = await db.userCompanyRole.findMany({
    where: { userId }, include: { role: { include: { permissions: { include: { permission: true } } } } },
  })
  const chaves = papeis.flatMap((p) => p.role.permissions.map((rp) => rp.permission.key))
  if (chaves.some((k) => k === '*' || k === 'company.update')) return true
  // legado: quem tem UserCompany OWNER/ADMIN
  const legado = await db.userCompany.count({ where: { userId, role: { in: ['OWNER', 'ADMIN'] } } })
  if (legado > 0) return true

  // ⚠️ QUEM JÁ TEM ASSINATURA PRÓPRIA É TITULAR — mesmo sem empresa cadastrada.
  // Pego pelos testes do Asaas: contas que contrataram plano antes de abrir empresa (o
  // admin da plataforma, contas de avaliação) seriam bloqueadas do próprio checkout. Quem
  // paga pode mexer no que paga; a regra é sobre FUNCIONÁRIO não pagar, não sobre impedir
  // cliente de gerenciar o dele.
  const propria = await db.subscription.findUnique({ where: { userId }, select: { id: true } })
  return propria != null
}

/**
 * ⭐ Amarra a assinatura à empresa do titular (backfill e uso futuro).
 * Idempotente: já amarrada, não mexe.
 */
export async function amarrarAssinaturaAEmpresa(
  userId: string, db: PrismaClient = defaultPrisma,
): Promise<{ companyId: string | null; jaEstava: boolean }> {
  const sub = await db.subscription.findUnique({ where: { userId } })
  if (!sub) return { companyId: null, jaEstava: false }
  if (sub.companyId) return { companyId: sub.companyId, jaEstava: true }

  // a empresa onde ele é DONO — é ela que a assinatura paga
  const dono = await db.userCompanyRole.findFirst({
    where: { userId, role: { name: { in: ['OWNER', 'ADMIN'] } } }, select: { companyId: true },
  })
  const donoLegado = dono ?? (await db.userCompany.findFirst({
    where: { userId, role: { in: ['OWNER', 'ADMIN'] } }, select: { companyId: true },
  }))
  if (!donoLegado) return { companyId: null, jaEstava: false }

  await db.subscription.update({ where: { id: sub.id }, data: { companyId: donoLegado.companyId } })
  return { companyId: donoLegado.companyId, jaEstava: false }
}
