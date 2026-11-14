// ⭐⭐ ROTINAS (lei docs/rotinas-referencia.html, R25–R31, 13/11/2026) — a FÁBRICA de tarefas.
// ⛔ R31: esta rota NÃO cria tarefa avulsa (essa é a mão do Painel, POST /tarefas). Ela cria a REGRA;
// as tarefas nascem pela semeadura (`semearRotinasDoDia`).
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { criarRotina, garantirSemeaduraDeHoje, listarRotinas, RotinaError } from '@/lib/stock/producao/rotinas-do-banco'
import { schemaDaRotina } from '@/lib/stock/producao/rotinas-schema'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const agora = new Date()
  // ⭐ R25 — disparo da LEITURA: se o agendador da meia-noite falhou, esta leitura semeia
  await garantirSemeaduraDeHoje(companyId, agora, prisma)
  return NextResponse.json({ rotinas: await listarRotinas(companyId, agora, prisma), agora: agora.toISOString() })
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schemaDaRotina.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Diga o nome, quando repete, quem faz e pelo menos 1 item.' }, { status: 400 })
  try {
    const r = await criarRotina({ companyId, ...parsed.data, userId: a.user.sub }, prisma)
    return NextResponse.json(r, { status: 201 })
  } catch (e) {
    if (e instanceof RotinaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    console.error('[producao/rotinas] falhou:', (e as Error)?.name)
    return NextResponse.json({ erro: 'Não consegui criar a rotina. Nada foi gravado — dá pra tentar de novo.' }, { status: 500 })
  }
}
