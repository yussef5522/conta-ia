// ⭐⭐ DESEMPENHO — o motor da tela (leis R9–R16 de docs/producao-desempenho-referencia.html, 13/11/2026).
//
// R9: a história em duas lentes (Pessoas · Receitas), período Hoje · 7 dias · 30 dias · qualquer dia.
// R10: pessoa se mede por lotes, tarefas, horas medidas e NO RITMO (% das etapas ≤ 1,25× a mediana
//      da própria etapa). < 30s fica fora das horas e do ritmo, contado em "N sem tempo". NUNCA soma UN.
// R11: barra em escala única (a tela usa `barPct` com o MAIOR da lista).
// R12/R14: rendimento feito ÷ pedido na unidade da receita, contra 70–130%, com "N fora".
// R13: conta de escritório/aparelho em "fora da comparação" (papel da Equipe — porta única).
// R15: custo real/un × ficha; lote sem custo fora da média e contado à parte.
// R16: cada linha leva os lotes por trás do número (`lotes`).
// ⭐ A RÉGUA DO LOTE (13/11, limpeza de sinal): lote = conclusão VIGENTE fechada no período; as
//    etapas das pessoas são as dessas ordens (+ tarefas finalizadas no período).

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { diaEmSaoPaulo, janelaDoDiaSP, somarDias, horaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'
import { conclusoesVigentes } from './conclusoes-vigentes'
import { pedidoDaOrdem } from './pedido-da-ordem'
import { lerEtapas, medianasDasChaves, nomesDasContas, type EtapaLida } from './tempos-das-etapas'
import { papeisDasContas } from './papel-da-conta'
import { barPct, ritmo, rendCor, mediana, tempoDeMentira, foraDoRanking, type Periodo, type PapelDaConta } from './leis-r'
import { listFichas } from './fichas'
import { receitaDoCatalogo } from './catalogo-regua'

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

/** o período da tela → janela de dias de Brasília (inclusiva) */
export function janelaDoPeriodo(p: Periodo, agora: Date): { de: string; ate: string } {
  const hoje = diaEmSaoPaulo(agora)
  if (p.tipo === 'hoje') return { de: hoje, ate: hoje }
  if (p.tipo === '7d') return { de: somarDias(hoje, -6), ate: hoje }
  if (p.tipo === '30d') return { de: somarDias(hoje, -29), ate: hoje }
  return { de: p.dia, ate: p.dia }
}

/** "quinta 12/11" — o rótulo do dia escolhido no calendário (R9) */
export function rotuloDoDia(dia: string): string {
  const d = new Date(`${dia}T12:00:00.000Z`)
  return `${DIAS_SEMANA[d.getUTCDay()]} ${dia.slice(8, 10)}/${dia.slice(5, 7)}`
}

export function lerPeriodo(q: { periodo?: string | null; dia?: string | null }): Periodo {
  if (q.periodo === 'hoje') return { tipo: 'hoje' }
  if (q.periodo === '30d') return { tipo: '30d' }
  if (q.periodo === 'dia' && q.dia && /^\d{4}-\d{2}-\d{2}$/.test(q.dia)) return { tipo: 'dia', dia: q.dia, rot: rotuloDoDia(q.dia) }
  return { tipo: '7d' }
}

export interface EtapaDaPessoa { quando: string; oQue: string; etapa: string; seg: number | null; mentira: boolean; ehTarefa: boolean }
export interface LinhaPessoa {
  colaboradorId: string
  quem: string
  papel: PapelDaConta
  lotes: number
  tarefas: number
  /** minutos medidos (só etapas FEITAS ≥ 30s) */
  min: number
  /** null = nenhuma etapa válida com mediana */
  ritmo: number | null
  /** etapas sem tempo de verdade: < 30s ou finalizadas pelo gerente */
  semTempo: number
  /** ⭐ R11 — as barras JÁ em escala única (maior da lista da cozinha = 100%); a tela só desenha */
  barLotes: number
  barMin: number
  etapas: EtapaDaPessoa[]
}

export interface LoteDaReceita { conclusaoId: string; quando: string; pedido: number | null; feito: number; rend: number | null; custoUn: number | null }
export interface LinhaReceita {
  itemId: string
  r: string
  un: string
  lotes: number
  /** soma só dos lotes COM pedido (feito idem) — compara igual com igual */
  ped: number
  feito: number
  semPedido: number
  rend: number | null
  fora: number
  tmedSeg: number | null
  custo: number | null
  semCusto: number
  ficha: number | null
  fichaCompleta: boolean
  lotesPorTras: LoteDaReceita[]
}

export interface Desempenho {
  periodo: Periodo
  de: string
  ate: string
  pessoas: LinhaPessoa[]
  fora: LinhaPessoa[]
  receitas: LinhaReceita[]
}

const ehLote = (e: EtapaLida) => !e.ehTarefa

export async function desempenhoDaProducao(companyId: string, periodo: Periodo, agora: Date = new Date(), db: PrismaClient = defaultPrisma): Promise<Desempenho> {
  const { de, ate } = janelaDoPeriodo(periodo, agora)
  const janela = janelaDoDiaSP(de, ate)
  const conclusoes = await conclusoesVigentes(companyId, { de: janela.de, ate: janela.ate }, db)
  const ordemIds = [...new Set(conclusoes.map((c) => c.ordemId))]

  const [etapasDosLotes, tarefas, ordens, metas] = await Promise.all([
    lerEtapas(companyId, { ordemIds }, db),
    lerEtapas(companyId, { finalizadasEntre: janela }, db).then((es) => es.filter((e) => e.ehTarefa)),
    db.stockProductionOrder.findMany({ where: { companyId, id: { in: ordemIds } }, select: { id: true, itemProduzidoId: true, fichaId: true, versaoFicha: true, escalaReceitas: true, estado: true } }),
    db.stockOrdemMeta.findMany({ where: { companyId, ordemId: { in: ordemIds } }, select: { ordemId: true, unidades: true } }),
  ])
  const etapas = [...etapasDosLotes.filter(ehLote), ...tarefas.filter((t) => t.estado === 'FEITA' || t.estado === 'FINALIZADA_PELO_GERENTE')]
  const contaIds = [...new Set(etapas.map((e) => e.quemId).filter((x): x is string => !!x))]
  const [med, nome, papel] = await Promise.all([
    medianasDasChaves(companyId, [...new Set(etapas.map((e) => e.chave))], db),
    nomesDasContas(companyId, contaIds, db),
    papeisDasContas(companyId, contaIds, db),
  ])

  // ── PESSOAS ─────────────────────────────────────────────────────────────
  const porPessoa = new Map<string, EtapaLida[]>()
  for (const e of etapas) if (e.quemId) porPessoa.set(e.quemId, [...(porPessoa.get(e.quemId) ?? []), e])
  const linhas: LinhaPessoa[] = []
  for (const [id, es] of porPessoa) {
    const feitas = es.filter((e) => e.estado === 'FEITA' && e.seg != null)
    const validas = feitas.filter((e) => !tempoDeMentira(e.seg!))
    linhas.push({
      colaboradorId: id, quem: nome.get(id) ?? '—', papel: papel.get(id) ?? 'cozinha',
      lotes: new Set(es.filter(ehLote).map((e) => e.ordemId)).size,
      tarefas: es.filter((e) => e.ehTarefa).length,
      min: Math.round(validas.reduce((s, e) => s + e.seg!, 0) / 60),
      ritmo: ritmo(feitas.map((e) => ({ seg: e.seg!, med: med.get(e.chave) ?? null }))),
      semTempo: es.filter((e) => e.estado === 'FINALIZADA_PELO_GERENTE' || (e.seg != null && tempoDeMentira(e.seg))).length,
      barLotes: 0, barMin: 0,
      etapas: es
        .filter((e) => e.finalizadoEm)
        .sort((a, b) => b.finalizadoEm!.getTime() - a.finalizadoEm!.getTime())
        .map((e) => ({
          quando: `${diaEmSaoPaulo(e.finalizadoEm!).slice(8, 10)}/${diaEmSaoPaulo(e.finalizadoEm!).slice(5, 7)} ${horaEmSaoPaulo(e.finalizadoEm!)}`,
          oQue: e.oQue, etapa: e.etapaNome, seg: e.seg, mentira: e.seg != null && tempoDeMentira(e.seg), ehTarefa: e.ehTarefa,
        })),
    })
  }
  const porLotes = (a: LinhaPessoa, b: LinhaPessoa) => b.lotes - a.lotes || b.tarefas - a.tarefas || a.quem.localeCompare(b.quem)
  const pessoas = linhas.filter((l) => !foraDoRanking(l.papel)).sort(porLotes)
  const fora = linhas.filter((l) => foraDoRanking(l.papel)).sort(porLotes)
  escalaUnica(pessoas)

  // ── RECEITAS ────────────────────────────────────────────────────────────
  const ordemDe = new Map(ordens.map((o) => [o.id, o]))
  const metaDe = new Map(metas.map((m) => [m.ordemId, m.unidades]))
  const fichaIds = [...new Set(ordens.map((o) => o.fichaId))]
  const itemIds = [...new Set(ordens.map((o) => o.itemProduzidoId))]
  const [versoes, itens, views] = await Promise.all([
    db.stockFichaVersao.findMany({ where: { companyId, fichaId: { in: fichaIds } }, select: { fichaId: true, versao: true, loteBase: true } }),
    db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true, unidadeControle: true } }),
    fichaIds.length ? listFichas(companyId, db, { incluirInativas: true }) : Promise.resolve([]),
  ])
  // ⭐ custo de FICHA por unidade = a MESMA régua do catálogo (dose ÷ rendimento medido)
  const fichaView = new Map(views.map((v) => [v.id, v]))
  const loteBaseDe = new Map(versoes.map((v) => [`${v.fichaId}:${v.versao}`, v.loteBase]))
  const itemDe = new Map(itens.map((i) => [i.id, i]))
  const segDaOrdem = new Map<string, number>()
  for (const e of etapasDosLotes) if (e.estado === 'FEITA' && e.seg != null && !tempoDeMentira(e.seg)) segDaOrdem.set(e.ordemId, (segDaOrdem.get(e.ordemId) ?? 0) + e.seg)

  const porItem = new Map<string, { fichaId: string; lotes: LoteDaReceita[]; ordens: Set<string>; custoLote: number; qtdComCusto: number }>()
  for (const c of [...conclusoes].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())) {
    const o = ordemDe.get(c.ordemId)
    if (!o) continue
    const pedido = pedidoDaOrdem({ meta: metaDe.get(o.id) ?? null, escala: o.escalaReceitas, loteBase: loteBaseDe.get(`${o.fichaId}:${o.versaoFicha}`) ?? 0, estado: o.estado }).unidades
    const temCusto = c.custoUnitarioReal != null && c.custoUnitarioReal > 0 && c.qtdGerada > 0
    const g = porItem.get(o.itemProduzidoId) ?? { fichaId: o.fichaId, lotes: [], ordens: new Set<string>(), custoLote: 0, qtdComCusto: 0 }
    g.lotes.push({
      conclusaoId: c.id,
      quando: `${diaEmSaoPaulo(c.criadoEm).slice(8, 10)}/${diaEmSaoPaulo(c.criadoEm).slice(5, 7)} ${horaEmSaoPaulo(c.criadoEm)}`,
      pedido, feito: c.qtdGerada,
      rend: pedido != null && pedido > 0 ? Math.round((c.qtdGerada / pedido) * 100) : null,
      custoUn: temCusto ? c.custoUnitarioReal : null,
    })
    g.ordens.add(o.id)
    if (temCusto) { g.custoLote += c.custoLoteReal; g.qtdComCusto += c.qtdGerada }
    porItem.set(o.itemProduzidoId, g)
  }

  const receitas: LinhaReceita[] = []
  for (const [itemId, g] of porItem) {
    const it = itemDe.get(itemId)
    const comPedido = g.lotes.filter((l) => l.pedido != null && l.pedido > 0)
    const ped = comPedido.reduce((s, l) => s + l.pedido!, 0)
    const feito = comPedido.reduce((s, l) => s + l.feito, 0)
    const fv = fichaView.get(g.fichaId)
    const cat = fv ? receitaDoCatalogo(fv, { lotes: 0, ultima: null }) : null
    const cu = cat && cat.porUnidade ? cat : null
    receitas.push({
      itemId, r: it?.nome ?? '(item removido)', un: it?.unidadeControle ?? 'UN',
      lotes: g.lotes.length, ped, feito, semPedido: g.lotes.length - comPedido.length,
      rend: ped > 0 ? Math.round((feito / ped) * 100) : null,
      fora: comPedido.filter((l) => rendCor(l.rend!) === 'ambar').length,
      tmedSeg: mediana([...g.ordens].map((id) => segDaOrdem.get(id) ?? 0)),
      custo: g.qtdComCusto > 0 ? Math.round((g.custoLote / g.qtdComCusto) * 100) / 100 : null,
      semCusto: g.lotes.filter((l) => l.custoUn == null).length,
      ficha: cu?.custo ?? null, fichaCompleta: !!cu?.completo,
      lotesPorTras: g.lotes,
    })
  }
  receitas.sort((a, b) => b.lotes - a.lotes || a.r.localeCompare(b.r))

  return { periodo, de, ate, pessoas, fora, receitas }
}


/**
 * ⭐ R11 — BARRA EM ESCALA ÚNICA: o MAIOR valor da coluna (na lista da cozinha) = 100%, e toda barra
 * da coluna usa essa MESMA régua. Cicatriz: rodrigo 1.238 UN com barra menor que edmar 1.003 na tela
 * velha (cada linha com a sua régua). ⛔ Quem está "fora da comparação" não entra no máximo.
 */
export function escalaUnica(pessoas: LinhaPessoa[]): void {
  const maxLotes = Math.max(0, ...pessoas.map((p) => p.lotes))
  const maxMin = Math.max(0, ...pessoas.map((p) => p.min))
  for (const p of pessoas) { p.barLotes = barPct(p.lotes, maxLotes); p.barMin = barPct(p.min, maxMin) }
}
