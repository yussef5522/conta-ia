// ESTOQUE Fase 3 Parte 1 — PROVA de que o enforcement não trancou ninguém.
//
// Resolve a permissão pelo MESMO caminho do `getAuthContext` (UserCompanyRole → Role →
// RolePermission → Permission.key → permissionMatches). Não é mock: é a mesma leitura de
// banco e a mesma função de match que a rota usa em produção.
//
// Existe porque o risco aqui é assimétrico: uma rota que exige chave que ninguém tem
// tranca o DONO fora do próprio sistema, e isso não aparece em teste de unidade — o
// OWNER em prod tinha uma lista CONCRETA de 33 permissões (o `*` foi expandido no seed
// antigo), então `stock.view` dava 403 mesmo pra ele.
//
// USO: npx tsx scripts/prova-permissoes-estoque.ts [companyId]

import { PrismaClient } from '@prisma/client'
import { permissionMatches } from '../lib/auth/permissions'

const prisma = new PrismaClient()
const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const companyId = process.argv[2] || CACULA

const CHAVES = ['stock.view', 'stock.operate', 'stock.manage'] as const
// amostra do FINANCEIRO: o operador de estoque NÃO pode ver isto
const FINANCEIRO = ['transaction.view', 'dre.view', 'report.view', 'bank_account.view', 'category.update'] as const

async function main() {
  const empresa = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } })
  console.log(`\n═══ PROVA DE PERMISSÕES — ${empresa?.name ?? companyId} ═══\n`)

  const vinculos = await prisma.userCompanyRole.findMany({
    where: { companyId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  })
  if (vinculos.length === 0) {
    console.log('⚠️  NENHUM UserCompanyRole nesta empresa — TODA rota com requireStock daria 403.')
    process.exitCode = 1
    return
  }

  const users = await prisma.user.findMany({ where: { id: { in: vinculos.map((v) => v.userId) } }, select: { id: true, email: true } })
  const emailPorId = new Map(users.map((u) => [u.id, u.email]))

  let falhou = false
  for (const v of vinculos) {
    const perms = v.role.permissions.map((rp) => rp.permission.key)
    const email = emailPorId.get(v.userId) ?? v.userId
    console.log(`👤 ${email} — papel ${v.role.name} (${perms.length} permissões)`)
    for (const k of CHAVES) {
      const ok = permissionMatches(perms, k)
      console.log(`     ${ok ? '✅' : '❌'} ${k}`)
      // OWNER/ADMIN têm que ter as três; se faltar, o dono está trancado
      if (!ok && (v.role.name === 'OWNER' || v.role.name === 'ADMIN')) falhou = true
    }
    console.log('')
  }

  // ---- os papéis novos: o que PODE e o que NÃO PODE ----
  for (const nome of ['OPERADOR_ESTOQUE', 'LEITURA_ESTOQUE']) {
    const role = await prisma.role.findFirst({ where: { name: nome, isSystemDefault: true }, include: { permissions: { include: { permission: true } } } })
    if (!role) { console.log(`❌ papel ${nome} NÃO existe — o convite ao operador falharia.`); falhou = true; continue }
    const perms = role.permissions.map((rp) => rp.permission.key)
    console.log(`🛡️  ${nome} (${perms.length} permissões)`)
    for (const k of CHAVES) console.log(`     ${permissionMatches(perms, k) ? '✅ pode' : '🚫 não pode'} ${k}`)
    const vazando = FINANCEIRO.filter((k) => permissionMatches(perms, k))
    if (vazando.length) { console.log(`     ❌ VAZAMENTO pro financeiro: ${vazando.join(', ')}`); falhou = true }
    else console.log(`     ✅ nenhum acesso ao financeiro (${FINANCEIRO.length} chaves testadas)`)
    console.log('')
  }

  console.log(falhou ? '❌ PROVA FALHOU — NÃO migre as rotas / NÃO convide ninguém.\n' : '✅ PROVA OK — dono inteiro, operador contido.\n')
  if (falhou) process.exitCode = 1
}

main().catch((e) => { console.error('erro:', (e as Error).message); process.exit(1) }).finally(() => prisma.$disconnect())
