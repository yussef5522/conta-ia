// Filtro-verdade do preview (bug Stone 17/08). O preview mostrava "novas" pelo
// gate (filtrarNovasOFX), cego pra tx criadas pelo V2 → marcava como nova uma linha
// que o confirm (reconcileStatement) deduplcaria → número fantasma na tela e no juiz
// de saldo. Este filtro remove das "novas" as que o reconcile diz que JÁ EXISTEM,
// usando a MESMA chave do reconcile (stableKey), pra a tela = o confirm (REGRA 4/5).
//
// Multiset consumível: um stableKey pode aparecer 2× legitimamente (2 tarifas iguais
// no mesmo dia). Se o reconcile diz "1 nova" desse key e o gate tem 2, só 1 fica.

export function filterToReconcileMissing<T>(
  items: T[],
  keyOf: (t: T) => string,
  missingKeys: Map<string, number>,
): { kept: T[]; removed: number } {
  const keys = new Map(missingKeys) // cópia consumível
  const kept: T[] = []
  for (const t of items) {
    const k = keyOf(t)
    const c = keys.get(k) ?? 0
    if (c > 0) {
      keys.set(k, c - 1)
      kept.push(t)
    }
  }
  return { kept, removed: items.length - kept.length }
}
