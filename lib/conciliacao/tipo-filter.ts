// Sprint A-effected Fase A (03/06/2026) — filtro de TIPO de conciliação.
//
// Pra negócio de varejo/restaurante (alto volume de recebimentos avulsos
// PIX/maquininha sem cliente cadastrado), conciliar CREDIT é inviável
// — esses entram via cash coding direto (Fase B+C). Hoje a tela polui
// a lista de pendentes com CREDIT sem candidato.
//
// Solução: seletor "Tipo" no header com 3 opções, default heurístico por
// tipo de empresa.

export type TipoConciliacao =
  | 'apenas-pagamentos'
  | 'apenas-recebimentos'
  | 'todos'

export type CompanyType =
  | 'restaurant'
  | 'retail'
  | 'service'
  | 'industry'
  | 'mixed'
  | 'other'

/**
 * Filter Prisma para tx OFX pelo tipo de conciliação selecionado.
 *
 * - apenas-pagamentos → type=DEBIT (esconde recebimentos)
 * - apenas-recebimentos → type=CREDIT (esconde pagamentos)
 * - todos → sem filtro (visão completa)
 *
 * Pra inserir num WHERE Prisma existente: spread o retorno.
 *   Ex: `where: { ...other, ...getTipoFilter(tipo) }`
 */
export function getTipoFilter(
  tipo: TipoConciliacao,
): { type?: 'DEBIT' | 'CREDIT' } {
  if (tipo === 'apenas-pagamentos') return { type: 'DEBIT' }
  if (tipo === 'apenas-recebimentos') return { type: 'CREDIT' }
  return {}
}

/**
 * Default heurístico de tipo de conciliação por tipo de empresa.
 *
 * - restaurant (Cacula Mix), retail (lojas), industry: alto volume de
 *   recebimentos avulsos sem cliente cadastrado → "apenas-pagamentos"
 *   esconde poluição visual.
 * - service (academia): mensalidade típica é AR cadastrada (Conta a
 *   Receber por aluno) → conciliar CREDIT faz sentido → "todos".
 * - mixed, other: "todos" pra não esconder nada inadvertidamente.
 */
export function defaultTipoForCompany(
  companyType: CompanyType | string | null | undefined,
): TipoConciliacao {
  // Normalização case-insensitive: schema atual armazena "RESTAURANT" em
  // alguns lugares e "restaurant" em outros (CompanyType enum BR foi salvo
  // uppercase historicamente). Normaliza pra prevenir o bug de fallback.
  const normalized = (companyType ?? '').toString().toLowerCase()
  switch (normalized) {
    case 'restaurant':
    case 'retail':
    case 'industry':
      return 'apenas-pagamentos'
    case 'service':
    case 'mixed':
    case 'other':
    default:
      return 'todos'
  }
}

/**
 * Parse seguro do query param `tipo=`. Aceita só valores conhecidos —
 * qualquer outro vira 'todos' (defensivo).
 */
export function parseTipoParam(raw: string | null | undefined): TipoConciliacao {
  if (raw === 'apenas-pagamentos') return 'apenas-pagamentos'
  if (raw === 'apenas-recebimentos') return 'apenas-recebimentos'
  return 'todos'
}
