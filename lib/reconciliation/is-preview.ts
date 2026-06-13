// Detecta linhas PREVIEW/AGENDADAS — entram como PENDING/PAYABLE, NÃO EFFECTED.
//
// Critérios (qualquer um basta):
//   1. DTPOSTED > DTASOF: lançamento futuro (extrato declara explicitamente que ainda não ocorreu)
//   2. FITID == YYMMDD da data: Banrisul usa esse formato pra previsão/preview interno
//      (caso real EMPRESTIMO R$ 4.092,02 FITID 260611 em 11/06/2026 — ver Rodada 5 da investigação)

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

export function isPreviewLine(line: IsPreviewInput, dtAsOf: Date): boolean {
  // Comparação por dia, ignorando horário (extratos têm DTASOF com hora 00:00 ou meio-dia)
  const lineDay = line.datePosted.toISOString().slice(0, 10)
  const asOfDay = dtAsOf.toISOString().slice(0, 10)
  if (lineDay > asOfDay) return true
  if (fitidLooksLikeDate(line.fitid, line.datePosted)) return true
  return false
}
