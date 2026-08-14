// Orquestrador do import OFX no caminho RECONCILE_V2.
// CHAMADO SOMENTE quando isReconcileV2Enabled() === true. Caminho legado intacto.
//
// Fluxo:
//   1. parseOFX (existente) extrai 1 StatementLine por <STMTTRN>
//   2. Reconcilia bidirecionalmente contra EFFECTED do DB na janela (Tier 1 + Tier 2)
//   3. Persiste statement_lines + rawOfxBlob (espelho cru pra auditoria — fecha o gap)
//   4. missing → insere como EFFECTED (origin=OFX)
//   5. previews → insere como PAYABLE/RECEIVABLE (NUNCA EFFECTED)
//   6. matched → SKIP (já no DB; ZERO duplicação por FITID reciclado)
//   7. orphans → cria warnings em import_warnings (revisão humana, NUNCA delete auto)
//
// Multi-tenant: todos os writes ficam dentro do bankAccountId recebido (checado upstream).

import type { Prisma, PrismaClient } from '@prisma/client'
import { parseOFX } from '@/lib/ofx/parser'
import { dedupHashOFX } from '@/lib/ofx/dedup'
import type { CategoryOverride } from '@/lib/import-categorization/apply-overrides'
import { applyImportDecisions, type ImportDecision } from '@/lib/ofx/decisions'
import { prepareBalanceTransactions } from '@/lib/balance/prepare'
import { parseStatementFromOFX } from './parse-statement-from-ofx'
import { reconcileStatement } from './reconcile-statement'
import { buildReconcileUniverse } from './reconcile-universe'
import { partitionFutureLines, reconcileLedgerAnchorDay } from '../ofx/future-line'
import { isCanonicalClassifyEnabled } from '../canonical/flag'
import { resolveImportStatuses } from './resolve-import-statuses'
import { resolveBankProfile, resolveStatementAnchor } from '../bank-profiles'
import { stableKey } from './stable-key'
import { buildLineDedupHash, makeOccurrenceCounter } from './line-dedup-hash'
import { isReconcileV2Enabled } from './flag'
import { recalcularSaldoConta } from '@/lib/balance/recalcular'
import { createOfxImportRecord, finalizeOfxImport } from '@/lib/ofx/persist-import'
import type { DbBankTransaction } from './types'

export interface ImportOrchestratorInput {
  bankAccountId: string
  rawOfx: string
  userId: string
  fileName: string
  ipAddress?: string
  userAgent?: string
  // Sprint rawOfxBlob (13/08): registro de import criado CEDO pelo caller (com o
  // blob, status PROCESSING) — o orchestrator só ATUALIZA (finalize). Se ausente,
  // cria via createOfxImportRecord (backward-compat). Ou seja: SEMPRE grava blob.
  importId?: string
  // Override opcional pro corte min(DTASOF, today). Default = new Date().
  // Em testes ou simulações determinísticas é útil; em prod normal não passar.
  today?: Date
  // Categorias escolhidas pelo usuário no preview (mapa dedupHash → categoryId).
  // A CHAVE é o `dedupHashOFX` (sha256 fitid|date|valor|memo) — a MESMA que o
  // client conhece do preview (`filtrarNovasOFX`), NÃO o stableKey nem o
  // dedupHash de linha armazenado (stableKey#importId:occ). Recomputada por
  // linha na criação. Espelha o applyCategoryOverrides do caminho V1.
  categoryOverrides?: CategoryOverride[]
  // Decisões declarativas do preview (dedupHash → CREATE_NEW/SKIP/…). Linha
  // marcada SKIP NÃO vira tx (Etapa 3a — paridade com o V1). Mesma chave
  // dedupHashOFX dos categoryOverrides. Sem isto, "preview ≠ confirm" no V2.
  decisions?: ImportDecision[]
}

export interface ImportOrchestratorResult {
  importId: string
  ledgerBalance: number | null
  dtAsOf: Date
  classification: {
    effected: number
    preview: number
    previewAlreadyExisting: number // previews que já existem como PAYABLE no DB
    skippedMatched: number
    orphanWarnings: number
    promoted: number // previews (PAYABLE/RECEIVABLE) que realizaram → EFFECTED
    promotionSkippedConciliada: number // previews conciliadas preservadas (não promovidas)
    discardedFuture: number // linhas futuras descartadas (agendado — não importado)
  }
  // Linhas futuras descartadas no import (2.4b — mostrar na tela, nunca sumir).
  discardedFuture: Array<{
    date: string
    signedAmount: number
    memo: string
    fitid: string | null
  }>
  // Validação de fechamento: saldo calculado x LEDGERBAL. null = fechou.
  ledgerMismatch: { saldoCalculado: number; ledgerBal: number; diferenca: number } | null
  matchedExact: number
  matchedFuzzy: number
  warnings: Array<{
    dbTxId: string
    reason: string
    memo: string
    signedAmount: number
    date: string
    fitid: string | null
  }>
  insertedTxIds: string[]
  insertedWarningIds: string[]
}

type Tx = Prisma.TransactionClient | PrismaClient

/**
 * Resolve a categoria de UMA linha EFFECTED nova a partir dos overrides do
 * preview. A chave de casamento é o `dedupHashOFX` (fitid|date|valor|memo) —
 * recomputado da linha, idêntico ao que o client enviou (`filtrarNovasOFX`).
 * Espelha o applyCategoryOverrides do V1: categoria → RECONCILED/MANUAL/conf 1;
 * sem override (ou override null = "A classificar") → PENDING/sem categoria.
 * Puro — exportado só pra teste.
 */
export function resolveLineOverride(
  overrideMap: Map<string, string | null>,
  line: { datePosted: Date; signedAmount: number; memo: string; fitid?: string | null },
): { categoryId: string | null; status: 'PENDING' | 'RECONCILED'; classificationSource: 'MANUAL' | null; aiConfidence: number | null } {
  const type = line.signedAmount >= 0 ? 'CREDIT' : 'DEBIT'
  const ofxHash = dedupHashOFX({
    datePosted: line.datePosted,
    type,
    amount: Math.abs(line.signedAmount),
    memo: line.memo,
    fitid: line.fitid ?? '',
  })
  const cat = overrideMap.has(ofxHash) ? overrideMap.get(ofxHash) ?? null : undefined
  return cat
    ? { categoryId: cat, status: 'RECONCILED', classificationSource: 'MANUAL', aiConfidence: 1.0 }
    : { categoryId: null, status: 'PENDING', classificationSource: null, aiConfidence: null }
}

export async function runImportV2(
  tx: Tx,
  input: ImportOrchestratorInput,
): Promise<ImportOrchestratorResult> {
  if (!isReconcileV2Enabled()) {
    throw new Error('runImportV2 chamado mas RECONCILE_V2 desligado — abort')
  }

  // 1. Parse
  const parsed = parseOFX(input.rawOfx)
  if (!parsed.ledgerBalance) throw new Error('OFX sem LEDGERBAL/DTASOF — abort')
  const { lines, dtAsOf: dtAsOfMaybe, ledgerBalance } = parseStatementFromOFX(parsed)
  if (!dtAsOfMaybe) throw new Error('OFX sem DTASOF — abort')
  const dtAsOf = dtAsOfMaybe
  if (lines.length === 0) throw new Error('OFX sem transações — abort')

  // 1.5 DESCARTE DE MOVIMENTO FUTURO (07/08; fix âncora 09/08): o extrato só
  // registra o passado. Linha com data > âncora — o "liquidado até aqui" — NÃO
  // vira transação (é descartada e reportada, nunca some em silêncio).
  //
  // ÂNCORA DIRIGIDA PELO PERFIL DO BANCO (FASE 2, 12/08): resolve pelo BANKID do
  // arquivo. Banrisul/Stone: max(DTASOF, DTEND) (DTASOF = dia da emissão). Sicredi:
  // DTASOF vem no FIM DO MÊS (futuro) → âncora pela última tx real, senão a
  // validação Σ×LEDGERBAL fica toothless e o `ledgerBalDate` no futuro engole tx
  // reais no "dead-zone" última-tx→fim-do-mês. Regra dura: DTASOF>hoje → última tx.
  const importToday = input.today ?? new Date()
  const bankProfile = resolveBankProfile(parsed.bankId)
  const lastRealTxMs = lines.reduce<number | null>((m, l) => {
    const t = l.datePosted.getTime()
    return t <= importToday.getTime() && (m === null || t > m) ? t : m
  }, null)
  const anchorRes = resolveStatementAnchor(bankProfile, {
    dtAsOf,
    dtEnd: parsed.statementEnd,
    lastRealTxDate: lastRealTxMs != null ? new Date(lastRealTxMs) : null,
    today: importToday,
  })
  const anchor = anchorRes.anchor ?? dtAsOf
  console.log(`[RECONCILE_V2] banco=${bankProfile?.id ?? 'DESCONHECIDO'} âncora=${anchor.toISOString().slice(0, 10)} regra=${anchorRes.rule} — ${anchorRes.reason}`)
  // O JUIZ (Wiring 14/08, flag CANONICAL_CLASSIFY_ENABLED) — a decisão ÚNICA do que
  // importa: canônico (Camada 1) → saldoAntes encadeado dos extratos anteriores →
  // LEDGERBAL (Camada 2). SUBSTITUI a partição por data, o descarte por FITID==YYMMDD
  // (a 2ª cópia, ver skipPreviewSeparation abaixo) E o anchor-day — tudo pelo saldo
  // que o banco declara. O PREVIEW chama a MESMA função (resolveImportStatuses) →
  // impossível a tela mostrar uma coisa e o confirm gravar outra. `blocked` = o saldo
  // não fecha e nada explica → NÃO grava (nunca em silêncio). Fallback pro legado se
  // o alinhamento por índice quebrar. Flag OFF = rollback instantâneo pro legado.
  let realLines: typeof lines
  let futureLines: typeof lines
  let judgeRan = false
  if (isCanonicalClassifyEnabled()) {
    const { classify } = await resolveImportStatuses(tx, {
      bankAccountId: input.bankAccountId,
      parsed,
      rawOfx: input.rawOfx,
      dtServer: input.today ?? new Date(),
      currentImportId: input.importId ?? null,
    })
    if (classify.importable.length === lines.length) {
      if (classify.blocked) {
        // NÃO grava em silêncio — o transaction dá rollback e a msg vai pra tela.
        throw new Error(`[JUIZ] ${classify.message ?? 'o saldo do banco não fecha — import não gravado.'}`)
      }
      realLines = lines.filter((_, i) => classify.importable[i])
      futureLines = lines.filter((_, i) => !classify.importable[i])
      judgeRan = true
      console.log(
        `[JUIZ] ${classify.judge.outcome} — ${realLines.length} importadas, ${futureLines.length} fora | ${classify.judge.reclassifications.length} reclass | saldoAntes ${classify.saldoAntes.outcome}=${classify.saldoAntes.saldoAntes}`,
      )
    } else {
      console.warn(`[JUIZ] alinhamento quebrou (${classify.importable.length}≠${lines.length}) — fallback pro legado`)
      ;({ realLines, futureLines } = partitionFutureLines(lines, anchor, input.today))
    }
  } else {
    ;({ realLines, futureLines } = partitionFutureLines(lines, anchor, input.today))
  }
  const futureSet = new Set(futureLines)
  if (futureLines.length > 0) {
    console.log(`[RECONCILE_V2] ${futureLines.length} linha(s) futura(s) descartada(s) (agendado — não importado)`)
  }

  // 2. Janela: minDate → dtAsOf (usa todas as linhas p/ largura; futuras são +tarde)
  const minDate = lines.reduce((m, l) => (l.datePosted < m ? l.datePosted : m), lines[0].datePosted)

  // 3. Fetch tx EFFECTED da conta na janela (pra reconcile real_lines)
  // + tx PAYABLE/RECEIVABLE da janela (pra deduplicar previews — evita recriar
  // o agendado que já existe). Inclui também a janela > dtAsOf pq previews têm
  // datePosted no FUTURO (ex: PAGAMENTO CARTAO 15/06 quando DTASOF=12/06).
  const dbEffected = await tx.transaction.findMany({
    where: {
      bankAccountId: input.bankAccountId,
      lifecycle: 'EFFECTED',
      date: { gte: minDate, lte: dtAsOf },
    },
    select: {
      id: true, date: true, createdAt: true, type: true, amount: true,
      bankAccountId: true, transferGroupId: true, externalId: true, description: true,
    },
  })

  // Pending (PAYABLE/RECEIVABLE) — janela ESTENDIDA pra cobrir previews futuros
  // (ex: agendado 15/06 > DTASOF 12/06)
  const dbPending = await tx.transaction.findMany({
    where: {
      bankAccountId: input.bankAccountId,
      lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] },
      date: { gte: minDate, lte: new Date(dtAsOf.getTime() + 365 * 24 * 60 * 60 * 1000) },
    },
    select: {
      id: true, date: true, type: true, amount: true, description: true,
      lifecycle: true, externalId: true, transferGroupId: true,
      reconcileGroupId: true, reconciledWithId: true,
    },
  })

  const groupIds = [
    ...new Set(dbEffected.filter((t) => t.transferGroupId).map((t) => t.transferGroupId!)),
  ]
  const sisters = groupIds.length
    ? await tx.transaction.findMany({
        where: { transferGroupId: { in: groupIds }, bankAccountId: { not: input.bankAccountId } },
        select: {
          id: true, date: true, createdAt: true, type: true, amount: true,
          bankAccountId: true, transferGroupId: true,
        },
      })
    : []

  const allForPrepare: any[] = [...dbEffected, ...sisters]
  const signedList = prepareBalanceTransactions(allForPrepare as any, input.bankAccountId)
  const signedById = new Map(signedList.map((s) => [s.id, s.signedAmount]))

  // Universo de reconcile = EFFECTED (linhas reais já materializadas) + PAYABLE/
  // RECEIVABLE (previews já existentes). Incluir os pending é o FIX do bug de
  // duplicata: sem eles, uma linha real que casa com uma preview criada por outro
  // import virava `missing` e era RECRIADA (duplicata). Agora casa → PROMOVE.
  // `buildReconcileUniverse` é pura e testada (guarda contra voltar a filtrar só
  // EFFECTED). Ver reconcile-universe.test.ts.
  const dbBankTxs: DbBankTransaction[] = buildReconcileUniverse(dbEffected, dbPending, signedById)

  // 4. Reconcile bidirecional (Tier 1 EXACT + Tier 2 FUZZY)
  // Passa `today` pro corte de preview ser min(DTASOF, today) — cobre
  // bancos que declaram DTASOF futuro (Sicredi: 30/06 num extrato de 13/06).
  // Só as linhas REAIS entram no reconcile — as futuras foram descartadas acima.
  // Quando O JUIZ rodou, só as importáveis chegam aqui e a conciliação é PURA (não
  // re-separa preview por FITID — a 2ª cópia da heurística que mordeu no 13/08).
  const result = reconcileStatement(realLines, dbBankTxs, dtAsOf, input.today, {
    skipPreviewSeparation: judgeRan,
  })

  // 4.5 CAMADA 2 — DESCARTE DE AGENDADA DO DIA DA ÂNCORA (11/08/2026). A CAMADA 1
  // (data) usa `> âncora`, então a linha com data IGUAL à âncora escapa. O banco
  // emite o extrato às 01h já listando um débito que só liquida às ~9h — o
  // LEDGERBAL NÃO o inclui. Se `saldoAntes + Σ(linhas novas efetivadas)` não fecha
  // com o LEDGERBAL e a diferença bate EXATO com um subconjunto do dia da âncora,
  // essas linhas são AGENDADAS (não importadas), igual às futuras. Fora do dia da
  // âncora / ambíguo / sem casamento → NÃO mexe (só a CAMADA 1 + validação avisam).
  // Ver lib/ofx/future-line.ts:reconcileLedgerAnchorDay.
  // ⚠️ Quando O JUIZ rodou (judgeRan), ele JÁ resolveu o anchor-day (e qualquer
  // linha não-liquidada, via LEDGERBAL + saldoAntes) — a CAMADA 2 legada não roda
  // (seria uma 2ª decisão sobre a mesma coisa). Flag OFF → CAMADA 2 legada segue.
  let effectiveMissing = result.missing
  if (ledgerBalance != null && !judgeRan) {
    const contaAntes = await tx.bankAccount.findUnique({
      where: { id: input.bankAccountId },
      select: { balance: true },
    })
    // Promovidas (PAYABLE/RECEIVABLE→EFFECTED) também entram no saldo projetado,
    // mas NÃO são reagendáveis (já eram preview) → dobram na base, não em newLines.
    const promotedSum = result.promoted.reduce((s, p) => s + p.statementLine.signedAmount, 0)
    const camada2 = reconcileLedgerAnchorDay({
      newLines: result.missing.map((l, i) => ({
        key: String(i),
        type: l.signedAmount >= 0 ? ('CREDIT' as const) : ('DEBIT' as const),
        amount: Math.abs(l.signedAmount),
        datePosted: l.datePosted,
      })),
      balanceAtual: (contaAntes?.balance ?? 0) + promotedSum,
      ledgerBalance,
      anchor,
    })
    if (camada2.resolved && camada2.scheduledKeys.length > 0) {
      const schedIdx = new Set(camada2.scheduledKeys.map(Number))
      const agendadas = result.missing.filter((_, i) => schedIdx.has(i))
      effectiveMissing = result.missing.filter((_, i) => !schedIdx.has(i))
      for (const a of agendadas) {
        futureLines.push(a)
        futureSet.add(a)
      }
      console.log(
        `[RECONCILE_V2] CAMADA 2: ${agendadas.length} linha(s) do dia da âncora AGENDADA(s) (banco listou, não liquidou) — não importada(s): ${agendadas.map((a) => `${a.memo} ${a.signedAmount}`).join(' | ')}`,
      )
    } else if (camada2.ambiguous) {
      console.warn(
        `[RECONCILE_V2] CAMADA 2 AMBÍGUA: diferença ${camada2.residualDiff} bate com +1 subconjunto do dia da âncora — NÃO reclassificado (revisar manualmente)`,
      )
    } else if (!camada2.resolved && Math.abs(camada2.residualDiff) > 0.02) {
      console.warn(
        `[RECONCILE_V2] CAMADA 2: saldo não fecha (dif ${camada2.residualDiff}) e não bate com linha do dia da âncora — divergência histórica, nada reclassificado`,
      )
    }
  }

  // Overrides de categoria do preview, indexados por dedupHashOFX (a chave que
  // o client envia). Só afeta linhas EFFECTED novas (previews PAYABLE/RECEIVABLE
  // seguem sem categoria, igual ao V1). value null = "manter A classificar".
  const overrideMap = new Map<string, string | null>()
  for (const o of input.categoryOverrides ?? []) overrideMap.set(o.dedupHash, o.categoryId)
  let overridesApplied = 0

  // 5. Criar OfxImport + rawOfxBlob
  const bankAcc = await tx.bankAccount.findUniqueOrThrow({
    where: { id: input.bankAccountId },
    select: { companyId: true },
  })

  // Registro do import: se o caller já criou CEDO (com blob, PROCESSING), usa —
  // e finaliza no fim. Senão cria via helper (SEMPRE grava o blob). Nunca mais
  // um OfxImport sem o cru. Ver lib/ofx/persist-import.ts.
  const newImport =
    input.importId != null
      ? { id: input.importId }
      : await createOfxImportRecord(tx, {
          bankAccountId: input.bankAccountId,
          userId: input.userId,
          fileName: input.fileName,
          fileSize: input.rawOfx.length,
          rawOfx: input.rawOfx,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
          totalTransactions: parsed.transactions.length,
        })

  // 6. Persistir statement_lines (espelho cru, COM flag isPreview por linha).
  // Persiste TODAS as linhas (inclui as futuras descartadas) pra auditoria; a
  // flag isPreview marca a linha futura que NÃO virou transação.
  for (const line of lines) {
    const sk = stableKey({ date: line.datePosted, signedAmount: line.signedAmount, memo: line.memo })
    const isPrev = futureSet.has(line) // mesma partição do descarte (fonte única)
    await tx.$executeRaw`
      INSERT INTO statement_lines (id, "importId", "bankAccountId", "datePosted", "signedAmount", memo, fitid, "stableKey", "isPreview")
      VALUES (gen_random_uuid()::text, ${newImport.id}, ${input.bankAccountId}, ${line.datePosted}, ${line.signedAmount}, ${line.memo}, ${line.fitid ?? null}, ${sk}, ${isPrev})
    `
  }

  // 7. EFFECTED para missing (linhas reais novas — não previews)
  // dedupHash = identidade de LINHA (stableKey + batch + ocorrência). NUNCA o
  // stableKey puro: 2 linhas reais idênticas (mesmo stableKey) precisam virar 2
  // transações — o stableKey puro colidiria no @@unique. Ver ./line-dedup-hash.
  const nextOcc = makeOccurrenceCounter()
  const insertedTxIds: string[] = []
  // Decisões do preview (SKIP não vira tx) — mesma chave dedupHashOFX dos
  // categoryOverrides, mesma função pura do V1 (applyImportDecisions). Aplica
  // ANTES de criar, tanto em EFFECTED (missing) quanto em previews.
  const ofxHashOf = (line: { datePosted: Date; signedAmount: number; memo: string; fitid?: string | null }) =>
    dedupHashOFX({
      datePosted: line.datePosted,
      type: line.signedAmount >= 0 ? 'CREDIT' : 'DEBIT',
      amount: Math.abs(line.signedAmount),
      memo: line.memo,
      fitid: line.fitid ?? '',
    })
  const missingDecided = applyImportDecisions(
    effectiveMissing.map((l) => ({ line: l, dedupHash: ofxHashOf(l) })),
    input.decisions,
  )
  let skippedByDecision = missingDecided.skipped
  for (const { line } of missingDecided.filtered) {
    const sk = stableKey({ date: line.datePosted, signedAmount: line.signedAmount, memo: line.memo })
    const type = line.signedAmount >= 0 ? 'CREDIT' : 'DEBIT'
    // Casa o override do preview pela MESMA chave que o client usou (dedupHashOFX).
    const ov = resolveLineOverride(overrideMap, line)
    if (ov.status === 'RECONCILED') overridesApplied += 1
    const created = await tx.transaction.create({
      data: {
        bankAccountId: input.bankAccountId,
        date: line.datePosted,
        description: line.memo,
        amount: Math.abs(line.signedAmount),
        type,
        // Categoria do usuário → RECONCILED (igual V1). Sem categoria → PENDING.
        status: ov.status,
        categoryId: ov.categoryId,
        classificationSource: ov.classificationSource,
        aiConfidence: ov.aiConfidence,
        origin: 'OFX',
        externalId: line.fitid ?? null,
        importId: newImport.id,
        lifecycle: 'EFFECTED',
        counterpartyName: line.counterpartyName ?? null,
        counterpartySource: line.counterpartyName ? 'OFX' : null,
        dedupHash: buildLineDedupHash(sk, newImport.id, nextOcc(sk)),
      },
      select: { id: true },
    })
    insertedTxIds.push(created.id)
  }
  // Reflete no relatório do import quantas entraram já categorizadas.
  if (overridesApplied > 0) {
    await tx.ofxImport.update({ where: { id: newImport.id }, data: { autoClassified: overridesApplied } })
  }

  // 8. MOVIMENTO FUTURO — DESCARTADO (decisão de produto 07/08). NÃO cria mais
  // PAYABLE/RECEIVABLE a partir do extrato (extrato = passado; previsão vem de
  // Contas a Pagar cadastradas). As `futureLines` são só reportadas pra tela.
  // `result.previews` deve vir vazio (as futuras já saíram antes do reconcile);
  // se por acaso vier algo (YYMMDD residual), some ao descarte + loga.
  const descartadasFuturas = [
    ...futureLines,
    ...result.previews, // rede: qualquer preview que escapou também é descartada
  ].map((l) => ({
    date: l.datePosted.toISOString().slice(0, 10),
    signedAmount: l.signedAmount,
    memo: l.memo,
    fitid: l.fitid ?? null,
  }))
  if (result.previews.length > 0) {
    console.log(`[RECONCILE_V2] ${result.previews.length} preview residual descartada (não deveria ocorrer pós-partição)`)
  }

  // 8.4. PROMOÇÃO (fix duplicata 07/08): linha REAL do extrato que casou com uma
  // PREVIEW (PAYABLE/RECEIVABLE) já existente → a preview realizou. Promove
  // lifecycle→EFFECTED em vez de recriar (elimina a duplicata preview↔real entre
  // imports). Só mexe no lifecycle → HERDA categoria, transferGroupId e vínculos.
  // RISCO conciliada: se a preview já está conciliada (reconcileGroupId OU
  // reconciledWithId), NÃO promove — mexer poderia quebrar a soma N:1 da
  // conciliação. Deixa como está (o dedup já impede a duplicata) e sinaliza.
  const conciliadaIds = new Set(
    dbPending.filter((t) => t.reconcileGroupId || t.reconciledWithId).map((t) => t.id),
  )
  let promotedCount = 0
  let promotionSkippedConciliada = 0
  for (const m of result.promoted) {
    if (conciliadaIds.has(m.dbTx.id)) {
      promotionSkippedConciliada += 1
      continue
    }
    // Só lifecycle. paymentDate segue NULL/como estava; a competência do DRE usa
    // `date` (que == datePosted da linha real, pois casaram por stableKey=data).
    await tx.transaction.update({
      where: { id: m.dbTx.id },
      data: { lifecycle: 'EFFECTED' },
    })
    promotedCount += 1
  }
  if (promotedCount > 0 || promotionSkippedConciliada > 0) {
    console.log(
      `[RECONCILE_V2] promoção: ${promotedCount} preview(s)→EFFECTED, ${promotionSkippedConciliada} conciliada(s) preservada(s)`,
    )
  }

  // 8.5. Sprint Cartao R2 (24/06/2026) — marca tx que parecem PAGAMENTO DE
  // CARTAO como isCardPayment=true (sem cartao vinculado ainda — fica
  // aguardando casar com fatura PDF). Filtro do DRE/cashflow ja pula
  // isCardPayment=true, entao a tx sai do DRE imediatamente.
  if (insertedTxIds.length > 0) {
    const { detectCardPayment } = await import('@/lib/credit-card-pj/payment-detector')
    const justCreated = await tx.transaction.findMany({
      where: { id: { in: insertedTxIds } },
      select: { id: true, description: true, type: true },
    })
    const cardPaymentIds = justCreated
      .filter((t) => detectCardPayment({ description: t.description, type: t.type }).isLikely)
      .map((t) => t.id)
    if (cardPaymentIds.length > 0) {
      await tx.transaction.updateMany({
        where: { id: { in: cardPaymentIds } },
        data: { isCardPayment: true },
      })
    }
  }

  // Corrige a contagem do import quando o usuário pediu SKIP no preview
  // (newTransactions foi setado antes dos loops, com o total pré-skip).
  if (skippedByDecision > 0) {
    await tx.ofxImport.update({
      where: { id: newImport.id },
      data: { newTransactions: insertedTxIds.length },
    })
    console.log(`[RECONCILE_V2] ${skippedByDecision} linha(s) puladas por decisão SKIP do preview`)
  }

  // 9. Warnings para orphans (NUNCA delete automático)
  const insertedWarningIds: string[] = []
  const warningsOut: ImportOrchestratorResult['warnings'] = []
  for (const orf of result.orphans) {
    const reason = `ORPHAN_RECONCILE_V2: ${orf.memo} | ${orf.signedAmount.toFixed(2)} | ${orf.date.toISOString().slice(0, 10)} | FITID=${orf.fitid ?? '-'}`
    const warn = await tx.importWarning.create({
      data: {
        companyId: bankAcc.companyId,
        bankAccountId: input.bankAccountId,
        importId: newImport.id,
        newTxId: orf.id, // tx que precisa revisão = a própria órfã
        suspectedDupId: orf.id, // sem duplicata equivalente — aponta pra si mesma
        similarity: 0,
        reason,
      },
      select: { id: true },
    })
    insertedWarningIds.push(warn.id)
    warningsOut.push({
      dbTxId: orf.id,
      reason,
      memo: orf.memo,
      signedAmount: orf.signedAmount,
      date: orf.date.toISOString().slice(0, 10),
      fitid: orf.fitid ?? null,
    })
  }

  // 10. DEFEITO 1 fix (31/07): grava o LEDGERBAL declarado pelo OFX + recalcula o
  // saldo da conta DENTRO deste mesmo $transaction (antes o V2 nunca recalculava
  // → saldo ficava travado). recalcularSaldoConta ANCORA no ledgerBal, então
  // NUNCA assume abertura 0 — respeita a abertura/histórico da conta.
  //
  // ledgerBalDate = ÂNCORA do perfil, NÃO o DTASOF cru (FASE 2, 12/08). Pro
  // Banrisul/Stone é o mesmo (âncora==DTASOF). Pro Sicredi conserta o dead-zone:
  // com DTASOF=31/08 (futuro), o recalc `Σ(EFFECTED > ledgerBalDate)` engolia tx
  // reais entre a última tx e o fim do mês; com a âncora na última tx real, elas
  // voltam a contar e a validação Σ×LEDGERBAL volta a ter dente.
  await tx.bankAccount.update({
    where: { id: input.bankAccountId },
    data: { ledgerBal: ledgerBalance, ledgerBalDate: anchor },
  })
  const recalc = await recalcularSaldoConta(tx, input.bankAccountId)

  // 11. VALIDAÇÃO DE FECHAMENTO (07/08): o saldo realizado (só EFFECTED, ancorado)
  // TEM que bater com o LEDGERBAL declarado pelo banco. Se não bater, alguma linha
  // foi classificada errado (real descartada como futura, ou vice-versa) — AVISA
  // em vez de gravar calado. Vale pra QUALQUER banco. Tolerância R$ 0,02.
  let ledgerMismatch: ImportOrchestratorResult['ledgerMismatch'] = null
  if (ledgerBalance != null && Math.abs(recalc.saldoDepois - ledgerBalance) > 0.02) {
    ledgerMismatch = {
      saldoCalculado: recalc.saldoDepois,
      ledgerBal: ledgerBalance,
      diferenca: Math.round((recalc.saldoDepois - ledgerBalance) * 100) / 100,
    }
    console.warn(
      `[RECONCILE_V2] LEDGERBAL NÃO FECHA: calculado ${recalc.saldoDepois} vs LEDGERBAL ${ledgerBalance} (dif ${ledgerMismatch.diferenca}) — revisar classificação`,
    )
  }

  // 12. FINALIZE (Sprint rawOfxBlob 2.4): fecha o registro com status + contadores
  // + CONTEXTO DA DECISÃO (âncora, regra, perfil de banco, LEDGERBAL fechou?, dif).
  // O blob já foi gravado na criação (cedo). Aqui vai o que o SISTEMA entendeu.
  await finalizeOfxImport(tx, newImport.id, {
    status: 'SUCCESS',
    totalTransactions: parsed.transactions.length,
    newTransactions: effectiveMissing.length + result.previews.length,
    duplicates: result.matched.length,
    autoClassified: overridesApplied,
    futureDiscarded: descartadasFuturas.length,
    periodStart: minDate,
    periodEnd: dtAsOf,
    anchorDate: anchor,
    anchorRule: anchorRes.rule,
    bankProfile: bankProfile?.id ?? null,
    ledgerBalAmount: ledgerBalance,
    ledgerBalMatched: ledgerBalance != null ? ledgerMismatch === null : null,
    ledgerBalDiff: ledgerMismatch?.diferenca ?? null,
  })

  return {
    importId: newImport.id,
    ledgerBalance,
    dtAsOf,
    classification: {
      effected: effectiveMissing.length,
      // Movimento futuro NÃO é mais criado — é descartado. preview=0 sempre.
      preview: 0,
      previewAlreadyExisting: 0,
      skippedMatched: result.matched.length,
      orphanWarnings: result.orphans.length,
      promoted: promotedCount,
      promotionSkippedConciliada,
      discardedFuture: descartadasFuturas.length,
    },
    discardedFuture: descartadasFuturas,
    ledgerMismatch,
    matchedExact: result.matched.filter((m) => m.confidence === 'EXACT').length,
    matchedFuzzy: result.matched.filter((m) => m.confidence === 'FUZZY').length,
    warnings: warningsOut,
    insertedTxIds,
    insertedWarningIds,
  }
}
