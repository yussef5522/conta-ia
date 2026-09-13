// ⭐⭐ OS RELATÓRIOS CHAMAM A MESMA FUNÇÃO DO HOJE (13/09/2026).
//
// A ordem do dono é *"fonte única"*, e o teste que morde é o que **roda as duas janelas** e
// exige o MESMO número — não um que confira cada lado por conta própria.

import { describe, it, expect } from 'vitest'
import { relatorioDaTarefa, geralDoPeriodo, seriePorDia, unidadesPorPessoa, type Lote } from '../relatorios'
import { placarDaEquipe, mediaDaTarefa, type Execucao } from '../desempenho'

const ex = (o: Partial<Execucao> & { tarefa: string; colaboradorId: string; minutos: number | null; unidades: number }): Execucao => ({
  ordemId: o.ordemId ?? `o-${o.colaboradorId}-${o.minutos}-${o.unidades}`,
  nome: o.nome ?? o.colaboradorId, unidade: o.unidade ?? 'UN', quando: o.quando ?? new Date('2026-09-12T10:00:00Z'), ...o,
})
const lote = (o: Partial<Lote> & { tarefa: string; entregue: number }): Lote => ({
  ordemId: o.ordemId ?? `l-${o.tarefa}-${o.entregue}-${o.dia ?? 'x'}`,
  pedido: o.pedido ?? null, custoUnitario: o.custoUnitario ?? null, unidade: o.unidade ?? 'UN',
  minutos: o.minutos ?? null, dia: o.dia ?? '2026-09-12', ...o,
})

const QUEIJO = 'porção queijo 135 grama'

/** a história que forma a média: 3 lotes medidos de 100, 110 e 120 min → média 110 */
const HISTORICO: Execucao[] = [
  ex({ tarefa: QUEIJO, colaboradorId: 'rodrigo', minutos: 100, unidades: 400 }),
  ex({ tarefa: QUEIJO, colaboradorId: 'marcyelle', minutos: 110, unidades: 380 }),
  ex({ tarefa: QUEIJO, colaboradorId: 'nadine', minutos: 120, unidades: 360 }),
]

describe('⭐⭐ fonte única: HOJE e Relatórios respondem o mesmo', () => {
  it('a tabela "quem fez essa tarefa" É o placar — mesma função, outra janela', () => {
    const janela = [ex({ tarefa: QUEIJO, colaboradorId: 'rodrigo', minutos: 90, unidades: 410 })]
    const r = relatorioDaTarefa(QUEIJO, [lote({ tarefa: QUEIJO, entregue: 410, minutos: 90 })], janela, HISTORICO)
    expect(r.pessoas).toEqual(placarDaEquipe(janela, HISTORICO))
    expect(r.pessoas[0].selo).toBe('ACIMA')   // 90min contra média 110 = mais rápido
  })

  it('⭐ a média da tarefa vem da HISTÓRIA, nunca da própria janela', () => {
    // se a janela formasse a média, um único lote lento seria "a média" e o selo sumiria
    const janela = [ex({ tarefa: QUEIJO, colaboradorId: 'eliane', minutos: 200, unidades: 300 })]
    const r = relatorioDaTarefa(QUEIJO, [lote({ tarefa: QUEIJO, entregue: 300, minutos: 200 })], janela, HISTORICO)
    expect(r.media).toEqual(mediaDaTarefa(QUEIJO, HISTORICO))
    expect(r.media.minutosPorLote).toBe(110)
    expect(r.pessoas[0].selo).toBe('ABAIXO')
  })

  it('⛔ menos de 3 lotes medidos = sem média, e a tela recebe o PORQUÊ', () => {
    const pouco = HISTORICO.slice(0, 2)
    const r = relatorioDaTarefa(QUEIJO, [lote({ tarefa: QUEIJO, entregue: 400, minutos: 95 })], [], pouco)
    expect(r.media.minutosPorLote).toBeNull()
    expect(r.media.porQue).toContain('precisa de 3')
  })
})

describe('⭐ rendimento e custo do período', () => {
  it('rendimento soma SÓ os lotes com meta — sem meta não vira pedido 0', () => {
    const r = relatorioDaTarefa(QUEIJO, [
      lote({ tarefa: QUEIJO, pedido: 400, entregue: 410 }),
      lote({ tarefa: QUEIJO, pedido: 400, entregue: 390 }),
      lote({ tarefa: QUEIJO, entregue: 500 }),           // ⚠️ sem meta: fica FORA do %
    ], [], HISTORICO)
    expect(r.rendimento.pedido).toBe(800)
    expect(r.rendimento.pct).toBe(100)                    // 800 entregues sobre 800 pedidos
    expect(r.unidades).toBe(1300)                         // ⭐ mas o VOLUME conta os três
  })

  it('⛔ nenhum lote com meta = "sem meta registrada", nunca 100%', () => {
    const r = relatorioDaTarefa(QUEIJO, [lote({ tarefa: QUEIJO, entregue: 410 })], [], HISTORICO)
    expect(r.rendimento.selo).toBe('SEM_META')
    expect(r.rendimento.pct).toBeNull()
  })

  it('custo médio ignora lote sem custo fechado — e DIZ quantos ficaram de fora', () => {
    const r = relatorioDaTarefa(QUEIJO, [
      lote({ tarefa: QUEIJO, entregue: 400, custoUnitario: 4.18 }),
      lote({ tarefa: QUEIJO, entregue: 400, custoUnitario: 4.42 }),
      lote({ tarefa: QUEIJO, entregue: 400 }),
    ], [], HISTORICO)
    expect(r.custoMedio).toBe(4.3)
    expect(r.custoMin).toBe(4.18)
    expect(r.custoMax).toBe(4.42)
    expect(r.lotesSemCusto).toBe(1)
  })

  it('⭐ o melhor lote é por unidades POR MINUTO, não por volume', () => {
    const r = relatorioDaTarefa(QUEIJO, [
      lote({ tarefa: QUEIJO, entregue: 600, minutos: 300 }),  // 2,0 un/min — volume maior
      lote({ tarefa: QUEIJO, entregue: 410, minutos: 127 }),  // 3,2 un/min — o melhor
    ], [], HISTORICO)
    expect(r.melhor?.unidades).toBe(410)
    expect(r.melhor?.frase).toContain('2h07')
  })
})

describe('⛔ período vazio é DITO, nunca zero disfarçado', () => {
  it('tarefa sem lote no filtro devolve o motivo', () => {
    const r = relatorioDaTarefa(QUEIJO, [], [], HISTORICO)
    expect(r.vazio).toBe('sem produção dessa tarefa no filtro')
    expect(r.lotes).toBe(0)
  })
  it('o geral sem lote nenhum também', () => {
    expect(geralDoPeriodo([]).vazio).toBe('sem produção no filtro')
  })
})

describe('⭐ a série por dia', () => {
  it('dia sem lote MEDIDO vem null, não zero', () => {
    const s = seriePorDia([
      lote({ tarefa: QUEIJO, entregue: 400, minutos: 100, dia: '2026-09-11' }),
      lote({ tarefa: QUEIJO, entregue: 300, dia: '2026-09-12' }),          // sem tempo
    ])
    expect(s.map((p) => p.minutosPorLote)).toEqual([100, null])
    expect(s[1].unidades).toBe(300)   // ⚠️ o volume do dia continua contado
  })
  it('sai em ordem de calendário', () => {
    const s = seriePorDia([
      lote({ tarefa: QUEIJO, entregue: 1, dia: '2026-09-12' }),
      lote({ tarefa: QUEIJO, entregue: 1, dia: '2026-09-06' }),
    ])
    expect(s.map((p) => p.dia)).toEqual(['2026-09-06', '2026-09-12'])
  })
})

describe('⭐ o geral e as barras por pessoa', () => {
  it('horas de cozinha contam só o MEDIDO, e o resto é dito', () => {
    const g = geralDoPeriodo([
      lote({ tarefa: QUEIJO, entregue: 400, minutos: 120 }),
      lote({ tarefa: 'massa', entregue: 100, minutos: 60 }),
      lote({ tarefa: 'massa', entregue: 50 }),
    ])
    expect(g.horas).toBe(3)
    expect(g.lotesSemTempo).toBe(1)
    expect(g.lotes).toBe(3)
    // ⭐⭐ A ORDEM É POR LOTES, não por unidades — e o motivo é o mesmo do resto (13/09):
    // ordenar "top tarefa" por quantidade é, ele próprio, comparar UN com KG. Lote é a única
    // magnitude comparável entre tarefas de unidades diferentes. Aqui "massa" tem 2 lotes
    // contra 1 do queijo, então ela lidera mesmo produzindo menos unidades.
    expect(g.topTarefas.map((t) => t.tarefa)).toEqual(['massa', QUEIJO])
    expect(g.topTarefas[0]).toEqual({ tarefa: 'massa', lotes: 2, unidades: 150, unidade: 'UN' })
  })

  it('a barra é proporcional a quem mais produziu', () => {
    const b = unidadesPorPessoa([
      ex({ tarefa: QUEIJO, colaboradorId: 'rodrigo', minutos: 100, unidades: 1410 }),
      ex({ tarefa: QUEIJO, colaboradorId: 'eliane', minutos: 60, unidades: 150 }),
    ])
    expect(b[0].nome).toBe('rodrigo')
    expect(b[0].quantidade.total).toBe(1410)
    expect(b[0].proporcao).toBe(1)
    expect(b[1].proporcao).toBeCloseTo(0.11, 2)
  })
})
