// ⭐ RELATÓRIOS DE PRODUÇÃO — **só `stock.manage`**, a MESMA trava do HOJE.
//
// ⛔⛔ E pelo MESMO motivo: esta rota mostra o ritmo de cada pessoa lado a lado. **O tablet
// da cozinha (`minhas-tarefas`) não recebe nada disto** — há guard provando que a rota do
// tablet não devolve placar nem comparação.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { lotesDaJanela, tarefasDaJanela } from '@/lib/stock/producao/lotes'
import { execucoesDaJanela, execucoesParaMedia } from '@/lib/stock/producao/execucoes'
import { relatorioDaTarefa, geralDoPeriodo, unidadesPorPessoa } from '@/lib/stock/producao/relatorios'
// ⭐ REGRA 4: a janela do dia em SP e o "menos N dias" já têm dono nesta casa — escrever
// aritmética de data aqui seria a segunda régua de fuso do módulo.
import { diaEmSaoPaulo, janelaDoDiaSP, somarDias } from '@/lib/datas/dia-sao-paulo'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro

  const q = request.nextUrl.searchParams
  const hoje = diaEmSaoPaulo()
  // ⭐ a janela é EXPLÍCITA (de/ate); o atalho `periodo` só calcula as datas, e a tela
  // sempre mostra as duas pontas — período que o dono não vê escrito é período que engana.
  const periodo = q.get('periodo') ?? '7d'
  const dias = periodo === 'hoje' ? 0 : periodo === 'mes' ? 29 : 6
  const ate = q.get('ate') || hoje
  const de = q.get('de') || somarDias(ate, -dias)
  const tarefa = q.get('tarefa') || undefined
  const colaboradorId = q.get('pessoa') || undefined

  const janela = janelaDoDiaSP(de, ate)
  const [lotes, execucoes, historico] = await Promise.all([
    lotesDaJanela(companyId, janela, prisma),
    execucoesDaJanela(companyId, { ...janela, colaboradorId }, prisma),
    // ⭐ a média vem da história INTEIRA, nunca da janela do filtro
    execucoesParaMedia(companyId, prisma),
  ])

  const tarefas = tarefasDaJanela(lotes)
  // ⚠️ sem tarefa escolhida, abre na que mais produziu — e a tela DIZ qual é
  const alvo = tarefa ?? tarefas[0]?.tarefa ?? null

  return NextResponse.json({
    de, ate, periodo, tarefa: alvo, pessoa: colaboradorId ?? null,
    tarefas,
    porTarefa: alvo ? relatorioDaTarefa(alvo, lotes, execucoes, historico) : null,
    porPessoa: unidadesPorPessoa(execucoes),
    geral: geralDoPeriodo(lotes),
  })
}
