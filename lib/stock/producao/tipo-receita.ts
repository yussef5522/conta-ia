// ⭐ O QUE É "RECEITA DE PRODUÇÃO" — uma régua só (01/09/2026).
//
// ⛔ BUG QUE CRIOU ESTE ARQUIVO: a busca de "nova ordem de produção" listava **XIS COMPLETO
// e PIZZA PEQUENA 25CM** — fichas de PRODUTO_FINAL criadas pelo cardápio. Produto de venda
// é **montado na hora do pedido**, não produzido em lote: criar ordem de produção pra um xis
// não significa nada, e a separação explodiria os componentes dele na câmara.
//
// ⚠️ E ia piorar rápido: o dono vai fichar os **~77 produtos do cardápio**. A busca de ordem
// ficaria inutilizável — 77 itens que nunca deveriam estar ali afogando os 8 que deveriam.
//
// ⚠️ A REGRA JÁ EXISTIA, MAS COMO LITERAL NA TELA: `/producao/receitas` fazia
// `.filter((f) => f.tipoProduto === 'INTERMEDIARIO')` dentro do componente, e o `NovaOrdem`
// simplesmente não filtrava. Duas telas, a mesma pergunta, uma resposta só implementada.
// Aqui é a resposta; as duas passam a chamá-la.

/** o tipo de ficha que se PRODUZ em lote (o resto é montado na venda) */
export const TIPO_RECEITA_PRODUCAO = 'INTERMEDIARIO' as const

/**
 * PURA. Esta ficha pode virar ordem de produção?
 *
 * ⚠️ `PRODUTO_FINAL` **não** — é montado na venda, e quem o "produz" é a baixa por venda
 * explodindo a ficha. Ver `lib/stock/vendas/baixa-venda.ts`.
 *
 * ⛔⛔ E **ARQUIVADA também não** — isto quase virou teste-ficção (01/09): eu escrevi o
 * guard "ficha arquivada não aparece na busca" e ele passou VERDE, mas nenhuma das duas
 * telas filtrava por `ativo` (`listFichas` devolve as inativas e as telas só olhavam o
 * tipo). O teste estava certo e a TELA errada; a arquivada continuaria aparecendo.
 * A régua entra AQUI pra as duas herdarem — em vez de dois `.filter(f => f.ativo)`
 * espalhados que a próxima tela esqueceria de novo.
 *
 * ⚠️ `ativo` opcional pra retrocompat: quem não informa é tratado como ATIVO (era o
 * comportamento até agora, e mudar isso em silêncio esconderia fichas boas).
 */
export function ehReceitaDeProducao(f: { tipoProduto: string; ativo?: boolean }): boolean {
  if (f.ativo === false) return false
  return f.tipoProduto === TIPO_RECEITA_PRODUCAO
}
