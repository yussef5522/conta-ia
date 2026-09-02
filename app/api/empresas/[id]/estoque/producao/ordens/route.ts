// ESTOQUE FASE 2 item 2.1 — ordens de produção (GET lista, POST cria).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { listOrdens, criarOrdem, OrdemError } from '@/lib/stock/producao/ordens'
import { sugestoesDeProducao } from '@/lib/stock/producao/sugestao-cardapio'
import { cardsDoPainel, lotesDoPeriodo, ESTADOS_ABERTOS, ehDeOntem } from '@/lib/stock/producao/painel-producao'
import { conclusoesNoPeriodo } from '@/lib/stock/producao/conclusao'

interface Params { params: Promise<{ id: string }> }


export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  // ⭐ PERÍODO só governa as CONCLUÍDAS. Ordem aberta aparece SEMPRE — trabalho aberto
  // não é histórico (a regra central do redesenho).
  const sp = request.nextUrl.searchParams
  const agora = new Date()
  // ⚠️⚠️ O DIA É O DE QUEM OPERA (BRT), NUNCA UTC — pego em prod antes do dono abrir a tela.
  // Às 22:34 de 01/09 no servidor (UTC−3) as 7 conclusões da noite já tinham `criadoEm` em
  // 02/09 UTC. Com o recorte em `Date.UTC` a tela abria em "hoje" com TUDO ZERADO, minutos
  // depois de ele produzir 7 lotes — o tipo de zero que faz alguém achar que quebrou.
  // É a mesma família do `fmt` da conferência (20/08) e da âncora de 31/07 12:00 UTC.
  const BRT = -3
  const local = new Date(agora.getTime() + BRT * 3_600_000)
  const hoje0 = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - BRT * 3_600_000)
  const de = sp.get('de') ? new Date(`${sp.get('de')}T00:00:00.000Z`) : hoje0
  const ate = sp.get('ate') ? new Date(`${sp.get('ate')}T23:59:59.999Z`) : new Date(hoje0.getTime() + 86_399_999)

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
      return { ...c, pct: s?.pct ?? null, faixa: s?.faixa ?? 'SEM_REGUA', motivo: s?.motivo ?? null }
    }),
    periodo: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) },
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
