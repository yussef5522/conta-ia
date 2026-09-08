// READ-ONLY. O que a "Histórico de compras" está realmente mostrando, e o que é o par ±222.
// npx tsx scripts/diag-historico-item.ts

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo'

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY_ID)

  // ── 1. achar o par ±222 ────────────────────────────────────────────────────
  const perto = await prisma.stockMovement.findMany({
    where: { companyId: COMPANY_ID, OR: [{ quantidade: { gte: 222, lte: 223 } }, { quantidade: { gte: -223, lte: -222 } }] },
    orderBy: { dataMovimento: 'asc' },
  })
  console.log(`\n=== o par ±222 (${perto.length} movimento(s)) ===`)
  for (const m of perto) {
    const item = await prisma.stockItem.findUnique({ where: { id: m.itemId }, select: { nome: true, unidadeControle: true } })
    console.log(`\n[${m.id}] ${m.dataMovimento.toISOString().slice(0, 16)}`)
    console.log(`   item: ${item?.nome} (${item?.unidadeControle}) · ${m.itemId}`)
    console.log(`   tipo: ${m.tipo} · qtd ${m.quantidade} · custoUnit ${m.custoUnitario} · total ${m.custoTotal}`)
    console.log(`   receiptId: ${m.receiptId ?? '—'} · nfeChave: ${m.nfeChave ?? '—'} · estornoDeId: ${m.estornoDeId ?? '—'}`)
    console.log(`   criadoPorId: ${m.criadoPorId ?? '⛔ NULL'} · origem: ${m.origem}`)
    if (m.receiptId) {
      const [conf, ordem, cont, saida, ent, imp] = await Promise.all([
        prisma.stockReceiptConference.findUnique({ where: { id: m.receiptId }, select: { id: true, chave: true } }),
        prisma.stockProductionOrder.findUnique({ where: { id: m.receiptId }, select: { id: true, estado: true, dataProducao: true } }),
        prisma.stockContagem.findUnique({ where: { id: m.receiptId }, select: { id: true, tipo: true, status: true } }).catch(() => null),
        prisma.stockSaida.findUnique({ where: { id: m.receiptId }, select: { id: true, motivo: true } }).catch(() => null),
        prisma.stockEntradaManual.findUnique({ where: { id: m.receiptId }, select: { id: true } }).catch(() => null),
        prisma.stockVendaImport.findUnique({ where: { id: m.receiptId }, select: { id: true, data: true } }).catch(() => null),
      ])
      const alvo = conf ? `CONFERENCIA(recibo) ${conf.chave?.slice(-8)}` : ordem ? `ORDEM DE PRODUCAO ${ordem.estado} ${ordem.dataProducao?.toISOString().slice(0, 10)}`
        : cont ? `CONTAGEM ${cont.tipo}/${cont.status}` : saida ? `SAIDA ${saida.motivo}` : ent ? 'ENTRADA MANUAL' : imp ? `IMPORT DE VENDA ${imp.data?.toISOString().slice(0, 10)}` : '⛔ NÃO RESOLVE PRA NADA'
      console.log(`   → o receiptId aponta pra: ${alvo}`)
      console.log(`   ⚠️ a TELA hoje linka isto pra /estoque/recibos/${m.receiptId}`)
    }
  }

  // ── 2. o item inteiro, como a tela mostra ──────────────────────────────────
  const itemId = perto[0]?.itemId
  if (itemId) {
    const movs = await prisma.stockMovement.findMany({
      where: { companyId: COMPANY_ID, itemId }, orderBy: { dataMovimento: 'desc' },
    })
    const it = await prisma.stockItem.findUnique({ where: { id: itemId }, select: { nome: true, unidadeControle: true } })
    console.log(`\n\n=== "${it?.nome}": ${movs.length} linhas na tela "Histórico de COMPRAS" ===`)
    const porTipo = new Map<string, number>()
    for (const m of movs) porTipo.set(m.tipo, (porTipo.get(m.tipo) ?? 0) + 1)
    console.log('   por tipo:', [...porTipo].map(([t, n]) => `${t}=${n}`).join(' · '))
    const naoCompra = movs.filter((m) => m.tipo !== 'ENTRADA_NF')
    console.log(`   ⛔ NÃO são compra: ${naoCompra.length} de ${movs.length}`)
    console.log(`   ⛔ com quantidade NEGATIVA (consumo) na tabela de compras: ${movs.filter((m) => m.quantidade < 0).length}`)
    console.log(`   ⛔ sem autor (criadoPorId NULL): ${movs.filter((m) => !m.criadoPorId).length} de ${movs.length}`)
    console.log('\n   as linhas, como a tela as pinta hoje:')
    for (const m of movs.slice(0, 14)) {
      const rotuloTela = m.receiptId ? 'recibo (link)' : '—'
      console.log(`   ${m.dataMovimento.toISOString().slice(0, 10)} ${String(m.quantidade).padStart(9)} ${it?.unidadeControle}  tela:"${rotuloTela}"  real:${m.tipo}  autor:${m.criadoPorId ? 'sim' : '⛔NULL'}`)
    }
  }

  // ── 3. a empresa inteira: quem tem autor e pra onde o receiptId aponta ─────
  console.log('\n\n=== A EMPRESA INTEIRA: rastro por tipo de movimento ===')
  const todos = await prisma.stockMovement.groupBy({
    by: ['tipo'], where: { companyId: COMPANY_ID }, _count: { _all: true },
  })
  for (const g of todos.sort((a, b) => b._count._all - a._count._all)) {
    const semAutor = await prisma.stockMovement.count({ where: { companyId: COMPANY_ID, tipo: g.tipo, criadoPorId: null } })
    const semRef = await prisma.stockMovement.count({ where: { companyId: COMPANY_ID, tipo: g.tipo, receiptId: null } })
    console.log(`   ${g.tipo.padEnd(22)} ${String(g._count._all).padStart(5)} linhas · sem autor: ${String(semAutor).padStart(5)} · sem receiptId: ${String(semRef).padStart(5)}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
