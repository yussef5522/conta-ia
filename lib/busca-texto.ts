// BUSCA POR TEXTO — normalização única do sistema (28/08).
//
// ⚠️ O BUG QUE PEDIU ISTO: o dono não achava o "PAO DE XIS" na busca de ingredientes.
// "xis" → nada · "pao" → nada · e o item aparecia rolando a lista completa.
//
// ⭐ A CAUSA, provada contra prod: `contains` do Prisma é **case-SENSITIVE no PostgreSQL** e
// **case-INSENSITIVE no SQLite**. Medido no banco real:
//     contains("xis") → 0      contains("XIS") → 1  ("PAO DE XIS")
//     contains("pao") → 0      contains("PAO") → 1
// Funcionava em DEV e falhava CALADO em PROD — a pior classe: o dev nunca vê.
//
// ⚠️ E `mode: 'insensitive'` NÃO BASTA: ele resolve caixa, não ACENTO. Medido também:
//     insensitive("pao") → acha "PAO DE XIS" mas NÃO acha "Pão tradicional"
// Num catálogo onde o mesmo produto vem escrito "PAO" pela nota e "Pão" pelo dono, buscar
// por um jeito e não achar o outro é o mesmo bug com outra cara.
//
// ⭐ POR ISSO O FILTRO É NO APP, sobre a MESMA lista que a tela renderiza (REGRA 4): filtro
// e lista deixam de poder discordar, e o acento se resolve sem depender de extensão do
// Postgres (`unaccent`) nem de coluna normalizada — que o isolamento do estoque proibiria
// (migrations de stock_ são CREATE-only).

/** minúsculas + sem acento + espaços colapsados. "Pão  Fatiado" → "pao fatiado" */
export function normalizarBusca(s: string): string {
  return (s ?? '')
    .normalize('NFD') // separa a letra do acento
    .replace(/[̀-ͯ]/g, '') // remove os acentos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * O termo casa com o texto? Normalizado dos dois lados, e por PALAVRA: todas as palavras
 * do termo precisam aparecer, em qualquer ordem.
 *
 * ⚠️ O "qualquer ordem" é de propósito: "xis pao" acha "PAO DE XIS". Exigir a frase inteira
 * na ordem obrigaria o dono a lembrar como o fornecedor escreveu o nome — e o nome vem da
 * nota, não dele.
 */
export function casaBusca(texto: string, termo: string): boolean {
  const t = normalizarBusca(termo)
  if (t === '') return true // busca vazia mostra tudo
  const alvo = normalizarBusca(texto)
  return t.split(' ').every((palavra) => alvo.includes(palavra))
}

/** Filtra uma lista pelo termo, usando o campo que `extrair` apontar. */
export function filtrarPorBusca<T>(itens: T[], termo: string, extrair: (i: T) => string): T[] {
  const t = normalizarBusca(termo)
  if (t === '') return itens
  return itens.filter((i) => casaBusca(extrair(i), termo))
}
