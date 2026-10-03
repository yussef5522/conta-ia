/**
 * ⭐⭐⭐ A PORTA ÚNICA DA EXPLOSÃO — ficha → consumo, num lugar só (02/10/2026).
 *
 * **A ordem do dono:** *"toda quebra da produção nasceu de CONTA PARALELA — escala dupla da
 * maionese, round2 zerando dose pequena, a ficha do Combo baixando bebida que o complemento
 * já baixava. N fluxos cada um multiplicando por conta própria = N lugares pra mesma doença
 * renascer. A cura é a mesma da financeira: PORTA ÚNICA + GUARD QUE NUNCA DORME."*
 *
 * ⚠️ **E A VARREDURA ACHOU UM SURFACE MENOR DO QUE O MEDO:** só **duas** funções explodiam
 * receita em consumo (a venda — que produtos E complementos já compartilham desde 02/09 — e
 * a separação de ordem). As outras aparições de `qtdPlanejada` são **custo** (dose × preço de
 * UM lote) ou **conversão de unidade** (o reunitizar), que são outra pergunta. As duas de
 * consumo passam a viver aqui.
 *
 * ═══ ⭐⭐ ESTOCADO × ATRAVESSA — a régua dos líderes, agora DECLARADA ═══
 *
 * É o `Component × Item` do Crunchtime (POS Decrement) e o *phantom BOM blow-through* da
 * manufatura. Cada componente que é FICHA responde **como é consumido**:
 *
 * | | |
 * |---|---|
 * | **ESTOCADO** | a explosão baixa **o próprio item** e **PARA ali**. É o intermediário que a cozinha produz por ORDEM (metade de bolinha, porções, beefs): os insumos dele **já saíram na ordem de produção**, então descer seria **baixa DUPLA**. |
 * | **ATRAVESSA** | *phantom*: agrupamento sem estoque próprio (o invólucro de PRODUTO_FINAL/SABOR, que existe só pra dar nome a uma linha do cardápio). A explosão **desce** aos componentes dele. |
 *
 * ⛔⛔ **A REGRA DE OURO DO MRP VIRA GUARD:** item que **É** estocado (tem ordem, contagem ou
 * saldo) **JAMAIS** pode ser ATRAVESSA — senão a explosão desce num item que tem estoque
 * próprio e o saldo dele fica para sempre num limbo que ninguém baixa.
 * Ver `__tests__/fantasma-nao-tem-estoque.integration.test.ts`.
 *
 * ⚠️ Hoje a resposta é **derivada do TIPO** (o que o `montaNaVenda` já fazia desde 03/09), e
 * isso está certo: `INTERMEDIARIO` é produzido por ordem (estocado) e `PRODUTO_FINAL`/`SABOR`
 * são invólucros de cardápio (phantom). O que muda é a régua ter **NOME e um lugar só**, em
 * vez de viver dentro de um `if` no meio da recursão.
 *
 * ═══ ⛔ SEM ARREDONDAMENTO NO MEIO ═══
 *
 * A conta acumula **exata** e arredonda **uma vez, na borda**. Era `round6` a cada passo da
 * recursão — e arredondamento composto é como a dose de 0,0003 KG de fermento virou 0 (28/09)
 * e como a maionese de 2 casas quebrou o CHECK do ledger (19/09). *O ledger guarda precisão
 * cheia; quem arredonda é a borda.*
 */

/** como um componente-ficha é consumido — a régua do item 1.b, com nome */
export type ComoConsome = 'ESTOCADO' | 'ATRAVESSA'

/**
 * ⭐ Os tipos que são **invólucro de cardápio** (phantom): existem pra nomear o que se VENDE,
 * ninguém os produz por ordem e eles não se contam na prateleira (`seContaFisicamente` já os
 * exclui). Logo a explosão atravessa.
 *
 * ⚠️ `SABOR` entrou em 03/09 por um defeito real: sem ele, um sabor usado como componente
 * baixava o item-invólucro — **que ninguém produz** — e o saldo ficava negativo pra sempre.
 */
const ATRAVESSA_POR_TIPO: readonly string[] = ['PRODUTO_FINAL', 'SABOR']

export function comoConsome(tipoProduto: string): ComoConsome {
  return ATRAVESSA_POR_TIPO.includes(tipoProduto) ? 'ATRAVESSA' : 'ESTOCADO'
}

/**
 * ⭐⭐ A REGRA DE DESCIDA DO FLUXO — e os dois NÃO são a mesma pergunta.
 *
 * - **`VENDA`**: vendeu um produto final → desce pelos invólucros (ATRAVESSA) e **para** no
 *   primeiro item estocado. É o que faz "1 pizza" baixar *a porção pronta*, não a farinha.
 * - **`SEPARACAO`**: a cozinha vai **tirar da câmara** o que a ficha lista. Aqui **nada
 *   desce**: cada componente é retirado como está, porque o gesto é físico. Descer aqui
 *   mandaria a pessoa buscar farinha quando a ficha pede massa pronta.
 *
 * ⚠️ São modos **declarados** de UMA função — não dois motores. A diferença é do GESTO, e
 * escondê-la num `if` dentro de cada fluxo foi como as contas paralelas nasceram.
 */
export type RegraDeDescida = 'VENDA' | 'SEPARACAO'

export interface FichaDoGrafo {
  id: string
  tipoProduto: string
  itemProduzidoId: string
}

/** o grafo que a porta precisa — montado uma vez por request, nunca por item */
export interface GrafoDeFichas {
  componentesByFicha: Map<string, { itemId: string; qtdPlanejada: number }[]>
  fichaByItemProduzido: Map<string, FichaDoGrafo>
}

export interface ConsumoDaExplosao {
  itemId: string
  /** ⚠️ EXATO — sem arredondamento no meio; quem arredonda é a borda de gravação */
  qtd: number
  /** ⭐ por onde a explosão passou pra chegar aqui — o rastro que explica o número */
  viaFichas: string[]
}

/**
 * ⭐⭐ O "NÃO SEI" DA EXPLOSÃO (item 5 do dono): *"componente sem custo, dose que zeraria,
 * sub-ficha sem versão — tudo NOMEADO na saída, nunca engolido."*
 */
export type MotivoDoAviso = 'FICHA_SEM_COMPONENTE' | 'DOSE_ZERO' | 'PROFUNDIDADE'

export interface AvisoDaExplosao {
  motivo: MotivoDoAviso
  itemId?: string
  fichaId?: string
  frase: string
}

export interface ResultadoDaExplosao {
  consumos: ConsumoDaExplosao[]
  /** ⛔ nunca engolido: o que a explosão não soube resolver sai nomeado */
  avisos: AvisoDaExplosao[]
  profundidadeMax: number
}

export interface AlvoDaExplosao {
  /** item direto (revenda/matéria-prima): baixa ele e pronto */
  itemId?: string
  /** ficha: explode pela régua */
  fichaId?: string
}

const TETO_PROFUNDIDADE = 12

/**
 * ⭐⭐⭐ A ÚNICA CONVERSÃO ficha → consumo do módulo.
 *
 * ⚠️ `qtd` é **quantas unidades do alvo** (pizzas vendidas, ou a escala da ordem) — a
 * multiplicação por dose acontece **aqui e em lugar nenhum mais**. O guard estrutural
 * `__tests__/regras-estoque/uma-porta-pra-explosao.test.ts` fica vermelho se alguém
 * multiplicar dose fora desta função.
 */
export function explodirReceita(
  alvo: AlvoDaExplosao,
  qtd: number,
  grafo: GrafoDeFichas,
  regra: RegraDeDescida,
): ResultadoDaExplosao {
  const acc = new Map<string, { qtd: number; via: string[] }>()
  const avisos: AvisoDaExplosao[] = []
  let profundidadeMax = 0

  const soma = (itemId: string, q: number, via: string[]) => {
    const atual = acc.get(itemId)
    // ⛔ acumula EXATO — o arredondamento é da borda, não do meio
    if (atual) { atual.qtd += q; if (atual.via.length > via.length) atual.via = via }
    else acc.set(itemId, { qtd: q, via })
  }

  const descer = (fichaId: string, fator: number, via: string[], prof: number) => {
    profundidadeMax = Math.max(profundidadeMax, prof)
    if (prof > TETO_PROFUNDIDADE) {
      avisos.push({ motivo: 'PROFUNDIDADE', fichaId, frase: `a explosão passou de ${TETO_PROFUNDIDADE} níveis — há ciclo de ficha?` })
      return
    }
    const comps = grafo.componentesByFicha.get(fichaId)
    if (!comps || !comps.length) {
      avisos.push({ motivo: 'FICHA_SEM_COMPONENTE', fichaId, frase: 'esta ficha não tem componente na versão vigente — não baixa nada' })
      return
    }
    for (const c of comps) {
      const q = fator * c.qtdPlanejada
      if (c.qtdPlanejada === 0) {
        avisos.push({ motivo: 'DOSE_ZERO', itemId: c.itemId, fichaId, frase: 'a dose deste componente é zero na ficha — não baixa nada' })
        continue
      }
      const sub = grafo.fichaByItemProduzido.get(c.itemId)
      // ⭐ a régua, num lugar só: na VENDA o phantom atravessa; na SEPARAÇÃO nada desce
      const atravessa = regra === 'VENDA' && sub != null && comoConsome(sub.tipoProduto) === 'ATRAVESSA'
      if (atravessa) descer(sub!.id, q, [...via, sub!.id], prof + 1)
      else soma(c.itemId, q, via)
    }
  }

  if (alvo.itemId) soma(alvo.itemId, qtd, [])
  else if (alvo.fichaId) descer(alvo.fichaId, qtd, [alvo.fichaId], 1)

  return {
    consumos: [...acc].map(([itemId, v]) => ({ itemId, qtd: v.qtd, viaFichas: v.via })),
    avisos,
    profundidadeMax,
  }
}

/**
 * ⭐ A BORDA: o único arredondamento, na saída pra gravação.
 *
 * ⛔ 6 casas porque o ledger guarda 3 e o CHECK dele confere `|custoTotal − qtd×custoUnit| ≤
 * 0,01` — arredondar antes já quebrou a reunitização do pão (27/08) e a conclusão de produção
 * (21/08). ⚠️ E **dose que zeraria não vira 0 calado**: quem grava recebe o aviso.
 */
export const round6 = (n: number) => Math.round((n + Number.EPSILON) * 1e6) / 1e6

/** ⚠️ dose que, arredondada pra gravar, viraria zero — a borda tem que AVISAR, nunca engolir */
export function doseQueZeraria(consumos: ConsumoDaExplosao[]): ConsumoDaExplosao[] {
  return consumos.filter((c) => c.qtd !== 0 && round6(c.qtd) === 0)
}
