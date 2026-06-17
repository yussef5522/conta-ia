import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseOFX } from '@/lib/ofx/parser'
import { detectarBanco, bateComPerfilDaConta } from '@/lib/ofx/bancos'
import { dedupHashOFX, filtrarNovasOFX } from '@/lib/ofx/dedup'
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
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ erro: 'Arquivo OFX não enviado' }, { status: 400 })
    }
    uploadedFileName = (file as File).name || 'extrato.ofx'
    rawContent = await (file as File).text()
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

  // Deduplicação por hash composto (ver lib/ofx/dedup.ts).
  // Lookup contra DB usa os hashes que vamos calcular agora — evita pegar
  // toda a tabela e reduz o IN(...) ao tamanho do arquivo.
  const todosHashes = transactions.map((t) => dedupHashOFX(t))
  const existentes = await prisma.transaction.findMany({
    where: { bankAccountId: contaId, dedupHash: { in: todosHashes } },
    select: { dedupHash: true },
  })
  const hashesExistentes = new Set(
    existentes.map((e) => e.dedupHash).filter((h): h is string => h !== null),
  )

  const { novas, duplicadasNoArquivo, duplicadasNoBanco } = filtrarNovasOFX(transactions, hashesExistentes)
  const duplicadas = duplicadasNoArquivo + duplicadasNoBanco

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
    if (!isV2PreviewEnabled()) {
      return NextResponse.json(
        buildLegacyPreviewPayload({
          novas,
          totalArquivo: transactions.length,
          duplicadas,
          errosParser: errors,
          banco,
        }),
      )
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

    return NextResponse.json(
      buildV2PreviewPayload({
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
    )
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

  const importRow = await prisma.ofxImport.create({
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
    classified,
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
  const predictMs = Date.now() - t0Predict

  try {
    await prisma.$transaction([
      prisma.transaction.createMany({
        data: classified.map((t) => ({
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
        })),
      }),
      prisma.bankAccount.update({
        where: { id: contaId },
        data: { balance: { increment: ajusteSaldo } },
      }),
      // Incrementa vezesAplicada das regras que dispararam
      ...Array.from(rulesFired.entries()).map(([ruleId, count]) =>
        prisma.aiLearningRule.update({
          where: { id: ruleId },
          data: { vezesAplicada: { increment: count } },
        }),
      ),
    ])
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
    const { normalizeCnpj } = await import('@/lib/transfers/own-entity-signals')
    const crypto = await import('node:crypto')

    const companyForRefs = await prisma.company.findUnique({
      where: { id: conta.companyId },
      select: {
        cnpj: true,
        name: true,
        tradeName: true,
        bankAccounts: { where: { isActive: true }, select: { id: true, name: true } },
        sociosPF: { select: { nome: true } },
      },
    })
    if (companyForRefs) {
      const refs = {
        cnpj: normalizeCnpj(companyForRefs.cnpj),
        names: [
          companyForRefs.name,
          companyForRefs.tradeName,
          ...companyForRefs.sociosPF.map((s) => s.nome),
        ].filter((n): n is string => typeof n === 'string' && n.length > 0),
        accountNames: companyForRefs.bankAccounts.map((a) => a.name),
      }
      const accIds = companyForRefs.bankAccounts.map((a) => a.id)
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
      if (toApply.length > 0) {
        await prisma.$transaction(async (txp) => {
          for (const p of toApply) {
            const groupId = crypto.randomUUID()
            const r1 = await txp.transaction.updateMany({
              where: { id: p.from.id, transferGroupId: null, type: 'DEBIT' },
              data: {
                type: 'TRANSFER',
                transferGroupId: groupId,
                transferDirection: 'OUT',
                status: 'RECONCILED',
              },
            })
            const r2 = await txp.transaction.updateMany({
              where: { id: p.to.id, transferGroupId: null, type: 'CREDIT' },
              data: {
                type: 'TRANSFER',
                transferGroupId: groupId,
                transferDirection: 'IN',
                status: 'RECONCILED',
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
    mensagem: `${novas.length} transaç${novas.length !== 1 ? 'ões importadas' : 'ão importada'} com sucesso.`,
    inseridas: novas.length,
    duplicadas,
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
