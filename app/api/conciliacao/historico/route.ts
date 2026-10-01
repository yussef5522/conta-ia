// Sprint A-effected Fase 1 — GET /api/conciliacao/historico
//
// Lista paginada de conciliações já feitas (candidatos com reconciledWithId).
// Inclui dados do OFX linkado em cada item (1 query agregada via Map lookup,
// evita N+1 no client).
//
// Filtros:
//   - empresaId (multi-tenant obrigatório)
//   - busca (descrição contém — candidato OU OFX)
//   - page, limit (paginação default 25 / max 100)
//
// Ordenação: updatedAt DESC (mais recente primeiro — proxy de "conciliada em").

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { casaBusca } from '@/lib/busca-texto'

const querySchema = z.object({
  empresaId: z.string().cuid(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  busca: z.string().trim().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))

    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    const companyScope = {
      OR: [
        { bankAccount: { companyId: data.empresaId } },
        { supplier: { companyId: data.empresaId } },
        { customer: { companyId: data.empresaId } },
        { category: { companyId: data.empresaId } },
      ],
    }

    const where = {
      reconciledWithId: { not: null },
      AND: [
        companyScope,
        ...(data.busca
          ? [{ description: { contains: data.busca, mode: 'insensitive' as const } }]
          : []),
      ],
    }

    const [total, items] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (data.page - 1) * data.limit,
        take: data.limit,
        select: {
          id: true,
          description: true,
          amount: true,
          paymentDate: true,
          dueDate: true,
          date: true,
          origin: true,
          lifecycle: true,
          status: true,
          reconciledWithId: true,
          reconcileGroupId: true,
          updatedAt: true,
          category: { select: { id: true, name: true, color: true } },
          supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
        },
      }),
    ])

    // Enriquece com OFX linkado (1 query agregada)
    const ofxIds = items.map((i) => i.reconciledWithId).filter((id): id is string => !!id)
    const ofxs =
      ofxIds.length > 0
        ? await prisma.transaction.findMany({
            where: { id: { in: ofxIds } },
            select: {
              id: true,
              description: true,
              amount: true,
              date: true,
              type: true,
              bankAccount: { select: { name: true, bankName: true } },
            },
          })
        : []
    const ofxById = new Map(ofxs.map((o) => [o.id, o]))

    const enriched = items.map((item) => ({
      ...item,
      ofx: item.reconciledWithId ? ofxById.get(item.reconciledWithId) ?? null : null,
      avulsa: null as null | { criadoEm: string; motivo: string | null },
    }))

    /**
     * ⭐⭐⭐ AS AVULSAS ENTRAM AQUI (30/09) — porque elas eram INENCONTRÁVEIS.
     *
     * **A queixa do dono:** *"as duas SUMIRAM e NÃO estão em «Já conciliadas»"*. E era
     * literal: esta lista filtra `reconciledWithId: { not: null }`, e a avulsa **não tem
     * vínculo nenhum** — ela arquiva a linha por uma DECISÃO, não por um par. Então ela saía
     * da caixa e não aparecia em lugar nenhum do sistema.
     *
     * ⛔ *Arquivo inencontrável é a porta sem maçaneta do lado do arquivo* — e é pior que a
     * porta pintada, porque aqui o dono sabe que fez o gesto e não acha o resultado.
     *
     * ⚠️ Elas vão numa consulta À PARTE de propósito: misturar no `where` exigiria um `OR`
     * sobre duas perguntas diferentes (*"tem vínculo?"* × *"tem decisão gravada?"*) e o
     * `total`/paginação passariam a contar maçãs com laranjas. Aqui a lista de avulsas é
     * pequena por natureza (decisão do dono, não fluxo diário) e vem inteira, filtrada pela
     * MESMA busca.
     */
    const avulsas = await prisma.conciliacaoAvulsaConfirmada.findMany({
      where: { companyId: data.empresaId },
      orderBy: { criadoEm: 'desc' },
      select: { transactionId: true, criadoEm: true, motivo: true },
    })
    const avulsaPorTx = new Map(avulsas.map((a) => [a.transactionId, a]))
    const linhasAvulsas = avulsas.length
      ? await prisma.transaction.findMany({
          where: { id: { in: avulsas.map((a) => a.transactionId) } },
          orderBy: { date: 'desc' },
          select: {
            id: true, description: true, amount: true, date: true, type: true,
            paymentDate: true, dueDate: true, origin: true, lifecycle: true, status: true,
            reconciledWithId: true, reconcileGroupId: true, updatedAt: true,
            category: { select: { id: true, name: true, color: true } },
            supplier: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
            bankAccount: { select: { name: true, bankName: true } },
          },
        })
      : []

    /**
     * ⭐⭐ A BUSCA DAS AVULSAS RODA NO APP, pela `casaBusca` da casa — e isso é MELHOR que o
     * `mode: 'insensitive'` do Prisma, não um atalho.
     *
     * ⚠️ `contains` é case-SENSITIVE no Postgres e case-INSENSITIVE no SQLite (o bug de
     * 08/09, que funcionava em dev e falhava calado em prod), e `mode: 'insensitive'` nem
     * existe no SQLite — por isso ele não compila aqui. A `casaBusca` resolve **caixa E
     * acento** e casa palavra em qualquer ordem: quem digita «cooperativa» acha
     * «COOPERATIVA DE PAIS E MESTRES».
     *
     * ⛔ E só vale porque a lista é pequena POR NATUREZA (avulsa é decisão do dono, não
     * fluxo diário) — filtrar no app uma lista paginada perderia item fora da página, que é
     * a armadilha do `take` que esta casa já pagou quatro vezes.
     */
    const itensAvulsos = (data.busca
      ? linhasAvulsas.filter((t) => casaBusca(t.description ?? '', data.busca!))
      : linhasAvulsas
    ).map((t) => {
      const a = avulsaPorTx.get(t.id)!
      return {
        ...t,
        ofx: null,
        // ⭐ o que marca a linha como "decisão do dono" na tela — e carrega o QUANDO e o
        // PORQUÊ, que é o que o contador vai perguntar
        avulsa: { criadoEm: a.criadoEm.toISOString(), motivo: a.motivo },
      }
    })

    return NextResponse.json({
      items: enriched,
      /**
       * ⭐ Lista SEPARADA, não misturada — a tela desenha as duas seções e o dono vê a
       * diferença entre *"casou com uma nota"* e *"eu disse que não tem nota"*. Colapsar as
       * duas no mesmo balde é a mistura que escondeu os R$ 16.201,01 em 24/09.
       */
      avulsas: itensAvulsos,
      total,
      page: data.page,
      limit: data.limit,
      totalPages: Math.ceil(total / data.limit),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
