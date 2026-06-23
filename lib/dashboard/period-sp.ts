// Sprint 7 — helpers de período em America/Sao_Paulo.
//
// O resto do projeto trabalha em UTC. Aqui calculamos "hoje em SP"
// para que o usuário no Brasil veja o dashboard MTD certo mesmo
// quando o servidor está em UTC e já virou meia-noite UTC mas em SP
// ainda é o dia anterior.
//
// SP = UTC-3 sem DST atualmente. Implementamos via offset fixo (-3h)
// — quando voltar o horário de verão, trocar pra Intl/luxon.

const SP_OFFSET_HOURS = -3

/** Hoje em São Paulo, retornado como objeto Date "deslocado" pra que
 * .getUTCFullYear/.getUTCMonth/.getUTCDate retornem o que o usuário vê
 * no relógio dele. NUNCA usar como timestamp absoluto — só pra extrair
 * y/m/d/h "locais". */
export function nowInSaoPaulo(now: Date = new Date()): Date {
  return new Date(now.getTime() + SP_OFFSET_HOURS * 60 * 60 * 1000)
}

/** Mês corrente (MTD) em São Paulo. Retorna start = 1º dia do mês 00:00 UTC,
 * end = NOW (instante atual UTC). Usado como period custom no dashboard.
 *
 * Por que end = NOW (não fim do mês)? Mercury-style mostra MTD (mês até hoje).
 * "Resultado do mês" inclui só o que aconteceu até agora.
 */
export function getCurrentMTD(now: Date = new Date()): { start: Date; end: Date; year: number; month: number } {
  const sp = nowInSaoPaulo(now)
  const year = sp.getUTCFullYear()
  const month = sp.getUTCMonth() // 0-11
  const start = new Date(Date.UTC(year, month, 1))
  // end = agora real (UTC). MTD = mês até este instante.
  const end = now
  return { start, end, year, month }
}

/** Mês completo de referência (ex: junho 2026 inteiro).
 * Usado quando o user escolhe um mês passado no seletor.
 */
export function getFullMonth(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 1) - 1) // último ms do último dia
  return { start, end }
}

/** Verifica se um (year, month) é o mês corrente em SP (=> mostrar MTD,
 * desabilitar seta "próximo"). */
export function isCurrentMonth(year: number, month: number, now: Date = new Date()): boolean {
  const cur = getCurrentMTD(now)
  return year === cur.year && month === cur.month
}

/** Parse "YYYY-MM" → { year, month }. Retorna null se inválido. */
export function parsePeriodoYM(s: string | null | undefined): { year: number; month: number } | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})$/.exec(s)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  if (month < 0 || month > 11) return null
  if (year < 2000 || year > 2100) return null
  return { year, month }
}

/** Formata "YYYY-MM" a partir de (year, month). */
export function formatPeriodoYM(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/** Avança N meses (positivo ou negativo). */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month + delta
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 }
}

/** Label visual ("Junho 2026"). */
const MES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export function labelMesAno(year: number, month: number): string {
  return `${MES_NOMES[month]} ${year}`
}
