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

/**
 * ⛔⛔ TERMO **TRANSFORMADO** QUE ESVAZIA É FILTRO QUE NÃO FILTRA (31/08/2026).
 *
 * CASO REAL, na busca de Recebimentos:
 *     `(l.cnpj ?? '').includes(q.replace(/\D/g, ''))`
 * Buscar por LETRAS faz o `replace` devolver `''`, e **`includes('')` é sempre true** —
 * então a cláusula do CNPJ ficava verdadeira pra TODA linha e a busca por fornecedor
 * mostrava a lista inteira, sem filtrar nada.
 *
 * ⚠️ A RÉGUA QUE SEPARA O BUG DO COMPORTAMENTO CERTO: termo **cru** vazio significa "sem
 * filtro" e devolver tudo é o esperado (é o que `casaBusca` faz de propósito). O defeito
 * aparece quando o termo é **transformado** e a transformação pode esvaziá-lo — aí "vazio"
 * deixa de significar "não digitei" e passa a significar "casa com tudo".
 *
 * ⭐ Por isso a comparação por DÍGITOS mora aqui, com a guarda embutida: sem dígito no
 * termo, ela simplesmente não opina. Varredura de 31/08: era a ÚNICA ocorrência da classe
 * no código (os outros 8 `includes` usam o termo cru, com guarda de `busca.trim()`).
 */
export function casaDigitos(alvo: string | null | undefined, termo: string): boolean {
  const d = (termo ?? '').replace(/\D/g, '')
  if (d === '') return false // ⛔ termo sem dígito NÃO casa — nunca "casa com tudo"
  return (alvo ?? '').replace(/\D/g, '').includes(d)
}

/** Filtra uma lista pelo termo, usando o campo que `extrair` apontar. */
export function filtrarPorBusca<T>(itens: T[], termo: string, extrair: (i: T) => string): T[] {
  const t = normalizarBusca(termo)
  if (t === '') return itens
  return itens.filter((i) => casaBusca(extrair(i), termo))
}
