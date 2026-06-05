// Sprint UX-bulk-review: detecção de outliers no modal "Aprender e aplicar".
//
// Quando o user vai categorizar N transações similares em lote, queremos
// destacar visualmente as que têm descrição DIFERENTE do padrão dominante
// — são as mais prováveis de estarem erradas no agrupamento (ex: 117 vendas
// PIX e no meio uma TED que coincidiu de descrição).
//
// Estratégia: extrair "shape" = uppercase com dígitos virando '#'. Contar
// frequência das shapes. Top 2 shapes mais frequentes = padrão dominante.
// Outliers = itens cuja shape NÃO está nos top 2.
//
// Salvaguardas pra evitar falso positivo:
//   - Mín 5 itens (amostra pequena: ignora)
//   - Top1 precisa cobrir ≥60% (variância natural alta: ignora)

export interface OutlierCandidate {
  id: string
  description: string
}

export function descriptionShape(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
}

export function detectOutliers(items: OutlierCandidate[]): Set<string> {
  if (items.length < 5) return new Set()
  const shapeCounts = new Map<string, number>()
  for (const it of items) {
    const s = descriptionShape(it.description)
    shapeCounts.set(s, (shapeCounts.get(s) ?? 0) + 1)
  }
  const sorted = Array.from(shapeCounts.entries()).sort((a, b) => b[1] - a[1])

  // Top1 precisa cobrir ≥60% pra haver "padrão dominante" — caso contrário
  // variância natural alta (vários shapes equivalentes) e não há outlier
  // estatístico confiável.
  const top1Count = sorted[0]?.[1] ?? 0
  if (top1Count / items.length < 0.6) return new Set()

  // Shape vira "dominante" se cobre >10% do total. Isso evita que 1 outlier
  // solo seja incluído como top-2 (caso clássico: 9 iguais + 1 estranho →
  // sem essa salvaguarda, o estranho viraria top-2 e ele mesmo não seria
  // detectado como outlier).
  const minShareForDominant = 0.1
  const topSet = new Set(
    sorted
      .filter(([, count]) => count / items.length > minShareForDominant)
      .map(([shape]) => shape),
  )
  // Garante que top1 sempre entra (mesmo com 100% só ele, 100% > 10%)
  topSet.add(sorted[0][0])

  return new Set(
    items
      .filter((it) => !topSet.has(descriptionShape(it.description)))
      .map((it) => it.id),
  )
}
