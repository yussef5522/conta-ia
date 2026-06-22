// READ-ONLY — diagnóstico dashboard Cacula
// Roda EXATAMENTE as queries de cada widget e cruza os números

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

async function main() {
  console.log('━'.repeat(80))
  console.log('DIAGNÓSTICO DASHBOARD Cacula (READ-ONLY)')
  console.log('━'.repeat(80))

  // ═══════════════════════════════════════════════════════════════
  // 1) PENDENTES — 3 contagens diferentes
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('1) PENDENTES — 3 queries em paralelo')
  console.log('═'.repeat(80))

  // 1a) Card IA "X aguardam classificação" — lib/dashboard/queries.ts:getPendingCount
  const cardIA = await prisma.transaction.count({
    where: {
      bankAccount: { companyId: CACULA },
      status: 'PENDING',
    },
  })

  // 1b) Badge sidebar — app/api/dashboard/badges/route.ts
  const badge = await prisma.transaction.count({
    where: {
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      status: 'PENDING',
      categoryId: null,
      reconciledWithId: null,
      reconciledFrom: { none: {} },
      transferGroupId: null,
      type: { not: 'TRANSFER' },
    },
  })

  // 1c) Tela /pendentes — endpoint /api/transacoes?semCategoria=true&status=PENDING
  const tela = await prisma.transaction.count({
    where: {
      bankAccount: { companyId: CACULA },
      categoryId: null,
      transferGroupId: null,
      reconciledWithId: null,
      reconciledFrom: { none: {} },
      type: { not: 'TRANSFER' },
      status: 'PENDING',
    },
  })

  console.log(`\n  Card IA "aguardam classificação":   ${cardIA}`)
  console.log(`  Badge sidebar:                       ${badge}`)
  console.log(`  Tela /pendentes:                     ${tela}`)
  console.log(`\n  Δ Card IA - Tela: ${cardIA - tela} (tx com status=PENDING mas que tela exclui)`)
  console.log(`  Δ Tela - Badge:   ${tela - badge} (tela inclui lifecycle != EFFECTED; badge não)`)

  // Decompor Δ Card IA - Tela
  console.log(`\n  Decompõe Card IA - Tela:`)
  const cardIAExtras = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      status: 'PENDING',
      OR: [
        { categoryId: { not: null } },
        { transferGroupId: { not: null } },
        { reconciledWithId: { not: null } },
        { reconciledFrom: { some: {} } },
        { type: 'TRANSFER' },
      ],
    },
    select: {
      id: true, type: true, categoryId: true, transferGroupId: true,
      reconciledWithId: true, lifecycle: true, amount: true, date: true,
      description: true,
    },
    take: 20,
  })
  let comCat = 0, comGroup = 0, conciliada = 0, transfer = 0
  for (const t of cardIAExtras) {
    if (t.categoryId) comCat++
    if (t.transferGroupId) comGroup++
    if (t.reconciledWithId) conciliada++
    if (t.type === 'TRANSFER') transfer++
  }
  console.log(`    Amostra ${cardIAExtras.length} tx que Card conta mas Tela exclui:`)
  console.log(`    · com categoryId set:      ${comCat}`)
  console.log(`    · com transferGroupId set: ${comGroup}`)
  console.log(`    · reconciliadas:           ${conciliada}`)
  console.log(`    · type=TRANSFER:           ${transfer}`)

  // Decompor Δ Tela - Badge
  const telaSemEffected = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      categoryId: null,
      transferGroupId: null,
      reconciledWithId: null,
      reconciledFrom: { none: {} },
      type: { not: 'TRANSFER' },
      status: 'PENDING',
      lifecycle: { not: 'EFFECTED' },
    },
    select: { id: true, lifecycle: true, type: true, amount: true, date: true, description: true },
  })
  console.log(`\n  Tx que Tela inclui mas Badge exclui (lifecycle != EFFECTED): ${telaSemEffected.length}`)
  for (const t of telaSemEffected.slice(0, 10)) {
    console.log(`    · ${t.id} ${t.type} R$ ${t.amount} lifecycle=${t.lifecycle} "${t.description.slice(0, 50)}"`)
  }

  // ═══════════════════════════════════════════════════════════════
  // 2) RECEITA BRUTA — 2 queries (Hero vs DRE)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('2) RECEITA BRUTA — Hero KPI vs DRE Gerencial')
  console.log('═'.repeat(80))

  // Mês corrente (junho 2026)
  const inicioMes = new Date('2026-06-01T00:00:00Z')
  const fimMes = new Date('2026-06-30T23:59:59.999Z')

  // 2a) Hero KPI: lifecycle=EFFECTED + reconciledWithId=null + RECEITA_BRUTA via dreGroup
  const heroReceita = await prisma.transaction.aggregate({
    where: {
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      reconciledWithId: null,
      date: { gte: inicioMes, lte: fimMes },
      type: 'CREDIT',
      category: { dreGroup: 'RECEITA_BRUTA' },
    },
    _sum: { amount: true },
    _count: true,
  })

  // 2b) DRE Gerencial (regime caixa default): lifecycle=EFFECTED + NOT OFX-pai-conciliada
  const dreReceita = await prisma.transaction.aggregate({
    where: {
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      type: 'CREDIT',
      isInternalTransfer: false,
      status: { not: 'IGNORED' },
      category: { dreGroup: 'RECEITA_BRUTA' },
      date: { gte: inicioMes, lte: fimMes },
      NOT: {
        origin: 'OFX',
        reconciledWithId: null,
        reconciledFrom: { some: {} },
      },
    },
    _sum: { amount: true },
    _count: true,
  })

  console.log(`\n  Hero KPI receita junho:  R$ ${heroReceita._sum.amount?.toFixed(2)} (${heroReceita._count} tx)`)
  console.log(`  DRE Gerencial receita:   R$ ${dreReceita._sum.amount?.toFixed(2)} (${dreReceita._count} tx)`)
  console.log(`  Δ: R$ ${((dreReceita._sum.amount ?? 0) - (heroReceita._sum.amount ?? 0)).toFixed(2)}`)

  // Procurar a diferença: tx OFX-pai conciliada com reconciledFrom.some
  const ofxPaiConciliada = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      type: 'CREDIT',
      origin: 'OFX',
      reconciledWithId: null,
      reconciledFrom: { some: {} },
      category: { dreGroup: 'RECEITA_BRUTA' },
      date: { gte: inicioMes, lte: fimMes },
    },
    select: { id: true, amount: true, date: true, description: true, status: true },
  })
  console.log(`\n  Tx OFX-pai-conciliada (Hero conta, DRE exclui): ${ofxPaiConciliada.length}`)
  for (const t of ofxPaiConciliada.slice(0, 10)) {
    console.log(`    · ${t.date.toISOString().slice(0,10)} R$ ${t.amount} status=${t.status} "${t.description.slice(0,40)}"`)
  }
  const sumOfxPai = ofxPaiConciliada.reduce((s, t) => s + t.amount, 0)
  console.log(`    SUM: R$ ${sumOfxPai.toFixed(2)}`)

  // Conferir RECEIVABLE (regime caixa não conta)
  const receivable = await prisma.transaction.aggregate({
    where: {
      bankAccount: { companyId: CACULA },
      lifecycle: 'RECEIVABLE',
      type: 'CREDIT',
      category: { dreGroup: 'RECEITA_BRUTA' },
      date: { gte: inicioMes, lte: fimMes },
    },
    _sum: { amount: true },
    _count: true,
  })
  console.log(`\n  RECEIVABLE junho (PIX pendente, fora de ambos):`)
  console.log(`    qtd=${receivable._count} sum=R$ ${receivable._sum.amount?.toFixed(2)}`)

  // Tx IGNORED (DRE exclui, Hero conta?)
  const ignored = await prisma.transaction.aggregate({
    where: {
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      type: 'CREDIT',
      status: 'IGNORED',
      category: { dreGroup: 'RECEITA_BRUTA' },
      date: { gte: inicioMes, lte: fimMes },
    },
    _sum: { amount: true },
    _count: true,
  })
  console.log(`\n  RECEITA_BRUTA IGNORED junho (DRE exclui):`)
  console.log(`    qtd=${ignored._count} sum=R$ ${ignored._sum.amount?.toFixed(2)}`)

  // ═══════════════════════════════════════════════════════════════
  // 3) TOP 5 DESPESAS — listar conteúdo + foco Contabilidade
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('3) TOP 5 DESPESAS — conteúdo de cada categoria')
  console.log('═'.repeat(80))

  // Reproduz query Top 5 do dashboard
  const topGroupByCat = await prisma.transaction.groupBy({
    by: ['categoryId'],
    where: {
      bankAccount: { companyId: CACULA },
      type: { not: 'TRANSFER' },
      categoryId: { not: null },
      date: { gte: inicioMes, lte: fimMes },
    },
    _sum: { amount: true },
    _count: true,
    orderBy: { _sum: { amount: 'desc' } },
    take: 20,
  })
  const catIds = topGroupByCat.map((g) => g.categoryId!).filter(Boolean)
  const cats = await prisma.category.findMany({
    where: { id: { in: catIds } },
    select: { id: true, name: true, dreGroup: true, type: true },
  })
  const catById = new Map(cats.map((c) => [c.id, c]))

  // Filtra dreGroup despesa (mesma lista do compute-top-categories.ts)
  const EXPENSE_DRE_GROUPS = [
    'CUSTO_PRODUTO_VENDIDO',
    'DESPESAS_OPERACIONAIS',
    'DESPESAS_ADMINISTRATIVAS',
    'DESPESAS_COMERCIAIS',
    'DESPESAS_FINANCEIRAS',
    'OUTRAS_DESPESAS',
    'IMPOSTOS',
  ]

  const top5 = topGroupByCat
    .filter((g) => {
      const c = catById.get(g.categoryId!)
      return c && EXPENSE_DRE_GROUPS.includes(c.dreGroup ?? '')
    })
    .slice(0, 5)

  console.log(`\n  Top 5 (mês corrente junho):`)
  for (const g of top5) {
    const c = catById.get(g.categoryId!)!
    console.log(`    ${c.name.padEnd(35)} dreGroup=${c.dreGroup?.padEnd(28)} qtd=${g._count} R$ ${g._sum.amount?.toFixed(2)}`)
  }

  // FOCO: Contabilidade
  const contabilCat = cats.find((c) => c.name.toLowerCase().includes('contabil') || c.name.toLowerCase().includes('contábil'))
  if (contabilCat) {
    console.log(`\n  ━━ FOCO: ${contabilCat.name} (dreGroup=${contabilCat.dreGroup}) ━━`)
    const contabilTxs = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId: CACULA },
        categoryId: contabilCat.id,
        date: { gte: inicioMes, lte: fimMes },
        type: { not: 'TRANSFER' },
      },
      select: {
        id: true, type: true, amount: true, date: true, description: true,
        lifecycle: true, transferGroupId: true, origin: true, status: true,
      },
      orderBy: { amount: 'desc' },
    })
    let sumTotal = 0
    let sumPayable = 0
    let sumEffected = 0
    let suspeitos: typeof contabilTxs = []
    for (const t of contabilTxs) {
      sumTotal += t.amount
      if (t.lifecycle === 'PAYABLE') sumPayable += t.amount
      if (t.lifecycle === 'EFFECTED') sumEffected += t.amount
      const desc = t.description.toUpperCase()
      if (desc.includes('LIQUIDACAO') || desc.includes('PARCELA') || desc.includes('EMPRESTIMO') || desc.includes('FINANCIAMENTO') || desc.includes('AMORTIZ')) {
        suspeitos.push(t)
      }
    }
    console.log(`    Total tx: ${contabilTxs.length}, SUM=R$ ${sumTotal.toFixed(2)}`)
    console.log(`    Por lifecycle: PAYABLE=R$ ${sumPayable.toFixed(2)} · EFFECTED=R$ ${sumEffected.toFixed(2)}`)
    console.log(`    Suspeitos (LIQUIDACAO/PARCELA/EMPRESTIMO/AMORTIZ): ${suspeitos.length}`)
    for (const s of suspeitos.slice(0, 10)) {
      console.log(`      🚨 ${s.id} ${s.date.toISOString().slice(0,10)} ${s.type} ${s.lifecycle} R$ ${s.amount} "${s.description.slice(0,60)}"`)
    }
    console.log(`\n    Top 10 maiores tx Contabilidade:`)
    for (const t of contabilTxs.slice(0, 10)) {
      console.log(`      · ${t.date.toISOString().slice(0,10)} ${t.type} ${t.lifecycle} R$ ${t.amount} "${t.description.slice(0,60)}"`)
    }
  }

  // Verifica se Top 5 inclui PAYABLE (regime caixa não devia)
  console.log(`\n  ━━ Top 5 quebra por lifecycle ━━`)
  for (const g of top5) {
    const c = catById.get(g.categoryId!)!
    const byLife = await prisma.transaction.groupBy({
      by: ['lifecycle'],
      where: {
        bankAccount: { companyId: CACULA },
        categoryId: g.categoryId!,
        date: { gte: inicioMes, lte: fimMes },
        type: { not: 'TRANSFER' },
      },
      _sum: { amount: true },
      _count: true,
    })
    console.log(`    ${c.name.padEnd(35)}`)
    for (const b of byLife) {
      console.log(`      ${b.lifecycle.padEnd(11)} qtd=${b._count} sum=R$ ${b._sum.amount?.toFixed(2)}`)
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 4) MoM +1860% — confirmar base maio
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('4) MoM — base maio')
  console.log('═'.repeat(80))

  const inicioMaio = new Date('2026-05-01T00:00:00Z')
  const fimMaio = new Date('2026-05-31T23:59:59.999Z')

  const maioReceita = await prisma.transaction.aggregate({
    where: {
      bankAccount: { companyId: CACULA },
      lifecycle: 'EFFECTED',
      type: 'CREDIT',
      category: { dreGroup: 'RECEITA_BRUTA' },
      date: { gte: inicioMaio, lte: fimMaio },
    },
    _sum: { amount: true },
    _count: true,
  })
  console.log(`\n  Receita maio: R$ ${maioReceita._sum.amount?.toFixed(2) ?? '0.00'} (${maioReceita._count} tx)`)
  console.log(`  Receita junho: R$ ${heroReceita._sum.amount?.toFixed(2)}`)
  const junho = heroReceita._sum.amount ?? 0
  const maio = maioReceita._sum.amount ?? 0
  const delta = maio !== 0 ? ((junho - maio) / Math.abs(maio)) * 100 : null
  console.log(`  Delta MoM: ${delta?.toFixed(0)}% (null se maio=0)`)
  console.log(`  Se mostrou "+1860%" mas base maio = R$ ${maio.toFixed(2)}, indica maio quase-vazio`)

  // Cobertura OFX maio
  const ofxMaio = await prisma.ofxImport.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      OR: [
        { periodStart: { gte: inicioMaio, lte: fimMaio } },
        { periodEnd: { gte: inicioMaio, lte: fimMaio } },
        { AND: [{ periodStart: { lte: inicioMaio } }, { periodEnd: { gte: fimMaio } }] },
      ],
      status: 'SUCCESS',
    },
    select: {
      id: true, bankAccountId: true, periodStart: true, periodEnd: true,
      newTransactions: true, bankAccount: { select: { name: true } },
    },
  })
  console.log(`\n  OfxImports cobrindo maio: ${ofxMaio.length}`)
  for (const i of ofxMaio) {
    console.log(`    · ${i.bankAccount?.name} ${i.periodStart?.toISOString().slice(0,10)} → ${i.periodEnd?.toISOString().slice(0,10)} (${i.newTransactions} tx)`)
  }

  // ═══════════════════════════════════════════════════════════════
  // 5) FONTE DA VERDADE — cada widget vem de onde?
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('5) FONTES — tabela')
  console.log('═'.repeat(80))
  console.log(`
  +---------------------------+--------------------------------+----------------------------------------------------+--------+
  | Widget                    | Função                         | Filtros chave                                      | Cache  |
  +---------------------------+--------------------------------+----------------------------------------------------+--------+
  | Saldo Atual (Hero)        | getHeroKPIs                    | SUM(bank_accounts.balance) cache                   | 60s    |
  | Receita Bruta (Hero)      | getHeroKPIs+calculateDRE       | lifecycle=EFFECTED reconciledWithId=null competence| 60s    |
  | Despesas Op (Hero)        | getHeroKPIs+calculateDRE       | mesmo                                              | 60s    |
  | Resultado (Hero)          | getHeroKPIs+calculateDRE       | mesmo                                              | 60s    |
  | Mini DRE                  | getMiniDRE+calculateDRE        | regime=competence                                  | 60s    |
  | DRE Gerencial             | /api/.../dre +calculateDRE     | regime=cash DEFAULT, exclui OFX-pai-conciliada     | livre  |
  | Top 5 Despesas            | getTopCategories               | type != TRANSFER, categoryId NOT NULL, NO lifecycle| 60s    |
  | Pendentes Card (IA)       | getPendingCount                | status=PENDING APENAS                              | 60s    |
  | Badge sidebar Pendentes   | /api/dashboard/badges          | lifecycle=EFFECTED+categoryId=null+5 outros        | 60s    |
  | Tela /pendentes           | /api/transacoes?semCategoria   | semCategoria=true + 4 anti-conciliada              | livre  |
  +---------------------------+--------------------------------+----------------------------------------------------+--------+
  `)

  await prisma.$disconnect()
  console.log('━'.repeat(80))
  console.log('FIM — read-only, nada mutado.')
}
main().catch((e) => { console.error(e); process.exit(1) })
