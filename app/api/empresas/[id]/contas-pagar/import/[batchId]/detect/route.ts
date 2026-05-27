// Sprint 5.0.2.0 — Detecta favorecido + categoria pra cada linha do batch.
//
// Esta etapa NÃO cria nada em produção — só popula campos `matched*` /
// `proposed*` no StagedPayableRow pra UI revisar.
//
// Etapas:
//   1. Se confidence heurístico do mapping atual < 0.70, chama IA pra
//      refinar mapeamento. Senão usa o do /upload.
//   2. Para cada linha: classifica favorecido (SUPPLIER/EMPLOYEE/ORGAO).
//   3. Match favorecido com Supplier/Employee existentes da empresa.
//   4. Map categoria do centro de custo → Category do plano de contas.
//   5. Detecta duplicatas vs Transactions PAYABLE últimos 90 dias.
//   6. Atualiza StagedPayableRow com matched*/proposed*/confidence.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { classifyFavorecido } from '@/lib/excel-import/classify-favorecido'
import { mapCategories } from '@/lib/excel-import/map-categories'
import { decideStagedUserDecision } from '@/lib/excel-import/decide-row-action'

// Sprint 5.0.2.3 — Node runtime explícito + 60s timeout pra batches grandes
export const runtime = 'nodejs'
export const maxDuration = 60

interface Params {
  params: Promise<{ id: string; batchId: string }>
}

function normalizeNameKey(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId, batchId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.create')

    const batch = await prisma.excelImportBatch.findFirst({
      where: { id: batchId, companyId },
    })
    if (!batch) {
      return NextResponse.json(
        { erro: 'Batch não encontrado', code: 'BATCH_NOT_FOUND' },
        { status: 404 },
      )
    }

    const rows = await prisma.stagedPayableRow.findMany({
      where: { batchId },
    })
    if (rows.length === 0) {
      return NextResponse.json(
        { erro: 'Batch sem linhas', code: 'BATCH_EMPTY' },
        { status: 400 },
      )
    }

    // Pre-load suppliers/employees/categorias da empresa
    const [suppliers, employees, categorias] = await Promise.all([
      prisma.supplier.findMany({
        where: { companyId, isActive: true },
        select: { id: true, razaoSocial: true, nomeFantasia: true },
      }),
      prisma.employee.findMany({
        where: { companyId, ativo: true },
        select: { id: true, nome: true },
      }),
      prisma.category.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true, type: true, dreGroup: true },
      }),
    ])

    // Índices pra match rápido
    const supplierByKey = new Map<string, string>()
    for (const s of suppliers) {
      const k1 = normalizeNameKey(s.razaoSocial)
      const k2 = normalizeNameKey(s.nomeFantasia)
      if (k1) supplierByKey.set(k1, s.id)
      if (k2) supplierByKey.set(k2, s.id)
    }
    const employeeByKey = new Map<string, string>()
    for (const e of employees) {
      const k = normalizeNameKey(e.nome)
      if (k) employeeByKey.set(k, e.id)
    }

    // Mapeia centros de custo UNIQUE em batch (pra reusar 1 chamada por CC)
    const centrosCustoSet = new Set<string>()
    for (const r of rows) {
      if (r.rawCentroCusto) centrosCustoSet.add(r.rawCentroCusto)
    }
    const ccArray = Array.from(centrosCustoSet)
    const ccResults = mapCategories({
      centrosCusto: ccArray,
      categoriasEmpresa: categorias,
    })
    const ccByKey = new Map(ccResults.map((c) => [c.centroCusto, c]))

    // Detecção de duplicatas: pega dedupHashes únicos do batch + busca em
    // transactions PAYABLE últimos 90 dias.
    const hashes = Array.from(
      new Set(rows.map((r) => r.dedupHash).filter((h): h is string => !!h)),
    )
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000)
    const existingDuplicates = hashes.length
      ? await prisma.transaction.findMany({
          where: {
            bankAccount: { companyId },
            lifecycle: 'PAYABLE',
            dedupHash: { in: hashes },
            createdAt: { gte: ninetyDaysAgo },
          },
          select: { id: true, dedupHash: true },
        })
      : []
    const dupByHash = new Map<string, string>()
    for (const d of existingDuplicates) {
      if (d.dedupHash) dupByHash.set(d.dedupHash, d.id)
    }

    let countSupplier = 0
    let countEmployee = 0
    let countOrgao = 0
    let countMatchedSupplier = 0
    let countMatchedEmployee = 0
    let countCategoryMatch = 0
    let countCategoryProposed = 0
    let countDuplicates = 0

    // Processa em batches de 100 (UPDATE em lote via $transaction)
    const updateOperations = []

    for (const row of rows) {
      if (!row.rawFavorecido) continue

      const classify = classifyFavorecido({
        favorecido: row.rawFavorecido,
        beneficiarioTipo: row.rawBeneficiario,
        centroCusto: row.rawCentroCusto,
      })

      if (classify.type === 'SUPPLIER') countSupplier++
      else if (classify.type === 'EMPLOYEE') countEmployee++
      else countOrgao++

      const nameKey = normalizeNameKey(row.rawFavorecido)
      let matchedSupplierId: string | null = null
      let matchedEmployeeId: string | null = null

      if (classify.type === 'EMPLOYEE') {
        matchedEmployeeId = employeeByKey.get(nameKey) ?? null
        if (matchedEmployeeId) countMatchedEmployee++
      } else {
        // SUPPLIER ou ORGAO_PUBLICO — usa Supplier
        matchedSupplierId = supplierByKey.get(nameKey) ?? null
        if (matchedSupplierId) countMatchedSupplier++
      }

      const ccResult = row.rawCentroCusto ? ccByKey.get(row.rawCentroCusto) : null
      const matchedCategoryId = ccResult?.matchedCategoryId ?? null
      const proposedCategoryName = ccResult?.proposedCategoryName ?? null
      const categoryConfidence = ccResult?.confidence ?? null
      if (matchedCategoryId) countCategoryMatch++
      else if (proposedCategoryName) countCategoryProposed++

      const duplicateOf = row.dedupHash ? dupByHash.get(row.dedupHash) ?? null : null
      if (duplicateOf) countDuplicates++

      // Sprint 5.0.2.4 — FIX CRÍTICO: NEEDS_REVIEW só por classify.confidence.
      //
      // BUG (Sprint 5.0.2.0): a regra incluía `categoryConfidence < 0.7` como
      // critério, mas categoria PROPOSTA NOVA (estratégia 4 do mapCategories)
      // SEMPRE retorna confidence=0 — ou seja, qualquer CC sem match exato/hint
      // virava NEEDS_REVIEW. O /confirm skipa NEEDS_REVIEW silenciosamente,
      // → 46 das 94 linhas do Cacula perdidas (R$ 76k em transações fora do DRE).
      //
      // CORREÇÃO: categoryConfidence baixo significa "vai criar categoria nova
      // com nome do CC" — caminho normal, não razão pra pular. Só ambiguidade
      // de favorecido (classify.confidence baixo, ex: nome PF ambíguo) justifica
      // revisão humana.
      updateOperations.push(
        prisma.stagedPayableRow.update({
          where: { id: row.id },
          data: {
            favorecidoType: classify.type,
            favorecidoConfidence: classify.confidence,
            matchedSupplierId,
            matchedEmployeeId,
            matchedCategoryId,
            proposedCategoryName,
            categoryConfidence,
            duplicateOf,
            userDecision: decideStagedUserDecision(classify.confidence),
          },
        }),
      )
    }

    // Roda em chunks de 50 pra não estourar pool
    for (let i = 0; i < updateOperations.length; i += 50) {
      await prisma.$transaction(updateOperations.slice(i, i + 50))
    }

    await prisma.excelImportBatch.update({
      where: { id: batchId },
      data: { status: 'DETECTED' },
    })

    console.log(
      `[EXCEL-DETECT] company=${companyId} batch=${batchId} rows=${rows.length} ` +
        `suppliers=${countSupplier} employees=${countEmployee} orgaos=${countOrgao} ` +
        `matched_supplier=${countMatchedSupplier} matched_employee=${countMatchedEmployee} ` +
        `category_match=${countCategoryMatch} category_proposed=${countCategoryProposed} ` +
        `duplicates=${countDuplicates}`,
    )

    return NextResponse.json({
      batchId,
      rows: rows.length,
      breakdown: {
        favorecidos: {
          supplier: countSupplier,
          employee: countEmployee,
          orgao_publico: countOrgao,
        },
        matched: {
          supplier: countMatchedSupplier,
          employee: countMatchedEmployee,
        },
        categories: {
          matched: countCategoryMatch,
          proposed_new: countCategoryProposed,
        },
        duplicates: countDuplicates,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
