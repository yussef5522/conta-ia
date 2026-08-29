import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseOFX } from '@/lib/ofx/parser'
import { detectarBanco, bateComPerfilDaConta } from '@/lib/ofx/bancos'
import { dedupHashOFX, filtrarNovasOFX } from '@/lib/ofx/dedup'
import { computeIdentity } from '@/lib/import-identity/compute-identity'
import { computeFileHash } from '@/lib/import-identity/file-hash'
import { createOfxImportRecord, finalizeOfxImport } from '@/lib/ofx/persist-import'
import { applyIdentityGate, type GateInput } from '@/lib/import-identity/apply-gate'
import { loadLedgerState } from '@/lib/import-identity/ledger-queries'
import { findBatchWarnings } from '@/lib/import-identity/batch-overlap'
import { reconcileTransferPlaceholders } from '@/lib/import-identity/reconcile-placeholder'
import { predictSuggestionsForPreview } from '@/lib/import-categorization/predict-for-preview'
import { loadPredictionContext } from '@/lib/import-categorization/load-prediction-context'
import {
  applyCategoryOverrides,
  persistNewRules,
  type CategoryOverride,
  type NewRuleSpec,
} from '@/lib/import-categorization/apply-overrides'
import {
  buildLegacyPreviewPayload,
  buildV2PreviewPayload,
  isV2PreviewEnabled,
} from '@/lib/ofx/preview-v2'
import {
  autoClassifyTransactions,
  buildRuleIndex,
  loadActiveRules,
  persistKeywordSuggestions,
} from '@/lib/ai-categorizer/apply'
import { ensureAllSystemCategories } from '@/lib/categorias/ensure-system-categories'
import {
  loadPatternsForSetor,
  resolveSetorCategoryId,
} from '@/lib/categorization/match-setor-pattern'
import { isReconcileV2Enabled } from '@/lib/reconciliation/flag'
import { runImportV2, reconcileImportLines } from '@/lib/reconciliation/import-orchestrator'
import type { StatementLine } from '@/lib/reconciliation/types'
import { stableKey } from '@/lib/reconciliation/stable-key'
import { filterToReconcileMissing } from '@/lib/reconciliation/filter-new-by-reconcile'
import { recomputeVendasSafe } from '@/lib/vendas/recompute-hook'
import { toFriendlyImportError } from '@/lib/ofx/import-error-message'
import {
  applyImportDecisions,
  importDecisionsSchema,
  type ImportDecision,
} from '@/lib/ofx/decisions'
import { partitionFutureLines, settledThroughDate } from '@/lib/ofx/future-line'
import { contentKey } from '@/lib/canonical/to-canonical'
import { isCanonicalClassifyEnabledForBank } from '@/lib/canonical/flag'
import { resolveImportStatuses } from '@/lib/reconciliation/resolve-import-statuses'
import { resolveBankProfile, resolveStatementAnchor, bankProfileWarning } from '@/lib/bank-profiles'
import { avisoExportMesmoDia } from '@/lib/ofx/export-mesmo-dia'
import { verifyOfxMatchesAccount } from '@/lib/ofx/verify-account-match'
import { conciliarDestinos } from '@/lib/ofx/conciliar-destinos'

interface Params { params: Promise<{ id: string }> }

async function verificarAcesso(userId: string, contaId: string) {
  return prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId } } } },
  })
}

// POST /api/contas-bancarias/[id]/importar-ofx
// Body: multipart/form-data com campo "file" (arquivo .ofx ou .qfx)
// Query: ?preview=true retorna preview sem inserir; sem ?preview insere as transações
export async function POST(request: NextRequest, { params }: Params) {
  const { id: contaId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const conta = await verificarAcesso(user.sub, contaId)
  if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  const isPreview = request.nextUrl.searchParams.get('preview') === 'true'

  let rawContent: string
  let uploadedFileName = 'extrato.ofx'
  // Sprint Import Categoria Editável (18/06/2026): overrides do usuário
  // (mapa dedupHash -> categoryId) + regras a persistir após sucesso.
  let categoryOverrides: CategoryOverride[] = []
  // ⭐⭐ MARCAÇÕES DA REVISÃO (29/08) — vêm no MESMO payload do confirm, como os
  // categoryOverrides e as decisions, e são aplicadas DENTRO da transação do import.
  // Antes iam numa 2ª chamada (`/apply-marks`) que falhava em silêncio.
  let marksDoPreview: Array<{ ofxHash: string; kind: string; params?: Record<string, unknown> }> = []
  let newRules: NewRuleSpec[] = []
  // Sprint Preview-Truth (29/06/2026): decisões declarativas por linha
  // (dedupHash → action). SKIP = não cria a tx; CREATE_NEW (ou ausência)
  // segue. Garante "o preview = o que entra".
  let decisions: ImportDecision[] = []
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ erro: 'Arquivo OFX não enviado' }, { status: 400 })
    }
    uploadedFileName = (file as File).name || 'extrato.ofx'
    rawContent = await (file as File).text()
    const overridesRaw = formData.get('categoryOverrides')
    const marksRaw = formData.get('marks')
    if (typeof marksRaw === 'string' && marksRaw) {
      try {
        const parsedMarks = JSON.parse(marksRaw)
        if (Array.isArray(parsedMarks)) marksDoPreview = parsedMarks
      } catch { /* payload torto não derruba o import */ }
    }
    if (typeof overridesRaw === 'string' && overridesRaw.trim()) {
      try {
        const parsed = JSON.parse(overridesRaw)
        if (Array.isArray(parsed)) categoryOverrides = parsed
      } catch {}
    }
    const rulesRaw = formData.get('newRules')
    if (typeof rulesRaw === 'string' && rulesRaw.trim()) {
      try {
        const parsed = JSON.parse(rulesRaw)
        if (Array.isArray(parsed)) newRules = parsed
      } catch {}
    }
    const decisionsRaw = formData.get('decisions')
    if (typeof decisionsRaw === 'string' && decisionsRaw.trim()) {
      try {
        const parsed = JSON.parse(decisionsRaw)
        const validated = importDecisionsSchema.safeParse(parsed)
        if (validated.success) decisions = validated.data
      } catch {}
    }
  } catch {
    return NextResponse.json({ erro: 'Erro ao ler arquivo' }, { status: 400 })
  }

  const parsedOfx = parseOFX(rawContent)
  const { transactions, errors, bankId, accountId, ledgerBalance, statementEnd } = parsedOfx

  if (transactions.length === 0) {
    return NextResponse.json({
      erro: 'Nenhuma transação encontrada no arquivo',
      errosParser: errors,
    }, { status: 400 })
  }

  // TRAVA ANTI "OFX NA CONTA ERRADA" (FASE 2.1, 12/08): confere BANKID×bankCode e
  // ACCTID×número da conta. Diverge → RECUSA (preview E confirm), não oferece
  // importar. Mesma proteção que o PDF já tinha. Se não dá pra conferir, vira
  // aviso na tela (bankProfilePayload.accountMatchWarning), não bloqueia.
  const accountMatch = verifyOfxMatchesAccount(
    { bankId, accountId },
    { bankCode: conta.bankCode, bankName: conta.bankName, accountNumber: conta.accountNumber, name: conta.name },
  )
  if (accountMatch.block) {
    return NextResponse.json({ erro: accountMatch.error, code: accountMatch.code }, { status: 400 })
  }

  // ────────────────────────────────────────────────────────────────
  // RECONCILE_V2: motor de conciliação bidirecional (Espelho do Extrato).
  // Flag OFF → caminho legado abaixo segue 100% intacto. Rollback = desligar.
  // Aplicado SÓ no confirm (não no ?preview=true, que já tem seu V2 próprio).
  // ────────────────────────────────────────────────────────────────
  if (!isPreview && isReconcileV2Enabled()) {
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      undefined
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? undefined

    // Sprint rawOfxBlob (13/08): cria o registro CEDO (com o blob, PROCESSING)
    // ANTES da transação de import — o cru sobrevive mesmo se o import falhar ou
    // criar 0 tx (é justo aí que se investiga). O orchestrator só ATUALIZA.
    const preImport = await createOfxImportRecord(prisma, {
      bankAccountId: contaId,
      userId: user.sub,
      fileName: uploadedFileName,
      fileSize: rawContent.length,
      rawOfx: rawContent,
      fileHash: computeFileHash(new TextEncoder().encode(rawContent)),
      source: 'OFX',
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
      totalTransactions: transactions.length,
    })
    try {
      const result = await prisma.$transaction(
        async (tx) =>
          runImportV2(tx, {
            bankAccountId: contaId,
            rawOfx: rawContent,
            userId: user.sub,
            // ⭐ as marcações da revisão vão JUNTO — aplicadas na mesma transação
            marks: marksDoPreview,
            fileName: uploadedFileName,
            ipAddress,
            userAgent,
            // registro já criado com o blob → orchestrator finaliza este id.
            importId: preImport.id,
            // Fix regressão (06/08): repassa as categorias escolhidas no preview.
            // Sem isto o V2 criava tudo PENDING/sem categoria (branch legado
            // applyCategoryOverrides na L657 é inalcançável com a flag ON).
            categoryOverrides,
            // Etapa 3a (06/08): repassa as decisões declarativas (SKIP não vira
            // tx). O route já parseava mas não passava — "preview ≠ confirm" no V2.
            decisions,
          }),
        { timeout: 120000, maxWait: 10000 },
      )
      // GATILHO DE VENDAS (fail-soft, APÓS o commit): o import pode ter criado venda
      // nova → recompute a VendaDiaria da empresa. NUNCA derruba o import — se falhar,
      // loga e segue; o juiz noturno pega (V1 vermelho de manhã). Por companyId.
      await recomputeVendasSafe(prisma, conta.companyId, 'import-ofx/confirm')
      // Contrato: mantém os campos essenciais do legado (`mensagem`,
      // `inseridas`, `duplicadas`, `importId`, `errosParser`) + adiciona
      // métricas novas do V2 (preview/orphan/ledgerBalance).
      const inseridas = result.classification.effected
      // Promovidas = agendados (PAYABLE/RECEIVABLE) legados que realizaram agora.
      const promovidas = result.classification.promoted
      const sufixoPromo = promovidas > 0
        ? ` ${promovidas} agendado${promovidas !== 1 ? 's realizados' : ' realizado'}.`
        : ''
      // 2.4b — movimento futuro descartado (agendado): NUNCA some em silêncio.
      const futuras = result.discardedFuture
      const sufixoFuturas = futuras.length > 0
        ? ` ${futuras.length} lançamento${futuras.length !== 1 ? 's futuros não foram importados' : ' futuro não foi importado'} (agendado — entra quando sair de fato).`
        : ''
      return NextResponse.json({
        mode: 'RECONCILE_V2',
        mensagem: `${inseridas} transaç${inseridas !== 1 ? 'ões importadas' : 'ão importada'}.${sufixoPromo}${sufixoFuturas}`,
        inseridas,
        duplicadas: result.classification.skippedMatched,
        effected: result.classification.effected,
        previewNovas: 0,
        previewJaExistia: 0,
        promovidas,
        // Lista dos futuros descartados (data, valor, descrição) — pra tela mostrar.
        descartadasFuturas: futuras,
        // Aviso de fechamento: saldo calculado x LEDGERBAL não bateu.
        ledgerMismatch: result.ledgerMismatch,
        orphanWarnings: result.classification.orphanWarnings,
        matchedExact: result.matchedExact,
        matchedFuzzy: result.matchedFuzzy,
        warnings: result.warnings,
        importId: result.importId,
        // ⭐⭐ A PONTE preview → gravado (29/08). Sem isto a tela cruzava o `dedupHash` do
        // preview com o gravado — formatos DIFERENTES (o gravado embute o importId, que só
        // existe depois) — e TODA marcação caía em silêncio: o dono escolhia "pagamento de
        // cartão" na revisão e a transação nascia crua, indo pra fila de pendentes.
        txIdByOfxHash: result.txIdByOfxHash,
        marcacoes: result.marcacoesAplicadas,
        ledgerBalance: result.ledgerBalance,
        errosParser: errors,
      })
    } catch (e: unknown) {
      // O blob JÁ está gravado (criado cedo). Marca o registro como FAILED pra
      // ele não ficar PROCESSING pra sempre — mas o cru fica pra investigar.
      await finalizeOfxImport(prisma, preImport.id, {
        status: 'FAILED',
        errorMessage: (e instanceof Error ? e.message : String(e)).slice(0, 500),
      }).catch(() => {})
      // Loga o erro TÉCNICO completo no servidor (pm2) — nunca vai pro client.
      const friendly = toFriendlyImportError(e)
      console.error('[importar-ofx RECONCILE_V2] falhou:', {
        code: friendly.code,
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      })
      // Devolve SÓ a mensagem amigável (sem nome de tabela/coluna/stack).
      return NextResponse.json(
        { erro: friendly.message, code: friendly.code },
        { status: 500 },
      )
    }
  }

  // Detecção de banco a partir do BANKID do OFX (FEBRABAN)
  const bancoDetectado = detectarBanco(bankId)
  const banco = bancoDetectado
    ? {
        codigo: bancoDetectado.codigo,
        nome: bancoDetectado.nome,
        batePerfilConta: bateComPerfilDaConta(
          { bankName: conta.bankName, bankCode: conta.bankCode },
          bancoDetectado,
        ),
      }
    : null

  // Sprint Reconcile Transfer Identity (18/06/2026) — RECONCILE pré-gate.
  // SÓ no caminho de confirm (NÃO no preview, pra não mutar dado em dry-run).
  // Cria importRow early com status=PROCESSING (duplicates atualizado depois)
  // e reconcilia placeholders TRANSFER órfãos (origin=MANUAL/externalId=null)
  // com as linhas reais do OFX antes do gate de identidade.
  let importRowPre: { id: string } | null = null
  let reconciledCount = 0
  let effectiveTxs = transactions
  if (!isPreview) {
    const ipAddressEarly =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null
    const userAgentEarly = request.headers.get('user-agent')?.slice(0, 500) ?? null
    const fileHashEarly = computeFileHash(new TextEncoder().encode(rawContent))
    const datasArquivoEarly = transactions.map((t) => t.datePosted.getTime())
    const periodStartEarly =
      datasArquivoEarly.length > 0 ? new Date(Math.min(...datasArquivoEarly)) : null
    const periodEndEarly =
      datasArquivoEarly.length > 0 ? new Date(Math.max(...datasArquivoEarly)) : null
    // Sprint rawOfxBlob (13/08): caminho V1/legado também grava o cru (via helper).
    importRowPre = await createOfxImportRecord(prisma, {
      bankAccountId: contaId,
      userId: user.sub,
      fileName: uploadedFileName,
      fileSize: rawContent.length,
      rawOfx: rawContent,
      fileHash: fileHashEarly,
      source: 'OFX',
      ipAddress: ipAddressEarly,
      userAgent: userAgentEarly,
      totalTransactions: transactions.length,
      periodStart: periodStartEarly,
      periodEnd: periodEndEarly,
    })
    try {
      const r = await reconcileTransferPlaceholders(prisma, transactions, {
        bankAccountId: contaId,
        companyId: conta.companyId,
        importBatchId: importRowPre.id,
      })
      reconciledCount = r.reconciled.length
      effectiveTxs = r.remaining
    } catch (e) {
      // Falha aqui não trava import — segue com todas as tx originais
      console.error('[importar-ofx] reconcileTransferPlaceholders falhou:', e)
    }
  }

  // Sprint Import Idempotente (18/06/2026) — IDENTIDADE CANÔNICA.
  // Calcula fitidKey + contentHash de TODAS as tx incoming. Esses 2 campos
  // são robustos a re-export do banco (ignora hora/tz; normaliza desc).
  const incomingIdentities = effectiveTxs.map((t) => ({
    payload: t,
    identity: computeIdentity({
      accountId: contaId,
      fitid: t.fitid,
      date: t.datePosted,
      amount: t.amount,
      type: t.type,
      name: undefined,
      memo: t.memo,
    }),
  }))

  // Carrega estado do seen-ledger pra essa conta.
  const ledgerState = await loadLedgerState(
    contaId,
    incomingIdentities
      .map((i) => i.identity.fitidKey)
      .filter((k): k is string => k !== null),
    incomingIdentities.map((i) => i.identity.contentHash),
  )
  const gateResult = applyIdentityGate(incomingIdentities, ledgerState)

  // FileHash do upload (idempotência de arquivo)
  const fileHashHex = computeFileHash(new TextEncoder().encode(rawContent))

  // Período (min/max das datas do arquivo TODO, não só novas)
  const datasArquivo = transactions.map((t) => t.datePosted.getTime())
  const periodArquivoStart =
    datasArquivo.length > 0 ? new Date(Math.min(...datasArquivo)) : null
  const periodArquivoEnd =
    datasArquivo.length > 0 ? new Date(Math.max(...datasArquivo)) : null

  // Warnings pré-import (arquivo exato + overlap período)
  const batchWarnings = await findBatchWarnings(
    contaId,
    fileHashHex,
    periodArquivoStart,
    periodArquivoEnd,
  )

  // Deduplicação por hash composto (ver lib/ofx/dedup.ts) — caminho LEGACY
  // mantido como defesa em profundidade (@@unique [bankAccountId, dedupHash]).
  // O gate de identidade canônica acima já filtrou; sobra só transforma o
  // que `gateResult.toInsert` tem em payload pro pipeline existente.
  const todosHashes = gateResult.toInsert.map((i) => dedupHashOFX(i.payload))
  const existentes = await prisma.transaction.findMany({
    where: { bankAccountId: contaId, dedupHash: { in: todosHashes } },
    select: { dedupHash: true },
  })
  const hashesExistentes = new Set(
    existentes.map((e) => e.dedupHash).filter((h): h is string => h !== null),
  )

  const { novas: novasPreDecisions, duplicadasNoArquivo, duplicadasNoBanco } =
    filtrarNovasOFX(
      gateResult.toInsert.map((i) => i.payload),
      hashesExistentes,
    )
  // Sprint Preview-Truth (29/06/2026) — APLICA DECISÕES DECLARATIVAS.
  // SO no caminho de confirm (não no preview — preview já filtra na UI).
  // SKIP → linha removida; sem decisão → CREATE_NEW default (não perder tx).
  const decisionResult = !isPreview
    ? applyImportDecisions(novasPreDecisions, decisions)
    : { filtered: novasPreDecisions, skipped: 0, implicit: novasPreDecisions.length, orphanDecisionHashes: [] }
  const novas = decisionResult.filtered
  if (!isPreview && (decisionResult.skipped > 0 || decisionResult.implicit > 0 || decisionResult.orphanDecisionHashes.length > 0)) {
    console.log(
      `[importar-ofx] decisions: skipped=${decisionResult.skipped} ` +
        `implicit=${decisionResult.implicit} orphan=${decisionResult.orphanDecisionHashes.length} ` +
        `kept=${novas.length}/${novasPreDecisions.length}`,
    )
  }
  // Duplicatas TOTAIS: o gate + legacy + decisões SKIP (linha desmarcada
  // pelo usuário no preview entra na contagem de "não criadas"). `let` porque o
  // filtro-verdade do reconcile (bug Stone) soma as que o gate não viu como dup.
  let duplicadas =
    duplicadasNoArquivo + duplicadasNoBanco + gateResult.skipped.length + decisionResult.skipped

  // Mapa pra recuperar a identidade canônica de cada `novas[]` (pra salvar
  // em Transaction + criar ImportedIdentity)
  const identityByDedupHash = new Map(
    gateResult.toInsert.map((i) => [dedupHashOFX(i.payload), i.identity]),
  )

  if (isPreview) {
    // Sprint Blob-no-Preview (13/08): SALVA o blob JÁ no preview (status PREVIEW).
    // Foi por NÃO ter isso que não deu pra diagnosticar o 4.092,02 quando o Yussef
    // cancelou — e é justo no import cancelado que tem o que investigar. Reuso por
    // fileHash não duplica (previu 2× = 1 registro; confirmar depois reaproveita).
    // FAIL-SOFT: se falhar, o preview segue normal (não bloqueia o usuário).
    let previewImportId: string | null = null
    try {
      const rec = await createOfxImportRecord(prisma, {
        bankAccountId: contaId,
        userId: user.sub,
        fileName: uploadedFileName,
        fileSize: rawContent.length,
        rawOfx: rawContent,
        fileHash: fileHashHex,
        source: 'OFX',
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
          request.headers.get('x-real-ip') ??
          null,
        userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
        totalTransactions: transactions.length,
        periodStart: periodArquivoStart,
        periodEnd: periodArquivoEnd,
        status: 'PREVIEW',
      })
      previewImportId = rec.id
    } catch (e) {
      console.error('[blob-no-preview] falhou (não bloqueia o preview):', (e as Error).message)
    }

    // Sprint 3-Bugs Fase 2A (Yussef 12/06/2026) — flag IMPORT_PREVIEW_V2
    //
    // Quando V2=true: payload enriquecido com classificação 4-grupos
    //   (skipDup / replaceManual / conciliatePayable / novasGenuinas).
    //   Pré-empta os 3 bugs (FITID reciclado / manual + OFX / Excel↔OFX).
    //
    // Quando V2=false ou ausente: payload IDÊNTICO ao legado (preservado
    //   bit-pra-bit). UI antiga continua funcionando 100%.
    //
    // O /confirm legado (linhas abaixo) NÃO mudou — esta sub-fase é
    // puramente "preview enriquecido". O atomic de criação de tx continua
    // sendo o histórico até a Fase 2D.

    // Sprint OFX V3 R7 (27/06/2026) — FIX 3: categorySuggestions +
    // categoriesForUI passam a ser computados pra AMBOS os caminhos
    // (legacy + V2). Antes ficavam DENTRO do `if (!isV2PreviewEnabled())`
    // e o V3 (que consome esse payload) recebia tudo vazio → tudo virava
    // "escolha você". Agora aproveita as 11 regras + 60 fornecedores que
    // o user já ensinou pra Cacula.
    let categorySuggestions: ReturnType<typeof predictSuggestionsForPreview> = []
    let categoriesForUI: Array<{ id: string; name: string; type: string; dreGroup: string | null; parentId: string | null }> = []
    try {
      const ctx = await loadPredictionContext(conta.companyId)
      categorySuggestions = predictSuggestionsForPreview(
        novas.map((t) => ({
          dedupHash: t.dedupHash,
          description: t.memo,
          amount: t.amount,
          type: t.type,
        })),
        ctx,
      )
      const allCats = await prisma.category.findMany({
        where: { companyId: conta.companyId, isActive: true },
        select: { id: true, name: true, type: true, dreGroup: true, parentId: true },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      })
      categoriesForUI = allCats
    } catch (e) {
      console.error('[importar-ofx preview] categorySuggestions falhou:', e)
    }

    // Sprint OFX V3 R7 (27/06/2026) — FIX 1: passa OwnEntityRefs pra UI
    // detectar transferência interna por sinal forte (CNPJ próprio +
    // nome empresa + nome de outra conta da mesma empresa).
    //
    // Sprint Owner Detection (28/06/2026): refs agora incluem CPFs + nomes
    // dos sócios (SocioPF). Centralizado em loadOwnEntityRefs pra os 6
    // callers usarem o mesmo conjunto sem divergência.
    let ownEntityRefs: import('@/lib/transfers/own-entity-signals').OwnEntityRefs = {
      cnpj: null,
      names: [],
      accountNames: [],
      ownerCpfs: [],
      ownerNames: [],
    }
    try {
      const { loadOwnEntityRefs } = await import('@/lib/transfers/load-own-entity-refs')
      ownEntityRefs = await loadOwnEntityRefs(prisma, conta.companyId)
    } catch (e) {
      console.error('[importar-ofx preview] ownEntityRefs falhou:', e)
    }

    // Sprint Preview-Futuro (09/08/2026) — REGRESSÃO: o descarte de futuro só
    // rodava no CONFIRM; o PREVIEW oferecia as linhas agendadas (10/11/17/08) e
    // ainda concluía "divergência histórica". Aqui particionamos TAMBÉM no
    // preview: as reais alimentam o payload; as futuras vão numa seção separada
    // (não-selecionável na UI) via `futuras`.
    //
    // ÂNCORA DIRIGIDA PELO PERFIL DO BANCO (FASE 2, 12/08): resolve pelo BANKID.
    // Banrisul/Stone: max(DTASOF, DTEND). Sicredi: DTASOF no fim do mês (futuro)
    // → última tx real (senão a validação de saldo fica toothless). Banco
    // desconhecido → conservador + WARNING pra tela (bankProfileWarning).
    const bankProfile = resolveBankProfile(bankId)
    const previewToday = new Date()
    const lastRealTxMs = transactions.reduce<number | null>((m, t) => {
      const ts = t.datePosted.getTime()
      return ts <= previewToday.getTime() && (m === null || ts > m) ? ts : m
    }, null)
    const anchorRes = resolveStatementAnchor(bankProfile, {
      dtAsOf: ledgerBalance?.asOfDate ?? null,
      dtEnd: statementEnd ?? null,
      lastRealTxDate: lastRealTxMs != null ? new Date(lastRealTxMs) : null,
      today: previewToday,
    })
    const dtAsOfPreview = anchorRes.anchor ?? periodArquivoEnd ?? new Date()

    // ⚠️ EXPORT DE MESMO DIA (29/08/2026) — calculado UMA vez e devolvido em TODOS os
    // returns do preview (legado, re-import vazio e V2). REGRA 4: a 1ª versão só ligou
    // no return do V2 e o re-import — justamente o caso em que o dono vê "nada novo" e
    // fica na dúvida se é o dia aberto — não recebia o aviso. É AVISO, nunca decisão.
    const avisoMesmoDiaCalc = avisoExportMesmoDia(
      dtAsOfPreview ?? null,
      transactions.map((t) => t.datePosted),
      new Date(),
    )
    const avisoMesmoDiaPayload = avisoMesmoDiaCalc.mesmoDia ? avisoMesmoDiaCalc : null
    const bankProfilePayload = {
      id: bankProfile?.id ?? null,
      displayName: bankProfile?.displayName ?? null,
      anchorRule: anchorRes.rule,
      anchorDate: dtAsOfPreview.toISOString(),
      warning: bankProfileWarning(bankProfile, bankId ?? null),
      // Aviso "não deu pra conferir a conta" (quando não bloqueou). Vai pro banner.
      accountMatchWarning: accountMatch.warning ?? null,
      // Aviso do JUIZ: o saldo do banco não fecha → mostra na tela, preview não mente.
      judgeBlockWarning: null as string | null,
    }
    // O JUIZ NO PREVIEW (Wiring 14/08, flag): a MESMA função do confirm
    // (`resolveImportStatuses`) — impossível a tela mostrar uma coisa e o confirm
    // gravar outra. Casa por conteúdo (o preview só tem as `novas`). `blocked` = o
    // saldo do banco não fecha → a tela AVISA (não mostra um preview mentiroso).
    // Fallback pro legado se algo faltar. Flag OFF = comportamento legado (rollback).
    let novasReais: typeof novas
    let novasFuturas: typeof novas
    let judgeBlockWarning: string | null = null
    if (isCanonicalClassifyEnabledForBank(bankId)) {
      const { classify, importableByKey } = await resolveImportStatuses(prisma, {
        bankAccountId: contaId,
        parsed: parsedOfx,
        rawOfx: rawContent,
        dtServer: new Date(),
        currentImportId: previewImportId,
      })
      const impOf = (t: (typeof novas)[number]) =>
        importableByKey.get(contentKey(t.fitid, t.datePosted, t.type === 'CREDIT' ? t.amount : -t.amount, t.memo))
      const allMapped = novas.every((t) => impOf(t) !== undefined)
      if (allMapped) {
        if (classify.blocked) judgeBlockWarning = classify.message
        novasReais = novas.filter((t) => impOf(t) === true)
        novasFuturas = novas.filter((t) => impOf(t) !== true)
      } else {
        console.warn('[JUIZ] preview: linha sem status no mapa — fallback pro legado')
        ;({ realLines: novasReais, futureLines: novasFuturas } = partitionFutureLines(novas, dtAsOfPreview, new Date()))
      }
    } else {
      ;({ realLines: novasReais, futureLines: novasFuturas } = partitionFutureLines(novas, dtAsOfPreview, new Date()))
    }
    bankProfilePayload.judgeBlockWarning = judgeBlockWarning

    // PREVIEW = CONFIRM (bug PIX 7.000, 17/08). O confirm (runImportV2) reconcilia
    // TODAS as linhas do arquivo via reconcileStatement e IGNORA o gate; o preview
    // usava gate/dedupHash (cego pra tx criadas pelo V2 — contentHash null, dedupHash
    // no formato stableKey#import) e por isso dizia "N novas" sem ver o overlap. Aqui
    // o preview roda o MESMO reconcileImportLines → "N novas + M já existem" batem com
    // o que o confirm faria. Read-only (prisma, fora de $transaction). Fail-soft: se
    // falhar, o preview segue sem o número (não bloqueia).
    let reconcileCount: { jaExistem: number; novas: number } | null = null
    let reconMissingKeys: Map<string, number> | null = null
    try {
      const allStmtLines: StatementLine[] = transactions.map((t) => ({
        datePosted: t.datePosted,
        signedAmount: t.type === 'CREDIT' ? t.amount : -t.amount,
        memo: t.memo,
        fitid: t.fitid ?? undefined,
      }))
      const { result: recon } = await reconcileImportLines(prisma, {
        bankAccountId: contaId,
        allLines: allStmtLines,
        realLines: allStmtLines,
        dtAsOf: dtAsOfPreview,
        today: previewToday,
        judgeRan: false,
      })
      reconcileCount = { jaExistem: recon.matched.length, novas: recon.missing.length }
      // Multiset dos stableKeys das linhas REALMENTE novas (o que o confirm cria).
      // A MESMA função stableKey do reconcile (REGRA 4/5) → impossível divergir.
      reconMissingKeys = new Map()
      for (const m of recon.missing) {
        const k = stableKey({ date: m.datePosted, signedAmount: m.signedAmount, memo: m.memo })
        reconMissingKeys.set(k, (reconMissingKeys.get(k) ?? 0) + 1)
      }
      console.log(
        `[importar-ofx preview] reconcile: ${recon.matched.length} já existem + ${recon.missing.length} novas ` +
          `(${recon.previews.length} futuras) — arquivo com ${allStmtLines.length} linhas`,
      )
    } catch (e) {
      console.error('[importar-ofx preview] reconcileImportLines falhou (não bloqueia):', (e as Error).message)
    }

    // FILTRO DA VERDADE (bug Stone 17/08): remove das "novas" as linhas que o
    // reconcile (= o confirm) diz que JÁ EXISTEM. O gate (filtrarNovasOFX) é cego
    // pra tx criadas pelo V2 (contentHash null, dedupHash no formato stableKey#import)
    // → marcava as 11 transferências IN do Stone como novas (117.600 fantasma) e o
    // juiz de saldo acusava. O confirm (runImportV2→reconcileImportLines) NUNCA as
    // criaria (casa por stableKey), mas a TELA mentia. Agora a lista e o juiz de saldo
    // usam a verdade do reconcile. Se o reconcile falhou (reconMissingKeys null),
    // mantém o gate (fail-soft, não trava o import legítimo).
    if (reconMissingKeys) {
      const { kept, removed } = filterToReconcileMissing(
        novasReais,
        (t) => stableKey({ date: t.datePosted, signedAmount: t.type === 'CREDIT' ? t.amount : -t.amount, memo: t.memo }),
        reconMissingKeys,
      )
      novasReais = kept
      if (removed > 0) {
        duplicadas += removed // as removidas são "já existem"
        console.log(`[importar-ofx preview] filtro-verdade: ${removed} "novas" já existem (reconcile) → removidas da lista/juiz`)
      }
    }

    const futurasPayload = novasFuturas.map((t) => ({
      date: t.datePosted.toISOString().slice(0, 10),
      signedAmount: t.type === 'CREDIT' ? t.amount : -t.amount,
      memo: t.memo,
      fitid: t.fitid,
    }))
    const futurasSum = Math.round(futurasPayload.reduce((s, f) => s + f.signedAmount, 0) * 100) / 100

    // ⭐⭐ TODA LINHA DO ARQUIVO TEM QUE TER UM DESTINO NOMEADO (29/08/2026).
    //
    // ⚠️ O QUE ISTO IMPEDE, com nome e data: em 28/08 o preview leu 129 linhas e mostrou 12
    // novas — a 13ª ("26/08 EMPRESTIMO −2.444,62") tinha sido descartada por uma heurística
    // e **não aparecia em lugar nenhum**: nem na revisão, nem num balde de descartadas, nem
    // no log. O gate travou pelo SALDO, e o dono ficou com um enigma de R$ 2.444,62 em vez
    // de uma linha marcada com o motivo.
    //
    // Contar LINHAS é mais forte que conferir SALDO: linha perdida cujo valor empata com
    // outra coisa (ou período em que o LEDGERBAL não é confiável — Banrisul embute
    // bloqueado) some sem alarme nenhum no gate de saldo. Aqui não some.
    // ⚠️ o total vem do ARQUIVO (blocos <STMTTRN>), não do que o parser conseguiu ler:
    // usar `transactions.length` deixaria a conta cega pra linha derrubada no parser — ela
    // sumiria antes de existir. `errors` é o balde nomeado dessas (aparece na tela).
    const conciliacao = conciliarDestinos({
      totalNoArquivo: parsedOfx.totalBlocos ?? transactions.length,
      novas: novasReais.length,
      jaExistem: duplicadas,
      futuras: novasFuturas.length,
      ignoradas: 0, // no preview o usuário ainda não marcou nada
      ilegiveis: errors.length,
    })
    if (!conciliacao.fecha) {
      console.error(`[importar-ofx preview] CONCILIAÇÃO NÃO FECHA: ${conciliacao.resumo} · sem destino: ${conciliacao.semDestino}`)
    }
    // ⚠️ BLOQUEIA só na direção PERIGOSA (linha do arquivo sem destino = linha sumindo).
    // Contagem a MAIOR é artefato de exibição (uma linha contada em dois baldes) — avisa,
    // mas não impede o dono de importar: travar por defeito de contagem nossa seria trocar
    // um problema por outro.
    if (conciliacao.semDestino > 0) {
      return NextResponse.json({
        erro: conciliacao.erro,
        code: 'LINHA_SEM_DESTINO',
        conciliacao,
      }, { status: 422 })
    }

    if (!isV2PreviewEnabled()) {
      const payload = buildLegacyPreviewPayload({
        novas: novasReais,
        totalArquivo: transactions.length,
        duplicadas,
        errosParser: errors,
        banco,
      })
      return NextResponse.json({
        ...payload,
        futuras: futurasPayload,
        conciliacao, // "N linhas no arquivo = A novas + B já no sistema + C futuras"
        reconcileDedup: reconcileCount,
        importIdentity: {
          gate: gateResult.stats,
          batchWarnings,
        },
        categorySuggestions,
        categoriesForUI,
        ownEntityRefs,
        bankProfile: bankProfilePayload,
        avisoExportMesmoDia: avisoMesmoDiaPayload,
      })
    }

    // Sprint Fix-Import-Vazio (05/07/2026): guard pra re-import.
    //
    // Se `novas.length === 0` (todas as tx do arquivo já foram importadas
    // antes — gate de identidade filtrou tudo), o V2Preview abaixo fazia
    // Math.min(...[]) = Infinity → new Date(Invalid) → o findMany do Prisma
    // caía em PrismaClientValidationError com 500 sem body JSON limpo, e a
    // UI mostrava a mensagem enganosa "Não foi possível ler o arquivo".
    //
    // Fix: retorna o payload legado com `preview=[]` — a UI já sabe processar
    // (mesmo shape que quando IMPORT_PREVIEW_V2=false). O `duplicadas` conta
    // corretamente o que ficou fora, e a mensagem explica o que aconteceu.
    // Backward-compat total: se novas > 0, segue no V2Preview normalmente.
    if (novasReais.length === 0) {
      return NextResponse.json({
        ...buildLegacyPreviewPayload({
          novas: [],
          totalArquivo: transactions.length,
          duplicadas,
          errosParser: errors,
          banco,
        }),
        futuras: futurasPayload,
        reconcileDedup: reconcileCount,
        importIdentity: {
          gate: gateResult.stats,
          batchWarnings,
        },
        categorySuggestions,
        categoriesForUI,
        ownEntityRefs,
        bankProfile: bankProfilePayload,
        avisoExportMesmoDia: avisoMesmoDiaPayload,
        mensagem:
          futurasPayload.length > 0
            ? `Nenhuma transação nova pra importar. ${futurasPayload.length} lançamento${futurasPayload.length !== 1 ? 's futuros (agendados)' : ' futuro (agendado)'} não ${futurasPayload.length !== 1 ? 'entram' : 'entra'} — o resto já existia.`
            : 'Todas as transações deste arquivo já foram importadas anteriormente.',
      })
    }

    // Sprint Fix-Import-Vazio (05/07/2026): try/catch defensivo cobrindo
    // todo o path V2Preview. Antes, qualquer exception aqui (Prisma inválido,
    // dependência quebrada) virava 500 opaco → UI caía no catch genérico e
    // mostrava "Não foi possível ler o arquivo". Agora qualquer falha retorna
    // JSON com mensagem específica em `erro` — a UI (page.tsx:322-324) mostra
    // via toast destrutivo com a descrição real.
    try {
      // V2: busca candidatos do sistema (somente leitura) + classifica
      const datesIncoming = novasReais.map((t) => t.datePosted.getTime())
      const minDate = new Date(Math.min(...datesIncoming) - 5 * 86400_000)
      const maxDate = new Date(Math.max(...datesIncoming) + 1 * 86400_000)

      const [candidatesMesmaConta, candidatesExcelPayable] = await Promise.all([
        prisma.transaction.findMany({
          where: {
            bankAccountId: contaId,
            lifecycle: 'EFFECTED',
            origin: { in: ['OFX', 'MANUAL'] },
            date: { gte: minDate, lte: maxDate },
          },
          select: {
            id: true, bankAccountId: true, amount: true, date: true,
            dueDate: true, description: true, type: true, origin: true,
            lifecycle: true, reconciledWithId: true, transferGroupId: true,
            category: { select: { name: true } },
            supplier: { select: { razaoSocial: true } },
          },
        }),
        prisma.transaction.findMany({
          where: {
            origin: 'IMPORT_EXCEL',
            lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] },
            OR: [
              { bankAccount: { companyId: conta.companyId } },
              { supplier: { companyId: conta.companyId } },
              { customer: { companyId: conta.companyId } },
              { category: { companyId: conta.companyId } },
            ],
            dueDate: { gte: minDate, lte: maxDate },
          },
          select: {
            id: true, bankAccountId: true, amount: true, date: true,
            dueDate: true, description: true, type: true, origin: true,
            lifecycle: true, reconciledWithId: true, transferGroupId: true,
            category: { select: { name: true } },
            supplier: { select: { razaoSocial: true } },
          },
        }),
      ])

      const v2Payload = buildV2PreviewPayload({
        novas: novasReais,
        totalArquivo: transactions.length,
        duplicadasHashLegado: duplicadas,
        errosParser: errors,
        banco,
        contaId,
        candidates: [...candidatesMesmaConta, ...candidatesExcelPayable],
        // Sub-fase 2B: balance da conta + LEDGERBAL do arquivo (rede de
        // segurança matemática estilo Conta Azul). Função pura calcula
        // delta e detecta divergência.
        contaBalance: conta.balance,
        ledgerBalance,
        // Sprint Preview-Futuro (09/08): soma das futuras — se o diff bater
        // com ela, o diagnóstico diz "= linhas futuras" (rede de segurança).
        futurasSum,
        // CAMADA 2 (11/08): âncora max(DTASOF, DTEND) — pega a agendada do DIA
        // da âncora que a CAMADA 1 (data) deixa passar.
        anchor: dtAsOfPreview,
      })
      // CAMADA 2: as agendadas do dia da âncora entram na MESMA seção "agendadas
      // — não serão importadas" que as futuras da CAMADA 1 (fonte única na UI).
      const agendadasDia = v2Payload.agendadasDiaAncora.map((a) => ({
        date: a.date.slice(0, 10),
        signedAmount: a.signedAmount,
        memo: a.memo,
        fitid: a.fitid,
      }))

      // ⭐ DIAGNÓSTICO GUIADO (29/08/2026) — quando o saldo NÃO fecha, dizer ONDE começou.
      //
      // ⚠️ O que faltava não era detectar: o gate já dizia "não bate, dif X". Faltava a
      // pergunta seguinte — *desde quando?* — que é a única que leva a uma AÇÃO ("re-exporte
      // o extrato de tal a tal data"). Sem ela o dono olha um número e não tem o que fazer.
      // `ondeDescolou` varre os LEDGERBAL consecutivos já gravados e aponta o 1º intervalo
      // que não fecha. Roda SÓ quando o gate acusou (é caro e seria ruído quando está tudo
      // verde) e é FAIL-SOFT: diagnóstico nunca derruba o preview.
      let diagnostico: { de: string; ate: string; diferenca: number; instrucao: string } | null = null
      if (v2Payload.ledgerBalCheck.available && !v2Payload.ledgerBalCheck.bate) {
        try {
          const [{ lerConta }, { ondeDescolou }] = await Promise.all([
            import('@/lib/balance/ler-conferencia'),
            import('@/lib/balance/ledgerbal-invariants'),
          ])
          const leitura = await lerConta(contaId, prisma)
          const d = leitura ? ondeDescolou(leitura) : null
          if (d) {
            diagnostico = {
              de: d.de.toISOString().slice(0, 10),
              ate: d.ate.toISOString().slice(0, 10),
              diferenca: d.diferenca,
              instrucao: d.instrucao,
            }
          }
        } catch (e) {
          console.error('[importar-ofx preview] diagnóstico guiado falhou (preview segue):', e)
        }
      }

      return NextResponse.json({
        ...v2Payload,
        futuras: [...futurasPayload, ...agendadasDia],
        reconcileDedup: reconcileCount,
        categorySuggestions,
        categoriesForUI,
        ownEntityRefs,
        bankProfile: bankProfilePayload,
        avisoExportMesmoDia: avisoMesmoDiaPayload,
        diagnostico,
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[importar-ofx preview V2] falhou:', msg)
      return NextResponse.json(
        {
          erro: `Falha ao gerar preview: ${msg}`,
          code: 'PREVIEW_V2_FAILED',
        },
        { status: 500 },
      )
    }
  }

  // Inserção em lote das transações novas + recalcula saldo
  if (novas.length === 0) {
    return NextResponse.json({
      mensagem: 'Todas as transações já foram importadas anteriormente.',
      inseridas: 0,
      duplicadas,
    })
  }

  // DESCARTE de movimento futuro (07/08) — paridade com o V2 via helper central.
  // Antes o V1 criava a linha futura como PAYABLE/RECEIVABLE; agora DESCARTA
  // (extrato = passado). Branch dormente sob RECONCILE_V2=true, mas é a rede de
  // rollback e tem que se comportar IGUAL à tela single se a flag for desligada.
  const now = new Date()
  const dtAsOfV1 = settledThroughDate(ledgerBalance?.asOfDate, statementEnd) ?? now
  const { futureLines: novasFuturas } = partitionFutureLines(novas, dtAsOfV1, now)
  const futureHashesV1 = new Set(novasFuturas.map((t) => t.dedupHash))
  const descartadasFuturasV1 = novasFuturas.map((t) => ({
    date: t.datePosted.toISOString().slice(0, 10),
    signedAmount: t.type === 'CREDIT' ? t.amount : -t.amount,
    memo: t.memo,
    fitid: t.fitid ?? null,
  }))

  // Onda 2 Sprint 2.3 — registra OfxImport (status=PROCESSING).
  // Atualizado pra SUCCESS após o createMany abaixo.
  // Capturamos IP/UA do header.
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  // Período: min/max date das transações novas (snapshot do extrato)
  const datasNovas = novas.map((t) => t.datePosted.getTime())
  const periodStart =
    datasNovas.length > 0 ? new Date(Math.min(...datasNovas)) : null
  const periodEnd =
    datasNovas.length > 0 ? new Date(Math.max(...datasNovas)) : null

  // Sprint Reconcile Transfer Identity (18/06/2026): se importRowPre já foi
  // criado no early-step (caminho confirm), reusa e atualiza duplicates.
  // Caso contrário, cria normalmente.
  const importRow = importRowPre
    ? await prisma.ofxImport.update({
        where: { id: importRowPre.id },
        data: { duplicates: duplicadas + reconciledCount },
      })
    : await createOfxImportRecord(prisma, {
        bankAccountId: contaId,
        userId: user.sub,
        fileName: uploadedFileName,
        fileSize: rawContent.length,
        rawOfx: rawContent, // ← V1 fallback também grava o cru
        fileHash: fileHashHex,
        source: 'OFX',
        ipAddress,
        userAgent,
        totalTransactions: transactions.length,
        duplicates: duplicadas,
        periodStart,
        periodEnd,
      })

  // Fase 3 Etapa 1: AUTO-CLASSIFY via regras EXACT (≥0.95) ANTES do insert.
  // Multi-tenant: regras filtradas por companyId. Cache em memória durante
  // este import — 1 query no DB pra todas as regras ativas.
  const t0Predict = Date.now()
  const activeRules = await loadActiveRules(conta.companyId)
  const ruleIndex = buildRuleIndex(conta.companyId, activeRules)

  // Sprint 5.0.2.l — Camada SETOR (KB DB-backed):
  //  1. Lê setor da empresa
  //  2. Garante categorias do sistema (Pix + universais + setoriais)
  //  3. Carrega snapshot de SetorPattern UNIVERSAL + setor empresa
  //  4. Resolver retorna categoryId via nome
  const empresa = await prisma.company.findUnique({
    where: { id: conta.companyId },
    select: { setor: true },
  })
  const setorEmpresa = empresa?.setor ?? null
  const systemCats = await ensureAllSystemCategories(conta.companyId, setorEmpresa)
  const setorPatterns = await loadPatternsForSetor(setorEmpresa)
  const setorResolver = (name: string) =>
    resolveSetorCategoryId(systemCats.list, name)

  const {
    classified: classifiedRaw,
    rulesFired,
    autoCount,
    supplierSuggestions,
    keywordHits,
    setorAutoCount,
  } = autoClassifyTransactions(
    novas.map((t) => ({
      bankAccountId: contaId,
      date: t.datePosted,
      description: t.memo,
      amount: t.amount,
      type: t.type,
      externalId: t.fitid,
      dedupHash: t.dedupHash,
      origin: 'OFX',
    })),
    ruleIndex,
    setorPatterns,
    setorResolver,
  )
  // Sprint Import Categoria Editável (18/06/2026): override de categorias
  // editadas pelo user na UI (formData.categoryOverrides). Pipeline IA é
  // executado normalmente; user pode sobrescrever no momento do confirm.
  const classified = categoryOverrides.length > 0
    ? applyCategoryOverrides(classifiedRaw, categoryOverrides)
    : classifiedRaw
  const overridesApplied = categoryOverrides.length
  const predictMs = Date.now() - t0Predict

  try {
    // Sprint Saldo-Ancorado-LEDGERBAL (17/06/2026):
    // (1) createMany das tx novas
    // (2) atualiza ledgerBal + ledgerBalDate do bankAccount com BALAMT/DTASOF
    //     do arquivo (se OFX trouxe — alguns extratos têm <LEDGERBAL/> vazio)
    // (3) Vezes aplicada das regras
    // Fora do $transaction: recalcularSaldoConta (sequencial, depois) —
    // precisa LER as tx recém-criadas + ledgerBal recém-gravado.
    await prisma.$transaction([
      prisma.transaction.createMany({
        // Descarta as linhas futuras (não vira transação — paridade com V2).
        data: classified
          .filter((t) => !t.dedupHash || !futureHashesV1.has(t.dedupHash))
          .map((t) => {
            // Sprint Import Idempotente: recupera identidade canônica via dedupHash
            const ident = t.dedupHash ? identityByDedupHash.get(t.dedupHash) : null
            return {
              bankAccountId: t.bankAccountId,
              date: t.date,
              description: t.description,
              amount: t.amount,
              type: t.type,
              status: t.status,
              origin: t.origin,
              externalId: t.externalId,
              dedupHash: t.dedupHash,
              // Onda 2 Sprint 2.3 — vincula ao registro de import (pra revert)
              importId: importRow.id,
              categoryId: t.categoryId ?? null,
              classificationSource: t.classificationSource ?? null,
              classifiedByRuleId: t.classifiedByRuleId ?? null,
              aiConfidence: t.aiConfidence ?? null,
              // Sprint Import Idempotente (18/06/2026)
              fitidKey: ident?.fitidKey ?? null,
              contentHash: ident?.contentHash ?? null,
              // Extrato = passado: tudo que entra é EFFECTED (futura foi descartada).
              lifecycle: 'EFFECTED',
              dueDate: null,
            }
          }),
      }),
      // Atualiza ledgerBal + ledgerBalDate quando OFX trouxe (substitui o
      // increment cumulativo que driftou; balance será recalculado depois).
      prisma.bankAccount.update({
        where: { id: contaId },
        data: ledgerBalance
          ? {
              ledgerBal: ledgerBalance.amount,
              ledgerBalDate: ledgerBalance.asOfDate,
            }
          : {},
      }),
      // Incrementa vezesAplicada das regras que dispararam
      ...Array.from(rulesFired.entries()).map(([ruleId, count]) =>
        prisma.aiLearningRule.update({
          where: { id: ruleId },
          data: { vezesAplicada: { increment: count } },
        }),
      ),
    ])

    // Sprint Empréstimos Backend (17/06/2026) — auto-concilia parcelas
    // OPEN com DEBITs novos da conta. Falha silenciosa: erro não mata o
    // import (try/catch como scan-retroativo de transferência).
    try {
      const { autoConciliarParcelas } = await import('@/lib/loans/auto-conciliacao')
      const r = await autoConciliarParcelas(prisma, conta.companyId)
      if (r.matched.length > 0) {
        console.log(
          `[IMPORT-OFX] auto-conciliou ${r.matched.length} parcela(s) de empréstimo ` +
            `(${r.ambiguous.length} ambíguas) — company=${conta.companyId}`,
        )
      }
    } catch (e) {
      console.error('[IMPORT-OFX] auto-conciliação empréstimo falhou:', e)
    }

    // Recalcula balance ANCORADO no LEDGERBAL.
    // Conta SEM ledgerBal: usa SUM(signed) total.
    // Conta COM ledgerBal: usa ledgerBal + SUM(tx pós-ledgerBalDate).
    try {
      const { recalcularSaldoConta } = await import('@/lib/balance/recalcular')
      await recalcularSaldoConta(prisma, contaId)
    } catch (rcErr) {
      // Falha silenciosa: balance fica desatualizado mas tx foram criadas.
      // Cron de saúde futuro pode pegar isso.
      console.error('[importar-ofx] recalcularSaldo falhou:', rcErr)
    }
  } catch (err) {
    // Marca import como FAILED + propaga erro pra cliente
    await prisma.ofxImport.update({
      where: { id: importRow.id },
      data: {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    })
    return NextResponse.json(
      { erro: 'Erro ao salvar transações', importId: importRow.id },
      { status: 500 },
    )
  }

  // Atualiza import → SUCCESS + totais finais
  await prisma.ofxImport.update({
    where: { id: importRow.id },
    data: {
      status: 'SUCCESS',
      newTransactions: novas.length - novasFuturas.length,
      autoClassified: autoCount,
    },
  })

  // Sprint Import Categoria Editável (18/06/2026): persiste AiLearningRules
  // criadas pelo usuário durante o import. Falha silenciosa.
  let rulesCreated = 0
  let rulesUpdated = 0
  if (newRules.length > 0) {
    try {
      const r = await persistNewRules(prisma, conta.companyId, newRules)
      rulesCreated = r.created
      rulesUpdated = r.updated
    } catch (e) {
      console.error('[importar-ofx] persistNewRules falhou:', e)
    }
  }

  // Sprint Import Idempotente (18/06/2026) — registra TODA tx criada no
  // seen-ledger. Falha silenciosa: erro aqui não mata o import, mas
  // log fica pra cron de auditoria pegar.
  try {
    const createdTxs = await prisma.transaction.findMany({
      where: { importId: importRow.id },
      select: { id: true, dedupHash: true },
    })
    const identityRows = createdTxs
      .map((t) => {
        const ident = t.dedupHash ? identityByDedupHash.get(t.dedupHash) : null
        if (!ident) return null
        return {
          companyId: conta.companyId,
          bankAccountId: contaId,
          importBatchId: importRow.id,
          fitidKey: ident.fitidKey,
          contentHash: ident.contentHash,
          transactionId: t.id,
          tombstone: false,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
    if (identityRows.length > 0) {
      await prisma.importedIdentity.createMany({ data: identityRows })
    }
  } catch (e) {
    console.error('[importar-ofx] seed identities falhou:', e)
  }

  // Sprint Transfer-Pairing-Retroativo (16/06/2026) — auto-parear HIGH+nameOk
  // após criar as tx. Roda em background mas dentro do mesmo request pra
  // garantir consistência. Falha silenciosa: erro aqui NÃO mata o import.
  //
  // Resolve o problema histórico "detectarTransferencias só roda no preview
  // de UM arquivo": agora pares cross-account ficam pareados mesmo quando o
  // user importa Banrisul, Sicredi e Stone em sequência sem clicar em
  // "Parear" no painel do preview.
  let autoPairedCount = 0
  try {
    const { scanRetroativo } = await import('@/lib/transfers/scan-retroativo')
    const { loadOwnEntityRefs } = await import('@/lib/transfers/load-own-entity-refs')
    const crypto = await import('node:crypto')

    // Sprint Owner Detection (28/06/2026): refs centralizadas — incluem
    // CPFs + nomes dos sócios (antes o nome do dono era misturado no array
    // de "nome empresa" com peso de sinal errado).
    const refs = await loadOwnEntityRefs(prisma, conta.companyId)
    const allAccounts = await prisma.bankAccount.findMany({
      where: { companyId: conta.companyId, isActive: true },
      select: { id: true },
    })
    if (refs.cnpj || refs.names.length > 0 || refs.ownerNames.length > 0) {
      const accIds = allAccounts.map((a) => a.id)
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const orphans = await prisma.transaction.findMany({
        where: {
          bankAccountId: { in: accIds },
          origin: 'OFX',
          lifecycle: 'EFFECTED',
          transferGroupId: null,
          type: { in: ['CREDIT', 'DEBIT'] },
          date: { gte: since7d },
          reconciledWithId: null,
          reconciledFrom: { none: {} },
        },
        select: {
          id: true,
          bankAccountId: true,
          date: true,
          type: true,
          amount: true,
          description: true,
          bankAccount: { select: { name: true } },
        },
      })
      const scan = scanRetroativo({
        txs: orphans.map((o) => ({
          id: o.id,
          bankAccountId: o.bankAccountId!,
          bankAccountName: o.bankAccount?.name ?? '',
          date: o.date,
          type: o.type as 'CREDIT' | 'DEBIT',
          amount: o.amount,
          description: o.description,
        })),
        refs,
      })
      // Gate: SOMENTE HIGH + nameMatchOk (a mesma regra usada no endpoint
      // /transferencias/scan-retroativo). MEDIUM fica como pendente — UI
      // futura (Fase 2) mostra como candidato pra user confirmar.
      const toApply = scan.pairs.filter((p) => p.level === 'HIGH' && p.nameMatchOk)

      // Sprint Owner Detection (28/06/2026): carrega accountKind dos 2 lados
      // pra classificar PJ+PJ (TRANSFER interna) vs PJ+PF (Aporte/Retirada).
      // Antes auto-pair sempre virava TRANSFER — agora respeita o classificador.
      const accountsKinds = await prisma.bankAccount.findMany({
        where: { companyId: conta.companyId, isActive: true },
        select: { id: true, accountKind: true },
      })
      const accKindById = new Map(accountsKinds.map((a) => [a.id, a.accountKind]))

      // Pré-carrega categorias equity (1 query) — usadas só nas decisões PJ+PF.
      const equityCats = await prisma.category.findMany({
        where: {
          companyId: conta.companyId,
          isActive: true,
          OR: [
            { name: 'Aporte de Capital', dreGroup: 'APORTES_CAPITAL' },
            { name: 'Retirada de Lucros / Pró-labore', dreGroup: 'DISTRIBUICAO_LUCROS' },
          ],
        },
        select: { id: true, name: true, dreGroup: true },
      })
      const aporteId = equityCats.find((c) => c.dreGroup === 'APORTES_CAPITAL')?.id ?? null
      const retiradaId = equityCats.find((c) => c.dreGroup === 'DISTRIBUICAO_LUCROS')?.id ?? null

      const { classifyTransferPair, normalizeAccountKind } = await import('@/lib/accounts/kind')

      if (toApply.length > 0) {
        await prisma.$transaction(async (txp) => {
          for (const p of toApply) {
            // Classificar pelo accountKind do par
            const fromKind = normalizeAccountKind(accKindById.get(p.from.bankAccountId) ?? 'PJ')
            const toKind = normalizeAccountKind(accKindById.get(p.to.bankAccountId) ?? 'PJ')
            // p.from é DEBIT (saiu), p.to é CREDIT (entrou) — pelo scanRetroativo
            const classification = classifyTransferPair(fromKind, 'DEBIT', toKind)

            if (classification.kind === 'OUT_OF_SCOPE') continue // PF↔PF não eh assunto

            if (classification.kind === 'TRANSFER_INTERNAL') {
              // PJ + PJ: caminho clássico (atual)
              const groupId = crypto.randomUUID()
              const r1 = await txp.transaction.updateMany({
                where: { id: p.from.id, transferGroupId: null, type: 'DEBIT' },
                data: {
                  type: 'TRANSFER',
                  transferGroupId: groupId,
                  transferDirection: 'OUT',
                  status: 'RECONCILED',
                  // Sprint Pending Transfer State (27/06/2026): quando o
                  // scanRetroativo casa o par, limpa flags de "aguardando par"
                  // se estava marcada como pendingTransfer.
                  pendingTransfer: false,
                  pendingTransferDirection: null,
                  pendingTransferSince: null,
                },
              })
              const r2 = await txp.transaction.updateMany({
                where: { id: p.to.id, transferGroupId: null, type: 'CREDIT' },
                data: {
                  type: 'TRANSFER',
                  transferGroupId: groupId,
                  transferDirection: 'IN',
                  status: 'RECONCILED',
                  pendingTransfer: false,
                  pendingTransferDirection: null,
                  pendingTransferSince: null,
                },
              })
              if (r1.count === 1 && r2.count === 1) {
                autoPairedCount += 1
              } else {
                // Rollback do lado órfão se um pareou e outro não
                if (r1.count === 1 && r2.count !== 1) {
                  await txp.transaction.update({
                    where: { id: p.from.id },
                    data: {
                      type: 'DEBIT',
                      transferGroupId: null,
                      transferDirection: null,
                      status: 'PENDING',
                    },
                  })
                }
                if (r2.count === 1 && r1.count !== 1) {
                  await txp.transaction.update({
                    where: { id: p.to.id },
                    data: {
                      type: 'CREDIT',
                      transferGroupId: null,
                      transferDirection: null,
                      status: 'PENDING',
                    },
                  })
                }
              }
              continue
            }

            // PJ + PF: APORTE_CAPITAL ou RETIRADA_LUCRO
            // Categoriza ambos lados com a categoria de equity, MANTÉM
            // type=DEBIT/CREDIT (não vira TRANSFER artificial). Sai do DRE
            // pelo dreGroup (NonDREGroup).
            const equityCatId =
              classification.kind === 'APORTE_CAPITAL' ? aporteId : retiradaId
            if (!equityCatId) {
              // Categoria não cadastrada — não tenta classificar automatic,
              // deixa pra UI 1-clique do aguardando-par.
              continue
            }
            await txp.transaction.update({
              where: { id: p.from.id },
              data: {
                categoryId: equityCatId,
                status: 'RECONCILED',
                cashCoded: true,
                cashCodedAt: new Date(),
                pendingTransfer: false,
                pendingTransferDirection: null,
                pendingTransferSince: null,
                notes: `[PJ↔PF:${classification.kind}]`,
              },
            })
            await txp.transaction.update({
              where: { id: p.to.id },
              data: {
                categoryId: equityCatId,
                status: 'RECONCILED',
                cashCoded: true,
                cashCodedAt: new Date(),
                pendingTransfer: false,
                pendingTransferDirection: null,
                pendingTransferSince: null,
                notes: `[PJ↔PF:${classification.kind}]`,
              },
            })
            autoPairedCount += 1
          }
        })
      }
      if (autoPairedCount > 0) {
        console.log(
          `[IMPORT-OFX] auto-pareou ${autoPairedCount} transferência(s) ` +
            `cross-account (HIGH + nameMatchOk) — company=${conta.companyId}`,
        )
      }
    }
  } catch (e) {
    console.error('[IMPORT-OFX] auto-pareamento falhou (não bloqueia import):', e)
  }

  // Fase 3 Etapa 2: persiste sugestões de fornecedor (Camada 2A keyword)
  // APÓS o createMany. Cria Supplier + linka transaction.supplierId.
  let supplierStats = { suppliersCreated: 0, transactionsLinked: 0 }
  let keywordPersistMs = 0
  if (supplierSuggestions.length > 0) {
    const t0Persist = Date.now()
    const categoriasEmpresa = await prisma.category.findMany({
      where: { companyId: conta.companyId, isActive: true },
      select: { id: true, name: true, dreGroup: true, isActive: true },
    })
    supplierStats = await persistKeywordSuggestions(
      conta.companyId,
      supplierSuggestions,
      categoriasEmpresa,
    )
    keywordPersistMs = Date.now() - t0Persist
  }

  const inseridasReaisV1 = novas.length - novasFuturas.length
  return NextResponse.json({
    mensagem: `${inseridasReaisV1} transaç${inseridasReaisV1 !== 1 ? 'ões importadas' : 'ão importada'} com sucesso${descartadasFuturasV1.length > 0 ? ` · ${descartadasFuturasV1.length} futura(s) não importada(s) (agendado)` : ''}${reconciledCount > 0 ? ` (${reconciledCount} contrapartes reconciliadas)` : ''}${overridesApplied > 0 ? ` · ${overridesApplied} categoria(s) editada(s)` : ''}${rulesCreated + rulesUpdated > 0 ? ` · ${rulesCreated} regra(s) criada(s)${rulesUpdated > 0 ? ` (${rulesUpdated} atualizadas)` : ''}` : ''}.`,
    inseridas: inseridasReaisV1,
    descartadasFuturas: descartadasFuturasV1,
    duplicadas,
    reconciledTransferPlaceholders: reconciledCount,
    categoryOverridesApplied: overridesApplied,
    rulesCreated,
    rulesUpdated,
    autoClassificadas: autoCount,
    regrasDispararam: rulesFired.size,
    keywordHits,
    // Sprint 5.0.2.l — Camada SETOR (KB) hits
    setorClassificadas: setorAutoCount,
    setorEmpresa,
    fornecedoresDetectados: supplierStats.suppliersCreated,
    transacoesComFornecedor: supplierStats.transactionsLinked,
    transferenciasAutoPareadas: autoPairedCount,
    predictMs,
    keywordPersistMs,
    errosParser: errors,
    importId: importRow.id,
  })
}
