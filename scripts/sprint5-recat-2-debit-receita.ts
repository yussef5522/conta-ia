// Sprint 5 — Recategoriza as 2 DEBIT misclassificadas como Receita de Vendas
//
// IDEMPOTENTE: WHERE current categoryId = 'Receita de Vendas' garante
// que rodar 2x não reverte (na 2ª passada já não bate o WHERE).
//
// Read-write em prod CAIXAOS. NÃO mexer em valor/data/conta/lifecycle.
// Só categoryId + classificationSource=MANUAL + classifiedByRuleId=null.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CACULA = 'cmq17yapb00gnrndlh33sctbo'

// Categoria atual (origem) — confirmada na FASE 0
const CAT_RECEITA_VENDAS = 'cmq17yapx00gxrndlkpprtk6d' // "Receita de Vendas" RECEITA_BRUTA

// Categorias destino (escolhidas na FASE 0)
const CAT_MAQUININHA = 'cmq17yasa00j5rndliugosgpl' // "Maquininha de Cartão" DESPESAS_FINANCEIRAS
const CAT_DESPESA_FINANCEIRA = 'cmq17yas500izrndl4md9vd1k' // "Despesas Financeiras" DESPESAS_FINANCEIRAS

// IDs alvo
const TX_1_MENSALIDADE_STONE = 'cmq8rhp4h004nhzkntsjqjpuv' // R$ 474,90
const TX_2_PAGAMENTO_CARTAO_BANRI = 'cmqhdec7w006knco9cw90xrlc' // R$ 2.654,63

async function main() {
  console.log('━'.repeat(80))
  console.log('Sprint 5 — Recategoriza 2 DEBIT misclassificadas em Receita de Vendas')
  console.log('━'.repeat(80))

  // Sanity: confirmar categorias destino existem na Cacula
  const cats = await prisma.category.findMany({
    where: {
      companyId: CACULA,
      id: { in: [CAT_MAQUININHA, CAT_DESPESA_FINANCEIRA, CAT_RECEITA_VENDAS] },
    },
    select: { id: true, name: true, dreGroup: true, isActive: true },
  })
  console.log('\n━━ Categorias confirmadas ━━')
  for (const c of cats) {
    console.log(`  ${c.id} | ${c.name.padEnd(25)} | ${c.dreGroup} | active=${c.isActive}`)
  }
  if (cats.length !== 3) {
    throw new Error('Categorias não encontradas — abort.')
  }
  const isAllActive = cats.every((c) => c.isActive)
  if (!isAllActive) {
    throw new Error('Alguma categoria inativa — abort.')
  }

  // Pre-state: estado atual das 2 alvo
  console.log('\n━━ Estado ANTES ━━')
  const antes = await prisma.transaction.findMany({
    where: { id: { in: [TX_1_MENSALIDADE_STONE, TX_2_PAGAMENTO_CARTAO_BANRI] } },
    select: {
      id: true,
      type: true,
      amount: true,
      description: true,
      categoryId: true,
      classificationSource: true,
      classifiedByRuleId: true,
    },
  })
  for (const t of antes) {
    console.log(`  ${t.id} | ${t.type} | R$ ${t.amount} | cat=${t.categoryId} | src=${t.classificationSource} | rule=${t.classifiedByRuleId ?? 'null'} | ${t.description}`)
  }

  // ATOMIC: as 2 mudanças num único transaction.
  // WHERE current categoryId = Receita de Vendas → idempotência:
  //   1ª passada: bate, atualiza
  //   2ª passada: não bate, count=0, no-op
  console.log('\n━━ Recategorizando (atomic) ━━')
  const result = await prisma.$transaction(async (tx) => {
    const upd1 = await tx.transaction.updateMany({
      where: {
        id: TX_1_MENSALIDADE_STONE,
        categoryId: CAT_RECEITA_VENDAS, // só mexe se ainda está como Receita
      },
      data: {
        categoryId: CAT_MAQUININHA,
        classificationSource: 'MANUAL',
        classifiedByRuleId: null,
      },
    })
    const upd2 = await tx.transaction.updateMany({
      where: {
        id: TX_2_PAGAMENTO_CARTAO_BANRI,
        categoryId: CAT_RECEITA_VENDAS,
      },
      data: {
        categoryId: CAT_DESPESA_FINANCEIRA,
        classificationSource: 'MANUAL',
        classifiedByRuleId: null,
      },
    })
    return { tx1: upd1.count, tx2: upd2.count }
  })
  console.log(`  TX#1 (Mensalidade Stone)     → updates count: ${result.tx1}`)
  console.log(`  TX#2 (Pagamento Cartao Banri) → updates count: ${result.tx2}`)
  console.log(`  ${result.tx1 + result.tx2 === 2 ? '✅' : result.tx1 + result.tx2 === 0 ? '⚠️ idempotente (já estavam recategorizadas)' : '🚨 estado parcial!'}`)

  // Post-state
  console.log('\n━━ Estado DEPOIS ━━')
  const depois = await prisma.transaction.findMany({
    where: { id: { in: [TX_1_MENSALIDADE_STONE, TX_2_PAGAMENTO_CARTAO_BANRI] } },
    select: {
      id: true,
      type: true,
      amount: true,
      description: true,
      categoryId: true,
      category: { select: { name: true, dreGroup: true } },
      classificationSource: true,
      classifiedByRuleId: true,
    },
  })
  for (const t of depois) {
    console.log(`  ${t.id} | ${t.type} | R$ ${t.amount} | ${t.category?.name} (${t.category?.dreGroup}) | src=${t.classificationSource} | rule=${t.classifiedByRuleId ?? 'null'}`)
  }

  await prisma.$disconnect()
  console.log('\n━ FIM ━')
}
main().catch((e) => { console.error(e); process.exit(1) })
