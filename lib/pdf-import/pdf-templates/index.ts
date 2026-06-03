// Sprint PF Fatia 3.5 — Selector de template por banco.

import { GENERIC_PROMPT } from './generic'
import { NUBANK_PROMPT } from './nubank'
import { ITAU_PROMPT } from './itau'
import { BRADESCO_PROMPT } from './bradesco'
import { INTER_PROMPT } from './inter'
import { C6_PROMPT } from './c6'

export type BankHint = 'NUBANK' | 'ITAU' | 'BRADESCO' | 'INTER' | 'C6' | 'GENERIC'

export const TEMPLATES: Record<BankHint, string> = {
  NUBANK: NUBANK_PROMPT,
  ITAU: ITAU_PROMPT,
  BRADESCO: BRADESCO_PROMPT,
  INTER: INTER_PROMPT,
  C6: C6_PROMPT,
  GENERIC: GENERIC_PROMPT,
}

/**
 * Heurística leve sobre o NOME do arquivo OU hint manual do user.
 * Em produção, o nome geralmente vem como "Fatura_Nubank_05_2026.pdf".
 */
export function detectBankFromFileName(fileName: string): BankHint {
  const f = fileName.toLowerCase()
  if (f.includes('nubank') || f.includes('nu_pagamentos')) return 'NUBANK'
  if (f.includes('itau') || f.includes('itaú')) return 'ITAU'
  if (f.includes('bradesco')) return 'BRADESCO'
  if (f.includes('inter')) return 'INTER'
  if (f.includes('c6')) return 'C6'
  return 'GENERIC'
}

export function getTemplate(bank: BankHint): string {
  return TEMPLATES[bank]
}
