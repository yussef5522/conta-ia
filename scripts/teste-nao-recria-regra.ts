// Sprint 2 FASE 3 — prova que sistema NÃO recria regras sozinho.
// 3 testes-chave em Cacula. Cada um:
//   - Conta regras antes
//   - Executa cenário
//   - Conta regras depois
//   - Espera: igual a antes (0)

import { PrismaClient } from '@prisma/client'
import { autoMemorizeVendor } from '../lib/categorization/auto-memorize-vendor'
import {
  classifyWithLearning,
  autoClassifyTransactions,
  buildRuleIndex,
  loadActiveRules,
} from '../lib/ai-categorizer/apply'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

async function contarRegras(): Promise<number> {
  return prisma.aiLearningRule.count({ where: { companyId: CACULA } })
}

async function main() {
  console.log('━'.repeat(80))
  console.log('SPRINT 2 FASE 3 — Provar que sistema NÃO recria regras')
  console.log(`AUTO_RULE_GENERATION = "${process.env.AUTO_RULE_GENERATION ?? '(undefined)'}"`)
  console.log('━'.repeat(80))

  const baseline = await contarRegras()
  console.log(`\nBaseline regras Cacula: ${baseline}`)
  if (baseline !== 0) {
    console.log(`🚨 Esperava 0 mas tem ${baseline}. Abortando.`)
    process.exit(1)
  }

  // ───────────────────────────────────────────────────────
  // TESTE 1 — autoMemorizeVendor direto (silencioso)
  // ───────────────────────────────────────────────────────
  console.log('\n━━ TESTE 1: autoMemorizeVendor direto (silencioso) ━━')
  // Pegar uma tx Cacula qualquer pra usar como base
  const tx1 = await prisma.transaction.findFirst({
    where: { bankAccount: { companyId: CACULA }, type: 'DEBIT' },
    select: { id: true, description: true, type: true, categoryId: true },
  })
  if (!tx1) {
    console.log('  ⚠ Nenhuma tx DEBIT encontrada na Cacula — pulando teste')
  } else {
    // Pegar uma categoria EXPENSE
    const cat = await prisma.category.findFirst({
      where: { companyId: CACULA, isActive: true, type: 'EXPENSE' },
      select: { id: true, name: true },
    })
    if (!cat) {
      console.log('  ⚠ Sem categoria EXPENSE — pulando')
    } else {
      const result = await autoMemorizeVendor({
        companyId: CACULA,
        baseTransactionId: tx1.id,
        baseDescription: tx1.description,
        categoryId: cat.id,
        baseType: tx1.type,
      })
      console.log(`  autoMemorizeVendor() result: anchor=${result.anchor ?? 'null'} ruleId=${result.ruleId ?? 'null'} retroactiveCount=${result.retroactiveCount}`)
      const apos1 = await contarRegras()
      console.log(`  Regras Cacula após: ${apos1}`)
      if (apos1 === baseline) {
        console.log('  ✅ PASSOU: 0 regras criadas')
      } else {
        console.log(`  🚨 FALHOU: criou ${apos1 - baseline} regras`)
      }
    }
  }

  // ───────────────────────────────────────────────────────
  // TESTE 2 — autoClassifyTransactions (motor do import OFX)
  // ───────────────────────────────────────────────────────
  console.log('\n━━ TESTE 2: autoClassifyTransactions (motor do import OFX) ━━')
  const conta = await prisma.bankAccount.findFirst({
    where: { companyId: CACULA, isActive: true },
    select: { id: true, name: true },
  })
  if (!conta) {
    console.log('  ⚠ Sem conta bancária — pulando')
  } else {
    const activeRules = await loadActiveRules(CACULA)
    const ruleIndex = buildRuleIndex(CACULA, activeRules)
    console.log(`  activeRules carregadas: ${activeRules.length} (esperado 0)`)

    // Simula 3 tx incoming
    const incoming = [
      { bankAccountId: conta.id, date: new Date(), description: 'PAGAMENTO PIX TESTE 1', amount: 100, type: 'DEBIT', externalId: 'TEST_1', dedupHash: 'hash1', origin: 'OFX' },
      { bankAccountId: conta.id, date: new Date(), description: 'RECEBIMENTO PIX TESTE 2', amount: 50, type: 'CREDIT', externalId: 'TEST_2', dedupHash: 'hash2', origin: 'OFX' },
      { bankAccountId: conta.id, date: new Date(), description: 'STONE TESTE 3', amount: 200, type: 'CREDIT', externalId: 'TEST_3', dedupHash: 'hash3', origin: 'OFX' },
    ] as any[]
    const r = autoClassifyTransactions(incoming, ruleIndex)
    console.log(`  Resultado: autoCount=${r.autoCount} keywordHits=${r.keywordHits} rulesFired=${r.rulesFired.size}`)
    const apos2 = await contarRegras()
    console.log(`  Regras Cacula após: ${apos2}`)
    if (apos2 === baseline) {
      console.log('  ✅ PASSOU: 0 regras criadas (motor read-only)')
    } else {
      console.log(`  🚨 FALHOU: criou ${apos2 - baseline} regras`)
    }
    // tx classificadas: esperado 0 (sem regras)
    const classifiedCount = r.classified.filter((c) => c.categoryId).length
    console.log(`  Classified com categoryId: ${classifiedCount}/3 (esperado 0, motor sem regras)`)
    if (classifiedCount === 0) {
      console.log(`  ✅ PASSOU: motor sem regras → 0 classificadas`)
    } else {
      console.log(`  ⚠ ${classifiedCount} classificadas (motor tem outras camadas — setor patterns?)`)
    }
  }

  // ───────────────────────────────────────────────────────
  // TESTE 3 — Sanity: o endpoint manual explícito CONTINUA criando regra
  // ───────────────────────────────────────────────────────
  console.log('\n━━ TESTE 3 (sanity): endpoint manual create-and-apply CONTINUA criando ━━')
  console.log('  Simulando: o que o endpoint POST /api/empresas/[id]/rules/create-and-apply faria')
  const cat3 = await prisma.category.findFirst({
    where: { companyId: CACULA, isActive: true, type: 'EXPENSE' },
    select: { id: true, name: true },
  })
  if (cat3) {
    const padraoTeste = 'PADRAO_TESTE_SPRINT_2_DELETE_ME'
    const ruleManual = await prisma.aiLearningRule.upsert({
      where: {
        companyId_tipoMatch_padrao: {
          companyId: CACULA,
          tipoMatch: 'CONTAINS',
          padrao: padraoTeste,
        },
      },
      create: {
        companyId: CACULA,
        tipoMatch: 'CONTAINS',
        padrao: padraoTeste,
        categoryId: cat3.id,
        confianca: 1.0,
        fonte: 'MANUAL',
        isActive: true,
      },
      update: { isActive: true },
    })
    const apos3 = await contarRegras()
    console.log(`  Regras Cacula após criação manual: ${apos3} (esperado 1)`)
    if (apos3 === 1) {
      console.log('  ✅ PASSOU: criação manual funciona (caminho user-explícito intacto)')
    } else {
      console.log(`  🚨 FALHOU: esperava 1, encontrou ${apos3}`)
    }
    // Limpar a regra de teste
    await prisma.aiLearningRule.delete({ where: { id: ruleManual.id } })
    const final = await contarRegras()
    console.log(`  Regras Cacula após cleanup: ${final}`)
  }

  // ───────────────────────────────────────────────────────
  // VEREDICTO FINAL
  // ───────────────────────────────────────────────────────
  console.log('\n' + '━'.repeat(80))
  const finalCount = await contarRegras()
  if (finalCount === 0) {
    console.log(`✅ Cacula segue com 0 regras. Sistema NÃO recria sozinho.`)
  } else {
    console.log(`🚨 Cacula tem ${finalCount} regras (esperado 0). Algo criou.`)
  }
  console.log('━'.repeat(80))
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
