// Sprint Limpeza Cacula + Backfill (18/06/2026)
//
// 4 fases via flag --phase:
//   manifest   : read-only, lista 193 grupos + regra importId + projeções
//   apply      : delete duplicatas + corrige 3 PIX YUSSEF + dedup 2 pares
//   backfill   : popula fitidKey + contentHash em tx vivas + imported_identities
//   revalidar  : DRY-RUN reimport=0 + DRE=254k + saldos=LEDGERBAL
//
// REGRA DE SEGURANÇA: só remove duplicata se importIds DIFERENTES.
// Iguais (ou ambos null) viram REVISAR MANUAL.
//
// CONFIRMED: apply só muta DB com --confirmed=true. Default = read-only.

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { computeIdentity } from '../lib/import-identity/compute-identity'
import { applyIdentityGate } from '../lib/import-identity/apply-gate'
import { loadLedgerState } from '../lib/import-identity/ledger-queries'

const CACULA_ID = 'cmq17yapb00gnrndlh33sctbo'
const BANRISUL_ID = 'cmq17z90v00qxrndl02kfn4iz'
const SICREDI_ID = 'cmq180ksv0001aktni9wj64mq'
const STONE_ID = 'cmq182qfr0005aktn6q2ugpv2'

// LEDGERBAL real do extrato (fornecidos pelo Yussef)
const LEDGERBAL_BANRISUL = -9588.12
const LEDGERBAL_SICREDI = -28494.33
const LEDGERBAL_STONE = 79.10

// Períodos
const PERIODO_INICIO = '2026-06-01'
const PERIODO_FIM = '2026-06-19'

// 3 PIX YUSSEF Stone órfãos -> TRANSFER (precisam ter par no Banrisul)
const PIX_YUSSEF_ORFAOS_IDS = [
  // descobertos via query do verify-step anterior — datas e valores:
  // 06/08 R$ 8000, 06/09 R$ 650, 06/15 R$ 50 — todos Stone CREDIT
  // serão localizados runtime via query
] as const

// 2 pares TRANSFER duplicados
const TRANSFER_DUP_GROUPS_TO_DELETE = [
  '7de154c4-2f2e-49dc-8c19-48262b55e6ac', // duplicata do 67d01c12 (34k 06/08)
  'be748f09-8f75-4667-9389-476ac94c4db4', // duplicata do 5287daa8 (1100 06/09)
]

const prisma = new PrismaClient()

interface DupItem {
  contentHash: string
  signature: string
  txs: Array<{
    id: string
    bankAccountId: string
    date: Date
    type: string
    amount: number
    description: string
    lifecycle: string
    origin: string
    importId: string | null
    externalId: string | null
    categoryName: string | null
    dreGroup: string | null
    createdAt: Date
  }>
  decision: 'REMOVE_NEWER' | 'REMOVE_RECEITA_BRUTA_KEEP_TRANSFER' | 'REVISAR_MANUAL'
  keepId: string
  removeIds: string[]
  reason: string
}

async function loadDupGroups(): Promise<DupItem[]> {
  // Pega TODAS tx Cacula vivas (todas contas) + todos períodos pra ser ambicioso.
  // Filtra TRANSFER (Sprint 0.5 já trata).
  const txs = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA_ID },
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
      createdAt: true,
      category: { select: { name: true, dreGroup: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Group by contentHash
  const groups = new Map<string, DupItem['txs']>()
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
      g = []
      groups.set(ident.contentHash, g)
    }
    g.push({
      id: t.id,
      bankAccountId: t.bankAccountId,
      date: t.date,
      type: t.type,
      amount: t.amount,
      description: t.description,
      lifecycle: t.lifecycle,
      origin: t.origin,
      importId: t.importId,
      externalId: t.externalId,
      categoryName: t.category?.name ?? null,
      dreGroup: t.category?.dreGroup ?? null,
      createdAt: t.createdAt,
    })
  }

  const dupGroups: DupItem[] = []
  for (const [contentHash, txs] of groups) {
    if (txs.length < 2) continue

    const sigDate = txs[0].date.toISOString().slice(0, 10)
    const sigVal = txs[0].amount.toFixed(2)
    const sigDesc = txs[0].description.slice(0, 60)
    const signature = `${sigDate} R$ ${sigVal} — "${sigDesc}"`

    // REGRA SEGURANÇA: importIds têm que ser DIFERENTES
    const importIds = new Set(txs.map((t) => t.importId))
    const todosMesmoImportId =
      importIds.size === 1 || (importIds.size === 1 && importIds.has(null))

    if (todosMesmoImportId) {
      dupGroups.push({
        contentHash,
        signature,
        txs,
        decision: 'REVISAR_MANUAL',
        keepId: txs[0].id,
        removeIds: [],
        reason: `importIds iguais (${[...importIds].join(',')}) — pode ser venda legitimamente igual`,
      })
      continue
    }

    // Preferência 1: tem cópia TRANSFERENCIA ou DISTRIBUICAO_LUCROS? manter ela
    const transferCopia = txs.find(
      (t) =>
        t.dreGroup === 'TRANSFERENCIA' || t.dreGroup === 'DISTRIBUICAO_LUCROS',
    )
    if (transferCopia) {
      const others = txs.filter((t) => t.id !== transferCopia.id)
      dupGroups.push({
        contentHash,
        signature,
        txs,
        decision: 'REMOVE_RECEITA_BRUTA_KEEP_TRANSFER',
        keepId: transferCopia.id,
        removeIds: others.map((t) => t.id),
        reason: `manter TRANSFERENCIA/Aporte; remover RECEITA_BRUTA duplicada`,
      })
      continue
    }

    // Preferência 2: empate de tipo -> manter mais antiga (importId mais antigo)
    const sortedByAge = [...txs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    const keep = sortedByAge[0]
    const remove = sortedByAge.slice(1)
    dupGroups.push({
      contentHash,
      signature,
      txs,
      decision: 'REMOVE_NEWER',
      keepId: keep.id,
      removeIds: remove.map((t) => t.id),
      reason: `re-import (importIds diferentes); manter mais antiga`,
    })
  }

  // Ordena por |valor| DESC
  dupGroups.sort((a, b) => Math.abs(b.txs[0].amount) - Math.abs(a.txs[0].amount))
  return dupGroups
}

async function showManifest() {
  console.log('━'.repeat(80))
  console.log('FASE 1 — MANIFESTO (READ-ONLY)')
  console.log('━'.repeat(80))

  const groups = await loadDupGroups()
  const remove = groups.filter((g) => g.decision !== 'REVISAR_MANUAL')
  const revisar = groups.filter((g) => g.decision === 'REVISAR_MANUAL')

  console.log(`\nTotal grupos duplicados detectados: ${groups.length}`)
  console.log(`Marcados pra REMOVER: ${remove.length}`)
  console.log(`Marcados REVISAR MANUAL: ${revisar.length} (mesmo importId)`)

  console.log('\n━━ TOP 15 piores (ordenado |valor| DESC) ━━')
  for (const [i, g] of groups.slice(0, 15).entries()) {
    console.log(`\n[${i + 1}] ${g.signature}`)
    console.log(`    Decisão: ${g.decision}`)
    console.log(`    Razão:  ${g.reason}`)
    for (const tx of g.txs) {
      const tag = tx.id === g.keepId ? '✅ MANTER' : g.removeIds.includes(tx.id) ? '❌ REMOVER' : '⚠ '
      console.log(
        `    ${tag} ${tx.id} [${tx.type}] ${tx.dreGroup ?? '-'} · ${tx.categoryName ?? '-'} · importId=${tx.importId?.slice(0, 8) ?? 'null'} createdAt=${tx.createdAt.toISOString().slice(0, 16)}`,
      )
    }
  }

  // Soma de inflação a ser removida
  let inflacaoBruta = 0
  let inflacaoReceitaBruta = 0
  for (const g of remove) {
    const valorAbs = Math.abs(g.txs[0].amount)
    inflacaoBruta += valorAbs * g.removeIds.length
    // Receita bruta inflada = receita removida
    for (const rid of g.removeIds) {
      const tx = g.txs.find((t) => t.id === rid)!
      if (tx.dreGroup === 'RECEITA_BRUTA' && tx.type === 'CREDIT') {
        inflacaoReceitaBruta += tx.amount
      }
    }
  }

  console.log('\n━━ IMPACTO ESTIMADO da FASE 2 ━━')
  console.log(`Tx a deletar: ${remove.reduce((s, g) => s + g.removeIds.length, 0)}`)
  console.log(`Inflação bruta removida: R$ ${inflacaoBruta.toFixed(2)}`)
  console.log(`Receita bruta inflada removida: R$ ${inflacaoReceitaBruta.toFixed(2)}`)

  // PIX YUSSEF órfãos
  console.log('\n━━ 3 PIX YUSSEF Stone órfãos (cred -> transfer) ━━')
  const yussefOrfaos = await prisma.transaction.findMany({
    where: {
      bankAccountId: STONE_ID,
      date: {
        gte: new Date(PERIODO_INICIO),
        lt: new Date(PERIODO_FIM),
      },
      type: 'CREDIT',
      transferGroupId: null,
      OR: [
        { description: { contains: 'YUSSEF' } },
        { description: { contains: 'ABU ZAHRY' } },
      ],
    },
    select: {
      id: true,
      date: true,
      amount: true,
      description: true,
      category: { select: { name: true } },
    },
  })
  for (const o of yussefOrfaos) {
    console.log(
      `  ${o.id} ${o.date.toISOString().slice(0, 10)} R$ ${o.amount} cat=${o.category?.name ?? '-'}`,
    )
    // CASO A: já existe outra Stone tx TRANSFER mesmo valor/data?
    // -> esse CREDIT órfão é DUPLICATA de re-import → DELETAR
    const transferExistente = await prisma.transaction.findFirst({
      where: {
        bankAccountId: STONE_ID,
        type: 'TRANSFER',
        amount: o.amount,
        date: {
          gte: new Date(o.date.getTime() - 1 * 86400000),
          lte: new Date(o.date.getTime() + 1 * 86400000),
        },
      },
      select: { id: true, date: true },
    })
    if (transferExistente) {
      console.log(
        `    -> ⚠ duplicata de TRANSFER existente ${transferExistente.id} (${transferExistente.date.toISOString().slice(0, 10)}) — apply DELETARÁ o órfão`,
      )
      continue
    }
    // CASO B: procurar par DEBIT em outra conta da Cacula (PIX ENVIADO etc)
    const par = await prisma.transaction.findFirst({
      where: {
        bankAccount: { companyId: CACULA_ID },
        bankAccountId: { not: STONE_ID },
        type: 'DEBIT',
        amount: o.amount,
        transferGroupId: null,
        date: {
          gte: new Date(o.date.getTime() - 2 * 86400000),
          lte: new Date(o.date.getTime() + 2 * 86400000),
        },
        OR: [
          { description: { contains: 'PIX ENVIADO' } },
          { description: { contains: 'TRANSFER' } },
          { description: { contains: 'YUSSEF' } },
          { description: { contains: 'ABU ZAHRY' } },
        ],
      },
      select: { id: true, date: true, description: true, bankAccountId: true },
    })
    if (par) {
      console.log(
        `    -> ✅ par válido encontrado ${par.id} ${par.date.toISOString().slice(0, 10)} "${par.description.slice(0, 40)}" — apply criará TRANSFER`,
      )
    } else {
      console.log(`    -> ❌ NENHUM par válido encontrado — apply pula`)
    }
  }

  // Pares TRANSFER duplicados
  console.log('\n━━ 2 pares TRANSFER duplicados a deletar ━━')
  for (const gid of TRANSFER_DUP_GROUPS_TO_DELETE) {
    const ts = await prisma.transaction.findMany({
      where: { transferGroupId: gid },
      select: { id: true, date: true, amount: true, type: true, bankAccountId: true, description: true },
    })
    console.log(`  groupId ${gid}: ${ts.length} tx`)
    for (const t of ts) {
      console.log(`    ${t.id} ${t.date.toISOString().slice(0, 10)} ${t.type} R$ ${t.amount} acc=${t.bankAccountId?.slice(0, 8)}`)
    }
  }

  // Projeção DRE pós-limpeza
  console.log('\n━━ PROJEÇÃO DRE pós-limpeza ━━')
  await projetarDRE(remove, yussefOrfaos.length, TRANSFER_DUP_GROUPS_TO_DELETE)

  console.log('\n━'.repeat(80))
  console.log('🔒 READ-ONLY. Nada foi mutado.')
  console.log('Pra aplicar: --phase=apply --confirmed=true')
  console.log('━'.repeat(80))
}

async function projetarDRE(
  toRemove: DupItem[],
  yussefOrfaos: number,
  parDuplicados: readonly string[],
) {
  // 1. Soma de tx a deletar por dreGroup (impacto direto no DRE)
  const removeImpact = new Map<string, number>()
  for (const g of toRemove) {
    for (const rid of g.removeIds) {
      const tx = g.txs.find((t) => t.id === rid)!
      const key = tx.dreGroup ?? 'SEM_CATEGORIA'
      const sign = tx.type === 'CREDIT' ? 1 : -1
      removeImpact.set(key, (removeImpact.get(key) ?? 0) + sign * tx.amount)
    }
  }
  console.log('  Impacto DELETE no DRE (CREDIT-DEBIT por dreGroup):')
  for (const [k, v] of removeImpact) {
    console.log(`    ${k}: R$ ${v.toFixed(2)}`)
  }

  // 2. Buscar DRE atual e projetar
  const atualReceita = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA_ID },
      date: { gte: new Date(PERIODO_INICIO), lt: new Date(PERIODO_FIM) },
      type: 'CREDIT',
      category: { dreGroup: 'RECEITA_BRUTA' },
    },
    select: { amount: true },
  })
  const receitaAtual = atualReceita.reduce((s, t) => s + t.amount, 0)
  console.log(`  Receita bruta atual (CREDIT em RECEITA_BRUTA, 01-18/06): R$ ${receitaAtual.toFixed(2)}`)

  const receitaDups = toRemove.reduce((s, g) => {
    for (const rid of g.removeIds) {
      const tx = g.txs.find((t) => t.id === rid)!
      if (tx.dreGroup === 'RECEITA_BRUTA' && tx.type === 'CREDIT') {
        return s + tx.amount
      }
    }
    return s
  }, 0)
  console.log(`  Receita bruta a DELETAR (duplicatas): R$ ${receitaDups.toFixed(2)}`)
  console.log(`  Receita projetada pós-limpeza: R$ ${(receitaAtual - receitaDups).toFixed(2)}`)
  console.log(`  TARGET (Yussef): R$ 254.861,29`)
}

// ────────────────────────────────────────────────────────────────────────
// APPLY (FASE 2) — só com --confirmed=true
// ────────────────────────────────────────────────────────────────────────
async function applyChanges(confirmed: boolean) {
  if (!confirmed) {
    console.log('🚨 sem --confirmed=true. ABORTANDO. Nada foi mutado.')
    return
  }
  console.log('━'.repeat(80))
  console.log('FASE 2 — APLICANDO LIMPEZA (DB SERÁ MUTADO)')
  console.log('━'.repeat(80))

  const groups = await loadDupGroups()
  const remove = groups.filter((g) => g.decision !== 'REVISAR_MANUAL')

  let totalDeletadas = 0
  const idsADeletar: string[] = []
  for (const g of remove) idsADeletar.push(...g.removeIds)

  console.log(`\n1) Deletar ${idsADeletar.length} duplicatas`)
  // Atomic: deleta em batches de 100 + limpa imported_identities relacionadas
  const BATCH = 100
  for (let i = 0; i < idsADeletar.length; i += BATCH) {
    const batch = idsADeletar.slice(i, i + BATCH)
    await prisma.$transaction(async (tx) => {
      // 1) primeiro limpa imported_identities apontando pra essas tx
      await tx.importedIdentity.updateMany({
        where: { transactionId: { in: batch } },
        data: { tombstone: true, transactionId: null },
      })
      // 2) deleta as transactions
      const r = await tx.transaction.deleteMany({ where: { id: { in: batch } } })
      totalDeletadas += r.count
    })
    console.log(`  batch ${i / BATCH + 1}: deletadas ${batch.length}`)
  }
  console.log(`  ✅ Total tx deletadas: ${totalDeletadas}`)

  // 2) Pares TRANSFER duplicados
  console.log(`\n2) Deletar 2 pares TRANSFER duplicados`)
  for (const gid of TRANSFER_DUP_GROUPS_TO_DELETE) {
    const r = await prisma.transaction.deleteMany({
      where: { transferGroupId: gid },
    })
    console.log(`  groupId ${gid}: ${r.count} tx removidas`)
  }

  // 3) 3 PIX YUSSEF Stone órfãos -> TRANSFER pareado com Banrisul DEBIT
  console.log(`\n3) Corrigir 3 PIX YUSSEF Stone órfãos`)
  const yussefOrfaos = await prisma.transaction.findMany({
    where: {
      bankAccountId: STONE_ID,
      date: {
        gte: new Date(PERIODO_INICIO),
        lt: new Date(PERIODO_FIM),
      },
      type: 'CREDIT',
      transferGroupId: null,
      OR: [
        { description: { contains: 'YUSSEF' } },
        { description: { contains: 'ABU ZAHRY' } },
      ],
    },
    select: { id: true, date: true, amount: true, description: true, categoryId: true },
  })
  for (const o of yussefOrfaos) {
    // CASO A: já existe TRANSFER pareada -> deletar órfão (duplicata)
    const transferExistente = await prisma.transaction.findFirst({
      where: {
        bankAccountId: STONE_ID,
        type: 'TRANSFER',
        amount: o.amount,
        date: {
          gte: new Date(o.date.getTime() - 1 * 86400000),
          lte: new Date(o.date.getTime() + 1 * 86400000),
        },
      },
      select: { id: true },
    })
    if (transferExistente) {
      await prisma.$transaction(async (tx) => {
        await tx.importedIdentity.updateMany({
          where: { transactionId: o.id },
          data: { tombstone: true, transactionId: null },
        })
        await tx.transaction.delete({ where: { id: o.id } })
      })
      console.log(`  🗑  ${o.id} R$ ${o.amount}: deletado (duplicata de TRANSFER ${transferExistente.id})`)
      continue
    }
    // CASO B: cria TRANSFER com par válido
    const par = await prisma.transaction.findFirst({
      where: {
        bankAccount: { companyId: CACULA_ID },
        bankAccountId: { not: STONE_ID },
        type: 'DEBIT',
        amount: o.amount,
        transferGroupId: null,
        date: {
          gte: new Date(o.date.getTime() - 2 * 86400000),
          lte: new Date(o.date.getTime() + 2 * 86400000),
        },
        OR: [
          { description: { contains: 'PIX ENVIADO' } },
          { description: { contains: 'TRANSFER' } },
          { description: { contains: 'YUSSEF' } },
          { description: { contains: 'ABU ZAHRY' } },
        ],
      },
      select: { id: true, date: true },
    })
    if (!par) {
      console.log(`  ⏭  ${o.id} R$ ${o.amount}: SEM par válido, pulando`)
      continue
    }
    const newGroupId = randomUUID()
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: o.id },
        data: {
          type: 'TRANSFER',
          transferGroupId: newGroupId,
          transferDirection: 'IN',
          categoryId: null,
        },
      }),
      prisma.transaction.update({
        where: { id: par.id },
        data: {
          type: 'TRANSFER',
          transferGroupId: newGroupId,
          transferDirection: 'OUT',
          categoryId: null,
        },
      }),
    ])
    console.log(
      `  ✅ ${o.id} (Stone) + ${par.id} -> TRANSFER groupId=${newGroupId.slice(0, 8)}`,
    )
  }

  console.log('\n━ FASE 2 APLICADA ━')
}

// ────────────────────────────────────────────────────────────────────────
// BACKFILL (FASE 3)
// ────────────────────────────────────────────────────────────────────────
async function backfill(confirmed: boolean) {
  if (!confirmed) {
    console.log('🚨 sem --confirmed=true. ABORTANDO. Nada foi mutado.')
    return
  }
  console.log('━'.repeat(80))
  console.log('FASE 3 — BACKFILL retroativo')
  console.log('━'.repeat(80))

  // Pega TODAS tx vivas da Cacula
  const txs = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA_ID },
    },
    select: {
      id: true,
      bankAccountId: true,
      date: true,
      type: true,
      amount: true,
      description: true,
      externalId: true,
      importId: true,
    },
  })
  console.log(`Total tx a processar: ${txs.length}`)

  // Identifica tx sem importId -> agrupar por bankAccountId
  // pra cada bankAccount com tx sem importId, criar 1 synthetic OfxImport
  // (status SUCCESS, source=MANUAL, fileName=[backfill-pre-sprint])
  const txsSemImport = txs.filter((t) => !t.importId)
  const accountsSemImport = new Set(txsSemImport.map((t) => t.bankAccountId).filter((b): b is string => !!b))

  const syntheticByAccount = new Map<string, string>()
  if (accountsSemImport.size > 0) {
    console.log(`Criando ${accountsSemImport.size} synthetic batches pra tx sem importId`)
    // Precisa de um userId pro OfxImport.userId (FK). Pega 1º user da Cacula.
    const ucr = await prisma.userCompany.findFirst({
      where: { companyId: CACULA_ID },
      select: { userId: true },
    })
    if (!ucr) throw new Error('Nenhum user vinculado à Cacula')
    for (const accId of accountsSemImport) {
      const batch = await prisma.ofxImport.create({
        data: {
          bankAccountId: accId,
          userId: ucr.userId,
          status: 'SUCCESS',
          fileName: '[backfill-pre-sprint-import-idempotente]',
          fileSize: 0,
          totalTransactions: 0,
          source: 'MANUAL',
        },
        select: { id: true },
      })
      syntheticByAccount.set(accId, batch.id)
    }
  }

  // Cacula companyId pra todas as entries
  let processadas = 0
  let identitiesCriadas = 0
  const BATCH = 100
  for (let i = 0; i < txs.length; i += BATCH) {
    const batch = txs.slice(i, i + BATCH)
    await prisma.$transaction(async (db) => {
      for (const t of batch) {
        if (!t.bankAccountId) continue
        const ident = computeIdentity({
          accountId: t.bankAccountId,
          fitid: t.externalId,
          date: t.date,
          amount: t.amount,
          type: t.type,
          memo: t.description,
        })
        // 1) update Transaction
        await db.transaction.update({
          where: { id: t.id },
          data: {
            fitidKey: ident.fitidKey,
            contentHash: ident.contentHash,
          },
        })
        // 2) cria ImportedIdentity
        const importBatchId = t.importId ?? syntheticByAccount.get(t.bankAccountId) ?? null
        if (!importBatchId) continue
        try {
          await db.importedIdentity.create({
            data: {
              companyId: CACULA_ID,
              bankAccountId: t.bankAccountId,
              importBatchId,
              fitidKey: ident.fitidKey,
              contentHash: ident.contentHash,
              transactionId: t.id,
              tombstone: false,
            },
          })
          identitiesCriadas++
        } catch (e: any) {
          // Pode já existir se a tx foi criada APÓS o deploy (já tem entry).
          // Ignora silenciosamente nesse caso.
          if (!String(e?.message).includes('Unique')) throw e
        }
        processadas++
      }
    })
    console.log(`  batch ${i / BATCH + 1}/${Math.ceil(txs.length / BATCH)}: processadas ${batch.length}`)
  }
  console.log(`\n✅ Backfill: ${processadas} tx atualizadas / ${identitiesCriadas} ImportedIdentity entries criadas`)
}

// ────────────────────────────────────────────────────────────────────────
// REVALIDAR (FASE 4)
// ────────────────────────────────────────────────────────────────────────
async function revalidar() {
  console.log('━'.repeat(80))
  console.log('FASE 4 — REVALIDAÇÃO')
  console.log('━'.repeat(80))

  // 1) Dry-run reimport
  console.log('\n1) DRY-RUN reimport 01-18/06 (deve dar ~0 novas em cada conta)')
  for (const [name, id] of [
    ['BANRISUL', BANRISUL_ID],
    ['SICREDI', SICREDI_ID],
    ['STONE', STONE_ID],
  ] as const) {
    const existing = await prisma.transaction.findMany({
      where: {
        bankAccountId: id,
        date: { gte: new Date(PERIODO_INICIO), lt: new Date(PERIODO_FIM) },
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
      },
    })
    if (existing.length === 0) {
      console.log(`  ${name}: zero tx no período`)
      continue
    }
    const incoming = existing.map((tx) => ({
      payload: { txId: tx.id },
      identity: computeIdentity({
        accountId: tx.bankAccountId!,
        fitid: tx.externalId,
        date: tx.date,
        amount: tx.amount,
        type: tx.type,
        memo: tx.description,
      }),
    }))
    const ledger = await loadLedgerState(
      id,
      incoming.map((i) => i.identity.fitidKey).filter((k): k is string => k !== null),
      incoming.map((i) => i.identity.contentHash),
    )
    const r = applyIdentityGate(incoming, ledger)
    const pct = ((r.toInsert.length / existing.length) * 100).toFixed(0)
    const emoji = r.toInsert.length === 0 ? '✅' : '🚨'
    console.log(
      `  ${emoji} ${name} (${existing.length} tx): toInsert=${r.toInsert.length} (${pct}%) skipped=${r.skipped.length} (fitid=${r.stats.skippedFitid} content=${r.stats.skippedContent})`,
    )
  }

  // 2) DRE Receita Cacula 01-18/06
  console.log('\n2) DRE Receita Cacula 01-18/06')
  const receita = await prisma.transaction.findMany({
    where: {
      bankAccount: { companyId: CACULA_ID },
      date: { gte: new Date(PERIODO_INICIO), lt: new Date(PERIODO_FIM) },
      type: 'CREDIT',
      category: { dreGroup: 'RECEITA_BRUTA' },
    },
    select: { amount: true },
  })
  const total = receita.reduce((s, t) => s + t.amount, 0)
  console.log(`  Receita bruta: R$ ${total.toFixed(2)}`)
  console.log(`  TARGET: R$ 254.861,29`)
  const delta = Math.abs(total - 254861.29)
  console.log(`  Δ: R$ ${delta.toFixed(2)}`)

  // 3) Saldos vs LEDGERBAL
  console.log('\n3) Saldos das 3 contas vs LEDGERBAL')
  const accounts = await prisma.bankAccount.findMany({
    where: { id: { in: [BANRISUL_ID, SICREDI_ID, STONE_ID] } },
    select: { id: true, name: true, balance: true },
  })
  const targets = {
    [BANRISUL_ID]: LEDGERBAL_BANRISUL,
    [SICREDI_ID]: LEDGERBAL_SICREDI,
    [STONE_ID]: LEDGERBAL_STONE,
  } as Record<string, number>
  for (const a of accounts) {
    const tgt = targets[a.id]
    const dif = Math.abs(a.balance - tgt)
    const emoji = dif < 1 ? '✅' : '🚨'
    console.log(`  ${emoji} ${a.name}: cache=${a.balance.toFixed(2)} | LEDGERBAL=${tgt.toFixed(2)} | Δ=${dif.toFixed(2)}`)
  }
}

// ────────────────────────────────────────────────────────────────────────
async function main() {
  const phase = process.argv.find((a) => a.startsWith('--phase='))?.split('=')[1]
  const confirmed = process.argv.includes('--confirmed=true')
  if (!phase) {
    console.log('Usage: --phase=manifest|apply|backfill|revalidar [--confirmed=true]')
    process.exit(1)
  }
  switch (phase) {
    case 'manifest':
      await showManifest()
      break
    case 'apply':
      await applyChanges(confirmed)
      break
    case 'backfill':
      await backfill(confirmed)
      break
    case 'revalidar':
      await revalidar()
      break
    default:
      console.log('Phase desconhecida:', phase)
      process.exit(1)
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
