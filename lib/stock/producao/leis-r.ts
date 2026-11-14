// ⭐⭐ AS FUNÇÕES DAS LEIS R1–R24 — portadas do último <script> das 4 referências aprovadas (13/11/2026):
//   docs/producao-ao-vivo-referencia.html     (R1–R8)   mediana · corDoTempo · fmtDur · posPulso
//   docs/producao-desempenho-referencia.html  (R9–R16)  barPct · ritmo · rendCor · custoFlag · rotuloPeriodo · fmtH · fmtQ
//   docs/producao-receitas-referencia.html    (R17–R24) custoParcial · rotCusto · fmtVal · destinoExclusaoReceita
//   docs/producao-equipe-referencia.html      (R20–R23) validaPin · foraDoRanking · destinoExclusaoConta · textoExcluir
//
// ⛔ ARQUIVO DE REFERÊNCIA = LEI: os PINOS de cada <script> rodam como teste contra ESTAS funções
// (lib/stock/producao/__tests__/leis-r-pinos.test.ts). Mudar uma régua aqui sem a lei mudar é defeito.
// PURAS — nenhum relógio, nenhum banco.

import { formatarDuracao } from '@/lib/format/duracao'

/** R4 — abaixo disto a medição é "tempo de mentira": fora de mediana, ritmo, horas e ranking */
export const SEG_MINIMO_MEDIDO = 30
/** R3 — mínimo de medições válidas pra existir mediana da etapa */
export const MEDICOES_PRA_MEDIANA = 5
/** R3 — âmbar só ACIMA disto × a mediana */
export const FATOR_AMBAR = 1.5
/** R10 — "no ritmo" = até isto × a mediana da própria etapa */
export const FATOR_RITMO = 1.25
/** R12 — faixa saudável do rendimento */
export const FAIXA_RENDIMENTO = { min: 70, max: 130 } as const
/** R15 — diferença de custo real × ficha acima disto fica âmbar */
export const DIF_CUSTO_AMBAR = 0.10

/** R4 — tempo de mentira se declara */
export const tempoDeMentira = (seg: number) => seg < SEG_MINIMO_MEDIDO

/** R4 — mediana dos tempos (segundos); medições < 30s ficam fora. Vazia → null. */
export function mediana(ts: readonly number[]): number | null {
  const v = ts.filter((t) => t >= SEG_MINIMO_MEDIDO).sort((a, b) => a - b)
  if (v.length === 0) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

/** R3 — a mediana da ETAPA só existe com ≥ 5 medições válidas (≥ 30s); senão "ainda sem mediana" */
export function medianaDaEtapa(ts: readonly number[]): number | null {
  return ts.filter((t) => t >= SEG_MINIMO_MEDIDO).length >= MEDICOES_PRA_MEDIANA ? mediana(ts) : null
}

/** R3 — âmbar só acima de 1,5× a mediana; sem mediana, neutro. Vermelho NUNCA existe. */
export function corDoTempo(seg: number, medSeg: number | null): 'neutro' | 'ambar' {
  if (medSeg == null) return 'neutro'
  return seg > FATOR_AMBAR * medSeg ? 'ambar' : 'neutro'
}

/** R3/R7 — a barrinha: tempo ÷ mediana, trava em 100%. Sem mediana → null (não desenha). */
export function pctDaBarra(seg: number, medSeg: number | null): number | null {
  if (medSeg == null || medSeg <= 0) return null
  return Math.min(100, (seg / medSeg) * 100)
}

/** < 1 min em segundos ("14s"); daí em diante o DONO da régua (`formatarDuracao`: "45min", "1h12") */
export function fmtDur(seg: number): string {
  if (seg < 60) return Math.round(seg) + 's'
  return formatarDuracao(seg / 60)
}

/** R7 — posição (%) de um "HH:MM" no eixo do pulso [iniMin, fimMin] (minutos; o eixo pode passar da meia-noite) */
export function posPulso(h: string, iniMin: number, fimMin: number): number {
  const [hh, mm] = h.split(':').map(Number)
  let m = hh * 60 + mm
  if (m < iniMin) m += 1440
  if (fimMin <= iniMin) return 50
  return Math.max(0, Math.min(100, ((m - iniMin) / (fimMin - iniMin)) * 100))
}

/** R11 — barra em ESCALA ÚNICA: o maior valor da lista = 100% */
export function barPct(v: number, max: number): number {
  return max > 0 ? Math.round((v / max) * 100) : 0
}

/** R10 — no ritmo: % das etapas até 1,25× a mediana; < 30s e sem mediana ficam fora. Nenhuma válida → null. */
export function ritmo(execs: readonly { seg: number; med: number | null }[]): number | null {
  const validas = execs.filter((e) => e.seg >= SEG_MINIMO_MEDIDO && e.med != null)
  if (!validas.length) return null
  const ok = validas.filter((e) => e.seg <= FATOR_RITMO * (e.med as number))
  return Math.round((ok.length / validas.length) * 100)
}

/** R12 — rendimento (%) contra a faixa 70–130% */
export function rendCor(p: number): 'neutro' | 'ambar' {
  return p < FAIXA_RENDIMENTO.min || p > FAIXA_RENDIMENTO.max ? 'ambar' : 'neutro'
}

/** R15 — custo real × ficha: acima de 10% de diferença, âmbar */
export function custoFlag(real: number, ficha: number | null): 'neutro' | 'ambar' {
  if (ficha == null || ficha === 0) return 'neutro'
  return Math.abs(real - ficha) / ficha > DIF_CUSTO_AMBAR ? 'ambar' : 'neutro'
}

export type Periodo = { tipo: 'hoje' } | { tipo: '7d' } | { tipo: '30d' } | { tipo: 'dia'; dia: string; rot: string }

/** R9 — o título da aba repete o período escolhido */
export function rotuloPeriodo(p: Periodo): string {
  if (p.tipo === 'hoje') return 'hoje'
  if (p.tipo === '7d') return '7 dias'
  if (p.tipo === '30d') return '30 dias'
  return p.rot
}

/** horas medidas SEMPRE em "XhYY" (a coluna da lei): abaixo de 1h vira "0hMM"; daí em diante o dono da régua */
export function fmtH(min: number): string {
  const m = Math.round(min)
  if (m < 60) return '0h' + String(m).padStart(2, '0')
  return formatarDuracao(m)
}

/** quantidade pt-BR: milhar com ponto, decimal com vírgula (1 casa) */
export function fmtQ(n: number): string {
  const neg = n < 0 ? '−' : ''
  n = Math.abs(n)
  let int = Math.trunc(n), dec = Math.round((n - int) * 10)
  if (dec === 10) { int += 1; dec = 0 }
  const mi = String(int).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return neg + (dec ? mi + ',' + dec : mi)
}

export const brl2 = (n: number) => n.toFixed(2).replace('.', ',')

/** S22/E3 — soma o que tem preço, declara o que falta (a forma da porta única `custoDeUmaUnidade`) */
export function custoParcial(ings: readonly { custo: number | null }[]): { custo: number; completo: boolean; faltam: number } {
  const comPreco = ings.filter((i) => i.custo != null)
  return {
    custo: comPreco.reduce((s, i) => s + (i.custo as number), 0),
    completo: comPreco.length === ings.length,
    faltam: ings.length - comPreco.length,
  }
}

export function rotCusto(cp: { custo: number; completo: boolean }, un: string): string {
  if (cp.completo) return 'R$ ' + brl2(cp.custo) + '/' + un
  if (cp.custo === 0) return 'sem preço nos ingredientes'
  return '≥ R$ ' + brl2(cp.custo) + '/' + un
}

export function fmtVal(d: number | null): string | null {
  if (d == null) return null
  return d === 1 ? '1 dia' : d + ' dias'
}

/** R24 — o que o excluir da RECEITA faz por dentro depende da história */
export function destinoExclusaoReceita(nLotes: number): 'apaga' | 'some-das-telas' {
  return nLotes === 0 ? 'apaga' : 'some-das-telas'
}

/** R21 — PIN de 4 dígitos (o PIN nunca é exibido) */
export function validaPin(p: string): boolean {
  return /^\d{4}$/.test(p)
}

export type PapelDaConta = 'cozinha' | 'escritorio' | 'aparelho'

export const ROTULO_DO_PAPEL: Record<PapelDaConta, string> = { cozinha: 'cozinha', escritorio: 'escritório', aparelho: 'aparelho' }

/** R13 — o motivo que a linha "fora da comparação" diz */
export const motivoDeFora = (p: PapelDaConta) => `conta de ${ROTULO_DO_PAPEL[p]}`

/** R20/R13/R8 — escritório e aparelho ficam fora de toda comparação/ranking da cozinha */
export function foraDoRanking(papel: PapelDaConta): boolean {
  return papel !== 'cozinha'
}

/** R23 — o que o excluir da CONTA faz por dentro depende da história */
export function destinoExclusaoConta(nLotes: number, nTarefas: number): 'apaga' | 'some-das-telas' {
  return nLotes + nTarefas === 0 ? 'apaga' : 'some-das-telas'
}

/** R23 — a confirmação diz a verdade com números */
export function textoExcluir(h: { lotes: number; tarefas: number }): string {
  return `${h.lotes} lotes e ${h.tarefas} tarefas ficam na história — os relatórios ` +
    `dos meses em que trabalhou continuam com o nome. Some do teclado de PIN, ` +
    `das listas e desta tela. Nada do que já foi produzido muda.`
}

/** R7/R2 — iniciais do avatar */
export const iniciais = (s: string) => s.trim().split(/\s+/).map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase()
