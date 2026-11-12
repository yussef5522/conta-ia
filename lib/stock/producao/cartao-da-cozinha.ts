// ⭐⭐ O ALVO DO CARTÃO DA COZINHA (lei v7 M1, docs/producao-referencia.html, 12/11/2026).
//
// "100 UN · 2 receitas" — no cartão da lista E na tela do cronômetro. As UNIDADES vêm prontas do
// servidor (`MinhaTarefa.unidades`, pela porta `pedidoDaOrdem`); aqui só se ESCREVE. PURA, testada.
// ⛔ A cozinha não vê dinheiro nenhum: nada aqui recebe custo.

import { fmtPedido } from './pedido-na-tela'

export function textoDasReceitas(escala: number): string {
  const n = Number.isInteger(escala) ? String(escala) : String(escala).replace('.', ',')
  return `${n} ${escala === 1 ? 'receita' : 'receitas'}`
}

/** `{ unidades: "100 UN", receitas: "2 receitas" }` — `unidades` null quando não dá pra dizer (nunca "0 UN") */
export function alvoDoCartao(t: { unidades: number | null; unidadeProduto: string; escalaReceitas: number }): { unidades: string | null; receitas: string } {
  const n = t.unidades != null && t.unidades > 0 ? fmtPedido(t.unidades, t.unidadeProduto || 'UN') : null
  return { unidades: n ? `${n} ${t.unidadeProduto || 'UN'}` : null, receitas: textoDasReceitas(t.escalaReceitas) }
}
