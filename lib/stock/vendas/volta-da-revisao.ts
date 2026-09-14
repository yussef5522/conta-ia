// ⭐⭐⭐ IDA COM VOLTA — O COMBO VAI AO EDITOR E VOLTA PRA REVISÃO (14/09/2026).
//
// **O dono:** *"CRIAR FICHA COMPOSTA (os 4 combos lata+fritas) pode continuar indo ao editor
// completo do cardápio — receita de verdade precisa do editor — MAS com VOLTA: nasce a ficha
// → volto pra revisão NO MESMO dia/scroll, com a linha já vinculada. **Ida com volta não é
// expulsão.**"*
//
// ⛔ **A REGRA MORA AQUI, NUNCA NO COMPONENTE.** O projeto roda em `environment: node`, sem
// jsdom — regra dentro de um `useState`/JSX é regra que ninguém consegue provar, e foi
// exatamente isso que deixou o prefill do cardápio quebrar duas vezes (28/08).
//
// ⚠️ E o `voltar` do editor só aceita **caminho interno** (`ehCaminhoInterno`, 03/09): estas
// funções produzem caminho relativo por construção, nunca URL absoluta.

export type RelatorioDeVenda = 'PRODUTOS' | 'COMPLEMENTOS'

/** a aba da tela de Vendas onde a revisão daquele relatório mora */
export function abaDoRelatorio(relatorio: RelatorioDeVenda): 'processados' | 'complementos' {
  return relatorio === 'COMPLEMENTOS' ? 'complementos' : 'processados'
}

/**
 * ⭐ A âncora da LINHA. Sem ela a volta cai no topo de uma lista de 130 nomes e o dono
 * procura de novo o que acabou de resolver — que é meia expulsão.
 *
 * ⚠️ Slug conservador de propósito: só `[a-z0-9-]`. Nome do PDV tem acento, barra e
 * parêntese, e um `id` de HTML com esses caracteres quebra o `querySelector`.
 */
export function ancoraDaLinha(nome: string): string {
  const s = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `rev-${s || 'linha'}`
}

/**
 * A URL que REABRE a revisão daquele dia — com a linha no alvo quando o nome vem.
 *
 * ⚠️ É a mesma URL que a tela de Vendas lê no 1º render (`?revisar=`), como ela já fazia
 * com `?aba=`. Ler em `useEffect` faria a tela PISCAR na aba errada antes de trocar.
 */
export function urlDaRevisao(empresaId: string, relatorio: RelatorioDeVenda, data: string | null, nome?: string): string {
  const vendas = `/empresas/${empresaId}/estoque/vendas`
  // ⚠️ SEM DIA não existe revisão pra reabrir (é o caso da tela de produtos ANTES de o dono
  // escolher a data). A volta é a própria tela de Vendas — nunca uma URL com `revisar=`
  // vazia, que abriria o painel de um dia que não existe.
  if (!data) return `${vendas}?aba=importar`
  const base = `${vendas}?aba=${abaDoRelatorio(relatorio)}&revisar=${encodeURIComponent(data)}&relatorio=${relatorio}`
  return nome ? `${base}#${ancoraDaLinha(nome)}` : base
}

/**
 * O editor completo, já sabendo (a) o nome do PDV, (b) em qual mapa vincular e (c) **pra
 * onde voltar**.
 *
 * ⚠️ `mapear=` é o mapa de PRODUTOS e `complemento=` o de COMPLEMENTOS — são **dois mapas
 * desde 02/09**, porque 25 nomes vivem nos dois relatórios e um mapa só faria cada um baixar
 * duas vezes. Mandar o parâmetro errado vincularia no mapa errado em silêncio.
 */
export function hrefDoEditor(empresaId: string, relatorio: RelatorioDeVenda, data: string | null, nome: string): string {
  const comp = relatorio === 'COMPLEMENTOS'
  const q = new URLSearchParams()
  q.set('nome', nome)
  q.set(comp ? 'complemento' : 'mapear', nome)
  q.set('tipo', comp ? 'SABOR' : 'PRODUTO_FINAL')
  q.set('voltar', urlDaRevisao(empresaId, relatorio, data, nome))
  return `/empresas/${empresaId}/estoque/fichas/nova?${q.toString()}`
}
