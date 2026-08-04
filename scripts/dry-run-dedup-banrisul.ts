// Dry-run Sprint 3-Bugs Fase 1 (Yussef 12/06/2026):
// Prova a função findPreExistingMatches com dados REAIS Banrisul Cacula.
//
// ⚠️ SÓ LEITURA — usa APENAS prisma.transaction.findMany + bankAccount.findMany.
//   ZERO create, ZERO update, ZERO delete, ZERO upsert.
//   ZERO mutação no banco.
//
// Simula o cenário: Banrisul reciclou FITIDs e reexportou o extrato 01-11/jun.
// Constrói o "arquivo OFX simulado" a partir das tx que JÁ estão no sistema
// (= o que o preview real estaria oferecendo). Roda função, imprime resultado.

import { PrismaClient } from '@prisma/client'
import {
  findPreExistingMatches,
  normalizeUTC,
  type IncomingOfxTx,
  type ExistingCandidate,
} from '../lib/conciliacao/find-pre-existing-matches'

const prisma = new PrismaClient()

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo'
const BANRISUL_NAME = 'banrisul'
const RANGE_START = new Date('2026-06-01T00:00:00.000Z')
const RANGE_END = new Date('2026-06-13T00:00:00.000Z')

function fmt(n: number) { return n.toFixed(2) }

async function main() {
  console.log('=== Dry-run dedup Banrisul (Fase 1 prova com dados reais) ===\n')
  console.log('⚠️  SÓ LEITURA — esse script não cria/altera/deleta nenhuma tx.\n')

  // 1. CANDIDATES: tudo que JÁ existe no sistema (Banrisul OFX + MANUAL + Cacula Excel PAYABLE)
  const banrisul = await prisma.bankAccount.findFirstOrThrow({
    where: { companyId: COMPANY_ID, name: BANRISUL_NAME },
    select: { id: true, balance: true },
  })

  const banrisulTxs = await prisma.transaction.findMany({
    where: {
      bankAccountId: banrisul.id,
      lifecycle: 'EFFECTED',
      date: { gte: RANGE_START, lt: RANGE_END },
    },
    select: {
      id: true,
      bankAccountId: true,
      amount: true,
      date: true,
      description: true,
      type: true,
      origin: true,
      lifecycle: true,
      reconciledWithId: true,
      transferGroupId: true,
    },
  })

  // Excel PAYABLE da Cacula (pra cobrir prioridade 3)
  const excelPayable = await prisma.transaction.findMany({
    where: {
      origin: 'IMPORT_EXCEL',
      lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] },
      OR: [
        { bankAccount: { companyId: COMPANY_ID } },
        { supplier: { companyId: COMPANY_ID } },
        { customer: { companyId: COMPANY_ID } },
        { category: { companyId: COMPANY_ID } },
      ],
      dueDate: { gte: RANGE_START, lt: RANGE_END },
    },
    select: {
      id: true,
      bankAccountId: true,
      amount: true,
      date: true,
      dueDate: true,
      description: true,
      type: true,
      origin: true,
      lifecycle: true,
      reconciledWithId: true,
    },
  })

  console.log(`[candidates lidos do sistema]`)
  console.log(`  Banrisul EFFECTED 01-12/jun: ${banrisulTxs.length} tx`)
  console.log(`    - ${banrisulTxs.filter((t) => t.origin === 'OFX').length} OFX`)
  console.log(`    - ${banrisulTxs.filter((t) => t.origin === 'MANUAL').length} MANUAL`)
  console.log(`    - ${banrisulTxs.filter((t) => t.origin === 'ADJUSTMENT').length} ADJUSTMENT`)
  console.log(`  Excel PAYABLE/RECEIVABLE Cacula jun: ${excelPayable.length} tx`)
  console.log(`  banrisul.balance atual: ${fmt(banrisul.balance)}\n`)

  // 2. Mapeia pra ExistingCandidate
  const candidates: ExistingCandidate[] = [
    ...banrisulTxs.map((t) => ({
      id: t.id,
      bankAccountId: t.bankAccountId,
      amount: t.amount,
      date: normalizeUTC(t.date),
      description: t.description,
      type: t.type === 'TRANSFER' ? ('DEBIT' as const) : (t.type as 'CREDIT' | 'DEBIT'),
      // TRANSFER manual exporta como DEBIT no extrato real do banco. Pra dry-run
      // tratamos a perna Banrisul de TRANSFER como DEBIT (saída) pro match.
      origin: t.origin as 'OFX' | 'MANUAL' | 'IMPORT_EXCEL' | 'ADJUSTMENT',
      lifecycle: t.lifecycle as 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE',
      hasReconciledLink: t.reconciledWithId !== null,
    })),
    ...excelPayable.map((t) => ({
      id: t.id,
      bankAccountId: t.bankAccountId,
      amount: t.amount,
      date: normalizeUTC(t.dueDate ?? t.date),
      description: t.description,
      type: t.type as 'CREDIT' | 'DEBIT',
      origin: 'IMPORT_EXCEL' as const,
      lifecycle: t.lifecycle as 'PAYABLE' | 'RECEIVABLE',
      hasReconciledLink: t.reconciledWithId !== null,
    })),
  ]

  // 3. INCOMING: simula o "arquivo OFX" que Banrisul exportaria hoje (12/06)
  // Pega TODAS as tx OFX/MANUAL TRANSFER do sistema + simula reciclagem de FITID.
  // = mesmo cenário do preview real: Banrisul reexportou e mandou tudo de volta.
  const incoming: IncomingOfxTx[] = banrisulTxs
    .filter((t) => t.origin === 'OFX' || (t.origin === 'MANUAL' && t.transferGroupId !== null))
    .map((t, index) => ({
      index,
      bankAccountId: banrisul.id,
      amount: t.amount,
      date: normalizeUTC(t.date),
      // Simula descrição como o extrato traria (Banrisul reembala memo entre exports).
      // Pra TRANSFER manuais (que viraram DEBIT no extrato real), usa descrição típica:
      description:
        t.origin === 'MANUAL' && t.transferGroupId !== null
          ? 'PIX ENVIADO'
          : t.description,
      // OFX no arquivo NÃO traz TRANSFER — sempre DEBIT (saída) ou CREDIT (entrada).
      type:
        t.type === 'TRANSFER'
          ? ('DEBIT' as const)
          : (t.type as 'CREDIT' | 'DEBIT'),
    }))

  console.log(`[arquivo OFX simulado]`)
  console.log(`  Total a classificar: ${incoming.length} tx`)
  console.log(`    - ${incoming.filter((t) => t.type === 'CREDIT').length} entradas`)
  console.log(`    - ${incoming.filter((t) => t.type === 'DEBIT').length} saídas\n`)

  // 4. Chama função (PURA, sem DB)
  const results = findPreExistingMatches({ incoming, candidates })

  // 5. Resumo por ação
  const counts = {
    SKIP_DUP: 0, REPLACE_MANUAL: 0, CONCILIATE_PAYABLE: 0, CREATE_NEW: 0,
  }
  for (const r of results) counts[r.action] += 1

  console.log(`[resultado da classificação]`)
  console.log(`  ✅ SKIP_DUP (já existe no sistema):  ${counts.SKIP_DUP}`)
  console.log(`  🔁 REPLACE_MANUAL (substitui manual): ${counts.REPLACE_MANUAL}`)
  console.log(`  ✓ CONCILIATE_PAYABLE (concilia AP):  ${counts.CONCILIATE_PAYABLE}`)
  console.log(`  🆕 CREATE_NEW (genuinamente nova):    ${counts.CREATE_NEW}\n`)

  // 6. Detalhe linha-a-linha
  console.log(`[detalhe por tx]`)
  console.log(
    `  idx | tipo  | valor       | desc                                | ação              | matched`,
  )
  console.log(
    `  ----+-------+-------------+-------------------------------------+-------------------+--------`,
  )
  for (const r of results) {
    const ofx = incoming[r.ofxTxIndex]
    const matched = candidates.find((c) => c.id === r.matchedTxId)
    const matchedShort = r.matchedTxId
      ? `${r.matchedTxId.slice(0, 12)}… (${matched?.origin ?? '?'} ${fmt(matched?.amount ?? 0)})`
      : '—'
    console.log(
      `  ${String(r.ofxTxIndex).padStart(3)} | ${ofx.type.padEnd(5)} | R$ ${fmt(ofx.amount).padStart(8)} | ${ofx.description.slice(0, 35).padEnd(35)} | ${r.action.padEnd(17)} | ${matchedShort}`,
    )
  }

  // 7. Foco nas 5 transferências PIX (caso real bug 2)
  console.log(`\n[foco: as 5 saídas PIX que YUSSEF reportou]`)
  const valoresFoco = [21000, 9100, 34000, 20300, 1100]
  for (const v of valoresFoco) {
    const result = results.find((r) => {
      const ofx = incoming[r.ofxTxIndex]
      return ofx.type === 'DEBIT' && Math.abs(ofx.amount - v) < 0.02
    })
    if (!result) {
      console.log(`  R$ ${fmt(v).padStart(9)} → NÃO ENCONTRADA no incoming simulado`)
    } else {
      const ofx = incoming[result.ofxTxIndex]
      const matched = candidates.find((c) => c.id === result.matchedTxId)
      console.log(
        `  R$ ${fmt(v).padStart(9)} → ${result.action.padEnd(17)} | match: ${matched?.id.slice(0, 12) ?? '—'} ${matched ? `(${matched.origin})` : ''} | razão: ${result.reason}`,
      )
    }
  }

  // 8. Verifica que NINGUÉM foi marcado erroneamente como CREATE_NEW
  console.log(`\n[veredicto]`)
  if (counts.CREATE_NEW === 0) {
    console.log(`  ✅ FUNÇÃO PERFEITA: 0 CREATE_NEW. Tudo o sistema já tinha.`)
    console.log(`  ✅ Bug 3 (FITID reciclado) seria EVITADO.`)
    console.log(`  ✅ Bug 2 (manual + OFX) seria DETECTADO.`)
  } else {
    console.log(`  ⚠️  ${counts.CREATE_NEW} CREATE_NEW — investigar quais e por quê.`)
  }

  // 9. Comprovação SÓ LEITURA: balance Banrisul não mudou
  const banrisulPos = await prisma.bankAccount.findUniqueOrThrow({
    where: { id: banrisul.id }, select: { balance: true },
  })
  if (Math.abs(banrisulPos.balance - banrisul.balance) > 0.01) {
    console.log(`\n  🚨 BALANCE MUDOU! Pré ${fmt(banrisul.balance)} != Pós ${fmt(banrisulPos.balance)}`)
  } else {
    console.log(`\n  ✅ banrisul.balance idêntico: ${fmt(banrisulPos.balance)} (script só leu)`)
  }

  await prisma.$disconnect()
  console.log(`\n=== DRY-RUN CONCLUÍDO (zero mutação no banco) ===`)
}

main().catch(async (e) => {
  console.error('ERRO:', e.message)
  await prisma.$disconnect()
  process.exit(1)
})
