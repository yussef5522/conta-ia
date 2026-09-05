// ⭐⭐ COSTURA DE FORNECEDOR DUPLICADO — a régua da RM2, generalizada (05/09/2026).
//
// ⛔ A CAUSA É SEMPRE A MESMA: o seletor mostra o que existe, o dono não acha, cadastra de
// novo. A RM2 foi o primeiro caso; o CASPER é o segundo — e ele manda **3 notas por semana**,
// então cada semana sem costurar é mais nota caindo em cadastro diferente.
//
// ⭐ A REGRA DE FUNDO, do dono: *fusão errada de fornecedor é pior que duplicata visível.*
// Por isso este script **não decide quem é quem** — recebe o sobrevivente e os absorvidos
// por ID (REGRA 8) e mostra tudo que está pendurado antes de mover.
//
//   npx tsx scripts/costurar-fornecedor-duplicado.ts --manter=<id> --absorver=<id,id,...> [--apply]

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix — REGRA 8
const APLICAR = process.argv.includes('--apply')
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? ''
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)
  const manterId = arg('manter')
  const absorverIds = arg('absorver').split(',').map((s) => s.trim()).filter(Boolean)
  if (!manterId || !absorverIds.length) throw new Error('Informe --manter=<id> e --absorver=<id,id>.')
  if (absorverIds.includes(manterId)) throw new Error('O sobrevivente não pode estar na lista de absorvidos.')

  const manter = await prisma.supplier.findFirst({ where: { id: manterId, companyId: COMPANY } })
  if (!manter) throw new Error(`Fornecedor ${manterId} não existe nesta empresa.`)

  console.log(`\n=== COSTURA DE FORNECEDOR — ${APLICAR ? 'APLICANDO' : 'PREVIEW'} ===\n`)
  console.log(`MANTÉM  "${manter.razaoSocial}" · ${manter.id}`)
  console.log(`        cnpj=${manter.cnpj ?? '—'} · fonte=${manter.fonte} · criado ${manter.createdAt.toISOString().slice(0, 10)}\n`)

  let totalTx = 0, totalRegras = 0, totalRec = 0
  for (const id of absorverIds) {
    const f = await prisma.supplier.findFirst({ where: { id, companyId: COMPANY } })
    if (!f) { console.log(`  ⛔ ${id} não existe nesta empresa — fora da costura.`); continue }
    const [txs, regras, rec] = await Promise.all([
      prisma.transaction.findMany({ where: { supplierId: id }, select: { id: true, amount: true, date: true, lifecycle: true, description: true } }),
      prisma.aiLearningRule.count({ where: { supplierId: id } }),
      prisma.recurringSchedule.count({ where: { supplierId: id } }),
    ])
    totalTx += txs.length; totalRegras += regras; totalRec += rec
    console.log(`  ABSORVE "${f.razaoSocial}" · ${f.id}`)
    console.log(`          cnpj=${f.cnpj ?? '—'} · fonte=${f.fonte} · criado ${f.createdAt.toISOString().slice(0, 10)}`)
    console.log(`          ${txs.length} transação(ões) · ${regras} regra(s) · ${rec} recorrência(s)`)
    for (const t of txs.slice(0, 8)) console.log(`            ${t.date.toISOString().slice(0, 10)} ${brl(t.amount).padStart(12)} ${t.lifecycle} "${t.description.slice(0, 34)}"`)

    // ⚠️ CNPJ diferente é a linha vermelha: matriz e filial têm o mesmo nome e CNPJs
    // diferentes, e fundir mandaria dívida pro CNPJ errado sem ninguém perceber.
    const a = (manter.cnpj ?? '').replace(/\D/g, ''), b = (f.cnpj ?? '').replace(/\D/g, '')
    if (a && b && a !== b) throw new Error(`⛔ ABORTADO: "${f.razaoSocial}" tem CNPJ ${b} e o sobrevivente tem ${a}. CNPJs diferentes NUNCA se fundem.`)
  }

  console.log(`\n  total a mover: ${totalTx} transação(ões) · ${totalRegras} regra(s) · ${totalRec} recorrência(s)`)
  if (totalTx === 0 && totalRegras === 0 && totalRec === 0) {
    console.log('  ⭐ nada pendurado nos absorvidos — a costura é só desativar (nenhum dinheiro se move).')
  }

  if (!APLICAR) { console.log('\n⛔ NADA FOI GRAVADO. Rode com --apply.\n'); return }

  const r = await prisma.$transaction(async (tx) => {
    const t = await tx.transaction.updateMany({ where: { supplierId: { in: absorverIds } }, data: { supplierId: manterId } })
    const g = await tx.aiLearningRule.updateMany({ where: { supplierId: { in: absorverIds } }, data: { supplierId: manterId } })
    const c = await tx.recurringSchedule.updateMany({ where: { supplierId: { in: absorverIds } }, data: { supplierId: manterId } })
    // ⚠️ DESATIVA, não apaga: o rastro de que existiu responde "cadê o outro?" daqui a meses.
    // E `isActive=false` é o que tira do seletor (senão a duplicata volta a ser oferecida).
    for (const id of absorverIds) {
      const f = await tx.supplier.findFirst({ where: { id, companyId: COMPANY }, select: { notes: true } })
      if (!f) continue
      await tx.supplier.update({
        where: { id },
        data: { isActive: false, notes: [f.notes, `duplicata costurada em 05/09/2026 — absorvido por ${manterId}`].filter(Boolean).join(' · ') },
      })
    }
    return { tx: t.count, regras: g.count, rec: c.count }
  })

  const sobrou = await prisma.transaction.count({ where: { supplierId: { in: absorverIds } } })
  console.log(`\n✓ movidas: ${r.tx} tx · ${r.regras} regra(s) · ${r.rec} recorrência(s)`)
  console.log(`✓ sobrou nos absorvidos: ${sobrou} (tem que ser 0) · ${absorverIds.length} cadastro(s) desativado(s)\n`)
}

main().finally(() => prisma.$disconnect())
