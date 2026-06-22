// Sprint 2 Regras-Cadastro — apaga TODAS as AiLearningRule da Cacula.
// FK Restrict em transactions.classifiedByRuleId: limpar primeiro, depois deletar.
// CONFIRMED=true pra mutar.

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

async function main() {
  const confirmed = process.argv.includes('--confirmed=true')
  console.log('━'.repeat(80))
  console.log(`SPRINT 2 — Apagar TODAS as regras da Cacula (${confirmed ? 'APLICAR' : 'DRY-RUN'})`)
  console.log('━'.repeat(80))

  // Pré-contagem
  const regrasAntes = await prisma.aiLearningRule.count({ where: { companyId: CACULA } })
  const txComRegra = await prisma.transaction.count({
    where: {
      bankAccount: { companyId: CACULA },
      classifiedByRuleId: { not: null },
    },
  })
  console.log(`\nANTES:`)
  console.log(`  AiLearningRule total (Cacula):  ${regrasAntes}`)
  console.log(`  Transactions com classifiedByRuleId set: ${txComRegra}`)
  // Cacula NÃO deve afetar outras empresas
  const regrasOutrasEmpresas = await prisma.aiLearningRule.count({
    where: { companyId: { not: CACULA } },
  })
  console.log(`  AiLearningRule outras empresas: ${regrasOutrasEmpresas} (NÃO tocar)`)

  if (!confirmed) {
    console.log(`\n⏸ DRY-RUN — nada mutado.`)
    console.log(`Pra aplicar: --confirmed=true`)
    await prisma.$disconnect()
    return
  }

  // Lista IDs das regras Cacula
  const regrasCacula = await prisma.aiLearningRule.findMany({
    where: { companyId: CACULA },
    select: { id: true },
  })
  const ruleIds = regrasCacula.map((r) => r.id)

  // Atomic: nullify classifiedByRuleId nas tx Cacula que apontam pras regras + delete
  await prisma.$transaction(async (db) => {
    // 1) Nullify classifiedByRuleId em tx Cacula apontando pra essas regras
    const txUpdate = await db.transaction.updateMany({
      where: {
        bankAccount: { companyId: CACULA },
        classifiedByRuleId: { in: ruleIds },
      },
      data: {
        classifiedByRuleId: null,
        // Categoria das tx NÃO muda — só limpa o vínculo com a regra
      },
    })
    console.log(`\n  1) classifiedByRuleId nullified em ${txUpdate.count} transactions (Cacula)`)

    // 2) Delete todas as regras da Cacula
    const del = await db.aiLearningRule.deleteMany({
      where: { companyId: CACULA },
    })
    console.log(`  2) deleteMany aiLearningRule (Cacula): ${del.count} regras apagadas`)
  })

  // Verificação pós
  const regrasDepois = await prisma.aiLearningRule.count({ where: { companyId: CACULA } })
  const regrasOutrasEmpresasDepois = await prisma.aiLearningRule.count({
    where: { companyId: { not: CACULA } },
  })
  const txComRegraDepois = await prisma.transaction.count({
    where: {
      bankAccount: { companyId: CACULA },
      classifiedByRuleId: { not: null },
    },
  })
  console.log(`\nDEPOIS:`)
  console.log(`  AiLearningRule Cacula:           ${regrasDepois}    (esperado 0)`)
  console.log(`  AiLearningRule outras empresas:  ${regrasOutrasEmpresasDepois}    (intacta = ${regrasOutrasEmpresas})`)
  console.log(`  Transactions Cacula com regra:   ${txComRegraDepois}    (esperado 0)`)

  // Sanity: tx com categoryId set continuam tendo categoria
  const txComCategoria = await prisma.transaction.count({
    where: {
      bankAccount: { companyId: CACULA },
      categoryId: { not: null },
    },
  })
  console.log(`  Transactions Cacula com categoryId: ${txComCategoria} (intacto, não recategorizou nada)`)

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log('FASE 1 APLICADA.')
}

main().catch((e) => { console.error(e); process.exit(1) })
