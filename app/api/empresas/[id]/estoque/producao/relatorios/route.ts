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
  /**
   * ⛔⛔⛔ **A REGRA DO ESCOPO (13/09, do dono): escolhi tarefa → TUDO na tela é daquela
   * tarefa.** O defeito que ela conserta estava no print dele: com "metade de bolinha massa
   * de pizza" filtrada, os painéis *"Unidades por pessoa · todas as tarefas"* e *"Geral do
   * período"* mostravam a empresa INTEIRA **dentro do recorte** — rodrigo com 1.415 un e o
   * queijo como top tarefa, numa tela que dizia estar falando de massa de pizza.
   *
   * ⭐ O estado "todas as tarefas" passou a ser **explícito** (`tarefa=` vazio), e é o
   * default ao abrir. Antes a tela escolhia sozinha a tarefa que mais produziu e **misturava
   * os dois mundos**: recorte em cima, geral embaixo, sem ninguém dizer.
   */
  const tarefa = q.get('tarefa') || null
  const colaboradorId = q.get('pessoa') || undefined
  const visaoGeral = !tarefa

  const janela = janelaDoDiaSP(de, ate)
  const [lotesTudo, execucoesTudo, historico] = await Promise.all([
    lotesDaJanela(companyId, janela, prisma),
    execucoesDaJanela(companyId, { ...janela, colaboradorId }, prisma),
    // ⭐ a média vem da história INTEIRA, nunca da janela do filtro
    execucoesParaMedia(companyId, prisma),
  ])

  /**
   * ⭐ **O MESMO PRINCÍPIO PRA PESSOA** (ordem do dono): *"escolhi pessoa → tudo é dela, e
   * 'top tarefa' vira 'top tarefas DELA'"*. As execuções já vêm filtradas pelo leitor; o que
   * faltava era o LOTE — sem isto, escolher a eliane deixava os painéis de lote com a
   * cozinha inteira, que é o mesmo vazamento do filtro de tarefa com outra roupa.
   */
  const ordensDaPessoa = colaboradorId ? new Set(execucoesTudo.map((e) => e.ordemId)) : null
  const doEscopoDaPessoa = ordensDaPessoa
    ? lotesTudo.filter((l) => ordensDaPessoa.has(l.ordemId))
    : lotesTudo

  // ⚠️ o seletor lista as tarefas do ESCOPO (as dela, quando há pessoa) — e não da tarefa
  // escolhida, senão escolher uma sumiria com o caminho de voltar pras outras.
  const tarefas = tarefasDaJanela(doEscopoDaPessoa)

  // ⭐⭐ O RECORTE, num lugar só: tudo o que a tela desenha nasce daqui.
  const lotes = tarefa ? doEscopoDaPessoa.filter((l) => l.tarefa === tarefa) : doEscopoDaPessoa
  const execucoes = tarefa ? execucoesTudo.filter((e) => e.tarefa === tarefa) : execucoesTudo

  return NextResponse.json({
    de, ate, periodo, tarefa, pessoa: colaboradorId ?? null, visaoGeral,
    tarefas,
    // ⭐ na visão geral não há "a tarefa" — e inventar uma seria voltar ao defeito
    porTarefa: tarefa ? relatorioDaTarefa(tarefa, lotes, execucoes, historico) : null,
    porPessoa: unidadesPorPessoa(execucoes),
    geral: geralDoPeriodo(lotes),
  })
}
