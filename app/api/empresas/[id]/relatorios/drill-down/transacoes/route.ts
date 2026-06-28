// Sprint Drill-Down (29/05/2026) — GET (POST seria possível, mas REST + cache-friendly fica melhor com GET).
//
// Lista transações que compõem o valor de uma célula/barra clicada num relatório.
//
// Replica EXATAMENTE o filtro de status + bucket dos relatórios fonte
// (comparativo e analise-variacao) pra garantir aritmética: Σ modal = valor cell.
//
// Hotfix lifecycle (audit): NÃO filtra por lifecycle. Modal mostra coluna
// "Estado" pra distinguir EFFECTED ("paga") vs PAYABLE/RECEIVABLE ("pendente").

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/

const querySchema = z.object({
  categoriaId: z.string().min(1, 'categoriaId obrigatório'),
  dataInicio: z.string().regex(isoDateRegex, 'dataInicio deve ser YYYY-MM-DD'),
  dataFim: z.string().regex(isoDateRegex, 'dataFim deve ser YYYY-MM-DD'),
  regime: z.enum(['competencia', 'caixa']).default('competencia'),
  tipo: z.enum(['DESPESA', 'RECEITA', 'TODOS']).default('DESPESA'),
})

interface Params {
  params: Promise<{ id: string }>
}

export const runtime = 'nodejs'

const HARD_LIMIT = 200

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('dre.view')

    const sp = request.nextUrl.searchParams
    const input = querySchema.parse(Object.fromEntries(sp.entries()))

    // Range UTC: data fim vira final do dia
    const dataInicio = new Date(`${input.dataInicio}T00:00:00.000Z`)
    const dataFim = new Date(`${input.dataFim}T23:59:59.999Z`)

    if (dataFim.getTime() < dataInicio.getTime()) {
      return NextResponse.json(
        { error: 'dataFim deve ser >= dataInicio' },
        { status: 400 },
      )
    }

    // Bucket field: competencia → competenceDate ?? date; caixa → paymentDate ?? date.
    // Replica EXATA dos endpoints comparativo + analise-variacao.
    const bucketField =
      input.regime === 'caixa' ? 'paymentDate' : 'competenceDate'

    // Filtro de tipo (CREDIT/DEBIT/ambos) — alinhado com tipo do relatório.
    const typeFilter =
      input.tipo === 'DESPESA'
        ? { type: 'DEBIT' as const }
        : input.tipo === 'RECEITA'
          ? { type: 'CREDIT' as const }
          : {}

    const txs = await prisma.transaction.findMany({
      where: {
        AND: [
          // Multi-tenant: 5 fontes possíveis de companyId (mesma OR dos relatórios)
          {
            OR: [
              { bankAccount: { companyId: empresaId } },
              { supplier: { companyId: empresaId } },
              { employee: { companyId: empresaId } },
              { customer: { companyId: empresaId } },
              { category: { companyId: empresaId } },
            ],
          },
          { categoryId: input.categoriaId },
          // Bucket de data idêntico aos relatórios fonte
          {
            OR: [
              { [bucketField]: { gte: dataInicio, lte: dataFim } },
              {
                [bucketField]: null,
                date: { gte: dataInicio, lte: dataFim },
              },
            ],
          },
          typeFilter,
          // Excluir transferências (mesma decisão do DRE — não infla)
          { type: { not: 'TRANSFER' } },
          // Sprint Cartao PJ R6.1 (25/06/2026): pagamento de cartao casado
          // NAO aparece em drill-down de categoria (mesma decisao do DRE —
          // engine pula isCardPayment=true). Se Yussef categorizar uma por
          // engano fora deste filtro, ela nao entraria aqui mas tambem nao
          // entra no DRE, entao mantem consistencia visual.
          { isCardPayment: false },
          // Sprint Pendentes Fix R2 (27/06/2026): pagamento de parcela
          // emprestimo NAO aparece em drill-down (DRE conta so juros via
          // loanInterestSplit). Mesmo padrao do R6.1.
          { loanInstallmentPaid: { is: null } },
          // Sprint Pending Transfer State (27/06/2026): "aguardando par"
          // não compõe nenhum bucket de DRE — fora do drill-down.
          { pendingTransfer: false },
        ],
        status: { in: ['RECONCILED', 'PENDING'] },
      },
      select: {
        id: true,
        date: true,
        competenceDate: true,
        paymentDate: true,
        description: true,
        type: true,
        amount: true,
        lifecycle: true,
        status: true,
        supplier: { select: { razaoSocial: true, nomeFantasia: true } },
        employee: { select: { nome: true } },
        customer: { select: { razaoSocial: true, nomeFantasia: true } },
      },
      orderBy: [
        // Mesma ordem do bucket: usa o campo do regime escolhido
        { [bucketField]: 'desc' },
        { date: 'desc' },
      ],
      take: HARD_LIMIT,
    })

    const categoria = await prisma.category.findUnique({
      where: { id: input.categoriaId },
      select: { id: true, name: true, dreGroup: true, companyId: true },
    })

    // Multi-tenant guard: categoria deve pertencer à empresa
    if (!categoria || categoria.companyId !== empresaId) {
      return NextResponse.json(
        { error: 'Categoria não encontrada na empresa' },
        { status: 404 },
      )
    }

    const transacoes = txs.map((t) => {
      const favorecidoTipo: 'supplier' | 'employee' | 'customer' | null =
        t.supplier ? 'supplier'
        : t.employee ? 'employee'
        : t.customer ? 'customer'
        : null
      const favorecido =
        t.supplier?.razaoSocial ??
        t.employee?.nome ??
        t.customer?.razaoSocial ??
        null
      const bucketDate =
        input.regime === 'caixa'
          ? (t.paymentDate ?? t.date)
          : (t.competenceDate ?? t.date)
      const signedAmount = t.type === 'CREDIT' ? t.amount : -t.amount
      return {
        id: t.id,
        bucketDate: bucketDate.toISOString(),
        date: t.date.toISOString(),
        competenceDate: t.competenceDate?.toISOString() ?? null,
        paymentDate: t.paymentDate?.toISOString() ?? null,
        description: t.description,
        type: t.type as 'CREDIT' | 'DEBIT' | 'TRANSFER',
        amount: t.amount,
        signedAmount,
        favorecido,
        favorecidoTipo,
        lifecycle: t.lifecycle as 'EFFECTED' | 'PAYABLE' | 'RECEIVABLE',
        status: t.status as 'RECONCILED' | 'PENDING' | 'IGNORED',
      }
    })

    // Stats agregados: total + breakdown pagas/pendentes (Hotfix Ajuste 1)
    const total = transacoes.reduce(
      (s, t) => s + (input.tipo === 'TODOS' ? t.signedAmount : t.amount),
      0,
    )
    const pagas = transacoes.filter((t) => t.lifecycle === 'EFFECTED')
    const pendentes = transacoes.filter((t) => t.lifecycle !== 'EFFECTED')

    return NextResponse.json({
      categoria: {
        id: categoria.id,
        name: categoria.name,
        dreGroup: categoria.dreGroup,
      },
      total,
      qtd: transacoes.length,
      truncated: transacoes.length === HARD_LIMIT,
      breakdown: {
        pagas: {
          qtd: pagas.length,
          total: pagas.reduce(
            (s, t) => s + (input.tipo === 'TODOS' ? t.signedAmount : t.amount),
            0,
          ),
        },
        pendentes: {
          qtd: pendentes.length,
          total: pendentes.reduce(
            (s, t) => s + (input.tipo === 'TODOS' ? t.signedAmount : t.amount),
            0,
          ),
        },
      },
      transacoes,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
