// Sprint Parser Caixa (06/08/2026) — registro + roteamento de parsers de agenda.
// Detecta o banco pelo cabeçalho do documento e devolve o parser certo. Layout
// não reconhecido → null (o caller dá mensagem clara "banco não suportado ainda",
// nunca "nenhum contrato Sicredi").

import type { BankScheduleParser } from './bank-schedule-parser'
import { sicrediScheduleParser } from './sicredi-schedule-parser'
import { caixaScheduleParser } from './caixa-schedule-parser'
import { banrisulScheduleParser } from './banrisul-schedule-parser'

export const SCHEDULE_PARSERS: BankScheduleParser[] = [
  sicrediScheduleParser,
  caixaScheduleParser,
  banrisulScheduleParser,
]

/** Primeiro parser cujo layout casa com o texto. null = nenhum reconhecido. */
export function detectScheduleParser(text: string): BankScheduleParser | null {
  return SCHEDULE_PARSERS.find((p) => p.detects(text)) ?? null
}
