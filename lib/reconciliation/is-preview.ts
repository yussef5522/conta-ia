// Detecta linhas PREVIEW/AGENDADAS — entram como PENDING/PAYABLE, NÃO EFFECTED.
//
// Critérios (qualquer um basta):
//   1. DTPOSTED > corte efetivo (min(DTASOF, HOJE)): lançamento futuro
//   2. FITID == YYMMDD da data: Banrisul usa esse formato pra previsão/preview interno
//      (caso real EMPRESTIMO R$ 4.092,02 FITID 260611 em 11/06/2026 — Rodada 5)
//
// Por que `min(DTASOF, HOJE)`: alguns bancos (Sicredi) declaram DTASOF no fim
// do mês (30/06) mesmo quando o extrato foi gerado hoje (13/06). Sem o corte
// por HOJE, linhas de 15/06 seriam consideradas reais — quando na verdade são
// AGENDADAS pelo banco no extrato corrente.

export interface IsPreviewInput {
  datePosted: Date
  fitid?: string
}

export function fitidLooksLikeDate(fitid: string | undefined, date: Date): boolean {
  if (!fitid) return false
  // Aceita exatamente 6 dígitos numéricos
  if (!/^[0-9]{6}$/.test(fitid)) return false
  // Compara contra YYMMDD da data (UTC, consistente com parseOFXDate do projeto)
  const yy = String(date.getUTCFullYear()).slice(-2)
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return fitid === `${yy}${mm}${dd}`
}

// Corte efetivo = menor entre o DTASOF do arquivo e a data HOJE.
// `today` opcional pra ser testável determinísticamente; default = new Date().
export function effectiveAsOfDate(dtAsOf: Date, today?: Date): Date {
  const t = today ?? new Date()
  return dtAsOf.getTime() < t.getTime() ? dtAsOf : t
}

export function isPreviewLine(
  line: IsPreviewInput,
  dtAsOf: Date,
  today?: Date,
): boolean {
  const effective = effectiveAsOfDate(dtAsOf, today)
  // Comparação por dia ISO (ignora horário)
  const lineDay = line.datePosted.toISOString().slice(0, 10)
  const effectiveDay = effective.toISOString().slice(0, 10)
  if (lineDay > effectiveDay) return true
  if (fitidLooksLikeDate(line.fitid, line.datePosted)) return true
  return false
}
