// FASE 3 (07/08) — PREVIEW do recálculo de saldo (DRY-RUN com ROLLBACK).
// Roda o recalcularSaldoConta REAL em todas as contas da caçula dentro de uma
// transação e desfaz tudo (rollback). Não grava nada. Mostra antes/depois/delta.
// Uso: DATABASE_URL=<prod> npx tsx scripts/fase3-preview-saldo.ts

import { PrismaClient } from '@prisma/client'
import { recalcularSaldoConta } from '../lib/balance/recalcular'

const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'

async function main() {
  const contas = await prisma.bankAccount.findMany({
    where: { companyId: CO }, select: { id: true, name: true }, orderBy: { name: 'asc' },
  })
  const results: Array<{ nome: string; antes: number; depois: number; delta: number; modo: string }> = []
  try {
    await prisma.$transaction(async (tx) => {
      for (const c of contas) {
        const r = await recalcularSaldoConta(tx as any, c.id)
        results.push({ nome: r.bankAccountName, antes: r.saldoAntes, depois: r.saldoDepois, delta: r.delta, modo: r.modo })
      }
      throw new Error('ROLLBACK_DRYRUN') // desfaz — nada é gravado
    })
  } catch (e) {
    if (!(e as Error).message.includes('ROLLBACK_DRYRUN')) throw e
  }

  console.log('\n=== PREVIEW SALDO (dry-run, nada gravado) ===')
  for (const r of results) {
    const marca = Math.abs(r.delta) > 0.005 ? '  <<< MUDA' : ''
    console.log(`  ${r.nome.padEnd(18)} antes=${String(r.antes).padStart(12)} depois=${String(r.depois).padStart(12)} delta=${String(r.delta).padStart(12)} [${r.modo}]${marca}`)
  }

  // 2.4d — os 4 PAYABLE futuros do Banrisul: seguros pra remover? (0 conciliação/vínculo)
  const futuros = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CO, bankName: { contains: 'anrisul' } },
      amount: { in: [70.02, 1478.51, 13779.73] }, date: { gt: new Date('2026-08-07T23:59:59Z') },
      lifecycle: 'PAYABLE',
    },
    select: { id: true, date: true, amount: true, externalId: true, reconcileGroupId: true, reconciledWithId: true, categoryId: true },
  })
  console.log('\n=== 2.4d — 4 PAYABLE futuros Banrisul (candidatos a remover) ===')
  for (const f of futuros) {
    const seguro = !f.reconcileGroupId && !f.reconciledWithId
    console.log(`  ${f.date.toISOString().slice(0, 10)} R$ ${f.amount} fitid=${f.externalId} conc=${f.reconcileGroupId ?? '-'}/${f.reconciledWithId ?? '-'} cat=${f.categoryId ?? '-'} ${seguro ? 'SEGURO' : 'TEM VÍNCULO!'}`)
  }
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
