// Levenshtein distance — função PURA, sem deps.
// Sprint 2 Dia 4: usado em detect-duplicate-subscriptions pra
// achar transações com descrições "quase iguais" (ex: "NETFLIX 04/2026"
// vs "NETFLIX 05/2026" → distância 2).
//
// Algoritmo clássico O(m*n) com matriz comprimida (2 linhas).

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Linha anterior + linha atual (otimização de memória vs matriz completa)
  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)

  for (let j = 0; j <= b.length; j++) prev[j] = j

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(
        curr[j - 1] + 1, // insert
        prev[j] + 1, // delete
        prev[j - 1] + cost, // substitute
      )
    }
    // Swap prev/curr (evita re-alocação)
    const tmp = prev
    prev = curr
    curr = tmp
  }

  return prev[b.length]
}

// Normaliza descrição pra comparação: lowercase, trim, colapsa espaços.
// Mantém pontuação e dígitos — diferenças de data ("04" vs "05") são exatamente
// o que queremos detectar via Levenshtein.
export function normalizeDescription(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ')
}
