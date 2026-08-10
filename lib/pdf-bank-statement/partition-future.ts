// Sprint Preview-Futuro (09/08/2026) — descarte de linha futura no import por
// PDF (Vision). Extrato = passado: linha com data > hoje (BRT) é AGENDADA e não
// entra (nem no saldo). Helper PURO e testável (Regra 3) — a rota é fina.
//
// Comparação por DIA-CALENDÁRIO em BRT (não por instante): a data do PDF vem
// como string sem hora ("2026-08-10" ou "10/08/2026"); parsear como instante UTC
// jogaria a meia-noite pra 21h BRT do dia anterior e classificaria errado perto
// da virada. Data que não parseia → conservador: NÃO descarta (mantém real).

const SAO_PAULO_OFFSET_MS = -3 * 60 * 60 * 1000 // BRT permanente

/** Dia-calendário "hoje" em BRT no formato YYYY-MM-DD. */
export function todayBrazilDay(now: Date = new Date()): string {
  return new Date(now.getTime() + SAO_PAULO_OFFSET_MS).toISOString().slice(0, 10)
}

/** Normaliza a data da linha pra YYYY-MM-DD. Aceita ISO/‘YYYY-MM-DD’ e ‘DD/MM/YYYY’. */
export function statementLineDay(dateStr: string): string | null {
  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const br = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2]}-${br[1]}`
  const d = new Date(dateStr)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

export function partitionFutureStatementLines<T extends { date: string }>(
  lines: T[],
  now: Date = new Date(),
): { real: T[]; future: T[] } {
  const today = todayBrazilDay(now)
  const real: T[] = []
  const future: T[] = []
  for (const l of lines) {
    const day = statementLineDay(l.date)
    if (day && day > today) future.push(l)
    else real.push(l) // dia <= hoje OU data inválida → conservador (mantém)
  }
  return { real, future }
}
