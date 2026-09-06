// ESTOQUE FASE 2 item 2.1 — ordens de produção (GET lista, POST cria).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listOrdens, criarOrdem, OrdemError } from '@/lib/stock/producao/ordens'
import { sugestoesDeProducao } from '@/lib/stock/producao/sugestao-cardapio'
import { cardsDoPainel, lotesDoPeriodo, ESTADOS_ABERTOS, ehDeOntem } from '@/lib/stock/producao/painel-producao'
import { conclusoesNoPeriodo } from '@/lib/stock/producao/conclusao'
import { diaEmSaoPaulo, janelaDoDiaSP } from '@/lib/datas/dia-sao-paulo'

interface Params { params: Promise<{ id: string }> }


export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  // ⭐ PERÍODO só governa as CONCLUÍDAS. Ordem aberta aparece SEMPRE — trabalho aberto
  // não é histórico (a regra central do redesenho).
  const sp = request.nextUrl.searchParams
  const agora = new Date()
  // ⚠️⚠️ O DIA É O DE QUEM OPERA (São Paulo), NUNCA UTC.
  //
  // ⛔ ISTO JÁ FOI CORRIGIDO UMA VEZ, EM 02/09 — **no ramo sem parâmetros**. E a tela SEMPRE
  // manda `?de=&ate=`, então o ramo consertado é o único que ela nunca usa: o recorte
  // `${dia}T00:00:00.000Z` continuou cobrindo o dia UTC, que em São Paulo começa às 21h do
  // dia ANTERIOR. Medido em prod às 22:16 de 05/09: 9 conclusões do dia, "hoje" mostrando
  // ZERO. É a família "N caminhos, 1 esquecido" — consertar o vizinho e não o vizinho do lado.
  //
  // ⭐ Agora os dois ramos passam pela MESMA função (`janelaDoDiaSP`), então não há como um
  // responder um dia e o outro responder outro.
  const hoje = diaEmSaoPaulo(agora)
  const { de, ate } = janelaDoDiaSP(sp.get('de') || hoje, sp.get('ate') || hoje)

  const [ordens, sugestoes, painel, concluidas] = await Promise.all([
    listOrdens(companyId),
    sugestoesDeProducao(companyId, prisma),
    cardsDoPainel(companyId, { de, ate }, agora, prisma),
    conclusoesNoPeriodo(companyId, de, ate, prisma),
  ])
  // ⭐ o selo de % por linha — MESMA fonte do card "Rendimento"
  const lotes = await lotesDoPeriodo(companyId, { de, ate }, prisma)
  const seloPorConclusao = new Map(lotes.map((l) => [l.conclusaoId, l]))
  const abertas = ordens
    .filter((o) => (ESTADOS_ABERTOS as readonly string[]).includes(o.estado))
    .map((o) => ({ ...o, deOntem: ehDeOntem(new Date(o.dataProducao), agora) }))

  return NextResponse.json({
    ordens, sugestoes, painel, abertas,
    concluidas: concluidas.map((c) => {
      const s = seloPorConclusao.get(c.id)
      return { ...c, pct: s?.pct ?? null, faixa: s?.faixa ?? 'SEM_REGUA', motivo: s?.motivo ?? null, selo: s?.selo ?? 'SEM_DADO' }
    }),
    // ⚠️ o período ECOA os DIAS pedidos (calendário de SP), nunca o recorte UTC — senão a
    // tela imprimiria 'de 04/09' pra uma janela que começa no dia 05.
    periodo: { de: sp.get('de') || hoje, ate: sp.get('ate') || hoje },
  })
}

const criarSchema = z.object({
  fichaId: z.string().min(1),
  escalaReceitas: z.number().positive(),
  dataProducao: z.string().min(1),
  setorId: z.string().nullable().optional(),
  observacao: z.string().max(500).nullable().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = criarSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados da ordem inválidos.' }, { status: 400 })
  try {
    const r = await criarOrdem({ companyId, userId: a.user!.sub, ...parsed.data, dataProducao: new Date(`${parsed.data.dataProducao}T12:00:00`) })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof OrdemError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
