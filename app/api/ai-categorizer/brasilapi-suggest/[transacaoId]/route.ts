// POST /api/ai-categorizer/brasilapi-suggest/[transacaoId]
// Fase 3 Etapa 2 — Camada 2B (lazy lookup via BrasilAPI).
//
// Extrai CNPJ da descrição da tx → consulta BrasilAPI → cria/atualiza
// Supplier no banco com fonte=BRASILAPI + resolve categoryId via CNAE
// mapping.
//
// IDEMPOTENTE: se Supplier já existe pra esse CNPJ na empresa, retorna
// cache local sem hit na BrasilAPI (a menos que ?refresh=true).
//
// Multi-tenant: companyId vem da bankAccount da transação.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { extractCNPJ, formatCNPJ } from '@/lib/ai-categorizer/cnpj-extractor'
import { fetchCNPJ } from '@/lib/ai-categorizer/brasilapi-client'
import { mapCNAEtoCategoryHint } from '@/lib/ai-categorizer/cnae-mapping'
import { resolveCategoryFromHint } from '@/lib/ai-categorizer/pipeline'

interface Params {
  params: Promise<{ transacaoId: string }>
}

const CACHE_TTL_DAYS = 30

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { transacaoId } = await params
    const refresh = request.nextUrl.searchParams.get('refresh') === 'true'

    const tx = await prisma.transaction.findUnique({
      where: { id: transacaoId },
      include: { bankAccount: { select: { companyId: true } } },
    })
    if (!tx) {
      return NextResponse.json(
        { erro: 'Transação não encontrada' },
        { status: 404 },
      )
    }

    const ctx = await getAuthContext(request, tx.bankAccount!.companyId)
    ctx.requirePermission('transaction.view')

    // 1. Extrai CNPJ da descrição
    const cnpj = extractCNPJ(tx.description)
    if (!cnpj) {
      return NextResponse.json({
        encontrado: false,
        motivo: 'sem-cnpj',
        mensagem: 'Descrição não contém CNPJ válido.',
      })
    }

    const companyId = tx.bankAccount!.companyId

    // 2. Cache: já temos esse CNPJ persistido pra essa empresa?
    let supplier = await prisma.supplier.findUnique({
      where: { companyId_cnpj: { companyId, cnpj } },
      include: { category: { select: { id: true, name: true } } },
    })

    const cacheStale =
      supplier?.fonteAtualizadaEm &&
      Date.now() - supplier.fonteAtualizadaEm.getTime() >
        CACHE_TTL_DAYS * 24 * 60 * 60 * 1000

    // 3. Se não tem cache OU é stale OU user pediu refresh, consulta BrasilAPI
    if (!supplier || cacheStale || refresh) {
      const apiResult = await fetchCNPJ(cnpj)

      if (apiResult.kind === 'rate-limited') {
        // Sem cache local + rate limit → retorna erro suave
        if (!supplier) {
          return NextResponse.json(
            {
              encontrado: false,
              motivo: 'rate-limited',
              mensagem: 'BrasilAPI ocupada. Tente em 60 segundos.',
            },
            { status: 503 },
          )
        }
        // Tem cache local, devolve mesmo stale
      } else if (apiResult.kind === 'not-found') {
        // CNPJ inválido na Receita
        if (!supplier) {
          supplier = await prisma.supplier.create({
            data: {
              companyId,
              cnpj,
              razaoSocial: '(CNPJ não encontrado)',
              fonte: 'BRASILAPI',
              fonteAtualizadaEm: new Date(),
              isActive: false,
            },
            include: { category: { select: { id: true, name: true } } },
          })
        }
        return NextResponse.json({
          encontrado: false,
          motivo: 'cnpj-inativo',
          cnpj: formatCNPJ(cnpj),
          mensagem: 'CNPJ não encontrado na BrasilAPI.',
        })
      } else if (apiResult.kind === 'success') {
        const hint = mapCNAEtoCategoryHint(apiResult.data.cnae_fiscal)

        // Resolve categoryId via plano de contas (se houver hint)
        let categoryId: string | null = null
        if (hint) {
          const categorias = await prisma.category.findMany({
            where: { companyId, isActive: true },
            select: { id: true, name: true, dreGroup: true, isActive: true },
          })
          categoryId = resolveCategoryFromHint(categorias, {
            dreGroup: hint.dreGroup,
            categoryNameHint: hint.categoryNameHint,
          })
        }

        // Upsert Supplier
        supplier = await prisma.supplier.upsert({
          where: { companyId_cnpj: { companyId, cnpj } },
          create: {
            companyId,
            cnpj,
            razaoSocial: apiResult.data.razao_social,
            nomeFantasia: apiResult.data.nome_fantasia,
            cnaePrincipal:
              apiResult.data.cnae_fiscal !== null &&
              apiResult.data.cnae_fiscal !== undefined
                ? String(apiResult.data.cnae_fiscal)
                : null,
            categoryId,
            fonte: 'BRASILAPI',
            fonteAtualizadaEm: new Date(),
          },
          update: {
            razaoSocial: apiResult.data.razao_social,
            nomeFantasia: apiResult.data.nome_fantasia,
            cnaePrincipal:
              apiResult.data.cnae_fiscal !== null &&
              apiResult.data.cnae_fiscal !== undefined
                ? String(apiResult.data.cnae_fiscal)
                : null,
            // Só atualiza categoryId se ainda não tem (preserva escolha do user)
            ...(supplier?.categoryId ? {} : { categoryId }),
            fonteAtualizadaEm: new Date(),
            fonte: 'BRASILAPI',
          },
          include: { category: { select: { id: true, name: true } } },
        })

        // Linka a transaction.supplierId atual (se ainda não tem)
        if (!tx.supplierId) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { supplierId: supplier.id },
          })
        }
      } else if (apiResult.kind === 'timeout' || apiResult.kind === 'error') {
        if (!supplier) {
          return NextResponse.json(
            {
              encontrado: false,
              motivo: apiResult.kind,
              mensagem: 'Falha ao consultar BrasilAPI. Tente novamente.',
            },
            { status: 503 },
          )
        }
        // Tem cache, devolve mesmo
      }
    }

    if (!supplier) {
      return NextResponse.json({
        encontrado: false,
        motivo: 'sem-dados',
        cnpj: formatCNPJ(cnpj),
      })
    }

    return NextResponse.json({
      encontrado: true,
      supplier: {
        id: supplier.id,
        cnpj: supplier.cnpj ? formatCNPJ(supplier.cnpj) : null,
        razaoSocial: supplier.razaoSocial,
        nomeFantasia: supplier.nomeFantasia,
        cnaePrincipal: supplier.cnaePrincipal,
        fonte: supplier.fonte,
        category: supplier.category,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
