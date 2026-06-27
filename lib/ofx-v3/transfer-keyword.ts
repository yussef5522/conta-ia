// Sprint OFX V3 R7 — extrai keyword de transferência da descrição.
// Função PURA (testável sem DB). Reusada pelo PreviewV3Premium pra
// decidir se single-side (CNPJ/nome próprios) merece selo "aguarda par".

export type TransferKeyword = 'PIX' | 'TED' | 'DOC' | 'TRANSFER' | null

/**
 * Detecta keyword de transferência na descrição OFX.
 *
 * Hierarquia (1ª que casa vence):
 *   - PIX (cobre PIX_DEB, PIX_CRED, PIX RECEBIDO, etc)
 *   - TED
 *   - DOC
 *   - TRANSFER (palavra "transferência" / "transf")
 *
 * Retorna null quando descrição não tem nenhum sinal de transferência.
 */
export function detectTransferKeyword(description: string): TransferKeyword {
  const s = (description ?? '').toUpperCase()
  if (/\bPIX[_\s-]?(DEB|CRED)?\b/.test(s) || /\bPIX\b/.test(s)) return 'PIX'
  if (/\bTED\b/.test(s)) return 'TED'
  if (/\bDOC\b/.test(s)) return 'DOC'
  if (/TRANSFER[EÊ]NCIA|\bTRANSF\b/.test(s)) return 'TRANSFER'
  return null
}
