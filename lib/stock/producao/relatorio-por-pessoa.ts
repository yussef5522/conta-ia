// ⭐⭐ QUEM FEZ, EM QUANTO TEMPO, COM QUE RENDIMENTO (06/09/2026) — o relatório do fim do mês.
//
// **A pergunta do dono:** *"quem é mais rápido, quem produz mais, quem entrega dentro do
// esperado (20 kg de queijo → ~150 porções: quem faz pra mais, quem faz pra menos)"*.
//
// ⭐⭐ E AQUI ESTÁ O BURACO DO MERCADO QUE ESTE ARQUIVO OCUPA: a métrica padrão do setor é
// venda por hora trabalhada ou pratos por hora — números de SALÃO. **Nenhum líder normaliza
// por quilo ou por porção** (conferido em Jolt, MarketMan e meez). Nós podemos, e quase de
// graça: o rendimento já é medido em cada conclusão desde agosto; faltava saber de quem foi
// a mão.
//
// ⛔⛔ **NORMALIZAR NÃO É ENFEITE, É O QUE IMPEDE A INJUSTIÇA.** Tempo bruto diz que quem
// pegou o lote de 40 kg é mais lento que quem pegou o de 5 kg. `min/kg` responde a pergunta
// que o dono realmente fez. E quando não dá pra normalizar (lote sem quantidade medida), o
// número sai **null**, nunca um bruto disfarçado de taxa.
//
// ⛔ **ISTO NÃO É PONTO.** A jornada oficial é o REP homologado (TecnoPonto, decisão de
// 31/08). Aqui se mede TAREFA, não presença: quem não bateu o botão não tem tarefa, e isso
// não diz nada sobre ter trabalhado. A frase vai NA TELA, não num manual.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { janelaDoDiaSP } from '@/lib/datas/dia-sao-paulo'

type Db = PrismaClient | Prisma.TransactionClient

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100

/** ⚠️ menos de 3 lotes não é média, é anedota — vira "a apurar", nunca um número redondo */
export const LOTES_PARA_MEDIA = 3

export interface LinhaPorPessoa {
  colaboradorId: string
  nome: string
  tarefas: number
  minutos: number
  /** unidades produzidas nas ordens em que esta pessoa executou alguma etapa */
  produziu: number
  unidade: string | null
  /** minutos por unidade produzida — `null` quando não há quantidade pra normalizar */
  minPorUnidade: number | null
  /** desvio do rendimento contra a média medida da ficha (%). `null` = sem régua ainda */
  rendimentoVsEsperado: number | null
  lotesComRegua: number
}

export interface LinhaPorTarefa {
  nome: string
  vezes: number
  minutosMedia: number
  minPorUnidade: number | null
  unidade: string | null
}

export interface RelatorioPorPessoa {
  de: string
  ate: string
  pessoas: LinhaPorPessoa[]
  /** detalhe por TIPO de tarefa, de uma pessoa (quando pedido) */
  porTarefa: LinhaPorTarefa[]
  /** tarefas ainda abertas no período — o tempo delas NÃO entra em conta nenhuma */
  abertasIgnoradas: number
  /** ⚠️ o aviso que a tela imprime: isto mede tarefa, não presença */
  avisoDeEscopo: string
}

export const AVISO_NAO_E_PONTO =
  'Isto mede TAREFA, não presença. A jornada oficial continua no REP homologado (TecnoPonto) — '
  + 'quem não apertou o botão pode ter trabalhado do mesmo jeito.'

/**
 * ⭐ O RELATÓRIO. `de`/`ate` são dias de calendário de São Paulo ('YYYY-MM-DD').
 *
 * ⚠️ **Só tarefa FINALIZADA entra.** Tarefa aberta tem cronômetro correndo: incluí-la faria
 * a média piorar sozinha com o passar das horas, e a pessoa apareceria mais lenta a cada
 * vez que o gestor abrisse a tela. Elas são contadas à parte (`abertasIgnoradas`) e cobradas
 * pelo alarme de 4h.
 */
export async function relatorioPorPessoa(
  input: { companyId: string; de: string; ate: string; detalharColaboradorId?: string | null },
  db: Db = defaultPrisma,
): Promise<RelatorioPorPessoa> {
  const janela = janelaDoDiaSP(input.de, input.ate)

  const etapas = await db.stockOrdemEtapa.findMany({
    where: { companyId: input.companyId, finalizadoEm: { gte: janela.de, lte: janela.ate } },
    orderBy: { finalizadoEm: 'asc' },
  })
  const abertasIgnoradas = await db.stockOrdemEtapa.count({
    where: { companyId: input.companyId, iniciadoEm: { gte: janela.de, lte: janela.ate }, finalizadoEm: null },
  })

  const vazio: RelatorioPorPessoa = {
    de: input.de, ate: input.ate, pessoas: [], porTarefa: [],
    abertasIgnoradas, avisoDeEscopo: AVISO_NAO_E_PONTO,
  }
  if (!etapas.length) return vazio

  // ── o que cada ORDEM produziu (a conclusão já mede isso; aqui só se lê) ──────────────
  const ordemIds = [...new Set(etapas.map((e) => e.ordemId))]
  const [ordens, conclusoes] = await Promise.all([
    db.stockProductionOrder.findMany({ where: { companyId: input.companyId, id: { in: ordemIds } }, select: { id: true, itemProduzidoId: true, fichaId: true } }),
    db.stockProducaoConclusao.findMany({ where: { companyId: input.companyId, ordemId: { in: ordemIds } }, select: { ordemId: true, qtdGerada: true, rendimento: true } }),
  ])
  const itens = await db.stockItem.findMany({
    where: { companyId: input.companyId, id: { in: [...new Set(ordens.map((o) => o.itemProduzidoId))] } },
    select: { id: true, unidadeControle: true },
  })
  const unidadeDoItem = new Map(itens.map((i) => [i.id, i.unidadeControle]))
  const ordemInfo = new Map(ordens.map((o) => [o.id, o]))

  const produzidoDaOrdem = new Map<string, number>()
  const rendimentoDaOrdem = new Map<string, number[]>()
  for (const c of conclusoes) {
    produzidoDaOrdem.set(c.ordemId, round2((produzidoDaOrdem.get(c.ordemId) ?? 0) + c.qtdGerada))
    rendimentoDaOrdem.set(c.ordemId, [...(rendimentoDaOrdem.get(c.ordemId) ?? []), c.rendimento])
  }

  // ── a RÉGUA de rendimento por ficha: a média medida do PERÍODO INTEIRO da própria ficha,
  //    que é a mesma régua que a conclusão já usa. ⚠️ Comparar a pessoa contra um teórico
  //    inventado seria cobrar dela um número que ninguém nunca atingiu.
  const fichaIds = [...new Set(ordens.map((o) => o.fichaId))]
  const todasConclusoes = fichaIds.length
    ? await db.stockProducaoConclusao.findMany({
        where: { companyId: input.companyId, ordemId: { in: (await db.stockProductionOrder.findMany({ where: { companyId: input.companyId, fichaId: { in: fichaIds } }, select: { id: true } })).map((o) => o.id) } },
        select: { ordemId: true, rendimento: true },
      })
    : []
  const ordemDaFicha = new Map<string, string>()
  for (const o of await db.stockProductionOrder.findMany({ where: { companyId: input.companyId, fichaId: { in: fichaIds } }, select: { id: true, fichaId: true } })) {
    ordemDaFicha.set(o.id, o.fichaId)
  }
  const rendimentosPorFicha = new Map<string, number[]>()
  for (const c of todasConclusoes) {
    const f = ordemDaFicha.get(c.ordemId)
    if (!f) continue
    rendimentosPorFicha.set(f, [...(rendimentosPorFicha.get(f) ?? []), c.rendimento])
  }
  const mediaDaFicha = new Map<string, number>()
  for (const [f, rs] of rendimentosPorFicha) {
    if (rs.length >= LOTES_PARA_MEDIA) mediaDaFicha.set(f, rs.reduce((a, b) => a + b, 0) / rs.length)
  }

  // ── agrega por PESSOA ────────────────────────────────────────────────────────────────
  interface Acc { minutos: number; tarefas: number; produziu: number; unidades: Set<string>; desvios: number[] }
  const porPessoa = new Map<string, Acc>()
  const acc = (id: string) => {
    if (!porPessoa.has(id)) porPessoa.set(id, { minutos: 0, tarefas: 0, produziu: 0, unidades: new Set(), desvios: [] })
    return porPessoa.get(id)!
  }
  // ⚠️ a quantidade da ordem é dividida entre as ETAPAS dela: se duas mãos passaram pelo
  // mesmo lote de 100 kg, contar 100 kg pra cada uma dobraria a produção da cozinha no
  // relatório. Cada um responde pela sua etapa.
  const etapasPorOrdem = new Map<string, number>()
  for (const e of etapas) etapasPorOrdem.set(e.ordemId, (etapasPorOrdem.get(e.ordemId) ?? 0) + 1)

  for (const e of etapas) {
    const quem = e.executorId
    // ⛔⛔ É AQUI QUE A TAREFA ABERTA FICA DE FORA — e é a camada que importa (medido na
    // REGRA 11: mexer só no `where` acima deixa os 27 testes verdes, porque este `continue`
    // segura). O `where` é a 2ª camada; **esta é a 1ª**.
    // ⚠️ Sem ela, o tempo de uma tarefa esquecida em aberto cresceria com o relógio e a
    // pessoa apareceria MAIS LENTA a cada vez que o gestor abrisse a tela.
    if (!quem || !e.iniciadoEm || !e.finalizadoEm) continue
    const a = acc(quem)
    a.tarefas++
    a.minutos += Math.max(0, Math.round((e.finalizadoEm.getTime() - e.iniciadoEm.getTime()) / 60000))
    const info = ordemInfo.get(e.ordemId)
    const qtd = produzidoDaOrdem.get(e.ordemId) ?? 0
    const fatias = etapasPorOrdem.get(e.ordemId) || 1
    if (qtd > 0) {
      a.produziu = round2(a.produziu + qtd / fatias)
      if (info) a.unidades.add(unidadeDoItem.get(info.itemProduzidoId) ?? '—')
    }
    const ficha = info?.fichaId
    const regua = ficha ? mediaDaFicha.get(ficha) : undefined
    const rs = rendimentoDaOrdem.get(e.ordemId) ?? []
    if (regua && regua > 0 && rs.length) {
      const meu = rs.reduce((x, y) => x + y, 0) / rs.length
      a.desvios.push((meu - regua) / regua)
    }
  }

  const ids = [...porPessoa.keys()]
  const colabs = ids.length ? await db.stockColaborador.findMany({ where: { companyId: input.companyId, id: { in: ids } }, select: { id: true, nome: true } }) : []
  const nome = new Map(colabs.map((c) => [c.id, c.nome]))

  const pessoas: LinhaPorPessoa[] = ids.map((id) => {
    const a = porPessoa.get(id)!
    // ⚠️ unidade misturada (kg com un) → não normaliza. Somar quilo com unidade e chamar de
    // "por unidade" seria a conta que parece certa e não significa nada.
    const unidade = a.unidades.size === 1 ? [...a.unidades][0] : null
    return {
      colaboradorId: id,
      nome: nome.get(id) ?? '(colaborador removido)',
      tarefas: a.tarefas,
      minutos: a.minutos,
      produziu: a.produziu,
      unidade,
      minPorUnidade: unidade && a.produziu > 0 ? round1(a.minutos / a.produziu) : null,
      rendimentoVsEsperado: a.desvios.length >= LOTES_PARA_MEDIA
        ? round1((a.desvios.reduce((x, y) => x + y, 0) / a.desvios.length) * 100)
        : null,
      lotesComRegua: a.desvios.length,
    }
  }).sort((x, y) => y.produziu - x.produziu || y.tarefas - x.tarefas)

  // ── detalhe por TIPO de tarefa (de uma pessoa) ───────────────────────────────────────
  const porTarefa: LinhaPorTarefa[] = []
  if (input.detalharColaboradorId) {
    const meus = etapas.filter((e) => e.executorId === input.detalharColaboradorId && e.iniciadoEm && e.finalizadoEm)
    const grupos = new Map<string, { min: number[]; qtd: number; unidades: Set<string> }>()
    for (const e of meus) {
      const chave = e.nome
      if (!grupos.has(chave)) grupos.set(chave, { min: [], qtd: 0, unidades: new Set() })
      const g = grupos.get(chave)!
      g.min.push(Math.max(0, Math.round((e.finalizadoEm!.getTime() - e.iniciadoEm!.getTime()) / 60000)))
      const info = ordemInfo.get(e.ordemId)
      const q = produzidoDaOrdem.get(e.ordemId) ?? 0
      const fatias = etapasPorOrdem.get(e.ordemId) || 1
      if (q > 0) { g.qtd = round2(g.qtd + q / fatias); if (info) g.unidades.add(unidadeDoItem.get(info.itemProduzidoId) ?? '—') }
    }
    for (const [chave, g] of grupos) {
      const unidade = g.unidades.size === 1 ? [...g.unidades][0] : null
      const total = g.min.reduce((a, b) => a + b, 0)
      porTarefa.push({
        nome: chave, vezes: g.min.length,
        minutosMedia: Math.round(total / g.min.length),
        minPorUnidade: unidade && g.qtd > 0 ? round1(total / g.qtd) : null,
        unidade,
      })
    }
    porTarefa.sort((a, b) => b.vezes - a.vezes)
  }

  return { de: input.de, ate: input.ate, pessoas, porTarefa, abertasIgnoradas, avisoDeEscopo: AVISO_NAO_E_PONTO }
}
