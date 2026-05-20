import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseOFX } from '@/lib/ofx/parser'
import { detectarBanco, bateComPerfilDaConta } from '@/lib/ofx/bancos'
import { dedupHashOFX, filtrarNovasOFX } from '@/lib/ofx/dedup'
import {
  autoClassifyTransactions,
  buildRuleIndex,
  loadActiveRules,
  persistKeywordSuggestions,
} from '@/lib/ai-categorizer/apply'

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

  const { transactions, errors, bankId } = parseOFX(rawContent)

  if (transactions.length === 0) {
    return NextResponse.json({
      erro: 'Nenhuma transação encontrada no arquivo',
      errosParser: errors,
    }, { status: 400 })
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
    return NextResponse.json({
      preview: novas.map((t) => ({
        fitid: t.fitid,
        dedupHash: t.dedupHash,
        date: t.datePosted,
        amount: t.amount,
        type: t.type,
        memo: t.memo,
      })),
      total: transactions.length,
      novas: novas.length,
      duplicadas,
      errosParser: errors,
      banco,
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
  const {
    classified,
    rulesFired,
    autoCount,
    supplierSuggestions,
    keywordHits,
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
    fornecedoresDetectados: supplierStats.suppliersCreated,
    transacoesComFornecedor: supplierStats.transactionsLinked,
    predictMs,
    keywordPersistMs,
    errosParser: errors,
    importId: importRow.id,
  })
}
