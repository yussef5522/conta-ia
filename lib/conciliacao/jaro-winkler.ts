// Sprint 4.0.2 — Jaro-Winkler similarity (função PURA).
// Implementado inline pra evitar dep externa.
//
// Retorna float em [0, 1]: 0 = totalmente diferentes, 1 = idênticas.
// Algoritmo padrão: https://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance

export function jaroSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0

  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
  const aMatches = new Array<boolean>(a.length).fill(false)
  const bMatches = new Array<boolean>(b.length).fill(false)

  let matches = 0
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, b.length)
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue
      if (a[i] !== b[j]) continue
      aMatches[i] = true
      bMatches[j] = true
      matches++
      break
    }
  }
  if (matches === 0) return 0

  // Conta transposições
  let k = 0
  let transpositions = 0
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue
    while (!bMatches[k]) k++
    if (a[i] !== b[k]) transpositions++
    k++
  }
  transpositions /= 2

  return (
    matches / a.length +
    matches / b.length +
    (matches - transpositions) / matches
  ) / 3
}

export function jaroWinkler(a: string, b: string, prefixScale = 0.1): number {
  const jaro = jaroSimilarity(a, b)
  // Bônus de prefixo comum (até 4 chars)
  let prefix = 0
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++
    else break
  }
  return jaro + prefix * prefixScale * (1 - jaro)
}
