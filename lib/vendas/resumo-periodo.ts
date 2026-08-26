// VENDAS — agregados de PERÍODO da tela (25/08).
//
// ⚠️ EXTRAÍDOS da própria página no passe visual, com o código IDÊNTICO ao que já
// rodava lá dentro. O motivo de saírem: os CARDS DO TOPO e o NÚMERO GRANDE precisam do
// MESMO agregado. Deixar cada um somando por conta seria a 2ª cópia da mesma decisão —
// a família de bug que já custou caro aqui (5 detectores de par que discordavam entre
// telas; a `/parear` dizendo "nenhum par" com o banner mostrando 99%).
//
// Puro e testado: o passe visual não pode mudar um centavo, e é o teste que prova.

const MESNOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const parseDia = (s: string) => new Date(s + 'T12:00:00Z')
const dd = (s: string | null) => {
  if (!s) return '—'
  const d = parseDia(s)
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Unidade de exibição: um dia único OU um bloco de fim de semana já agregado. */
export interface Unidade {
  inicio: string
  fim: string
  total: number
  porMeio: Record<string, number>
  isBloco: boolean
}

export interface ResumoPeriodo {
  label: string
  total: number
  porMeio: Record<string, number>
}

export const somaMeio = (us: Unidade[]): Record<string, number> =>
  us.reduce((acc, u) => {
    for (const [m, v] of Object.entries(u.porMeio)) acc[m] = (acc[m] ?? 0) + v
    return acc
  }, {} as Record<string, number>)

/**
 * Semana (seg–dom) que contém a ÚLTIMA competência com dado.
 * ⚠️ É a última COM DADO, não "a semana de hoje": num mês navegado pra trás, "a semana
 * de hoje" não existe no mês exibido e o card ficaria vazio sem motivo.
 */
export function resumoSemana(unidades: Unidade[]): ResumoPeriodo | null {
  if (unidades.length === 0) return null
  const ultima = parseDia(unidades[unidades.length - 1].fim)
  const dow = (ultima.getUTCDay() + 6) % 7 // seg=0
  const segMs = ultima.getTime() - dow * 86400000
  const domMs = segMs + 6 * 86400000
  const naSemana = unidades.filter((u) => {
    const t = parseDia(u.fim).getTime()
    return t >= segMs && t <= domMs
  })
  const seg = new Date(segMs)
  const dom = new Date(domMs)
  const rot = `Semana ${String(seg.getUTCDate()).padStart(2, '0')}/${String(seg.getUTCMonth() + 1).padStart(2, '0')}–${String(dom.getUTCDate()).padStart(2, '0')}/${String(dom.getUTCMonth() + 1).padStart(2, '0')}`
  return { label: rot, total: naSemana.reduce((s, u) => s + u.total, 0), porMeio: somaMeio(naSemana) }
}

/** O mês inteiro que a tela carregou (as unidades JÁ vêm filtradas pelo mês). */
export function resumoMes(unidades: Unidade[], mes: string, moduleInicio: string | null): ResumoPeriodo {
  return {
    label: `${MESNOME[Number(mes.split('-')[1]) - 1]} (a partir de ${dd(moduleInicio)})`,
    total: unidades.reduce((s, u) => s + u.total, 0),
    porMeio: somaMeio(unidades),
  }
}
