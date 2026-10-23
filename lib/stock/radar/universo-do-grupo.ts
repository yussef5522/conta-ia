/**
 * ⭐⭐ O UNIVERSO DA BUSCA DE CADA GRUPO — RT2 (22/10/2026)
 *
 * O *"adicionar item"* no pé do grupo usa a **busca da casa** (`BuscaItem`), e ela exige
 * `universo` **sem default** desde 16/09: a ausência dele foi o que pôs ficha de cardápio no
 * seletor da compra, e um default aqui recriaria o problema com outro nome.
 *
 * ⛔⛔ **MÓDULO PURO, e isso é o que o torna possível.** Ele **não importa `grupos.ts`** (que
 * importa `@/lib/db`): a tela é `'use client'`, e um caminho de import que alcance o Prisma
 * arrasta o client pro bundle do navegador. Por isso a decisão vive aqui e a **ROTA** manda o
 * resultado pronto no payload — mesma régua do *"o selo vem PRONTO do servidor"*.
 *
 * ⚠️ Os três de origem ficam **PINADOS** na pergunta que cada um faz de verdade:
 *   · `CAROS`   → `COMPRAVEL`   (matéria-prima que se compra — é a lista do mín/máx)
 *   · `REVENDA` → `REVENDA`     (a bebida que entra e sai inteira)
 *   · `PORCOES` → `PRATELEIRA`  (⭐ COMPRAVEL **+ INTERMEDIARIO**: porção não se compra, se produz)
 *
 * ⭐ **Grupo NOVO cai em `PRATELEIRA`**, que é o universo mais largo do que **se CONTA** — e é
 * essa a pergunta desta tela (*"o que eu conto e comparo com o teórico?"*). ⛔ `CATALOGO`
 * ofereceria invólucro de cardápio e produto final, que ninguém conta na câmara; `COMPRAVEL`
 * deixaria de fora justamente a porção, que é o caso mais comum de grupo novo nesta casa.
 */
import type { UniversoDoSeletor } from '@/lib/stock/universo-do-seletor'

/**
 * ⚠️ As chaves são os **SLUGS** (sempre MAIÚSCULOS por causa do
 * `chk_stock_radar_item_lista`), nunca o nome — o nome é do dono e muda pelo ✎ (RT2).
 */
const UNIVERSO_PINADO: Record<string, UniversoDoSeletor> = {
  CAROS: 'COMPRAVEL',
  REVENDA: 'REVENDA',
  PORCOES: 'PRATELEIRA',
}

/** ⭐ o universo mais largo do que **se conta** — o default de grupo novo */
export const UNIVERSO_PADRAO_DO_GRUPO: UniversoDoSeletor = 'PRATELEIRA'

export function universoDoGrupo(slug: string): UniversoDoSeletor {
  return UNIVERSO_PINADO[slug] ?? UNIVERSO_PADRAO_DO_GRUPO
}
