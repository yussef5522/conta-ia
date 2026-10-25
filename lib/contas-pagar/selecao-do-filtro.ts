/**
 * ⭐⭐⭐ SELECIONAR O FILTRO INTEIRO — e a régua do TETO (23/10).
 *
 * **O pedido do dono (1.2, item 3):** *"selecionar-todas seleciona o FILTRO inteiro (as 81);
 * a barra mostra o total agregado do servidor das 81 (a nota «50 em outra página» morre); as
 * ações em lote agem sobre TODAS as selecionadas com confirmação explícita do número."*
 *
 * ⛔⛔⛔ **ESTA É UMA PORTA DE LEITURA, E ISSO É DESENHO, NÃO ECONOMIA.** O caminho óbvio
 * seria a rota de bulk aceitar um FILTRO e resolver as linhas no servidor — e aí **um bug no
 * filtro apaga a linha errada**, sem ninguém ter visto a lista. A rota de gravação
 * (`/bulk`) continua recebendo **IDS EXPLÍCITOS, all-or-nothing** (404 `BULK_MISSING_TXS` se
 * um id não é da empresa, 422 `BULK_BLOCKED_BY_EFFECTED` se alguma já foi efetivada). O que
 * esta porta faz é devolver **os ids que o dono VIU no filtro** — ele marca, confere o
 * número e o valor, e o gesto segue sendo por id.
 *
 * ⭐⭐ **E O `amount` VIAJA JUNTO COM O ID, de propósito.** É isso que faz o total da barra
 * ser **o agregado do servidor por construção**, em vez de a soma da página: o cliente
 * acumula `id → amount` conforme as páginas carregam, e "selecionar todas" traz os pares que
 * faltam. ⛔ Sem o valor aqui, a barra teria que somar só o que a página tem — **exatamente
 * o defeito que o item 3 conserta** (medido em prod: a barra escondia 31 contas e
 * R$ 44.533,81).
 *
 * ⛔⛔ **O TETO É O DA ROTA DE GRAVAÇÃO (500), e ele é DITO — nunca elevado em silêncio.** O
 * `bulkActionSchema` é `.max(500)` nas duas ações, e o lote é **atômico**: quebrar 812 ids em
 * dois gestos criaria o estado pela metade que a atomicidade existe pra impedir. Então acima
 * de 500 esta porta devolve as **500 primeiras na ORDEM DA TABELA** e marca `truncado`, com o
 * número do que ficou fora. ⚠️ *Truncar calado é a classe do `take: 50` que escondeu o
 * fermento (16/09)* — aqui a barra DIZ.
 */

/**
 * ⚠️ **O MESMO número do `bulkActionSchema`** (`lib/contas-pagar/bulk-actions.ts`). Ele mora
 * aqui porque esta porta é quem **entrega** os ids; os dois são conferidos por teste — se
 * alguém elevar um e esquecer o outro, a tela ofereceria 800 ids pra uma rota que recusa 500.
 */
export const TETO_DO_LOTE = 500

export interface ParDeSelecao {
  id: string
  amount: number
}

export interface SelecaoDoFiltro {
  /** os pares `{id, amount}` que o dono passa a ter marcados */
  pares: ParDeSelecao[]
  /** quantas contas o filtro tem **de verdade** (o `count`, não o tamanho da página) */
  totalNoFiltro: number
  /** `true` quando o filtro tem mais contas que o teto do lote */
  truncado: boolean
  /** quantas ficaram FORA da seleção por causa do teto — 0 quando não truncou */
  foraDoTeto: number
  teto: number
}

/**
 * ⭐ A régua PURA do recorte — separada da consulta pra ser testável sem banco.
 *
 * ⚠️ `pares` chega **já na ordem da tabela** (quem consulta usa o MESMO `buildPayableOrderBy`
 * da lista): as "500 primeiras" significam as primeiras que o dono veria rolando.
 */
export function recortarSelecao(
  pares: readonly ParDeSelecao[],
  totalNoFiltro: number,
  teto: number = TETO_DO_LOTE,
): SelecaoDoFiltro {
  const cortados = pares.slice(0, teto)
  const truncado = totalNoFiltro > teto
  return {
    pares: [...cortados],
    totalNoFiltro,
    truncado,
    foraDoTeto: truncado ? totalNoFiltro - cortados.length : 0,
    teto,
  }
}

/**
 * ⭐ A frase que a barra mostra quando o teto mordeu — **nunca silêncio**.
 *
 * `null` quando não truncou (frase que aparece sempre vira frase que ninguém lê).
 */
export function avisoDoTeto(s: SelecaoDoFiltro): string | null {
  if (!s.truncado) return null
  return `marquei as ${s.pares.length} primeiras de ${s.totalNoFiltro} — o lote age em até ${s.teto} por vez, e as outras ${s.foraDoTeto} ficam pra um 2º gesto`
}
