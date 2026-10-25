/**
 * ⭐⭐⭐ OS IDS DO FILTRO INTEIRO — porta de LEITURA do "selecionar todas" (23/10).
 *
 * **O defeito que ela fecha (caçado em prod antes de codar):** o header da tabela chamava
 * `toggleAllPageRowsSelected` sobre `rows={items}` com `limit: 50` — **não existia caminho
 * que alcançasse o filtro inteiro**. Com 81 contas em 2 páginas, "selecionar todas" marcava
 * 50, e a barra somava só essas (escondendo 31 contas e R$ 44.533,81) enquanto a contagem e
 * as ações falavam das 81 selecionadas de fato.
 *
 * ⛔⛔⛔ **SÓ LEITURA, e isso é a decisão central.** Aceitar um FILTRO na rota de bulk seria
 * uma porta de ESCRITA nova que resolve linhas no servidor — e **filtro com bug = linha
 * errada apagada**, sem ninguém ter visto a lista. Aqui o dono recebe os ids que ele VIU,
 * confere número e valor na barra, e a gravação segue sendo **por id explícito,
 * all-or-nothing** (`/api/empresas/[id]/contas-pagar/bulk`).
 *
 * ⭐ **UMA RÉGUA:** o `where` vem do MESMO `buildPayableListWhere` e a ordem do MESMO
 * `buildPayableOrderBy` da lista. Uma régua própria aqui selecionaria um conjunto que a
 * tabela não mostra — o pior tipo de divergência numa tela de dinheiro.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import {
  buildPayableListWhere,
  buildPayableOrderBy,
  listPayableSchema,
} from '@/lib/contas-pagar/list-filters'
import { recortarSelecao, TETO_DO_LOTE } from '@/lib/contas-pagar/selecao-do-filtro'
import { mesCorrente } from '@/lib/periodo/mes-corrente'

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const empresaId = sp.get('empresaId')
    if (!empresaId) {
      return NextResponse.json(
        { erro: 'empresaId obrigatório', code: 'EMPRESA_REQUIRED' },
        { status: 400 },
      )
    }

    const ctx = await getAuthContext(request, empresaId)
    // ⚠️ `view`: ler ids NUNCA exige gerenciar — a régua de 09/09 (*"ler é ler"*). Quem
    // grava é o `/bulk`, que pede `transaction.update`/`delete`.
    ctx.requirePermission('transaction.view')

    const input = listPayableSchema.parse(Object.fromEntries(sp.entries()))
    const now = new Date()
    const mesDoRecorte = input.mes ?? mesCorrente(now)
    const where = buildPayableListWhere({ ...input, mes: mesDoRecorte }, now)
    const orderBy = buildPayableOrderBy(input)

    const [linhas, totalNoFiltro] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy,
        // ⭐ o teto da rota de gravação, +0 — o recorte honesto é feito pela régua pura
        take: TETO_DO_LOTE,
        select: { id: true, amount: true },
      }),
      prisma.transaction.count({ where }),
    ])

    const selecao = recortarSelecao(
      linhas.map((l) => ({ id: l.id, amount: Number(l.amount) })),
      totalNoFiltro,
    )

    return NextResponse.json(selecao)
  } catch (error) {
    return handleApiError(error)
  }
}
