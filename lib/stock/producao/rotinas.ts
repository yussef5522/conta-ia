// ⭐⭐ AS FUNÇÕES DAS LEIS R25–R31 (ROTINAS) — portadas do último <script> de
// docs/rotinas-referencia.html ("ROTINAS (produção) — referência v1 APROVADA", 13/11/2026).
//   semeiaHoje · semear · proxima · atrasada · grupoConcluido · progresso
//
// ⛔ ARQUIVO DE REFERÊNCIA = LEI: os 12 PINOS do <script> rodam como teste contra ESTAS funções
// (lib/stock/producao/__tests__/leis-r-pinos.test.ts). PURAS — nenhum relógio, nenhum banco.
//
// Extensão do sprint (o prompt do dono pede "dias da semana"; a lei só desenhou o <select>):
// tipo 'dias' com a lista de dow. Não muda nenhum pino.

export type RegraRotina =
  | { tipo: 'diaria' }
  | { tipo: 'dias'; dows: number[] }
  | { tipo: 'semanal'; dow: number }
  | { tipo: 'mensal'; dia: number }

/** 'AAAA-MM-DD' → dia da semana (0=dom…6=sáb) e dia do mês, só calendário (sem fuso) */
function partes(dataISO: string): { dow: number; dia: number } {
  const [a, m, d] = dataISO.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d, 12))
  return { dow: dt.getUTCDay(), dia: dt.getUTCDate() }
}

/** R25 — a regra diz se semeia neste dia (data de negócio 'AAAA-MM-DD') */
export function semeiaHoje(regra: RegraRotina, dataISO: string): boolean {
  const { dow, dia } = partes(dataISO)
  if (regra.tipo === 'diaria') return true
  if (regra.tipo === 'dias') return regra.dows.includes(dow)
  if (regra.tipo === 'semanal') return dow === regra.dow
  if (regra.tipo === 'mensal') return dia === regra.dia
  return false
}

/** R25 — idempotente: só o que ainda não existe no dia */
export function semear<T>(aSemear: readonly T[], jaSemeadas: readonly T[]): T[] {
  return aSemear.filter((n) => !jaSemeadas.includes(n))
}

/** próxima data em que a regra cai, a partir de (sem contar) dataISO; null em 62 dias */
export function proxima(regra: RegraRotina, dataISO: string): string | null {
  const [a, m, d] = dataISO.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d, 12))
  for (let k = 1; k <= 62; k++) {
    dt.setUTCDate(dt.getUTCDate() + 1)
    const iso = dt.toISOString().slice(0, 10)
    if (semeiaHoje(regra, iso)) return iso
  }
  return null
}

/** R27 — atrasada: tem limite, passou, e não terminou. Âmbar, nunca vermelho. */
export function atrasada(agoraMin: number, limiteMin: number | null | undefined, feitas: number, total: number): boolean {
  if (limiteMin == null) return false
  return agoraMin > limiteMin && feitas < total
}

/** R26 — o grupo conclui sozinho no último tique (grupo vazio nunca conclui) */
export const grupoConcluido = (itens: readonly { feito: boolean }[]) => itens.length > 0 && itens.every((i) => i.feito)
export const progresso = (itens: readonly { feito: boolean }[]) => itens.filter((i) => i.feito).length + '/' + itens.length

/** 'HH:MM' → minutos do dia */
export const min = (h: string) => {
  const [a, b] = h.split(':').map(Number)
  return a * 60 + b
}

/** 'HH:MM' válido (00:00–23:59) */
export const horaValida = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** o rótulo da coluna "Repete" (lei: "todo dia" · "toda segunda" · "todo domingo" · "dia 1 do mês") */
export function rotuloRegra(r: RegraRotina): string {
  if (r.tipo === 'diaria') return 'todo dia'
  if (r.tipo === 'semanal') return (r.dow === 0 || r.dow === 6 ? 'todo ' : 'toda ') + DIAS[r.dow]
  if (r.tipo === 'mensal') return `dia ${r.dia} do mês`
  const ds = [...r.dows].sort((a, b) => a - b)
  if (ds.length === 7) return 'todo dia'
  if (ds.join(',') === '1,2,3,4,5') return 'seg a sex'
  if (ds.join(',') === '1,2,3,4,5,6') return 'seg a sáb'
  return ds.map((d) => CURTO[d]).join(' · ')
}

/** valida + normaliza a regra vinda da API/banco; null = torta */
export function regraValida(x: unknown): RegraRotina | null {
  if (!x || typeof x !== 'object') return null
  const r = x as Record<string, unknown>
  const dowOk = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6
  if (r.tipo === 'diaria') return { tipo: 'diaria' }
  if (r.tipo === 'semanal' && dowOk(r.dow)) return { tipo: 'semanal', dow: r.dow as number }
  if (r.tipo === 'mensal' && Number.isInteger(r.dia) && (r.dia as number) >= 1 && (r.dia as number) <= 31)
    return { tipo: 'mensal', dia: r.dia as number }
  if (r.tipo === 'dias' && Array.isArray(r.dows) && r.dows.length > 0 && r.dows.every(dowOk))
    return { tipo: 'dias', dows: [...new Set(r.dows as number[])].sort((a, b) => a - b) }
  return null
}

/** R29 — o destino do excluir: nunca semeou → apaga de vez; com história → some das telas */
export const destinoExclusaoRotina = (semeadas: number): 'apagar' | 'arquivar' => (semeadas === 0 ? 'apagar' : 'arquivar')

/** R29 — confirmação com números */
export function textoExcluirRotina(nome: string, semeadas: number, feitas: number): string {
  if (semeadas === 0) return `Excluir "${nome}"? Ela nunca caiu na cozinha — some de vez.`
  return `Excluir "${nome}"? Ela já caiu ${semeadas} ${semeadas === 1 ? 'vez' : 'vezes'} (${feitas} ${feitas === 1 ? 'feita' : 'feitas'}). Para de cair e some desta tela; as ${semeadas} tarefas já semeadas ficam intactas no histórico.`
}
