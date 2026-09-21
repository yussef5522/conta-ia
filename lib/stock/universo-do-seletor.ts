// ⭐⭐⭐ CADA GESTO TEM SEU UNIVERSO DE SELETOR (16/09/2026) — régua do dono.
//
// **O defeito que a criou:** na **entrada manual** (a compra do fermento sem nota) o
// seletor listava *"coisa de CARDÁPIO (fichas) e coisa de PRODUÇÃO"* e o dono **não
// achava os itens da Posição**. A causa: a rota `/estoque/itens` **sem parâmetro** devolve
// `{ companyId, ativo: true }` — **TUDO**, incluindo os invólucros de `SABOR` e
// `PRODUTO_FINAL` que existem só pra dar nome a uma linha do cardápio.
//
// ⛔⛔ **A RÉGUA:** *"compra NUNCA aponta pra ficha de cardápio nem pra tarefa de
// produção"*. Cada seletor com o WHERE do seu gesto — e **o universo é contrato
// obrigatório**: chamador que não declara **não compila**.
//
// ⚠️⚠️ **E A VARREDURA ACHOU QUE NÃO É UM UNIVERSO SÓ — SÃO DOIS.** O dono listou, pra
// compra, *"matéria-prima, insumo, revenda, embalagem"* — **sem intermediário**, e está
// certo: ninguém COMPRA "porção de carne 100g", ela se PRODUZ. Mas ela **se conta** (está
// na câmara) e **se perde** (cai no chão). Tratar os dois como o mesmo universo poria
// porção na lista de compra ou tiraria porção da contagem — os dois errados.

/** as categorias que o módulo conhece */
export const CAT = {
  MATERIA_PRIMA: 'MATERIA_PRIMA',
  REVENDA: 'REVENDA',
  EMBALAGEM: 'EMBALAGEM',
  LIMPEZA: 'LIMPEZA',
  USO_INTERNO: 'USO_INTERNO',
  INTERMEDIARIO: 'INTERMEDIARIO',
  /** ⚠️ invólucros de CARDÁPIO — existem só pra nomear a linha do menu */
  PRODUTO_FINAL: 'PRODUTO_FINAL',
  SABOR: 'SABOR',
} as const

/**
 * ⭐⭐ OS UNIVERSOS. Cada um é um GESTO, não uma "lista de categorias" — o nome diz a
 * pergunta que o dono está fazendo quando abre aquele seletor.
 */
export type UniversoDoSeletor =
  /** ⭐ **COMPRA** (entrada manual, conferência de nota): o que ENTRA por compra. */
  | 'COMPRAVEL'
  /** ⭐ **PRATELEIRA** (contagem, saída/perda): o que EXISTE fisicamente e se conta. */
  | 'PRATELEIRA'
  /** ⭐ **RECEITA** (componente de ficha): o que pode ser ingrediente. */
  | 'RECEITA'
  /** ⭐ **VENDÁVEL** (mapa do PDV): o que o cliente compra — fichas e revenda. */
  | 'VENDAVEL'
  /**
   * ⭐ **REVENDA** (a watchlist 🥤 do Radar, 21/09): o que entra pronto e sai pronto.
   *
   * ⛔ **Lista de UM item de propósito, e ela NÃO é "COMPRAVEL menos coisas".** O dono
   * separou a seção justamente porque *"os caros hoje mistura matéria-prima com bebida
   * (COCA COLA 600ML no meio do queijo)"* — oferecer queijo aqui recriaria a mistura que
   * a seção nasceu pra desfazer. Universo se escreve item a item (a lição do LIMPEZA que
   * vazou pra RECEITA em 16/09 por ter sido derivado de outro).
   */
  | 'REVENDA'
  /** ⚠️ **CATALOGO**: a lista administrativa, que mostra TUDO de propósito. */
  | 'CATALOGO'

const COMPRAVEL = [CAT.MATERIA_PRIMA, CAT.REVENDA, CAT.EMBALAGEM, CAT.LIMPEZA, CAT.USO_INTERNO]

/**
 * ⛔ **PRATELEIRA ⊃ COMPRÁVEL**, e a diferença é o INTERMEDIARIO.
 *
 * ⚠️ Ela espelha `seContaFisicamente` (o dono único da pergunta *"isto ocupa espaço na
 * câmara?"*, de 03/09) — **de propósito por LISTA e não por chamada**: aqui a pergunta é
 * feita pro banco, num `where`, e a função pura não atravessa a query. **Há teste que
 * roda as duas e exige que concordem**, senão a divergência nasceria no primeiro tipo novo.
 */
const PRATELEIRA = [...COMPRAVEL, CAT.INTERMEDIARIO]

/**
 * ⭐ O QUE PODE SER INGREDIENTE — **lista própria, NÃO derivada de COMPRAVEL**.
 *
 * ⚠️⚠️ A 1ª versão fazia `[...COMPRAVEL, INTERMEDIARIO]` por conveniência e arrastou
 * **LIMPEZA** junto — quebrando a régua de 27/08 (*"o editor de ficha estava oferecendo
 * DESENGRAXANTE, SACO DE LIXO e JAPONA DE CÂMARA como ingrediente de lanche"*). **O teste
 * por gesto pegou.** Universo se escreve item a item; derivar um do outro é como a régua
 * de um gesto vaza pro outro.
 *
 * ⭐ `PRODUTO_FINAL` entra de propósito: o **Combo leva o Xis** — a recursão de 3 níveis
 * provada em 22/08. E `EMBALAGEM` entra desde 01/09: **toda pizza sai com caixa**, e ela
 * custa; sem ela na ficha o CMV mente pra baixo.
 *
 * ⛔ `LIMPEZA` e `USO_INTERNO` ficam de fora: pano de chão não vai em receita.
 */
const RECEITA = [CAT.MATERIA_PRIMA, CAT.INTERMEDIARIO, CAT.PRODUTO_FINAL, CAT.REVENDA, CAT.EMBALAGEM]

/** ⚠️ o vendável é o inverso: invólucro de cardápio + revenda (a bebida) */
const VENDAVEL = [CAT.PRODUTO_FINAL, CAT.SABOR, CAT.REVENDA]

/** ⭐ só bebida e revenda — ver a razão no tipo acima */
const REVENDA = [CAT.REVENDA]

const CATEGORIAS: Record<UniversoDoSeletor, readonly string[] | null> = {
  COMPRAVEL,
  PRATELEIRA,
  RECEITA,
  VENDAVEL,
  REVENDA,
  // ⚠️ `null` = sem filtro. É o ÚNICO universo que mostra tudo, e o nome diz isso.
  CATALOGO: null,
}

/** ⭐ o `where` do gesto — é isto que a rota aplica */
export function categoriasDoUniverso(u: UniversoDoSeletor): readonly string[] | null {
  return CATEGORIAS[u]
}

/**
 * ⭐ A ORDEM DENTRO DO UNIVERSO — o que o dono procura primeiro aparece primeiro.
 * ⚠️ Na COMPRA, matéria-prima na frente: é o que mais entra por nota.
 */
export function pesoDaCategoria(u: UniversoDoSeletor, categoria: string): number {
  if (u === 'COMPRAVEL' || u === 'PRATELEIRA') {
    const ordem = [CAT.MATERIA_PRIMA, CAT.REVENDA, CAT.EMBALAGEM, CAT.INTERMEDIARIO, CAT.LIMPEZA, CAT.USO_INTERNO]
    const i = ordem.indexOf(categoria as never)
    return i === -1 ? 99 : i
  }
  if (u === 'RECEITA') {
    const ordem = [CAT.INTERMEDIARIO, CAT.MATERIA_PRIMA, CAT.REVENDA, CAT.EMBALAGEM]
    const i = ordem.indexOf(categoria as never)
    return i === -1 ? 99 : i
  }
  return 0
}

export function ehUniversoValido(v: string): v is UniversoDoSeletor {
  return v in CATEGORIAS
}

/**
 * ⭐ A FRASE DO VAZIO — ela DIZ qual universo está sendo mostrado.
 *
 * ⛔ *"Nenhum item encontrado"* faz o dono achar que o item não existe, quando ele só não
 * pertence àquele gesto. **Vazio que não diz o recorte é a ausência fingindo verdade.**
 */
export function fraseDoVazio(u: UniversoDoSeletor, busca: string): string {
  const alvo: Record<UniversoDoSeletor, string> = {
    COMPRAVEL: 'itens que se COMPRAM (matéria-prima, revenda, embalagem, limpeza)',
    PRATELEIRA: 'itens que existem na prateleira (inclui as porções produzidas)',
    RECEITA: 'itens que podem ser ingrediente',
    VENDAVEL: 'produtos do cardápio e itens de revenda',
    REVENDA: 'itens de REVENDA (bebida e o que entra pronto)',
    CATALOGO: 'itens do catálogo',
  }
  return `Nada com "${busca}" entre os ${alvo[u]}.`
}
