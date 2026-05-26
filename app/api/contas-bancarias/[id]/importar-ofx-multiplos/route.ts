// POST /api/contas-bancarias/[id]/importar-ofx-multiplos — Sprint 2.4 Onda 2.
//
// Recebe N arquivos via FormData (campo "files"). Processa SEQUENCIALMENTE
// (evita race condition no dedupHash). Cada arquivo gera 1 OfxImport.
//
// Retorna array de resultados — front mostra progress.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { parseOFX } from '@/lib/ofx/parser'
import { dedupHashOFX, filtrarNovasOFX } from '@/lib/ofx/dedup'
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

interface Params {
  params: Promise<{ id: string }>
}

interface FileResult {
  fileName: string
  status: 'SUCCESS' | 'FAILED' | 'EMPTY'
  importId?: string
  novas?: number
  duplicadas?: number
  autoClassificadas?: number
  fornecedoresDetectados?: number
  erro?: string
}

async function verificarAcesso(userId: string, contaId: string) {
  return prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId } } } },
  })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: contaId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const conta = await verificarAcesso(user.sub, contaId)
  if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ erro: 'Erro ao ler payload' }, { status: 400 })
  }

  const files = formData.getAll('files').filter(
    (v): v is File => typeof v !== 'string' && v !== null,
  )
  if (files.length === 0) {
    return NextResponse.json({ erro: 'Nenhum arquivo enviado' }, { status: 400 })
  }
  if (files.length > 20) {
    return NextResponse.json(
      { erro: 'Máximo 20 arquivos por vez' },
      { status: 400 },
    )
  }

  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  // Carrega regras 1 vez (reusa entre arquivos)
  const activeRules = await loadActiveRules(conta.companyId)
  const ruleIndex = buildRuleIndex(conta.companyId, activeRules)
  // Sprint 5.0.2.l — Camada SETOR DB-backed
  const empresa = await prisma.company.findUnique({
    where: { id: conta.companyId },
    select: { setor: true },
  })
  const setorEmpresa = empresa?.setor ?? null
  const systemCats = await ensureAllSystemCategories(conta.companyId, setorEmpresa)
  const setorPatterns = await loadPatternsForSetor(setorEmpresa)
  const setorResolver = (name: string) =>
    resolveSetorCategoryId(systemCats.list, name)
  const categoriasEmpresa = systemCats.list

  const results: FileResult[] = []
  let totalNovas = 0
  let totalDup = 0
  let totalAuto = 0

  // SEQUENCIAL: evita race no dedupHash entre arquivos do mesmo upload
  for (const file of files) {
    const fileName = file.name || 'extrato.ofx'
    try {
      const rawContent = await file.text()
      const { transactions } = parseOFX(rawContent)

      if (transactions.length === 0) {
        results.push({ fileName, status: 'EMPTY', erro: 'Arquivo vazio ou inválido' })
        continue
      }

      // Dedup hash lookup (inclui imports anteriores)
      const todosHashes = transactions.map((t) => dedupHashOFX(t))
      const existentes = await prisma.transaction.findMany({
        where: { bankAccountId: contaId, dedupHash: { in: todosHashes } },
        select: { dedupHash: true },
      })
      const hashesExistentes = new Set(
        existentes.map((e) => e.dedupHash).filter((h): h is string => h !== null),
      )
      const { novas, duplicadasNoArquivo, duplicadasNoBanco } = filtrarNovasOFX(
        transactions,
        hashesExistentes,
      )
      const duplicadas = duplicadasNoArquivo + duplicadasNoBanco

      // Período pra import row
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
          fileName,
          fileSize: rawContent.length,
          totalTransactions: transactions.length,
          duplicates: duplicadas,
          periodStart,
          periodEnd,
          ipAddress,
          userAgent,
        },
      })

      if (novas.length === 0) {
        await prisma.ofxImport.update({
          where: { id: importRow.id },
          data: { status: 'SUCCESS', newTransactions: 0 },
        })
        results.push({
          fileName,
          status: 'SUCCESS',
          importId: importRow.id,
          novas: 0,
          duplicadas,
          autoClassificadas: 0,
          fornecedoresDetectados: 0,
        })
        totalDup += duplicadas
        continue
      }

      const ajusteSaldo = novas.reduce((acc, t) => {
        return acc + (t.type === 'CREDIT' ? t.amount : -t.amount)
      }, 0)

      const {
        classified,
        rulesFired,
        autoCount,
        supplierSuggestions,
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
              importId: importRow.id,
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
          ...Array.from(rulesFired.entries()).map(([ruleId, count]) =>
            prisma.aiLearningRule.update({
              where: { id: ruleId },
              data: { vezesAplicada: { increment: count } },
            }),
          ),
        ])
      } catch (txErr) {
        await prisma.ofxImport.update({
          where: { id: importRow.id },
          data: {
            status: 'FAILED',
            errorMessage:
              txErr instanceof Error ? txErr.message : String(txErr),
          },
        })
        results.push({
          fileName,
          status: 'FAILED',
          importId: importRow.id,
          erro: 'Falha ao salvar transações',
        })
        continue
      }

      // Suppliers (keyword hits)
      let supplierStats = { suppliersCreated: 0, transactionsLinked: 0 }
      if (supplierSuggestions.length > 0) {
        supplierStats = await persistKeywordSuggestions(
          conta.companyId,
          supplierSuggestions,
          categoriasEmpresa,
        )
      }

      await prisma.ofxImport.update({
        where: { id: importRow.id },
        data: {
          status: 'SUCCESS',
          newTransactions: novas.length,
          autoClassified: autoCount,
        },
      })

      results.push({
        fileName,
        status: 'SUCCESS',
        importId: importRow.id,
        novas: novas.length,
        duplicadas,
        autoClassificadas: autoCount,
        fornecedoresDetectados: supplierStats.suppliersCreated,
      })

      totalNovas += novas.length
      totalDup += duplicadas
      totalAuto += autoCount
    } catch (err) {
      results.push({
        fileName,
        status: 'FAILED',
        erro: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return NextResponse.json({
    success: true,
    results,
    resumo: {
      totalArquivos: files.length,
      sucesso: results.filter((r) => r.status === 'SUCCESS').length,
      falhados: results.filter((r) => r.status === 'FAILED').length,
      vazios: results.filter((r) => r.status === 'EMPTY').length,
      totalNovas,
      totalDuplicadas: totalDup,
      totalAutoClassificadas: totalAuto,
    },
  })
}
