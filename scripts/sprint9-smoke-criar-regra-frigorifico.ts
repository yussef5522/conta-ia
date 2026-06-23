// Sprint 9 — smoke test: criar regra FRIGORIFICO → Compras Mercadoria
// e depois APAGAR pra deixar Cacula como estava (0 regras).
//
// Read-write em prod (com cleanup garantido no finally).
// Reusa o endpoint create-and-apply via fetch direto pra simular a UI.

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const CATEGORIA_COMPRAS_MERCADORIA = 'cmq17yapy00gzrndljp1jic5q' // achar via query
const prisma = new PrismaClient()

async function main() {
  console.log('━'.repeat(80))
  console.log('Sprint 9 — Smoke: criar regra teste + cleanup')
  console.log('━'.repeat(80))

  // 1) Acha a categoria "Compras Mercadoria" real
  const cat = await prisma.category.findFirst({
    where: { companyId: CACULA, name: 'Compras Mercadoria', isActive: true },
  })
  if (!cat) {
    console.error('🚨 Categoria "Compras Mercadoria" não encontrada na Cacula. Abort.')
    process.exit(1)
  }
  console.log(`  Categoria destino: ${cat.name} (${cat.id}, ${cat.dreGroup})`)

  // 2) Conta regras ANTES
  const regrasAntes = await prisma.aiLearningRule.count({ where: { companyId: CACULA } })
  console.log(`  Regras ANTES: ${regrasAntes}`)

  // 3) Conta pendentes ANTES
  const pendentesAntes = await prisma.transaction.count({
    where: {
      bankAccount: { companyId: CACULA },
      status: 'PENDING',
    },
  })
  console.log(`  Pendentes ANTES: ${pendentesAntes}`)

  // 4) Conta tx que batem com FRIGORIFICO no PENDING
  const pendentesQueBatemAntes = await prisma.transaction.count({
    where: {
      bankAccount: { companyId: CACULA },
      status: 'PENDING',
      description: { contains: 'FRIGORIFICO' },
    },
  })
  console.log(`  Pendentes que batem FRIGORIFICO ANTES: ${pendentesQueBatemAntes}`)

  // 5) Cria regra direto via Prisma (simulando o que o endpoint faz)
  const PADRAO = 'FRIGORIFICO SILVA' // mais específico pra evitar conflito com regra real do Yussef
  let ruleId: string | null = null
  try {
    const rule = await prisma.aiLearningRule.create({
      data: {
        companyId: CACULA,
        tipoMatch: 'CONTAINS',
        padrao: PADRAO,
        categoryId: cat.id,
        confianca: 1.0,
        fonte: 'MANUAL',
        isActive: true,
      },
    })
    ruleId = rule.id
    console.log(`\n  ✅ Regra criada: ${rule.id} (padrao=${PADRAO})`)

    // 6) Aplica retroativamente
    const where = {
      bankAccount: { companyId: CACULA },
      status: 'PENDING' as const,
      lifecycle: 'EFFECTED' as const,
      description: { contains: PADRAO },
    }
    const matching = await prisma.transaction.findMany({ where, select: { id: true, amount: true } })
    if (matching.length > 0) {
      await prisma.transaction.updateMany({
        where: { id: { in: matching.map((t) => t.id) } },
        data: {
          categoryId: cat.id,
          status: 'RECONCILED',
          classificationSource: 'RULE',
          classifiedByRuleId: rule.id,
          aiConfidence: 1.0,
        },
      })
      await prisma.aiLearningRule.update({
        where: { id: rule.id },
        data: { vezesAplicada: matching.length },
      })
      console.log(`  ✅ Aplicou em ${matching.length} tx (total R$ ${matching.reduce((s, t) => s + t.amount, 0).toFixed(2)})`)
    } else {
      console.log(`  ℹ Nenhuma tx pendente batia com "${PADRAO}" — regra ficou só pra futuras.`)
    }

    // 7) Verifica que regra está ativa + classificou
    const ruleVerif = await prisma.aiLearningRule.findUnique({ where: { id: rule.id } })
    console.log(`\n  Verificação:`)
    console.log(`    rule.isActive: ${ruleVerif?.isActive}`)
    console.log(`    rule.fonte: ${ruleVerif?.fonte}`)
    console.log(`    rule.confianca: ${ruleVerif?.confianca}`)
    console.log(`    rule.vezesAplicada: ${ruleVerif?.vezesAplicada}`)
  } finally {
    // 8) CLEANUP: reverter
    if (ruleId) {
      console.log(`\n━━ CLEANUP: revertendo regra ${ruleId} ━━`)
      // Devolve tx classificadas pra PENDING
      const reverted = await prisma.transaction.updateMany({
        where: { classifiedByRuleId: ruleId },
        data: {
          status: 'PENDING',
          categoryId: null,
          classificationSource: null,
          classifiedByRuleId: null,
          aiConfidence: null,
        },
      })
      console.log(`  ✅ Revertido ${reverted.count} tx pra PENDING`)
      await prisma.aiLearningRule.delete({ where: { id: ruleId } })
      console.log(`  ✅ Regra deletada`)
    }

    // 9) Confirma estado FINAL = igual ao inicial
    const regrasDepois = await prisma.aiLearningRule.count({ where: { companyId: CACULA } })
    const pendentesDepois = await prisma.transaction.count({
      where: { bankAccount: { companyId: CACULA }, status: 'PENDING' },
    })
    console.log(`\n  Regras DEPOIS: ${regrasDepois} (antes: ${regrasAntes}) ${regrasDepois === regrasAntes ? '✅' : '🚨'}`)
    console.log(`  Pendentes DEPOIS: ${pendentesDepois} (antes: ${pendentesAntes}) ${pendentesDepois === pendentesAntes ? '✅' : '🚨'}`)
  }

  await prisma.$disconnect()
  console.log('\n━ FIM ━')
}
main().catch((e) => { console.error(e); process.exit(1) })
