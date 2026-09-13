// ⛔⛔⛔ O FILTRO DE TAREFA VAZAVA — PAINÉIS GERAIS DENTRO DO RECORTE (13/09/2026)
//
// **O dono, com o print na mão:** filtrou *"metade de bolinha massa de pizza"* e a tela
// mostrava, DENTRO do recorte, *"Unidades por pessoa · todas as tarefas"* (rodrigo 1.415) e
// *"Geral do período"* (51 lotes, top queijo). **A tela dizia falar de massa de pizza e
// mostrava a cozinha inteira.**
//
// **A REGRA:** *"escolhi tarefa → TUDO na tela é daquela tarefa. O GERAL só aparece quando
// NENHUMA tarefa está escolhida."* E o mesmo pra PESSOA.
//
// ⚠️ A causa raiz era a tela **escolher a tarefa sozinha** (a que mais produziu) e seguir
// desenhando os painéis gerais embaixo: recorte em cima, empresa inteira embaixo, sem
// ninguém dizer qual era qual. O estado "todas as tarefas" passou a ser EXPLÍCITO.

import { describe, it, expect } from 'vitest'
import { relatorioDaTarefa, geralDoPeriodo, unidadesPorPessoa, seriePorDia, type Lote } from '../relatorios'
import { placarDaEquipe, somarQuantidades, type Execucao } from '../desempenho'

const ex = (o: Partial<Execucao> & { tarefa: string; colaboradorId: string; minutos: number | null; unidades: number }): Execucao => ({
  ordemId: o.ordemId ?? `o-${o.tarefa}-${o.colaboradorId}`,
  nome: o.nome ?? o.colaboradorId, unidade: o.unidade ?? 'UN',
  quando: o.quando ?? new Date('2026-09-12T10:00:00Z'), ...o,
})
const lote = (o: Partial<Lote> & { tarefa: string; entregue: number }): Lote => ({
  ordemId: o.ordemId ?? `l-${o.tarefa}-${o.entregue}-${o.dia ?? 'x'}`,
  pedido: o.pedido ?? null, custoUnitario: o.custoUnitario ?? null, unidade: o.unidade ?? 'UN',
  minutos: o.minutos ?? null, dia: o.dia ?? '2026-09-12', ...o,
})

const MASSA = 'metade de bolinha massa de pizza'
const QUEIJO = 'porçao queijo 135 grama'

/** o mundo do print: massa (eliane, KG) e queijo (rodrigo, UN) na mesma janela */
const LOTES: Lote[] = [
  lote({ tarefa: MASSA, entregue: 214, minutos: 190, dia: '2026-09-12', unidade: 'KG' }),
  lote({ tarefa: MASSA, entregue: 176, minutos: 129, dia: '2026-09-10', unidade: 'KG' }),
  lote({ tarefa: MASSA, entregue: 132, dia: '2026-09-11', unidade: 'KG' }),
  lote({ tarefa: QUEIJO, entregue: 1410, minutos: 300, dia: '2026-09-12', unidade: 'UN' }),
]
const EXECS: Execucao[] = [
  ex({ tarefa: MASSA, colaboradorId: 'eliane', minutos: 190, unidades: 214, unidade: 'KG' }),
  ex({ tarefa: MASSA, colaboradorId: 'eliane', minutos: 129, unidades: 176, unidade: 'KG' }),
  ex({ tarefa: QUEIJO, colaboradorId: 'rodrigo', minutos: 300, unidades: 1410, unidade: 'UN' }),
]

/** o recorte que a ROTA faz — a mesma régua, num lugar só */
const recorte = (tarefa: string | null) => ({
  lotes: tarefa ? LOTES.filter((l) => l.tarefa === tarefa) : LOTES,
  execucoes: tarefa ? EXECS.filter((e) => e.tarefa === tarefa) : EXECS,
})

describe('⛔⛔ escolhi uma tarefa → NADA de outra tarefa na tela', () => {
  const { lotes, execucoes } = recorte(MASSA)

  it('⭐ "unidades por pessoa" vira as unidades DAQUELA tarefa — eliane e acabou', () => {
    const b = unidadesPorPessoa(execucoes)
    expect(b.map((p) => p.nome)).toEqual(['eliane'])
    expect(b.map((p) => p.nome)).not.toContain('rodrigo')
    expect(b[0].quantidade.texto).toBe('390 KG')
  })

  it('⭐ o "geral" do recorte é o da tarefa — 3 lotes, não 51, e o top é a massa', () => {
    const g = geralDoPeriodo(lotes)
    expect(g.lotes).toBe(3)
    expect(g.topTarefas.map((t) => t.tarefa)).toEqual([MASSA])
    expect(g.topTarefas.map((t) => t.tarefa)).not.toContain(QUEIJO)
    expect(g.quantidade.texto).toBe('522 KG')
  })

  it('⛔ e o relatório da tarefa não vê o lote da outra', () => {
    const r = relatorioDaTarefa(MASSA, lotes, execucoes, EXECS)
    expect(r.lotes).toBe(3)
    expect(r.unidades).toBe(522)
    expect(r.pessoas.map((p) => p.nome)).toEqual(['eliane'])
  })
})

describe('⭐ "todas as tarefas" é o estado EXPLÍCITO da visão geral', () => {
  const { lotes, execucoes } = recorte(null)

  it('sem tarefa escolhida, o geral fala da cozinha inteira', () => {
    const g = geralDoPeriodo(lotes)
    expect(g.lotes).toBe(4)
    expect(g.topTarefas).toHaveLength(2)
  })

  it('⭐ e as top tarefas saem em lista — é delas que a tela faz os LINKS', () => {
    const g = geralDoPeriodo(lotes)
    for (const t of g.topTarefas) {
      expect(t.tarefa).toBeTruthy()
      expect(t.lotes).toBeGreaterThan(0)
      expect(t.unidade).toBeTruthy()   // ⭐ cada uma com a SUA unidade
    }
  })
})

describe('⛔⛔ NÚMERO COMPOSTO DE UNIDADES DIFERENTES NUNCA', () => {
  it('a soma da cozinha inteira sai POR UNIDADE — "1.410 UN · 522 KG"', () => {
    const g = geralDoPeriodo(LOTES)
    expect(g.quantidade.mista).toBe(true)
    expect(g.quantidade.total, 'somou UN com KG').toBeNull()
    expect(g.quantidade.texto).toBe('1.410 UN · 522 KG')
  })

  it('⭐ a barra por pessoa vira LOTES quando as unidades se misturam', () => {
    const b = unidadesPorPessoa(EXECS)
    expect(b.every((p) => p.emLotes)).toBe(true)
    // eliane 2 execuções × rodrigo 1 → ela lidera a barra, mesmo com menos "números"
    expect(b[0].nome).toBe('eliane')
    expect(b[0].quantidade.texto).toBe('390 KG')
    expect(b[1].quantidade.texto).toBe('1.410 UN')
  })

  it('⭐ com UMA unidade só, a barra volta a medir unidades', () => {
    const b = unidadesPorPessoa(EXECS.filter((e) => e.unidade === 'KG'))
    expect(b.every((p) => p.emLotes)).toBe(false)
    expect(b[0].quantidade.total).toBe(390)
  })

  it('⛔ e o PLACAR não soma UN com KG — era o "1.415,84 un" do print', () => {
    const p = placarDaEquipe([
      ex({ tarefa: QUEIJO, colaboradorId: 'rodrigo', minutos: 300, unidades: 1410, unidade: 'UN' }),
      ex({ tarefa: MASSA, colaboradorId: 'rodrigo', minutos: 190, unidades: 5.84, unidade: 'KG' }),
    ], EXECS)
    expect(p[0].quantidade.total, 'somou UN com KG no placar').toBeNull()
    expect(p[0].quantidade.texto).toBe('1.410 UN · 5,84 KG')
    expect(p[0].barraEmLotes).toBe(true)
  })

  it('⚠️ `somarQuantidades` de lista vazia não inventa unidade', () => {
    const q = somarQuantidades([])
    expect(q.total).toBe(0)
    expect(q.unidade).toBeNull()
    expect(q.mista).toBe(false)
  })
})

describe('⭐ o gráfico não inventa zero, e o "melhor" diz a conta', () => {
  it('⛔ dia com lote e SEM tempo medido fica sem ponto — e a tela sabe por quê', () => {
    const s = seriePorDia(recorte(MASSA).lotes)
    expect(s.map((p) => p.dia)).toEqual(['2026-09-10', '2026-09-11', '2026-09-12'])
    const onze = s.find((p) => p.dia === '2026-09-11')!
    expect(onze.minutosPorLote, 'o dia sem tempo virou ponto zero').toBeNull()
    expect(onze.semTempoMedido).toBe(true)
    expect(onze.lotes).toBe(1)          // ⭐ o lote existe, e o eixo o mostra
    expect(onze.unidades).toBe(132)     // ⭐ o volume dele continua contado
  })

  it('⚠️ dia SEM lote nenhum não entra no eixo — não há buraco a desenhar', () => {
    const s = seriePorDia(recorte(MASSA).lotes)
    expect(s.map((p) => p.dia)).not.toContain('2026-09-09')
  })

  it('⛔⛔ "melhor" é por RITMO e o rótulo DIZ a conta — não o lote mais longo', () => {
    const r = relatorioDaTarefa(MASSA, recorte(MASSA).lotes, recorte(MASSA).execucoes, EXECS)
    // 214/190 = 1,13 KG/min · 176/129 = 1,36 KG/min → o de 129 min é o melhor RITMO
    expect(r.melhor!.minutos).toBe(129)
    expect(r.melhor!.ritmo).toBe(1.36)
    expect(r.melhor!.frase).toContain('melhor ritmo')
    expect(r.melhor!.frase).toContain('KG/min')
    expect(r.melhor!.frase).toContain('10/09')
    // ⛔ o print mostrava "melhor: 3h10 p/ 214 un" — o lote MAIS LONGO, sem dizer a régua
    expect(r.melhor!.frase).not.toMatch(/^melhor: /)
  })
})

describe('⛔ rendimento com meta PARCIAL não vira média silenciosa', () => {
  it('2 de 3 lotes com meta → o % vale só nesses, e a contagem é dita', () => {
    const l = [
      lote({ tarefa: MASSA, entregue: 104, pedido: 100, unidade: 'KG' }),
      lote({ tarefa: MASSA, entregue: 104, pedido: 100, unidade: 'KG' }),
      lote({ tarefa: MASSA, entregue: 500, unidade: 'KG' }),   // sem meta
    ]
    const r = relatorioDaTarefa(MASSA, l, [], EXECS)
    expect(r.lotesComMeta).toBe(2)
    expect(r.lotes).toBe(3)
    expect(r.rendimento.pct).toBe(104)          // ⭐ 208 sobre 200, só os que têm meta
    expect(r.unidades).toBe(708)                // ⭐ e o VOLUME conta os três
  })

  it('⭐ todos com meta → não há o que ressalvar', () => {
    const l = [lote({ tarefa: MASSA, entregue: 104, pedido: 100, unidade: 'KG' })]
    const r = relatorioDaTarefa(MASSA, l, [], EXECS)
    expect(r.lotesComMeta).toBe(r.lotes)
  })
})
