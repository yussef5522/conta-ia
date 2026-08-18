// VENDAS FASE 1 (17/08/2026) — move as vendas em dinheiro do cofre da Cacula pra
// categoria dedicada "Venda em dinheiro" (decisão do dono, preview confirmado).
// - 76 tx cofre "Receita de Vendas" → "Venda em dinheiro" (DRE-neutro, RECEITA_BRUTA)
// - 1 tx (1.350, 18/07 "receita de venda academia dinheiro") → "Aporte de Capital"
//   (é aporte, não venda da loja — reduz RECEITA_BRUTA de julho em 1.350: correção)
// Cria também "Estorno de venda (dinheiro)" (nasce vazia). IDEMPOTENTE: rerun = 0
// move (não sobra tx em Receita de Vendas no cofre). Snapshot RECEITA_BRUTA por
// mês ANTES e DEPOIS pra provar o efeito. Rastro = este log + pg_dump + commit.
//
// Uso: npx tsx scripts/mover-venda-dinheiro-cacula.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const COFRE = 'cmq2o25qe0001y2faydl1yrp5'
const APORTE_CAT = 'cat_aporte_capital_cacula'
const ACADEMIA_TX = 'cmrzb677c02fkm8hd7nuijoxm' // 1.350, 18/07 — aporte, não venda
const RECEITAS_OPERACIONAIS = 'cmq17yapu00gvrndle1eutmws' // parent (mesmo de Receita de Vendas)

const MESES: [string, string, string][] = [
  ['junho', '2026-06-01', '2026-07-01'],
  ['julho', '2026-07-01', '2026-08-01'],
  ['agosto', '2026-08-01', '2026-09-01'],
]

// RECEITA_BRUTA do mês = Σ signedAmount de tx cuja categoria é RECEITA_BRUTA
// (empresa inteira, todas as contas — é o número do DRE).
async function receitaBrutaPorMes(): Promise<Record<string, number>> {
  const cats = await prisma.category.findMany({ where: { companyId: CO, dreGroup: 'RECEITA_BRUTA' }, select: { id: true } })
  const ids = cats.map((c) => c.id)
  const out: Record<string, number> = {}
  for (const [nome, ini, fim] of MESES) {
    const txs = await prisma.transaction.findMany({
      where: { categoryId: { in: ids }, bankAccount: { companyId: CO }, date: { gte: new Date(ini), lt: new Date(fim) } },
      select: { amount: true, type: true },
    })
    out[nome] = Math.round(txs.reduce((s, t) => s + (t.type === 'CREDIT' ? t.amount : -t.amount), 0) * 100) / 100
  }
  return out
}

async function main() {
  const antes = await receitaBrutaPorMes()

  // 1. Categorias (idempotente)
  const vendaDinheiro =
    (await prisma.category.findFirst({ where: { companyId: CO, name: 'Venda em dinheiro' } })) ??
    (await prisma.category.create({
      data: { companyId: CO, name: 'Venda em dinheiro', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentId: RECEITAS_OPERACIONAIS, isActive: true, color: '#10b981' },
    }))
  const estornoDinheiro =
    (await prisma.category.findFirst({ where: { companyId: CO, name: 'Estorno de venda (dinheiro)' } })) ??
    (await prisma.category.create({
      data: { companyId: CO, name: 'Estorno de venda (dinheiro)', type: 'INCOME', dreGroup: 'RECEITA_BRUTA', parentId: RECEITAS_OPERACIONAIS, isActive: true, color: '#f59e0b' },
    }))
  console.log(`categorias: "Venda em dinheiro"=${vendaDinheiro.id} · "Estorno de venda (dinheiro)"=${estornoDinheiro.id}`)

  const rdv = await prisma.category.findFirst({ where: { companyId: CO, name: 'Receita de Vendas', dreGroup: 'RECEITA_BRUTA' }, select: { id: true } })

  // 2. Academia (1.350) → Aporte de Capital (fora de RECEITA_BRUTA). Só se ainda em RDV.
  const academia = await prisma.transaction.findFirst({ where: { id: ACADEMIA_TX, categoryId: rdv!.id } })
  if (academia) {
    await prisma.transaction.update({ where: { id: ACADEMIA_TX }, data: { categoryId: APORTE_CAT, classificationSource: 'MANUAL', aiConfidence: 1.0 } })
    console.log(`  → 1.350 (18/07) movida pra "Aporte de Capital" (correção do dono: aporte, não venda)`)
  } else {
    console.log(`  = 1.350 já não está em Receita de Vendas (idempotente)`)
  }

  // 3. As demais vendas em dinheiro do cofre (Receita de Vendas) → Venda em dinheiro
  const mov = await prisma.transaction.updateMany({
    where: { bankAccountId: COFRE, categoryId: rdv!.id },
    data: { categoryId: vendaDinheiro.id, classificationSource: 'MANUAL', aiConfidence: 1.0 },
  })
  console.log(`  → ${mov.count} tx do cofre movidas pra "Venda em dinheiro" (correção do dono)`)

  const depois = await receitaBrutaPorMes()

  // 4. PROVA
  console.log('\n===== PROVA: RECEITA_BRUTA por mês (antes → depois) =====')
  for (const [nome] of MESES) {
    const d = Math.round((depois[nome] - antes[nome]) * 100) / 100
    const tag = d === 0 ? 'INALTERADO ✓' : `Δ ${d} (correção academia)`
    console.log(`  ${nome}: ${antes[nome].toFixed(2)} → ${depois[nome].toFixed(2)}   ${tag}`)
  }
  const nVenda = await prisma.transaction.count({ where: { bankAccountId: COFRE, categoryId: vendaDinheiro.id } })
  const nSobra = await prisma.transaction.count({ where: { bankAccountId: COFRE, categoryId: rdv!.id } })
  const nAporte = await prisma.transaction.count({ where: { id: ACADEMIA_TX, categoryId: APORTE_CAT } })
  console.log(`\n  cofre em "Venda em dinheiro": ${nVenda}  ·  sobra em "Receita de Vendas" (cofre): ${nSobra}  ·  1.350 em "Aporte": ${nAporte}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('[mover-venda-dinheiro] erro:', (e as Error).message)
  process.exit(1)
})
