// Sprint 3 FASE 0 + FASE 1 — READ-ONLY: confirma os 3 alvos + varre estrago residual
// + (opcionalmente) APLICA recategorização com --confirmed=true (FASE 2)

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const SICREDI = 'cmq180ksv0001aktni9wj64mq'

// IDs+FITIDs alvo (passados pelo Yussef)
interface Alvo { fitid: string; valor: number; idEsperado: string }
const ALVOS: Alvo[] = [
  { fitid: '22501610389', valor: 25000, idEsperado: 'cmqhdeybw00be' },
  { fitid: '22501591568', valor: 9000,  idEsperado: 'cmqhdeybw00bd' },
  { fitid: '22506240460', valor: 5000,  idEsperado: 'cmqhdeybx00bl' },
]

// CPF Yussef pessoa física
const CPF_YUSSEF = '60025889060'

const prisma = new PrismaClient()

async function main() {
  const confirmed = process.argv.includes('--confirmed=true')
  console.log('━'.repeat(80))
  console.log(`SPRINT 3 — Recategorizar 3 PIX YUSSEF (${confirmed ? 'APLICAR' : 'READ-ONLY'})`)
  console.log('━'.repeat(80))

  // ═══════════════════════════════════════════════════════════════
  // FASE 0 — CONFIRMAR os 3 alvos
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('FASE 0 — Estado ATUAL dos 3 alvos (por FITID exato)')
  console.log('═'.repeat(80))

  const txsAtuais: Array<{ alvo: Alvo; tx: any | null }> = []
  let podeAvancar = true

  for (const alvo of ALVOS) {
    const tx = await prisma.transaction.findFirst({
      where: {
        bankAccountId: SICREDI,
        externalId: alvo.fitid,
      },
      include: {
        category: { select: { name: true, dreGroup: true } },
        bankAccount: { select: { name: true, companyId: true } },
      },
    })
    txsAtuais.push({ alvo, tx })

    console.log(`\n  ━━ FITID ${alvo.fitid} (esperado R$ ${alvo.valor}) ━━`)
    if (!tx) {
      console.log(`    🚨 NÃO ENCONTRADA`)
      podeAvancar = false
      continue
    }
    if (tx.bankAccount?.companyId !== CACULA) {
      console.log(`    🚨 conta NÃO é da Cacula (${tx.bankAccount?.companyId})`)
      podeAvancar = false
      continue
    }
    if (Math.abs(tx.amount - alvo.valor) > 0.01) {
      console.log(`    🚨 valor divergente: esperava ${alvo.valor}, achou ${tx.amount}`)
      podeAvancar = false
      continue
    }
    if (!tx.id.startsWith(alvo.idEsperado)) {
      console.log(`    🚨 id divergente: esperava prefixo ${alvo.idEsperado}, achou ${tx.id}`)
      podeAvancar = false
      continue
    }
    if (!tx.description.includes(CPF_YUSSEF)) {
      console.log(`    🚨 description NÃO contém CPF ${CPF_YUSSEF}: "${tx.description}"`)
      podeAvancar = false
      continue
    }
    if (tx.origin !== 'OFX') {
      console.log(`    🚨 origin não é OFX (${tx.origin})`)
      podeAvancar = false
      continue
    }
    if (tx.type !== 'DEBIT') {
      console.log(`    🚨 type não é DEBIT (${tx.type})`)
      podeAvancar = false
      continue
    }
    if (tx.transferGroupId !== null) {
      console.log(`    🚨 transferGroupId set — NÃO recategorizar (é transferência interna)`)
      podeAvancar = false
      continue
    }
    if (tx.category?.dreGroup !== 'DESPESAS_ADMINISTRATIVAS' || tx.category?.name !== 'Contabilidade') {
      console.log(`    🚨 categoria atual não é "Contabilidade/DESPESAS_ADMINISTRATIVAS"`)
      console.log(`        atual: ${tx.category?.name ?? '-'} / ${tx.category?.dreGroup ?? '-'}`)
      podeAvancar = false
      continue
    }
    console.log(`    ✅ id=${tx.id}`)
    console.log(`        date=${tx.date.toISOString().slice(0,10)} type=${tx.type} R$ ${tx.amount}`)
    console.log(`        category=${tx.category.name} (${tx.category.dreGroup})`)
    console.log(`        origin=${tx.origin} importId=${tx.importId?.slice(0,8)}`)
    console.log(`        description="${tx.description}"`)
  }

  // ═══════════════════════════════════════════════════════════════
  // FASE 1 — Estrago residual
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log('FASE 1 — Estrago residual: outras tx erradas?')
  console.log('═'.repeat(80))

  // 1a) Outras tx Cacula categoria=Contabilidade no mesmo período do diagnóstico (junho/2026)
  console.log('\n━━ 1a) Outras tx em "Contabilidade" (DESPESAS_ADMINISTRATIVAS) em junho ━━')
  const contabilCat = await prisma.category.findFirst({
    where: { companyId: CACULA, name: 'Contabilidade', isActive: true },
    select: { id: true, name: true, dreGroup: true },
  })
  if (contabilCat) {
    const outrasContabil = await prisma.transaction.findMany({
      where: {
        bankAccount: { companyId: CACULA },
        categoryId: contabilCat.id,
        date: { gte: new Date('2026-06-01'), lt: new Date('2026-07-01') },
      },
      select: {
        id: true, type: true, amount: true, date: true, description: true,
        externalId: true, origin: true, lifecycle: true, transferGroupId: true,
        bankAccount: { select: { name: true } },
      },
      orderBy: { amount: 'desc' },
    })
    console.log(`  Total Contabilidade junho/2026: ${outrasContabil.length}`)
    for (const t of outrasContabil) {
      const isAlvo = ALVOS.some((a) => a.fitid === t.externalId)
      const flag = isAlvo ? ' 🎯 ALVO sprint' : t.description.includes(CPF_YUSSEF) ? ' 🚨 OUTRA PIX YUSSEF — investigar' : ''
      console.log(`    · ${t.date.toISOString().slice(0,10)} ${t.bankAccount?.name} ${t.type} R$ ${t.amount.toFixed(2).padStart(10)} ext=${t.externalId ?? 'null'} "${t.description.slice(0,55)}"${flag}`)
    }
  }

  // 1b) TODAS as tx PIX/transfer pro CPF YUSSEF em qualquer categoria/data
  console.log(`\n━━ 1b) TODAS tx Cacula com CPF YUSSEF (${CPF_YUSSEF}) na descrição ━━`)
  const txsYussef = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA },
      description: { contains: CPF_YUSSEF },
    },
    select: {
      id: true, type: true, amount: true, date: true, description: true,
      externalId: true, origin: true, lifecycle: true, transferGroupId: true,
      categoryId: true, classificationSource: true, classifiedByRuleId: true,
      category: { select: { name: true, dreGroup: true } },
      bankAccount: { select: { name: true } },
      bridge: { select: { id: true } },
    },
    orderBy: { date: 'asc' },
  })
  console.log(`  Total: ${txsYussef.length}`)
  // Análise por dreGroup
  const porDreGroup = new Map<string, { qtd: number; sum: number }>()
  for (const t of txsYussef) {
    const dg = t.category?.dreGroup ?? '(sem categoria)'
    if (!porDreGroup.has(dg)) porDreGroup.set(dg, { qtd: 0, sum: 0 })
    const e = porDreGroup.get(dg)!
    e.qtd++
    e.sum += t.amount
  }
  console.log(`\n  Quebra por dreGroup:`)
  for (const [dg, v] of porDreGroup) {
    console.log(`    ${dg.padEnd(32)} qtd=${v.qtd} sum=R$ ${v.sum.toFixed(2)}`)
  }
  // Listagem detalhada
  console.log(`\n  Detalhe linha por linha:`)
  for (const t of txsYussef) {
    const isAlvo = ALVOS.some((a) => a.fitid === t.externalId)
    let flag = ''
    if (isAlvo) flag = ' 🎯 ALVO sprint (vai virar Distribuição)'
    else if (t.category?.dreGroup === 'DISTRIBUICAO_LUCROS' || t.category?.dreGroup === 'TRANSFERENCIA') flag = ' ✅ correta (non-DRE)'
    else if (t.transferGroupId) flag = ' ✅ transferência pareada (TRANSFER)'
    else if (t.bridge) flag = ' ✅ Ponte PJ→PF (bridge)'
    else flag = ' 🚨 possível classificação errada'
    console.log(`    · ${t.date.toISOString().slice(0,10)} ${t.bankAccount?.name?.padEnd(7)} ${t.type.padEnd(8)} R$ ${t.amount.toFixed(2).padStart(10)}  cat=${(t.category?.name ?? 'null').padEnd(28)} dre=${(t.category?.dreGroup ?? 'null').padEnd(22)} src=${(t.classificationSource ?? '-').padEnd(8)} bridge=${t.bridge ? 'sim' : 'não'}${flag}`)
  }

  if (!podeAvancar) {
    console.log('\n' + '━'.repeat(80))
    console.log('🚨 NÃO PODE AVANÇAR pra FASE 2 — algum alvo não bate (veja 🚨 acima).')
    await prisma.$disconnect()
    return
  }

  // ═══════════════════════════════════════════════════════════════
  // FASE 2 — RECATEGORIZAR (só com --confirmed=true)
  // ═══════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80))
  console.log(`FASE 2 — RECATEGORIZAR (${confirmed ? 'APLICAR' : 'DRY-RUN'})`)
  console.log('═'.repeat(80))

  // Resolver categoria "Distribuição de Lucros" da Cacula (DISTRIBUICAO_LUCROS)
  // Usa a MESMA categoria das 2 de 08/06 — pegar uma delas e ler categoryId
  const refer = await prisma.transaction.findFirst({
    where: {
      bankAccount: { companyId: CACULA },
      description: { contains: CPF_YUSSEF },
      category: { dreGroup: 'DISTRIBUICAO_LUCROS' },
    },
    select: { categoryId: true, category: { select: { id: true, name: true, dreGroup: true } } },
  })
  if (!refer || !refer.categoryId) {
    console.log(`  🚨 Não achei categoria "Distribuição de Lucros" usada nas tx 08/06. Buscando direto…`)
    const distrib = await prisma.category.findFirst({
      where: {
        companyId: CACULA,
        isActive: true,
        dreGroup: 'DISTRIBUICAO_LUCROS',
        name: 'Distribuição de Lucros',
      },
      select: { id: true, name: true, dreGroup: true },
    })
    if (!distrib) {
      console.log(`  🚨 ABORTANDO: nenhuma categoria "Distribuição de Lucros" encontrada.`)
      await prisma.$disconnect()
      return
    }
    console.log(`  ✅ Categoria direta: ${distrib.id} ${distrib.name} (${distrib.dreGroup})`)
    var categoriaDestino = distrib
  } else {
    console.log(`  ✅ Categoria destino (mesma das 2 de 08/06): ${refer.categoryId} ${refer.category?.name} (${refer.category?.dreGroup})`)
    var categoriaDestino = { id: refer.categoryId, name: refer.category!.name, dreGroup: refer.category!.dreGroup }
  }

  for (const { alvo, tx } of txsAtuais) {
    if (!tx) continue
    // Sanity check em runtime (mesma categoria? já idempotente?)
    if (tx.categoryId === categoriaDestino.id) {
      console.log(`\n  ↪ ${tx.id} já está em ${categoriaDestino.name} — pulando (idempotente)`)
      continue
    }
    console.log(`\n  ━━ ${tx.id} (FITID ${alvo.fitid}, R$ ${tx.amount}) ━━`)
    console.log(`    ANTES: categoryId=${tx.categoryId} (${tx.category?.name} / ${tx.category?.dreGroup})`)
    console.log(`    DEPOIS: categoryId=${categoriaDestino.id} (${categoriaDestino.name} / ${categoriaDestino.dreGroup})`)
    if (!confirmed) {
      console.log(`    ⏸ DRY-RUN — não aplicado`)
      continue
    }
    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        categoryId: categoriaDestino.id,
        classificationSource: 'MANUAL',
        classifiedByRuleId: null,
        aiConfidence: 1.0,
      },
    })
    console.log(`    ✅ aplicado`)
  }

  await prisma.$disconnect()
  console.log('\n' + '━'.repeat(80))
  console.log(confirmed ? 'FASE 2 APLICADA.' : 'DRY-RUN — nada foi mutado.')
}
main().catch((e) => { console.error(e); process.exit(1) })
