// Sprint CSV Import (30/05/2026) — Limpa categoria CACULA + detecta multi.
//
// Categoria do CSV CACULA vem com valor embedded entre parênteses:
//   "MATERIA PRIMA ( R$ 5.312,80 );"
//   "ENERGIA ELETRICA ( R$ 129,68 );"
//   "ENTREGADOR DELIVERY" (já limpo, sem embedded)
//   "-" (vazia)
//
// ⚠️ REGRA CRÍTICA: o valor entre parênteses é NÃO CONFIÁVEL.
//    Pode divergir do TOTAL real (caso documentado: TOTAL -2.500,24
//    mas categoria mostra R$ 2.500,25 — 1 centavo de diferença;
//    outro caso: TOTAL -210 mas categoria mostra R$ 240 — R$ 30!).
//    O valor SEMPRE vem da coluna TOTAL.
//
// Multi-categoria: linhas com 2+ "( R$ )" representam compra dividida.
//   Decisão Yussef: importa só a 1ª + marca linha pra revisar.

// Captura " ( R$ <qualquer coisa exceto ")"> ) " com optional ";" no fim
const R_REGEX = /\s*\(\s*R\$[^)]*\)\s*;?/g

/**
 * Limpa o texto da categoria removendo a parte "( R$ X,XX )" embedded.
 *
 * - "-" / "" / whitespace → ""
 * - "MATERIA PRIMA ( R$ 5.312,80 );" → "MATERIA PRIMA"
 * - "ENERGIA ( R$ 129,68 )" → "ENERGIA"
 * - "ENTREGADOR DELIVERY" → "ENTREGADOR DELIVERY" (sem mudança)
 */
export function limparCategoria(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return ''
  const s = String(raw).trim()
  if (s === '' || s === '-') return ''
  return s
    .replace(R_REGEX, '')
    .replace(/;+$/, '')
    .trim()
}

export interface MultiCategoriaResult {
  /** Texto da PRIMEIRA categoria, já limpa. "" se nenhuma. */
  primeira: string
  /** True se há 2+ "( R$ )" no campo bruto */
  temMultiplas: boolean
  /** Quantos "( R$ )" foram encontrados */
  contagem: number
  /** Lista de TODAS as categorias limpas (pra log/audit/preview detalhado) */
  todas: string[]
}

/**
 * Detecta se a categoria contém múltiplas entradas (compra dividida).
 *
 * Heurística: conta quantos "( R$ ... )" aparecem.
 * - 0 ou 1 → linha simples (temMultiplas=false)
 * - 2+ → multi (badge no preview pro user revisar)
 *
 * NUNCA usa o valor entre parênteses pra fins financeiros — só texto.
 */
export function detectarMultiCategoria(
  raw: string | null | undefined,
): MultiCategoriaResult {
  if (raw === null || raw === undefined) {
    return { primeira: '', temMultiplas: false, contagem: 0, todas: [] }
  }
  const s = String(raw).trim()
  if (s === '' || s === '-') {
    return { primeira: '', temMultiplas: false, contagem: 0, todas: [] }
  }

  const matches = s.match(/\(\s*R\$[^)]*\)/g) ?? []
  const contagem = matches.length

  // Split por ";" e limpa cada parte
  const partes = s
    .split(';')
    .map(limparCategoria)
    .filter((p) => p !== '')

  return {
    primeira: partes[0] ?? '',
    temMultiplas: contagem > 1,
    contagem,
    todas: partes,
  }
}
