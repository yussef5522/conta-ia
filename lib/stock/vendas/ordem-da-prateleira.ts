// ⭐⭐ A ORDEM DA PRATELEIRA — e a LISTA ÚNICA (08/09/2026), decisão do dono.
//
// *"Sobrou duplicação de TELA: o mesmo sabor aparece em DOIS lugares. (…) A seção de cards
// MORRE. **Sem seção 'resumo dos grupos' separada — duas apresentações do mesmo dado
// divergem e confundem** — foi exatamente o que me fez achar que o bug continuava."*
//
// ⛔⛔ E A CURA NÃO FOI "ESCONDER O SEGUNDO": foi **apagar o componente**. Enquanto os dois
// existirem, alguém religa um deles e a página volta a mostrar 4 QUEIJOS duas vezes. É a
// mesma disciplina do resto do projeto: **impossibilidade, não vigilância.**
//
// ⚠️ A ordem também é regra, não estética. O dono: *"pendentes com sugestão primeiro (são
// os que têm ação de 1 clique)"*. Uma tela de trabalho ordena por **quanto custa resolver**,
// e só depois por volume.

import { normalizarNome } from './grupo-complemento'

/** o mínimo que a ordenação precisa saber de cada linha já agrupada */
export interface LinhaOrdenavel {
  nomeSuitable: string
  titulo: string
  ocorrencias: number
  destino: 'SEM_FICHA' | 'FICHA' | 'IGNORAR'
}

/**
 * ⛔ Quatro faixas, nesta ordem — o número menor sobe:
 *
 *  0. **pendente COM sugestão** — ação de UM clique. É o trabalho mais barato do dono.
 *  1. **pendente sem sugestão, que vendeu** — trabalho de verdade, por volume.
 *  2. **já decidido** (ficha ou ignorado) que vendeu — informação, não trabalho.
 *  3. **não vendeu no período** (`ocorrencias === 0`) — ⚠️ vai por ÚLTIMO **mesmo estando
 *     pendente**: sabor do cardápio que não apareceu não é fila, é conferência. Deixá-lo
 *     no topo por ser "pendente" empurraria pra baixo o que de fato vendeu.
 */
export function faixaDaLinha(l: LinhaOrdenavel, temSugestao: boolean): 0 | 1 | 2 | 3 {
  if (l.ocorrencias === 0) return 3
  if (l.destino !== 'SEM_FICHA') return 2
  return temSugestao ? 0 : 1
}

/**
 * A lista ÚNICA da página, na ordem do trabalho.
 *
 * `comSugestao` é o conjunto dos `nomeSuitable` que têm alguma sugestão inline (irmã com
 * ficha, typo/parecida, ou sufixo de tamanho).
 */
export function ordenarPrateleira<T extends LinhaOrdenavel>(
  linhas: readonly T[], comSugestao: ReadonlySet<string>,
): T[] {
  return [...linhas].sort((a, b) => {
    const fa = faixaDaLinha(a, comSugestao.has(a.nomeSuitable))
    const fb = faixaDaLinha(b, comSugestao.has(b.nomeSuitable))
    if (fa !== fb) return fa - fb
    if (a.ocorrencias !== b.ocorrencias) return b.ocorrencias - a.ocorrencias
    return a.titulo.localeCompare(b.titulo, 'pt-BR')
  })
}

/**
 * ⭐⭐ A PROVA DA LISTA ÚNICA: cada canônico pendente aparece EXATAMENTE UMA VEZ.
 *
 * ⚠️ O dono pediu *"teste conta linhas por canônico no HTML da tela"*. A suíte roda em
 * `environment: node`, sem jsdom — então a prova honesta é sobre **a lista que a tela
 * desenha**, não sobre a string de HTML. É mais forte, aliás: se a lista tem uma linha por
 * canônico e a página só desenha essa lista, a duplicata é impossível **por construção** —
 * e o componente que duplicava foi apagado, não escondido.
 */
export function canonicosDuplicados(linhas: readonly LinhaOrdenavel[]): string[] {
  const vezes = new Map<string, number>()
  for (const l of linhas) {
    // ⚠️ só o pendente agrupa por canônico; ficha e ignorado têm chaves próprias e podem
    // legitimamente repetir um canônico (duas fichas com nomes parecidos, por exemplo).
    if (l.destino !== 'SEM_FICHA') continue
    const k = normalizarNome(l.nomeSuitable)
    vezes.set(k, (vezes.get(k) ?? 0) + 1)
  }
  return [...vezes.entries()].filter(([, n]) => n > 1).map(([k]) => k)
}
