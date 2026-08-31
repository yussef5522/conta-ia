// ⭐ QUEBRAR O NOME EM DUAS LINHAS — no modo contar, o nome é a maior coisa da tela.
//
// O nome que vem da nota junta duas coisas: **o que é** e **qual é**. Quem está em pé no
// estoque com o celular na mão precisa ler "CAIXA P/ PIZZA OITAVADA" grande e conferir
// "35x35x4,0 cm" pequeno — não uma linha de 46 caracteres em corpo 14.
//
// ⚠️⚠️ ISTO É HEURÍSTICA SOBRE TEXTO LIVRE, e a regra da casa vale aqui igual: **heurística
// SUGERE, nunca inventa**. Quando não dá pra separar com confiança, devolve o nome INTEIRO
// numa linha só — nome cortado no lugar errado é pior que nome comprido, porque a pessoa
// conta o produto errado. É a mesma disciplina do "a apurar > número inventado".
//
// ⚠️ E É SÓ EXIBIÇÃO. Nada aqui entra em busca, comparação, mapa de fornecedor ou ledger —
// o nome guardado continua inteiro e único.

export interface NomePartido {
  /** o que é — vai grande */
  titulo: string
  /** qual é (medida, gramatura, modelo) — vai pequeno; vazio = não deu pra separar */
  especificacao: string
}

/**
 * ⚠️ O QUE CONTA COMO "ESPECIFICAÇÃO": um pedaço que começa com MEDIDA — número seguido de
 * unidade (cm, mm, ml, L, kg, g), dimensão (35x35x4), gramatura, ou capacidade. Palavra
 * solta NÃO é especificação: "OITAVADA" descreve o produto e tem que ficar no título.
 */
const INICIO_MEDIDA = new RegExp(
  [
    '\\d+[.,]?\\d*\\s*[xX]\\s*\\d',          // 35x35x4,0 · 21X31
    '\\d+[.,]?\\d*\\s*(cm|mm|ml|lt|l|kg|gr|g|un|und)\\b', // 600ML · 2,27 KG · 200GR
    '\\d+[.,]?\\d*\\s*(litros?|gramas?|metros?)\\b',
  ].join('|'),
  'i',
)

/** pedaços curtos demais não valem uma 2ª linha — viram ruído visual */
const MIN_TITULO = 3

/**
 * ⛔⛔ O TÍTULO PRECISA SER UM NOME, NÃO UM CÓDIGO — pego rodando a função contra os 91
 * nomes reais da Caçula. Dois casos saíam INVERTIDOS, com o código na linha grande e o
 * produto na pequena:
 *     "0000903482"  |  "CERV HEINEKEN PIL 0.60GFA RT 24UN"
 *     "F635"        |  "30,5X30Embalagem para Pizza Congelados…"
 * Isso é pior que não separar: quem está no estoque leria "0000903482" em corpo grande e
 * teria que caçar o produto na linha de baixo. Quando o título não tem nenhuma palavra de
 * verdade, a função DESISTE e devolve o nome inteiro — heurística sugere, nunca inventa.
 */
const TEM_PALAVRA = /[A-Za-zÀ-ÿ]{3,}/

export function partirNome(nome: string): NomePartido {
  const limpo = (nome ?? '').trim().replace(/\s+/g, ' ')
  if (!limpo) return { titulo: '', especificacao: '' }

  // 1) separador EXPLÍCITO do fornecedor ("NOME - 35x35") — só vale se o que vem depois
  //    parece medida; senão " - " pode estar separando duas partes do próprio nome.
  const traco = limpo.match(/^(.{3,}?)\s+[-–—]\s+(.+)$/)
  if (traco && INICIO_MEDIDA.test(traco[2]) && TEM_PALAVRA.test(traco[1])) {
    return { titulo: traco[1].trim(), especificacao: traco[2].trim() }
  }

  // 2) a primeira MEDIDA do texto abre a especificação
  const m = INICIO_MEDIDA.exec(limpo)
  if (m && m.index >= MIN_TITULO) {
    const titulo = limpo.slice(0, m.index).trim().replace(/[-–—,]$/, '').trim()
    const especificacao = limpo.slice(m.index).trim()
    // ⚠️ título curto demais = a medida está no COMEÇO do nome ("500ML COPO"): separar
    // aí deixaria o título sem sentido. E título SEM PALAVRA é código (ver acima).
    if (titulo.length >= MIN_TITULO && TEM_PALAVRA.test(titulo)) return { titulo, especificacao }
  }

  // 3) não deu pra separar com confiança → nome INTEIRO, numa linha só
  return { titulo: limpo, especificacao: '' }
}
