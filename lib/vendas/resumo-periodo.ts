// ⚠️⚠️ SEM CHAMADOR DESDE O VENDAS v4 (10/10) — CAPACIDADE GUARDADA, NÃO É LIXO.
//
// O v4 matou o modelo que isto agrega: aqui a unidade de exibição é o BLOCO de fim de
// semana JÁ AGREGADO (`Unidade.isBloco`), e no v4 **cada dia é célula própria** — o bloco
// agrupado foi o vermelho nº 2 do pedido do dono. Ou seja: não há mais quem produza
// `Unidade[]`, e religar isto exigiria ressuscitar o agrupado.
//
// ⛔ E NÃO FOI APAGADO POR UMA RAZÃO MEDIDA: o teste dele trava **números REAIS de agosto
// que não estão travados em lugar nenhum** — o bloco de borda 31/07–02/08 (R$ 58.852,69) e
// os dias de 03 a 11/08. O golden de agosto trava só os três dias que o dono conferiu
// (12/08, 13/08 e o fds 14–16). Apagar perderia cobertura de dinheiro conferido.
//
// ⭐ FECHA QUANDO: os números do mês forem realocados num teste do v4 (`montarCartoes`
// sobre o agosto real). Ver a pendência nomeada no relatório/CLAUDE.md.

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
