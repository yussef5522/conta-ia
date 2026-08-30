// ⭐⭐ ASSINATURA É DA EMPRESA (30/08/2026) — backfill + limpeza do trial de funcionário.
//
// 1. AMARRA cada assinatura existente à empresa onde o titular é DONO/ADMIN.
// 2. REMOVE a assinatura de quem é só FUNCIONÁRIO convidado (não é dono de empresa
//    nenhuma) — ela nunca deveria ter existido: quem paga é a empresa.
//
// ⚠️ Só apaga assinatura de quem NÃO é dono de nada. Assinatura de dono não se toca aqui
// nem por engano — é a relação de cobrança dele com o Asaas.
//
//   DRY-RUN:  npx tsx scripts/assinatura-por-empresa.ts
//   APLICAR:  npx tsx scripts/assinatura-por-empresa.ts --aplicar

import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { PrismaClient } from '@prisma/client'
import { amarrarAssinaturaAEmpresa } from '../lib/subscription/por-empresa'

const db = new PrismaClient()
const APLICAR = process.argv.includes('--aplicar')

async function main() {
  console.log(`\n⭐ ASSINATURA POR EMPRESA${APLICAR ? '  [APLICANDO]' : '  [DRY-RUN]'}\n`)

  const subs = await db.subscription.findMany({ orderBy: { createdAt: 'asc' } })
  const users = await db.user.findMany({ where: { id: { in: subs.map((s) => s.userId) } }, select: { id: true, email: true } })
  const email = new Map(users.map((u) => [u.id, u.email]))

  const paraAmarrar: Array<{ id: string; email: string; companyId: string }> = []
  const paraRemover: Array<{ id: string; email: string; status: string }> = []
  /** contas sem empresa nenhuma — NÃO se toca (ver o comentário no laço) */
  const semVinculo: Array<{ email: string; status: string }> = []

  for (const s of subs) {
    // é dono/admin de alguma empresa?
    const [porPapel, legado] = await Promise.all([
      db.userCompanyRole.findFirst({ where: { userId: s.userId, role: { name: { in: ['OWNER', 'ADMIN'] } } }, select: { companyId: true } }),
      db.userCompany.findFirst({ where: { userId: s.userId, role: { in: ['OWNER', 'ADMIN'] } }, select: { companyId: true } }),
    ])
    const empresaDele = porPapel?.companyId ?? legado?.companyId ?? null

    if (empresaDele) {
      if (!s.companyId) paraAmarrar.push({ id: s.id, email: email.get(s.userId) ?? '?', companyId: empresaDele })
    } else {
      // ⚠️⚠️ "NÃO É DONO" ≠ "É FUNCIONÁRIO", e o dry-run provou: a régua antiga marcava 5
      // pra remoção — incluindo o **admin da plataforma** (GRANTED), uma conta de teste e
      // um segundo email do dono. Nenhum deles é funcionário: são contas SEM empresa
      // nenhuma, e apagar a assinatura delas não tem nada a ver com a regra pedida.
      //
      // Funcionário é quem ESTÁ numa empresa E não é dono dela. Conta sem vínculo fica
      // como está — mexer nela seria dano colateral de um script de limpeza.
      const membroDe = await db.userCompanyRole.count({ where: { userId: s.userId } })
      const membroLegado = await db.userCompany.count({ where: { userId: s.userId } })
      if (membroDe + membroLegado > 0) {
        paraRemover.push({ id: s.id, email: email.get(s.userId) ?? '?', status: s.status })
      } else {
        semVinculo.push({ email: email.get(s.userId) ?? '?', status: s.status })
      }
    }
  }

  console.log(`=== AMARRAR À EMPRESA (${paraAmarrar.length}) ===`)
  for (const a of paraAmarrar) console.log(`  ${a.email.padEnd(36)} → empresa ${a.companyId.slice(-8)}`)

  console.log(`\n=== REMOVER — FUNCIONÁRIO (está numa empresa, não é dono) (${paraRemover.length}) ===`)
  for (const r of paraRemover) console.log(`  ${r.email.padEnd(36)} · ${r.status}`)

  console.log(`\n=== NÃO SE TOCA — conta sem empresa nenhuma (${semVinculo.length}) ===`)
  for (const r of semVinculo) console.log(`  ${r.email.padEnd(36)} · ${r.status}`)

  if (!APLICAR) {
    console.log('\n  (dry-run — rode com --aplicar)\n')
    await db.$disconnect()
    return
  }

  for (const a of paraAmarrar) {
    const sub = await db.subscription.findUnique({ where: { id: a.id } })
    if (sub) await amarrarAssinaturaAEmpresa(sub.userId, db)
  }
  if (paraRemover.length) {
    await db.subscription.deleteMany({ where: { id: { in: paraRemover.map((r) => r.id) } } })
  }
  console.log(`\n  ✓ ${paraAmarrar.length} amarradas · ${paraRemover.length} removidas`)

  const depois = await db.subscription.findMany({ select: { userId: true, companyId: true, status: true } })
  const semEmpresa = depois.filter((d) => !d.companyId).length
  console.log(`  estado final: ${depois.length} assinaturas · ${semEmpresa} ainda sem empresa amarrada\n`)
  await db.$disconnect()
}
main().catch((e) => { console.error('ERRO:', e.message); process.exit(1) })
