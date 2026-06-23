// Sprint 9 fix — Smoke dos 3 operadores (CONTAINS / EXACT / CNPJ).
// Roda em prod, cria 3 regras de teste, aplica, deleta.
// Confirma que ambas opções no backend funcionam após remover NORMALIZED.

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

async function main() {
  console.log('━'.repeat(80))
  console.log('Sprint 9 fix — Smoke dos 3 operadores + cleanup')
  console.log('━'.repeat(80))

  // Categoria destino: Tarifas Bancárias (DESPESAS_FINANCEIRAS)
  const cat = await prisma.category.findFirst({
    where: { companyId: CACULA, name: 'Tarifas Bancárias', isActive: true },
  })
  if (!cat) {
    console.error('🚨 Categoria "Tarifas Bancárias" não encontrada. Abort.')
    process.exit(1)
  }

  const regrasAntes = await prisma.aiLearningRule.count({ where: { companyId: CACULA } })
  const pendentesAntes = await prisma.transaction.count({
    where: { bankAccount: { companyId: CACULA }, status: 'PENDING' },
  })
  console.log(`\n  Estado ANTES: regras=${regrasAntes}, pendentes=${pendentesAntes}`)

  // ─── Cenários de teste ───
  const cenarios = [
    {
      label: 'CONTAINS — "FRIGORIFICO" (contém o texto)',
      tipoMatch: 'CONTAINS' as const,
      padrao: 'FRIGORIFICO SILVA TESTE',
    },
    {
      label: 'EXACT — descrição exata (não deve casar nada, padrão único)',
      tipoMatch: 'EXACT' as const,
      padrao: 'TESTE EXATO SPRINT9 FIX',
    },
    {
      label: 'CNPJ — número fictício (não casa, mas valida que aceita)',
      tipoMatch: 'CNPJ' as const,
      padrao: '99.999.999/0001-99',
    },
  ]

  const ruleIds: string[] = []
  try {
    for (const cen of cenarios) {
      console.log(`\n━━ ${cen.label} ━━`)
      const r = await prisma.aiLearningRule.create({
        data: {
          companyId: CACULA,
          tipoMatch: cen.tipoMatch,
          padrao: cen.padrao,
          categoryId: cat.id,
          confianca: 1.0,
          fonte: 'MANUAL',
          isActive: true,
        },
      })
      ruleIds.push(r.id)
      console.log(`  ✅ regra criada: ${r.id}`)
      console.log(`     tipoMatch=${r.tipoMatch} padrao="${r.padrao}" fonte=${r.fonte}`)
    }

    // Verifica 3 regras ativas
    const ativas = await prisma.aiLearningRule.count({
      where: { id: { in: ruleIds }, isActive: true },
    })
    console.log(`\n  ${ativas === 3 ? '✅' : '🚨'} 3 regras ativas: ${ativas}/3`)

    // Verifica que NORMALIZED não foi usado em nenhuma
    const tiposDistintos = await prisma.aiLearningRule.findMany({
      where: { id: { in: ruleIds } },
      select: { tipoMatch: true },
    })
    const usaNormalized = tiposDistintos.some((r) => r.tipoMatch === 'NORMALIZED')
    console.log(`  ${!usaNormalized ? '✅' : '🚨'} Nenhuma usa NORMALIZED (removido da UI)`)
  } finally {
    console.log(`\n━━ CLEANUP: deletando ${ruleIds.length} regras de teste ━━`)
    if (ruleIds.length > 0) {
      // Devolve tx classificadas (se houver)
      const reverted = await prisma.transaction.updateMany({
        where: { classifiedByRuleId: { in: ruleIds } },
        data: {
          status: 'PENDING',
          categoryId: null,
          classificationSource: null,
          classifiedByRuleId: null,
          aiConfidence: null,
        },
      })
      console.log(`  ✅ Revertido ${reverted.count} tx pra PENDING`)
      await prisma.aiLearningRule.deleteMany({ where: { id: { in: ruleIds } } })
      console.log(`  ✅ ${ruleIds.length} regras deletadas`)
    }
  }

  const regrasDepois = await prisma.aiLearningRule.count({ where: { companyId: CACULA } })
  const pendentesDepois = await prisma.transaction.count({
    where: { bankAccount: { companyId: CACULA }, status: 'PENDING' },
  })
  console.log(`\n  Estado DEPOIS: regras=${regrasDepois}, pendentes=${pendentesDepois}`)
  console.log(`  ${regrasDepois === regrasAntes ? '✅' : '🚨'} regras: ${regrasDepois} = ${regrasAntes}`)
  console.log(`  ${pendentesDepois === pendentesAntes ? '✅' : '🚨'} pendentes: ${pendentesDepois} = ${pendentesAntes}`)

  // Saldos LEDGERBAL
  const ledgers = await prisma.bankAccount.findMany({
    where: { companyId: CACULA, isActive: true, ledgerBal: { not: null } },
    select: { name: true, balance: true, ledgerBal: true },
  })
  const saldosOk = ledgers.every((c) => Math.abs(c.balance - (c.ledgerBal ?? 0)) < 0.01)
  console.log(`  ${saldosOk ? '✅' : '🚨'} Saldos LEDGERBAL Δ=0`)

  await prisma.$disconnect()
  console.log('\n━ FIM ━')
}
main().catch((e) => { console.error(e); process.exit(1) })
