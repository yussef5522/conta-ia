// Sprint CDB/Royalties (02/08/2026) — detecção de aplicação/resgate/IOF/rendimento
// automáticos (varredura Banrisul/Sicredi). Determinístico por memo. SÓ sugere;
// a classificação só grava após preview + confirmação do usuário.
//
// Natureza contábil correta:
//   APLICACAO/RESGATE = TRANSFERÊNCIA (conta corrente ↔ investimento) → fora do DRE
//   IOF               = DESPESA FINANCEIRA → entra no DRE
//   REND              = RECEITA FINANCEIRA → entra no DRE (hoje não vem no OFX — débito)

export type CdbNature = 'APLICACAO' | 'RESGATE' | 'IOF' | 'REND' | null

/** Nome EXATO da categoria-alvo no plano (academia/restaurante têm todas). */
export const CDB_TARGET_CATEGORY: Record<Exclude<CdbNature, null>, string> = {
  APLICACAO: 'Aplicação Financeira (saída)',
  RESGATE: 'Resgate de Aplicação (entrada)',
  IOF: 'IOF',
  REND: 'Rendimentos de Aplicações',
}

export function detectCdbNature(description: string | null | undefined): CdbNature {
  const d = (description ?? '').toUpperCase()
  if (!d) return null
  // "RESGATE AUTOMATICO" / "RESGATE CDB"
  if (/\bRESGATE\b/.test(d)) return 'RESGATE'
  // "APLICACAO AUTOMATICA" / "APLICACAO CDB"
  if (/\bAPLICA/.test(d)) return 'APLICACAO'
  // "REND CDB AUT" / "RENDIMENTO CDB" — só quando ligado a CDB/aplicação
  if (/\bREND/.test(d) && /(CDB|APLICA|POUP)/.test(d)) return 'REND'
  // IOF (imposto sobre a aplicação) — palavra isolada
  if (/\bIOF\b/.test(d)) return 'IOF'
  return null
}

/** true quando a natureza é transferência (fora do DRE): aplicação/resgate. */
export function isCdbTransfer(nature: CdbNature): boolean {
  return nature === 'APLICACAO' || nature === 'RESGATE'
}
