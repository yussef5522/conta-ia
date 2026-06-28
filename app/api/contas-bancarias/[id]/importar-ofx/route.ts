import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseOFX } from '@/lib/ofx/parser'
import { detectarBanco, bateComPerfilDaConta } from '@/lib/ofx/bancos'
import { dedupHashOFX, filtrarNovasOFX } from '@/lib/ofx/dedup'
import { computeIdentity } from '@/lib/import-identity/compute-identity'
import { computeFileHash } from '@/lib/import-identity/file-hash'
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
import { runImportV2 } from '@/lib/reconciliation/import-orchestrator'

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
  let newRules: NewRuleSpec[] = []
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ erro: 'Arquivo OFX não enviado' }, { status: 400 })
    }
    uploadedFileName = (file as File).name || 'extrato.ofx'
    rawContent = await (file as File).text()
    const overridesRaw = formData.get('categoryOverrides')
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
  } catch {
    return NextResponse.json({ erro: 'Erro ao ler arquivo' }, { status: 400 })
  }

  const { transactions, errors, bankId, ledgerBalance } = parseOFX(rawContent)

  if (transactions.length === 0) {
    return NextResponse.json({
      erro: 'Nenhuma transação encontrada no arquivo',
      errosParser: errors,
    }, { status: 400 })
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

    try {
      const result = await prisma.$transaction(
        async (tx) =>
          runImportV2(tx, {
            bankAccountId: contaId,
            rawOfx: rawContent,
            userId: user.sub,
            fileName: uploadedFileName,
            ipAddress,
            userAgent,
          }),
        { timeout: 120000, maxWait: 10000 },
      )
      // Contrato: mantém os campos essenciais do legado (`mensagem`,
      // `inseridas`, `duplicadas`, `importId`, `errosParser`) + adiciona
      // métricas novas do V2 (preview/orphan/ledgerBalance).
      const inseridas =
        result.classification.effected + result.classification.preview
      return NextResponse.json({
        mode: 'RECONCILE_V2',
        mensagem: `${inseridas} transaç${inseridas !== 1 ? 'ões importadas' : 'ão importada'} (${result.classification.effected} efetivadas, ${result.classification.preview} agendadas).`,
        inseridas,
        duplicadas: result.classification.skippedMatched,
        effected: result.classification.effected,
        previewNovas: result.classification.preview,
        previewJaExistia: result.classification.previewAlreadyExisting,
        orphanWarnings: result.classification.orphanWarnings,
        matchedExact: result.matchedExact,
        matchedFuzzy: result.matchedFuzzy,
        warnings: result.warnings,
        importId: result.importId,
        ledgerBalance: result.ledgerBalance,
        errosParser: errors,
      })
    } catch (e: any) {
      console.error('[importar-ofx RECONCILE_V2] falhou:', e?.message)
      return NextResponse.json(
        { erro: e?.message ?? 'Falha no import V2', code: 'RECONCILE_V2_FAILED' },
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
    importRowPre = await prisma.ofxImport.create({
      data: {
        bankAccountId: contaId,
        userId: user.sub,
        status: 'PROCESSING',
        fileName: uploadedFileName,
        fileSize: rawContent.length,
        totalTransactions: transactions.length,
        duplicates: 0,
        periodStart: periodStartEarly,
        periodEnd: periodEndEarly,
        ipAddress: ipAddressEarly,
        userAgent: userAgentEarly,
        fileHash: fileHashEarly,
        source: 'OFX',
      },
      select: { id: true },
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

  const { novas, duplicadasNoArquivo, duplicadasNoBanco } = filtrarNovasOFX(
    gateResult.toInsert.map((i) => i.payload),
    hashesExistentes,
  )
  // Duplicatas TOTAIS: o gate + legacy.
  const duplicadas =
    duplicadasNoArquivo + duplicadasNoBanco + gateResult.skipped.length

  // Mapa pra recuperar a identidade canônica de cada `novas[]` (pra salvar
  // em Transaction + criar ImportedIdentity)
  const identityByDedupHash = new Map(
    gateResult.toInsert.map((i) => [dedupHashOFX(i.payload), i.identity]),
  )

  if (isPreview) {
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

    if (!isV2PreviewEnabled()) {
      const payload = buildLegacyPreviewPayload({
        novas,
        totalArquivo: transactions.length,
        duplicadas,
        errosParser: errors,
        banco,
      })
      return NextResponse.json({
        ...payload,
        importIdentity: {
          gate: gateResult.stats,
          batchWarnings,
        },
        categorySuggestions,
        categoriesForUI,
        ownEntityRefs,
      })
    }

    // V2: busca candidatos do sistema (somente leitura) + classifica
    const datesIncoming = novas.map((t) => t.datePosted.getTime())
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

    return NextResponse.json({
      ...buildV2PreviewPayload({
        novas,
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
      }),
      categorySuggestions,
      categoriesForUI,
      ownEntityRefs,
    })
  }

  // Inserção em lote das transações novas + recalcula saldo
  if (novas.length === 0) {
    return NextResponse.json({
      mensagem: 'Todas as transações já foram importadas anteriormente.',
      inseridas: 0,
      duplicadas,
    })
  }

  const ajusteSaldo = novas.reduce((acc, t) => {
    return acc + (t.type === 'CREDIT' ? t.amount : -t.amount)
  }, 0)

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
    : await prisma.ofxImport.create({
        data: {
          bankAccountId: contaId,
          userId: user.sub,
          status: 'PROCESSING',
          fileName: uploadedFileName,
          fileSize: rawContent.length,
          totalTransactions: transactions.length,
          duplicates: duplicadas,
          periodStart,
          periodEnd,
          ipAddress,
          userAgent,
          fileHash: fileHashHex,
          source: 'OFX',
        },
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
        data: classified.map((t) => {
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
            // Campos AI (preenchidos só quando t.status='RECONCILED')
            categoryId: t.categoryId ?? null,
            classificationSource: t.classificationSource ?? null,
            classifiedByRuleId: t.classifiedByRuleId ?? null,
            aiConfidence: t.aiConfidence ?? null,
            // Sprint Import Idempotente (18/06/2026)
            fitidKey: ident?.fitidKey ?? null,
            contentHash: ident?.contentHash ?? null,
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
      newTransactions: novas.length,
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

  return NextResponse.json({
    mensagem: `${novas.length} transaç${novas.length !== 1 ? 'ões importadas' : 'ão importada'} com sucesso${reconciledCount > 0 ? ` (${reconciledCount} contrapartes reconciliadas)` : ''}${overridesApplied > 0 ? ` · ${overridesApplied} categoria(s) editada(s)` : ''}${rulesCreated + rulesUpdated > 0 ? ` · ${rulesCreated} regra(s) criada(s)${rulesUpdated > 0 ? ` (${rulesUpdated} atualizadas)` : ''}` : ''}.`,
    inseridas: novas.length,
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
