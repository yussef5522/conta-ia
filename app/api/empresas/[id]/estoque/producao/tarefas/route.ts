// ⭐⭐ TAREFA — TIPO PRÓPRIO (lei v7 M2, 12/11/2026). O escritório cria; cai na hora na Janela
// da Cozinha. ⛔ Sem estoque: esta rota não toca ficha, separação, lote nem movimento.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { criarTarefa, tarefasDoEscritorio, nomesDeTarefasUsados, TarefaTipoError, MAX_NOME_TAREFA, MAX_INSTRUCAO } from '@/lib/stock/producao/tarefa'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const [tarefas, nomes] = await Promise.all([tarefasDoEscritorio(companyId, new Date(), prisma), nomesDeTarefasUsados(companyId, prisma)])
  return NextResponse.json({ tarefas, nomes })
}

const schema = z.object({
  nome: z.string().min(1).max(MAX_NOME_TAREFA),
  instrucao: z.string().max(MAX_INSTRUCAO).optional().nullable(),
  /** id da pessoa da cozinha, ou 'EQUIPE' = liberada pra equipe */
  quem: z.string().min(1),
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  // ⭐ criar tarefa é OPERAR (o encarregado montando o dia), como criar ordem e designar etapa
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Diga o que fazer, quem faz e o dia.' }, { status: 400 })
  // ⛔ "liberada pra equipe" é a escolha do GERENTE (G6) — o mesmo gate do plano da etapa das ordens
  if (parsed.data.quem === 'EQUIPE') {
    const g = await guardStock(request, companyId, 'stock.manage')
    if (g.erro) return g.erro
  }
  try {
    const r = await criarTarefa({ companyId, ...parsed.data, userId: a.user.sub }, prisma)
    return NextResponse.json(r, { status: 201 })
  } catch (e) {
    if (e instanceof TarefaTipoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    console.error('[producao/tarefas] falhou:', (e as Error)?.name)
    return NextResponse.json({ erro: 'Não consegui criar a tarefa. Nada foi gravado — dá pra tentar de novo.' }, { status: 500 })
  }
}
