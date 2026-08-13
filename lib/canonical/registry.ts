// Sprint Rearquitetura-Import FASE 2 (13/08) — resolve o TRADUTOR pelo BANKID do
// arquivo (fonte da verdade, não o bankCode do DB). Reusa normalizeBankCode da
// ficha de banco. Banco desconhecido OU ficha incompleta → CONSERVADOR (avisa).

import { normalizeBankCode } from '@/lib/bank-profiles/registry'
import { CANONICAL_TRANSLATORS, translatorFromSpec } from './translators'
import type { BankTranslator } from './types'
import type { TranslatorSpec } from './build'

// bankCode normalizado → spec. Caixa (104) NÃO tem tradutor próprio (ficha
// incompleta, 0 OFX) → cai no CONSERVADOR de propósito, até subir um OFX real.
const BY_CODE: Record<string, TranslatorSpec> = {
  '41': CANONICAL_TRANSLATORS.BANRISUL,
  '748': CANONICAL_TRANSLATORS.SICREDI,
  '197': CANONICAL_TRANSLATORS.STONE,
}

/**
 * Resolve o tradutor pelo BANKID. Desconhecido/incompleto → CONSERVATIVE.
 * `overrides` é injetável PRA TESTE DE ISOLAMENTO (trocar um tradutor sem tocar
 * nos outros e provar que o resto não muda).
 */
export function resolveTranslator(
  bankId: string | null | undefined,
  overrides?: Partial<Record<string, TranslatorSpec>>,
): BankTranslator {
  const code = normalizeBankCode(bankId)
  const table = overrides ? { ...BY_CODE, ...overrides } : BY_CODE
  const spec = (code && table[code]) || CANONICAL_TRANSLATORS.CONSERVATIVE
  return translatorFromSpec(spec)
}
