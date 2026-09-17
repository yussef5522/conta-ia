// ⭐⭐⭐ O QUE O SELETOR DA LINHA MOSTRA — REGRA PURA, TESTÁVEL (17/09/2026).
//
// **O dono:** *"o painel mostra os 4 grupos certos, mas TODAS as linhas exibem o seletor em
// '— sem categoria —'. O dado está gravado; o value do `<select>` é que não está sendo
// hidratado."*
//
// ⚠️ **Medido, camada por camada, e tudo estava certo**: o payload traz `categoryId` em
// 33/33 (nos dois caminhos, com e sem `?fatura=`), nenhum id ficou fora das opções, e o JS
// **servido** liga `value: W[e.id] ?? e.categoryId ?? ""`. Não reproduzi o defeito.
//
// ⭐ Então o que esta regra faz é o que dá pra fazer com honestidade: **tirar a decisão de
// dentro do JSX**, onde ninguém consegue prová-la. *Regra que mora num `value={...}` é regra
// que ninguém testa* — foi a lição do prefill do cardápio (28/08), que quebrou duas vezes
// antes de virar função.

export interface LinhaComCategoria {
  id: string
  categoryId: string | null
}

/**
 * O valor do `<select>` de uma linha.
 *
 * ⛔ A ORDEM IMPORTA e é a única coisa que esta função decide: o **otimista** (o clique que
 * ainda não voltou do servidor) vence; senão vale o que está **GRAVADO**; e só quando não há
 * nenhum dos dois a linha aparece sem categoria.
 *
 * ⚠️ `??` e não `||`: string vazia é uma escolha ("sem categoria"), não ausência — com `||`
 * o otimista vazio cairia no gravado e a tela voltaria a mostrar o valor antigo.
 */
export function valorDoSeletor(
  otimista: Record<string, string>,
  linha: LinhaComCategoria,
): string {
  return otimista[linha.id] ?? linha.categoryId ?? ''
}

export interface OpcaoDoSeletor {
  id: string
  name: string
}

export interface LinhaComCategoriaNomeada extends LinhaComCategoria {
  categoryName: string | null
}

/**
 * ⭐⭐⭐ AS OPÇÕES DE UMA LINHA — **a categoria salva SEMPRE está entre elas** (17/09/2026).
 *
 * ⛔⛔ **O QUE ISTO TORNA IMPOSSÍVEL:** um `<select>` com `value` que não existe em nenhuma
 * `<option>`. O browser, nesse caso, não mostra nada — ele cai na primeira opção, e a tela
 * afirma *"— sem categoria —"* sobre uma linha categorizada. **Não basta o value bater com
 * o dado: a option tem que EXISTIR** — foi o dono quem separou as duas coisas.
 *
 * ⚠️ Medido no caso dele, as duas fontes de lista JÁ continham os 33 ids — ou seja, isto
 * **não é o conserto de um descasamento que eu vi**. É a garantia de que o widget não
 * depende de a lista estar completa: lista veio curta, veio vazia, veio de outra fonte? A
 * linha continua mostrando a categoria dela.
 *
 * ⚠️ E a extra entra **no fim e só quando falta**, pra não duplicar opção nem mexer na ordem
 * alfabética que o dono já conhece.
 */
export function opcoesDoSeletor(
  lista: OpcaoDoSeletor[],
  linha: LinhaComCategoriaNomeada,
): OpcaoDoSeletor[] {
  if (!linha.categoryId) return lista
  if (lista.some((c) => c.id === linha.categoryId)) return lista
  return [...lista, { id: linha.categoryId, name: linha.categoryName ?? 'categoria salva' }]
}
