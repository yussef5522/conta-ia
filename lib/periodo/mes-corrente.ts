// ⭐⭐⭐ FLUXO ABRE NO MÊS; ESTOQUE MOSTRA O ESTADO DE AGORA (14/09/2026) — régua da casa.
//
// **O dono:** *"número de FLUXO (aconteceu no tempo) abre no mês; número de ESTOQUE
// (saldo, dívida aberta, posição) mostra o estado ATUAL sempre. Saldo de conta e Posição
// de estoque NÃO ganham filtro de mês — são fotos de agora."*
//
// ⛔⛔ **E A RAZÃO DOS DOIS TEMPOS É NÃO ESCONDER DÍVIDA:** *"VENCIDAS mostra TODAS as
// vencidas em aberto SEMPRE — esconder vencida de agosto seria mentir que não devo."* Um
// filtro de mês sobre dívida aberta faria o sistema afirmar, na virada do mês, que uma
// conta parou de existir.
//
// ⚠️ O MÊS É O DO BRASIL, pelo mesmo motivo do `inicioDoDiaBrasil`: o servidor roda em
// UTC, e no dia 1º às 00h30 de São Paulo o `new Date()` ainda diz o mês anterior.

/** ⚠️ o mês corrente NO FUSO DE QUEM OLHA — `2026-09`, nunca o do servidor */
export function mesCorrente(now: Date = new Date()): string {
  const br = new Date(now.getTime() - 3 * 60 * 60 * 1000) // UTC−3
  return `${br.getUTCFullYear()}-${String(br.getUTCMonth() + 1).padStart(2, '0')}`
}

export interface JanelaDoMes {
  /** `YYYY-MM` */
  mes: string
  /** meia-noite do dia 1º, em UTC */
  de: Date
  /** o instante seguinte ao último dia — comparar com `lt`, nunca `lte` */
  ate: Date
}

/**
 * ⭐ A janela de um mês. ⚠️ O fim é EXCLUSIVO (`< ate`): usar o último dia às 23:59:59
 * perde o que cair no último segundo, e é o tipo de borda que ninguém vê até acontecer.
 */
export function janelaDoMes(mes: string): JanelaDoMes {
  const [a, m] = mes.split('-').map(Number)
  return {
    mes,
    de: new Date(Date.UTC(a, m - 1, 1)),
    ate: new Date(Date.UTC(m === 12 ? a + 1 : a, m === 12 ? 0 : m, 1)),
  }
}

/** ⭐ anda no calendário — é o ‹ › do cabeçalho */
export function mesVizinho(mes: string, passo: -1 | 1): string {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + passo, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/**
 * ⭐ o rótulo do cabeçalho: *"setembro"* no ano corrente, *"setembro de 2025"* fora dele.
 *
 * ⚠️ Repetir o ano todo mês é ruído; **omiti-lo num mês de OUTRO ano é mentira** — o dono
 * navegando pra trás precisa saber onde está.
 */
export function rotuloDoMes(mes: string, now: Date = new Date()): string {
  const [a, m] = mes.split('-').map(Number)
  const nome = MESES[m - 1] ?? mes
  return mes.slice(0, 4) === mesCorrente(now).slice(0, 4) ? nome : `${nome} de ${a}`
}
