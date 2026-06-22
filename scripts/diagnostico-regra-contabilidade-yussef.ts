// READ-ONLY — diagnóstico da regra que classifica PIX YUSSEF como Contabilidade
// + listar TODAS regras Cacula e categorias de retirada disponíveis

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const REGRA_ALVO = 'cmqhcjqzr004anco9uzm65djz'
const prisma = new PrismaClient()

const nomeConta: Record<string, string> = {
  'cmq17z90v00qxrndl02kfn4iz': 'BANRISUL',
  'cmq180ksv0001aktni9wj64mq': 'SICREDI',
  'cmq182qfr0005aktn6q2ugpv2': 'STONE',
  'cmq2objjg0005y2fald7auroi': 'BANCO_CAIXA',
  'cmq2o25qe0001y2faydl1yrp5': 'CAIXA_LOJA',
}

async function main() {
  console.log('━'.repeat(80))
  console.log('DIAGNÓSTICO REGRA CONTABILIDADE YUSSEF (READ-ONLY)')
  console.log('━'.repeat(80))

  // ─────────────────────────────────────────────────────
  // 1) A REGRA
  // ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80))
  console.log(`1) REGRA cmqhcjqzr004anco9uzm65djz`)
  console.log('═'.repeat(80))
  const regra = await prisma.aiLearningRule.findUnique({
    where: { id: REGRA_ALVO },
    include: {
      category: { select: { id: true, name: true, dreGroup: true, type: true, description: true } },
      supplier: { select: { id: true, razaoSocial: true, cnpj: true } },
    },
  })
  if (!regra) {
    console.log(`  🚨 REGRA NÃO ENCONTRADA`)
    process.exit(1)
  }

  console.log(`\n  id:               ${regra.id}`)
  console.log(`  companyId:        ${regra.companyId}`)
  console.log(`  profileId:        ${regra.profileId ?? 'null'}`)
  console.log(`  tipoMatch:        ${regra.tipoMatch}`)
  console.log(`  padrao:           "${regra.padrao}"`)
  console.log(`  categoryId:       ${regra.categoryId}`)
  console.log(`  category:         ${regra.category?.name} (dreGroup=${regra.category?.dreGroup}, type=${regra.category?.type})`)
  console.log(`  supplierId:       ${regra.supplierId ?? 'null'}`)
  if (regra.supplier) {
    console.log(`  supplier:         ${regra.supplier.razaoSocial} (CNPJ ${regra.supplier.cnpj})`)
  }
  console.log(`  confianca:        ${regra.confianca}`)
  console.log(`  vezesAplicada:    ${regra.vezesAplicada}`)
  console.log(`  isActive:         ${regra.isActive}`)
  console.log(`  fonte:            ${regra.fonte}  ${regra.fonte === 'MANUAL' ? '(criada manualmente pelo user)' : '(sugerida pela IA / Claude)'}`)
  console.log(`  createdAt:        ${regra.createdAt.toISOString()}`)
  console.log(`  updatedAt:        ${regra.updatedAt.toISOString()}`)

  // ─────────────────────────────────────────────────────
  // 2) ALCANCE — todas tx com classifiedByRuleId = regra
  // ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80))
  console.log(`2) TX AFETADAS por essa regra`)
  console.log('═'.repeat(80))

  const tx = await prisma.transaction.findMany({
    where: {
      classifiedByRuleId: REGRA_ALVO,
      bankAccount: { companyId: CACULA },
    },
    select: {
      id: true,
      bankAccountId: true,
      type: true,
      amount: true,
      date: true,
      description: true,
      origin: true,
      lifecycle: true,
      status: true,
      categoryId: true,
      classificationSource: true,
      aiConfidence: true,
      transferGroupId: true,
      category: { select: { name: true, dreGroup: true } },
    },
    orderBy: { date: 'desc' },
  })

  console.log(`\n  Total tx classificadas por essa regra: ${tx.length}`)
  let totalCacula = 0
  for (const t of tx) {
    totalCacula += t.amount
    console.log(
      `    · ${t.date.toISOString().slice(0,10)} ${nomeConta[t.bankAccountId ?? '']?.padEnd(13)} ${t.type} R$ ${t.amount.toFixed(2).padStart(10)} ${t.lifecycle.padEnd(11)} categoria=${t.category?.name ?? '-'} confidence=${t.aiConfidence?.toFixed(2) ?? '-'} "${t.description.slice(0, 50)}"`,
    )
  }
  console.log(`\n  Σ valor afetado: R$ ${totalCacula.toFixed(2)}`)

  // Conferir os 5 PIX esperados (15/06 e 08/06)
  console.log(`\n  ━━ Esperados ━━`)
  const esperados = [
    { data: '2026-06-15', valor: 25000 },
    { data: '2026-06-15', valor: 9000 },
    { data: '2026-06-15', valor: 5000 },
    { data: '2026-06-08', valor: 4000 },
    { data: '2026-06-08', valor: 200 },
  ]
  for (const e of esperados) {
    const inicio = new Date(`${e.data}T00:00:00.000Z`)
    const fim = new Date(`${e.data}T23:59:59.999Z`)
    const match = tx.find(
      (t) => Math.abs(t.amount - e.valor) < 0.01 && t.date >= inicio && t.date <= fim,
    )
    if (match) {
      console.log(`    ✅ ${e.data} R$ ${e.valor} encontrada (id ${match.id})`)
    } else {
      // Procurar mesmo se NÃO classificada pela regra (ver se existe + por que escapou)
      const semRegra = await prisma.transaction.findFirst({
        where: {
          bankAccount: { companyId: CACULA },
          date: { gte: inicio, lte: fim },
          amount: e.valor,
          description: { contains: 'YUSSEF' },
        },
        select: { id: true, classifiedByRuleId: true, category: { select: { name: true, dreGroup: true } }, description: true, classificationSource: true },
      })
      if (semRegra) {
        console.log(`    ⚠ ${e.data} R$ ${e.valor} EXISTE (id ${semRegra.id}) mas classifiedByRuleId=${semRegra.classifiedByRuleId ?? 'null'} categoria=${semRegra.category?.name ?? 'null'} source=${semRegra.classificationSource ?? '-'}`)
      } else {
        console.log(`    ❌ ${e.data} R$ ${e.valor} NÃO existe no banco`)
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // 3) CATEGORIAS DE RETIRADA/SOCIO disponiveis
  // ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80))
  console.log(`3) CATEGORIAS DE RETIRADA / SÓCIO disponíveis na Cacula`)
  console.log('═'.repeat(80))

  const catsRetirada = await prisma.category.findMany({
    where: {
      companyId: CACULA,
      isActive: true,
      OR: [
        { dreGroup: 'DISTRIBUICAO_LUCROS' },
        { dreGroup: 'DESPESAS_PESSOAL' },
        { name: { contains: 'pro-labore' } },
        { name: { contains: 'pró-labore' } },
        { name: { contains: 'lucro' } },
        { name: { contains: 'distrib' } },
        { name: { contains: 'sócio' } },
        { name: { contains: 'socio' } },
        { name: { contains: 'retirada' } },
        { name: { contains: 'transferência' } },
        { name: { contains: 'transferencia' } },
        { name: { contains: 'aporte' } },
      ],
    },
    select: { id: true, name: true, dreGroup: true, type: true, description: true, isSystemDefault: true, parentId: true, templateKey: true },
    orderBy: [{ dreGroup: 'asc' }, { name: 'asc' }],
  })

  console.log(`\n  Candidatas (${catsRetirada.length}):`)
  for (const c of catsRetirada) {
    console.log(`    · ${c.name.padEnd(35)} dreGroup=${(c.dreGroup ?? '-').padEnd(28)} type=${c.type.padEnd(8)} system=${c.isSystemDefault} templateKey=${c.templateKey ?? '-'}`)
    if (c.description) {
      console.log(`        descrição: "${c.description.slice(0, 100)}"`)
    }
  }

  // Listar dreGroups DISTINTOS da Cacula (panorama de plano de contas)
  console.log(`\n  ━━ dreGroups distintos do plano de contas da Cacula ━━`)
  const dreGroups = await prisma.category.groupBy({
    by: ['dreGroup'],
    where: { companyId: CACULA, isActive: true },
    _count: true,
  })
  for (const g of dreGroups) {
    console.log(`    · ${(g.dreGroup ?? 'null').padEnd(32)} ${g._count} categorias`)
  }

  // Tratamento DRE: confirmar quais dreGroups são NÃO-DRE (filtradas pelo engine)
  console.log(`\n  ━━ Tratamento DRE por dreGroup ━━`)
  console.log(`    DRE engine filtra (NON_DRE_GROUPS, ver lib/dre/calculator.ts):`)
  console.log(`      - TRANSFERENCIA          (Aporte de Capital, etc) → NÃO entra no DRE`)
  console.log(`      - DISTRIBUICAO_LUCROS    → NÃO entra no DRE (saída de equity, não despesa)`)
  console.log(``)
  console.log(`    DRE engine TRATA como despesa operacional:`)
  console.log(`      - DESPESAS_ADMINISTRATIVAS  (onde "Contabilidade" está)`)
  console.log(`      - DESPESAS_PESSOAL          (folha CLT, pró-labore)`)
  console.log(`      - DESPESAS_OPERACIONAIS, COMERCIAIS, FINANCEIRAS`)
  console.log(`      - CUSTO_PRODUTO_VENDIDO`)
  console.log(`      - IMPOSTOS, OUTRAS_DESPESAS`)

  // Ponte PJ→PF (Fatia 4)
  console.log(`\n  ━━ Ponte PJ→PF (Fatia 4) ━━`)
  const sociosPF = await prisma.socioPF.findMany({
    where: { companyId: CACULA },
    select: { id: true, nome: true, cpf: true, papel: true },
  })
  console.log(`    SocioPF cadastrados na Cacula: ${sociosPF.length}`)
  for (const s of sociosPF) {
    console.log(`      · ${s.nome} CPF=${s.cpf ?? 'null'} papel=${s.papel ?? '-'}`)
  }
  // Pontes existentes
  const pontes = await prisma.pJtoPFBridge.count({ where: { companyId: CACULA } })
  console.log(`    Pontes PJ→PF criadas (Fatia 4): ${pontes}`)

  // ─────────────────────────────────────────────────────
  // 4) TODAS REGRAS Cacula
  // ─────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(80))
  console.log(`4) TODAS as AiLearningRule da Cacula`)
  console.log('═'.repeat(80))

  const todas = await prisma.aiLearningRule.findMany({
    where: { companyId: CACULA, isActive: true },
    include: {
      category: { select: { name: true, dreGroup: true } },
    },
    orderBy: [{ vezesAplicada: 'desc' }, { createdAt: 'desc' }],
  })

  console.log(`\n  Total regras ativas: ${todas.length}`)

  // Quebra por dreGroup destino
  const byDreGroup = new Map<string, number>()
  for (const r of todas) {
    const dg = r.category?.dreGroup ?? 'null'
    byDreGroup.set(dg, (byDreGroup.get(dg) ?? 0) + 1)
  }
  console.log(`\n  Quebra por dreGroup destino:`)
  for (const [dg, n] of [...byDreGroup.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${dg.padEnd(32)} ${n}`)
  }

  // Top 30 por hit count
  console.log(`\n  Top 30 regras por vezesAplicada:`)
  console.log(`  ${'tipoMatch'.padEnd(9)} ${'hits'.padStart(5)} ${'confiança'.padStart(10)} ${'fonte'.padEnd(8)} ${'categoria'.padEnd(35)} ${'dreGroup'.padEnd(25)} padrão`)
  for (const r of todas.slice(0, 30)) {
    console.log(
      `  ${r.tipoMatch.padEnd(9)} ${String(r.vezesAplicada).padStart(5)} ${r.confianca.toFixed(2).padStart(10)} ${r.fonte.padEnd(8)} ${(r.category?.name ?? '-').slice(0, 35).padEnd(35)} ${(r.category?.dreGroup ?? '-').padEnd(25)} "${r.padrao.slice(0, 60)}"`,
    )
  }

  // Suspeitas: regras com termos sócio/transferência mas dreGroup despesa operacional
  console.log(`\n  ━━ Regras SUSPEITAS — termo de transferência/sócio mas dreGroup despesa operacional ━━`)
  const PALAVRAS_SUSPEITAS = ['YUSSEF', 'ABU ZAHRY', 'CACULA MIX', 'TRANSFERENCIA', 'TRANSFERÊNCIA', 'PIX_DEB', 'TED', 'SOCIO', 'PRO LABORE', 'PRO-LABORE', 'PROLABORE', 'AUTO']
  const DRE_DESPESA_OPERACIONAL = ['DESPESAS_ADMINISTRATIVAS', 'DESPESAS_OPERACIONAIS', 'DESPESAS_COMERCIAIS', 'CUSTO_PRODUTO_VENDIDO', 'OUTRAS_DESPESAS']
  const suspeitas = todas.filter((r) => {
    const padUpper = r.padrao.toUpperCase()
    const temPalavraSuspeita = PALAVRAS_SUSPEITAS.some((p) => padUpper.includes(p))
    const eDespesaOp = DRE_DESPESA_OPERACIONAL.includes(r.category?.dreGroup ?? '')
    return temPalavraSuspeita && eDespesaOp
  })
  console.log(`  Encontradas: ${suspeitas.length}`)
  for (const r of suspeitas) {
    console.log(`    🚨 id=${r.id} hits=${r.vezesAplicada} fonte=${r.fonte}`)
    console.log(`        padrão="${r.padrao}"`)
    console.log(`        → ${r.category?.name} (${r.category?.dreGroup})`)
  }

  // Regras criadas em sequência rápida (potencial auto-aprendizado em cascata)
  console.log(`\n  ━━ Regras criadas no mesmo "lote" da regra alvo (~5 min antes/depois) ━━`)
  if (regra) {
    const janelaIni = new Date(regra.createdAt.getTime() - 5 * 60 * 1000)
    const janelaFim = new Date(regra.createdAt.getTime() + 5 * 60 * 1000)
    const lote = todas.filter((r) => r.createdAt >= janelaIni && r.createdAt <= janelaFim && r.id !== regra.id)
    console.log(`  ${lote.length} regras criadas no mesmo janela de 10 min:`)
    for (const r of lote) {
      console.log(`    · ${r.createdAt.toISOString().slice(0, 16)} ${r.tipoMatch} fonte=${r.fonte} "${r.padrao.slice(0, 50)}" → ${r.category?.name}`)
    }
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log('FIM — read-only, nada mutado.')
}
main().catch((e) => { console.error(e); process.exit(1) })
