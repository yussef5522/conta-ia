// Sprint Import Idempotente — FASE 5 — RELATÓRIO READ-ONLY.
//
// Aplica a identidade canônica nova SOBRE OS DADOS ATUAIS da Cacula e
// gera relatório de duplicatas. NÃO MUTA NADA.
//
// Run em prod via:
//   npx tsx scripts/relatorio-duplicatas-cacula.ts
//
// Output: lista por contentHash com >1 transação viva. Pra cada grupo:
//   - assinatura (data, valor, descNorm)
//   - lista das tx (id, date, categoria, dreGroup, lifecycle, importId, origin)
//   - sugestão "manter X / remover Y"
//
// Yussef revisa o relatório, valida o critério "manter qual?", DEPOIS
// (sprint separado) aplicamos a limpeza com pg_dump.

import { PrismaClient } from '@prisma/client'
import { computeIdentity } from '../lib/import-identity/compute-identity'

const CACULA_ID = 'cmq17yapb00gnrndlh33sctbo'
const PERIODO_INICIO = '2026-06-01'
const PERIODO_FIM = '2026-06-19'

const prisma = new PrismaClient()

interface DupGroup {
  contentHash: string
  signature: {
    dateKey: string
    valorCentavos: number
    description: string
  }
  txs: Array<{
    id: string
    date: Date
    type: string
    amount: number
    description: string
    lifecycle: string
    origin: string
    importId: string | null
    categoryName: string | null
    dreGroup: string | null
    externalId: string | null
  }>
}

async function main() {
  console.log('━'.repeat(80))
  console.log('RELATÓRIO DE DUPLICATAS — Cacula Mix (READ-ONLY)')
  console.log(`Período: ${PERIODO_INICIO} → ${PERIODO_FIM}`)
  console.log('━'.repeat(80))

  // Pega todas as tx da Cacula no período (excluindo TRANSFER)
  const txs = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA_ID },
      date: {
        gte: new Date(PERIODO_INICIO),
        lt: new Date(PERIODO_FIM),
      },
      type: { in: ['CREDIT', 'DEBIT'] },
    },
    select: {
      id: true,
      bankAccountId: true,
      date: true,
      type: true,
      amount: true,
      description: true,
      externalId: true,
      lifecycle: true,
      origin: true,
      importId: true,
      bankAccount: { select: { name: true } },
      category: { select: { name: true, dreGroup: true } },
    },
    orderBy: { date: 'asc' },
  })

  console.log(`\n📊 Total tx no período (excluindo TRANSFER): ${txs.length}`)

  // Computa identidade canônica pra cada tx
  const groups = new Map<string, DupGroup>()
  for (const t of txs) {
    if (!t.bankAccountId) continue
    const ident = computeIdentity({
      accountId: t.bankAccountId,
      fitid: t.externalId,
      date: t.date,
      amount: t.amount,
      type: t.type,
      memo: t.description,
    })
    let g = groups.get(ident.contentHash)
    if (!g) {
      g = {
        contentHash: ident.contentHash,
        signature: {
          dateKey: ident.parts.dateKey,
          valorCentavos: ident.parts.valorCentavos,
          description: ident.parts.description,
        },
        txs: [],
      }
      groups.set(ident.contentHash, g)
    }
    g.txs.push({
      id: t.id,
      date: t.date,
      type: t.type,
      amount: t.amount,
      description: t.description,
      lifecycle: t.lifecycle,
      origin: t.origin,
      importId: t.importId,
      categoryName: t.category?.name ?? null,
      dreGroup: t.category?.dreGroup ?? null,
      externalId: t.externalId,
    })
  }

  // Filtra só grupos com >1 (duplicatas)
  const dupGroups = Array.from(groups.values()).filter((g) => g.txs.length > 1)
  dupGroups.sort(
    (a, b) =>
      Math.abs(b.signature.valorCentavos) - Math.abs(a.signature.valorCentavos),
  )

  console.log(`\n🚨 Grupos com ≥2 tx vivas mesmo conteúdo: ${dupGroups.length}`)
  console.log(
    `🚨 Tx duplicadas (excedentes): ${dupGroups.reduce(
      (sum, g) => sum + (g.txs.length - 1),
      0,
    )}`,
  )

  let totalInflacaoCentavos = 0
  let totalReceitaInflacao = 0
  console.log('\n━'.repeat(80))
  console.log('DETALHE POR GRUPO (ordenado por |valor| DESC)')
  console.log('━'.repeat(80))

  for (const [i, g] of dupGroups.entries()) {
    const valorR$ = (g.signature.valorCentavos / 100).toFixed(2)
    const excedentes = g.txs.length - 1
    const inflacao = (Math.abs(g.signature.valorCentavos) * excedentes) / 100
    totalInflacaoCentavos += Math.abs(g.signature.valorCentavos) * excedentes

    console.log(
      `\n[${i + 1}/${dupGroups.length}] ${g.signature.dateKey} R$ ${valorR$} — "${g.signature.description.slice(0, 60)}"`,
    )
    console.log(
      `    ${g.txs.length} cópias vivas · ${excedentes} duplicata(s) · inflação R$ ${inflacao.toFixed(2)}`,
    )

    // Sugestão: manter a tx com dreGroup mais "correto" (não-RECEITA quando aplicável)
    // Critério: manter a 1ª por createdAt, EXCETO se outra tem dreGroup non-DRE
    // como TRANSFERENCIA / DISTRIBUICAO_LUCROS (caso empréstimo 100k)
    const transferOrAporte = g.txs.find(
      (t) =>
        t.dreGroup === 'TRANSFERENCIA' || t.dreGroup === 'DISTRIBUICAO_LUCROS',
    )
    const keepCandidate = transferOrAporte ?? g.txs[0]

    for (const tx of g.txs) {
      const keep = tx.id === keepCandidate.id
      console.log(
        `    ${keep ? '✅ MANTER' : '❌ REMOVER'} ${tx.id} ` +
          `[${tx.type}] ${tx.dreGroup ?? '(sem categoria)'} · ` +
          `${tx.categoryName ?? '-'} · ` +
          `lifecycle=${tx.lifecycle} origin=${tx.origin} ` +
          `importId=${tx.importId?.slice(0, 8) ?? 'null'} ` +
          `externalId=${tx.externalId?.slice(0, 12) ?? 'null'}`,
      )
    }
    // Acumula impacto receita só quando a duplicata vai pra dreGroup RECEITA_BRUTA
    const receitaDup = g.txs.filter((t) => t.dreGroup === 'RECEITA_BRUTA').length
    if (receitaDup > 1) {
      totalReceitaInflacao += (Math.abs(g.signature.valorCentavos) * (receitaDup - 1)) / 100
    }
  }

  console.log('\n' + '━'.repeat(80))
  console.log('RESUMO')
  console.log('━'.repeat(80))
  console.log(`Total grupos duplicados: ${dupGroups.length}`)
  console.log(
    `Inflação BRUTA (soma de excedentes): R$ ${(totalInflacaoCentavos / 100).toFixed(2)}`,
  )
  console.log(
    `Inflação RECEITA_BRUTA estimada: R$ ${totalReceitaInflacao.toFixed(2)}`,
  )
  console.log('\n🔒 READ-ONLY: nenhuma tx foi modificada.')
  console.log(
    '👉 Próximo passo: Yussef revisa o relatório e aprova a limpeza separadamente.',
  )

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
