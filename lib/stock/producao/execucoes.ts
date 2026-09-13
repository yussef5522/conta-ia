// ⭐⭐⭐ DE ONDE SAEM AS EXECUÇÕES (13/09/2026) — o leitor único.
//
// `desempenho.ts` é PURO: ele recebe execuções e devolve médias, placar e rendimento. Este
// arquivo é quem vai ao banco buscá-las — e é o **único** que faz isso, pra o HOJE e os
// Relatórios lerem a MESMA coisa com janelas diferentes.
//
// ⛔⛔ AS RÉGUAS QUE MORAM AQUI (e não na tela):
//   · **ordem CANCELADA fora pelo ESTADO** — trabalho em ordem que não produziu não conta;
//   · a TAREFA é o **item produzido** (é por ele que se compara queijo com queijo);
//   · o tempo vem do relógio da própria etapa; `finalizadoEm` nulo = **a apurar**, e o
//     `minutos: null` é o que mantém o gerente fora das médias **sem lista de exceção**;
//   · as unidades do lote dividem **só entre quem MEDIU** (a lição de 08/09).

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import type { Execucao } from './desempenho'

type Db = PrismaClient | Prisma.TransactionClient

export interface JanelaDeExecucoes {
  /** ⚠️ ambos inclusivos; sem eles, a história inteira (é o que forma a MÉDIA) */
  de?: Date
  ate?: Date
  /** filtrar por tarefa (o item produzido) */
  tarefa?: string
  colaboradorId?: string
}

/**
 * ⭐ As execuções de uma janela. Sem `de`/`ate`, devolve a história inteira — que é
 * exatamente o que `placarDaEquipe` espera como `historico`.
 */
export async function execucoesDaJanela(
  companyId: string, janela: JanelaDeExecucoes = {}, db: Db = defaultPrisma,
): Promise<Execucao[]> {
  const etapas = await db.stockOrdemEtapa.findMany({
    where: {
      companyId,
      // ⚠️ só quem COMEÇOU tem execução; a fila não é trabalho feito
      iniciadoEm: { not: null },
      ...(janela.de || janela.ate ? { iniciadoEm: { not: null, ...(janela.de ? { gte: janela.de } : {}), ...(janela.ate ? { lte: janela.ate } : {}) } } : {}),
      ...(janela.colaboradorId ? { executorId: janela.colaboradorId } : {}),
    },
    select: { id: true, ordemId: true, nome: true, executorId: true, colaboradorId: true, iniciadoEm: true, finalizadoEm: true },
  })
  if (!etapas.length) return []

  const ordens = await db.stockProductionOrder.findMany({
    where: { companyId, id: { in: [...new Set(etapas.map((e) => e.ordemId))] } },
    select: { id: true, estado: true, itemProduzidoId: true },
  })
  // ⛔ CANCELADA fora — pelo ESTADO, nunca por heurística
  const vivas = new Map(ordens.filter((o) => o.estado !== 'CANCELADA').map((o) => [o.id, o]))

  const [itens, conclusoes, colaboradores] = await Promise.all([
    db.stockItem.findMany({ where: { id: { in: [...new Set(ordens.map((o) => o.itemProduzidoId))] } }, select: { id: true, nome: true } }),
    db.stockProducaoConclusao.findMany({ where: { companyId, ordemId: { in: [...vivas.keys()] } }, select: { ordemId: true, qtdGerada: true } }),
    db.stockColaborador.findMany({ where: { companyId }, select: { id: true, nome: true } }),
  ])
  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const nomePessoa = new Map(colaboradores.map((c) => [c.id, c.nome]))
  const geradoPorOrdem = new Map<string, number>()
  for (const c of conclusoes) geradoPorOrdem.set(c.ordemId, (geradoPorOrdem.get(c.ordemId) ?? 0) + c.qtdGerada)

  /**
   * ⛔⛔ AS UNIDADES DIVIDEM SÓ ENTRE QUEM MEDIU (a lição de 08/09, ao pé da letra):
   * `un/min = unidades ÷ minutos`, então dar unidades a quem não tem minutos **aumenta o
   * denominador de alguém sem aumentar o numerador de ninguém** — e o sem-tempo apareceria
   * como "o mais rápido de todos". ⚠️ Se NINGUÉM mediu, dividem igual: o volume conta, o
   * ritmo é a apurar.
   */
  const porOrdem = new Map<string, typeof etapas>()
  for (const e of etapas) {
    if (!vivas.has(e.ordemId)) continue
    porOrdem.set(e.ordemId, [...(porOrdem.get(e.ordemId) ?? []), e])
  }

  const out: Execucao[] = []
  for (const [ordemId, es] of porOrdem) {
    const o = vivas.get(ordemId)!
    const tarefa = nomeItem.get(o.itemProduzidoId) ?? '(item removido)'
    if (janela.tarefa && tarefa !== janela.tarefa) continue
    const total = geradoPorOrdem.get(ordemId) ?? 0
    const medidas = es.filter((e) => e.finalizadoEm)
    const divididoEntre = medidas.length || es.length
    for (const e of es) {
      const mediu = !!e.finalizadoEm
      const minutos = mediu ? Math.round((e.finalizadoEm!.getTime() - e.iniciadoEm!.getTime()) / 60000) : null
      const quem = e.executorId ?? e.colaboradorId
      if (!quem) continue
      out.push({
        ordemId, tarefa, colaboradorId: quem, nome: nomePessoa.get(quem) ?? '—',
        minutos,
        unidades: (medidas.length === 0 || mediu) ? Math.round((total / divididoEntre) * 100) / 100 : 0,
        quando: e.finalizadoEm ?? e.iniciadoEm!,
      })
    }
  }
  return out
}

/** ⭐ casca fina: a história inteira, que é o que forma as médias */
export function execucoesParaMedia(companyId: string, db: Db = defaultPrisma): Promise<Execucao[]> {
  return execucoesDaJanela(companyId, {}, db)
}
