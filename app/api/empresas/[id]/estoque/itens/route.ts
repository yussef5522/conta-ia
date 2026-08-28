// ESTOQUE FASE 2 item 2.0 — GET itens (busca pro editor de ficha) + POST criar item mínimo
// (o dono adiciona molho/sal que nunca vieram em nota — nasce SEM custo/movimento; o custo
// chega quando a 1ª nota dele entrar). Sem isso a ficha fica incompleta e o custo errado.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { custoMedioPorItem } from '@/lib/stock/saldo'
import { filtrarPorBusca } from '@/lib/busca-texto'

interface Params { params: Promise<{ id: string }> }


export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const busca = request.nextUrl.searchParams.get('busca')?.trim() ?? ''

  // ⭐ ESCOPO=RECEITA (27/08) — o editor de ficha estava oferecendo DESENGRAXANTE, SACO DE
  // LIXO e JAPONA DE CÂMARA como ingrediente de lanche. Ingrediente é matéria-prima,
  // intermediário produzido ou revenda (combo leva refri); LIMPEZA/USO_INTERNO/EMBALAGEM
  // não entram em receita. ⚠️ O filtro é NO SERVIDOR de propósito: com `take: 50`, filtrar
  // no cliente deixaria itens bons de fora quando o material de limpeza ocupa as 50 vagas.
  const escopoReceita = request.nextUrl.searchParams.get('escopo') === 'receita'
  const CATS_RECEITA = ['MATERIA_PRIMA', 'INTERMEDIARIO', 'PRODUTO_FINAL', 'REVENDA']

  // filtro por categoria — usado pelo hub pra listar SÓ revenda ao mapear bebida inline.
  // Também no servidor: com `take: 50` o filtro no cliente perderia itens.
  const categoria = request.nextUrl.searchParams.get('categoria')?.trim() || null

  // ⭐⭐ A BUSCA É FILTRADA NO APP, SOBRE A MESMA LISTA QUE A TELA MOSTRA (28/08 — REGRA 4).
  //
  // ⚠️ ANTES era `nome: { contains: busca }` no Prisma, e isso ESCONDIA o item em prod: o
  // `contains` é case-SENSITIVE no PostgreSQL e case-INSENSITIVE no SQLite. Medido no banco
  // real: contains("xis") → 0 e contains("XIS") → 1 ("PAO DE XIS"). Funcionava em DEV e
  // falhava CALADO em PROD — o dono via o item rolando a lista e não achava digitando.
  //
  // ⚠️ E `mode: 'insensitive'` não resolveria sozinho: conserta caixa, não ACENTO. No mesmo
  // banco, insensitive("pao") acha "PAO DE XIS" mas NÃO acha "Pão tradicional". Num catálogo
  // onde a nota escreve "PAO" e o dono escreve "Pão", isso é o mesmo bug com outra cara.
  //
  // Filtrando aqui, o critério é UM só (`casaBusca`) e a lista e o filtro não têm como
  // discordar. Também resolve a truncagem: o `take` passa a valer DEPOIS de filtrar — antes,
  // 50 itens eram lidos e só então a busca acontecia, então item fora das 50 sumia.
  const LIMITE_LEITURA = 2000 // catálogo de estoque não chega perto disso (Caçula: 54)
  const [todos, derivado] = await Promise.all([
    prisma.stockItem.findMany({
      where: {
        companyId, ativo: true,
        ...(categoria ? { categoria } : escopoReceita ? { categoria: { in: CATS_RECEITA } } : {}),
      },
      orderBy: { nome: 'asc' },
      take: LIMITE_LEITURA,
      select: { id: true, nome: true, unidadeControle: true, categoria: true },
    }),
    // custoMedio DERIVADO dos movimentos (mesma fonte da Posição) — não o campo stale
    custoMedioPorItem(prisma, companyId),
  ])

  const itens = filtrarPorBusca(todos, busca, (i) => i.nome).slice(0, 50)

  // ordem de RELEVÂNCIA pra receita: o que a cozinha usa primeiro aparece primeiro.
  const PESO: Record<string, number> = { INTERMEDIARIO: 0, MATERIA_PRIMA: 1, REVENDA: 2, PRODUTO_FINAL: 3 }
  const ordenados = escopoReceita
    ? [...itens].sort((a, b) => (PESO[a.categoria] ?? 9) - (PESO[b.categoria] ?? 9) || a.nome.localeCompare(b.nome, 'pt-BR'))
    : itens

  return NextResponse.json({ itens: ordenados.map((i) => ({ ...i, custoMedio: derivado.get(i.id) ?? null })) })
}

const criarSchema = z.object({
  nome: z.string().min(1).max(120),
  unidadeControle: z.enum(['KG', 'UN', 'LT']),
  categoria: z.enum(['MATERIA_PRIMA', 'REVENDA', 'EMBALAGEM', 'LIMPEZA', 'USO_INTERNO']).default('MATERIA_PRIMA'),
  estoqueMin: z.number().nonnegative().nullable().optional(),
  estoqueMax: z.number().positive().nullable().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = criarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Informe nome e unidade do item.' }, { status: 400 })
  const nome = parsed.data.nome.trim()
  const { estoqueMin, estoqueMax } = parsed.data
  if (estoqueMin != null && estoqueMax != null && estoqueMin >= estoqueMax) return NextResponse.json({ erro: 'O mínimo tem que ser menor que o máximo.' }, { status: 400 })
  // se já existe um item com o mesmo nome, devolve ele (não duplica)
  const existente = await prisma.stockItem.findFirst({ where: { companyId, nome }, select: { id: true, nome: true, unidadeControle: true, custoMedio: true, categoria: true } })
  if (existente) return NextResponse.json({ item: existente, jaExistia: true })
  // nasce SEM custo (custoMedio null → "a definir") e SEM movimento — o custo vem da 1ª nota
  const item = await prisma.stockItem.create({
    data: { companyId, nome, unidadeControle: parsed.data.unidadeControle, categoria: parsed.data.categoria, estoqueMin: estoqueMin ?? null, estoqueMax: estoqueMax ?? null, criadoVia: 'MANUAL', criadoPorId: a.user!.sub },
    select: { id: true, nome: true, unidadeControle: true, custoMedio: true, categoria: true },
  })
  return NextResponse.json({ item })
}
