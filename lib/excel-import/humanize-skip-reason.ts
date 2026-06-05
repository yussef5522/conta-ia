// Sprint Import-Transparência: converte motivos técnicos de skip em texto
// pt-BR humanizado pra UI mostrar pro Yussef em vez de "NEEDS_REVIEW".

export type SkipMotivo =
  | 'NEEDS_REVIEW_FAVORECIDO'
  | 'NEEDS_REVIEW_GENERICO'
  | 'NO_FAVORECIDO'
  | 'DUPLICATE'
  | 'EXCLUDED_BY_USER'

export interface SkippedRowContext {
  motivo: SkipMotivo
  favorecidoConfidence?: number | null
  rawFavorecido?: string | null
  duplicateOf?: string | null
}

/**
 * Retorna explicação curta em pt-BR pra exibir no card de linha pulada.
 * Sempre legível por humano não-técnico (Yussef olhando no celular).
 */
export function humanizarMotivoSkip(ctx: SkippedRowContext): string {
  switch (ctx.motivo) {
    case 'NEEDS_REVIEW_FAVORECIDO': {
      const conf = ctx.favorecidoConfidence
      if (typeof conf === 'number') {
        const pct = Math.round(conf * 100)
        return `Sistema não soube identificar bem o favorecido (semelhança ${pct}%). Pode ser pessoa física, empresa ou nome genérico — confirme.`
      }
      return 'Sistema marcou o favorecido como ambíguo (precisa de confirmação humana).'
    }
    case 'NEEDS_REVIEW_GENERICO':
      return 'Linha marcada como "precisa revisão" no detect — confirme antes de importar.'
    case 'NO_FAVORECIDO':
      return ctx.rawFavorecido
        ? `Favorecido em branco na planilha (campo "${ctx.rawFavorecido.slice(0, 40)}" detectado mas vazio).`
        : 'Favorecido em branco — sistema não tem com quem associar a despesa.'
    case 'DUPLICATE':
      return 'Linha já existe (mesma data + valor + favorecido bate com outra já importada).'
    case 'EXCLUDED_BY_USER':
      return 'Você marcou pra excluir na tela de revisão.'
  }
}

/**
 * Detecta motivo a partir do estado do staged_payable_row.
 * Usa userDecision + favorecidoConfidence + duplicateOf.
 */
export function detectSkipMotivo(row: {
  userDecision: string
  rawFavorecido: string | null
  favorecidoConfidence: number | null
  duplicateOf: string | null
}): SkipMotivo {
  if (row.duplicateOf) return 'DUPLICATE'
  if (!row.rawFavorecido || row.rawFavorecido.trim() === '') return 'NO_FAVORECIDO'
  if (row.userDecision === 'EXCLUDE') return 'EXCLUDED_BY_USER'
  if (row.userDecision === 'NEEDS_REVIEW') {
    if (typeof row.favorecidoConfidence === 'number' && row.favorecidoConfidence < 0.7) {
      return 'NEEDS_REVIEW_FAVORECIDO'
    }
    return 'NEEDS_REVIEW_GENERICO'
  }
  return 'NEEDS_REVIEW_GENERICO'
}
