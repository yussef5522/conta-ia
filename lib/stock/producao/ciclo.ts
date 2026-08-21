// ESTOQUE FASE 2 item 2.0 — validação de CICLO na ficha (proibido). A recursão é a força
// (xis usa pacote que usa carne), mas A não pode conter B se B contém A em qualquer nível.
// Puro: recebe o grafo produzido→componentes (das fichas existentes) e os componentes da
// ficha em edição. Detecta se algum componente volta pro próprio item produzido.

export type GrafoFichas = Map<string, string[]> // itemProduzidoId → [itemId componentes]

export interface CicloResult { ciclo: boolean; via: string | null }

export function detectaCicloFicha(itemProduzidoId: string, componentIds: string[], grafo: GrafoFichas): CicloResult {
  // grafo com a ficha EM EDIÇÃO aplicada (substitui/insere a aresta do item produzido)
  const g = new Map(grafo)
  g.set(itemProduzidoId, componentIds)

  const alcanca = (alvo: string, from: string): boolean => {
    const seen = new Set<string>()
    const st = [from]
    while (st.length) {
      const cur = st.pop()!
      if (cur === alvo) return true
      if (seen.has(cur)) continue
      seen.add(cur)
      for (const nxt of g.get(cur) ?? []) st.push(nxt)
    }
    return false
  }

  for (const c of componentIds) {
    if (c === itemProduzidoId) return { ciclo: true, via: c } // auto-referência direta
    if (alcanca(itemProduzidoId, c)) return { ciclo: true, via: c } // volta em algum nível
  }
  return { ciclo: false, via: null }
}
