// FASE 4 (08/08) — números de lucro disponível das 3 empresas. Reusa o DRE REAL
// (fonte da verdade, com reinjeção de encargo de empréstimo) via a rota autenticada.
// Disponível = lucroLiquido(desde 1ª tx) − distribuído(bridges kind=DISTRIBUICAO).
// Órfãs (categoria retirada sem ponte) = "não classificado" (não chutar o tipo).
// Uso: DATABASE_URL=<prod> npx tsx scripts/lucro-3-empresas.ts  (no servidor, .env carrega JWT_SECRET)

import { PrismaClient } from '@prisma/client'
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { signToken } from '../lib/auth'

const prisma = new PrismaClient()
const BASE = 'http://localhost:3001'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } })
  for (const co of companies) {
    const uc = await prisma.userCompany.findFirst({ where: { companyId: co.id }, include: { user: true } })
    if (!uc) continue
    // 1ª tx da empresa (marco do período)
    const first = await prisma.transaction.findFirst({
      where: { bankAccount: { companyId: co.id } }, orderBy: { date: 'asc' }, select: { date: true },
    })
    if (!first) { console.log(`\n${co.name}: sem transações`); continue }
    const desde = first.date.toISOString().slice(0, 7)
    // DRE real do período (regime caixa, realizado)
    const token = await signToken({ sub: uc.user.id, email: uc.user.email, name: uc.user.name, role: (uc.user as any).role ?? 'ADMIN' })
    const url = `${BASE}/api/empresas/${co.id}/dre?startDate=${first.date.toISOString()}&endDate=${new Date().toISOString()}&regime=cash`
    const r = await fetch(url, { headers: { cookie: `auth_token=${token}; current_empresa_id=${co.id}` } })
    if (r.status !== 200) { console.log(`\n${co.name}: DRE HTTP ${r.status}`); continue }
    const lucro = (await r.json()).totals.lucroLiquido as number
    // distribuído = bridges kind DISTRIBUICAO desta empresa
    const bridges = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COALESCE(SUM(b.amount),0)::float AS total FROM pj_to_pf_bridges b
       JOIN transactions t ON t.id=b."pjTransactionId" JOIN bank_accounts ba ON ba.id=t."bankAccountId"
       WHERE ba."companyId"=$1 AND b.kind='DISTRIBUICAO'`, co.id)
    const distribuido = bridges[0]?.total ?? 0
    // órfãs (categoria retirada sem ponte) = não classificado
    const orf = await prisma.$queryRawUnsafe<Array<{ n: number; valor: number }>>(
      `SELECT count(*)::int AS n, COALESCE(SUM(t.amount),0)::float AS valor
       FROM transactions t JOIN bank_accounts ba ON ba.id=t."bankAccountId" JOIN categories c ON c.id=t."categoryId"
       WHERE ba."companyId"=$1 AND c."dreGroup"='DISTRIBUICAO_LUCROS' AND t.type='DEBIT' AND t.lifecycle='EFFECTED'
         AND NOT EXISTS (SELECT 1 FROM pj_to_pf_bridges b WHERE b."pjTransactionId"=t.id)`, co.id)
    const disponivel = Math.round((lucro - distribuido) * 100) / 100

    console.log(`\n════ ${co.name} (desde ${desde}) ════`)
    console.log(`  Lucro apurado:   ${brl(lucro)}`)
    console.log(`  Já distribuído:  ${brl(distribuido)}  (bridges DISTRIBUICAO)`)
    console.log(`  Disponível:      ${brl(disponivel)}${disponivel < 0 ? '  (distribuído além do apurado — tratado como adiantamento na apuração)' : ''}`)
    console.log(`  Não classificado (retiradas sem ponte): ${orf[0].n} · ${brl(orf[0].valor)}`)
  }
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
