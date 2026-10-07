/**
 * ⭐⭐⭐ A SOBRA POR PRODUTO — o insumo de TODA a tela "Quem paga a casa" (07/10/2026).
 *
 * ⛔⛔ **ZERO CONTA NOVA, e isso é o que mantém a tela honesta.** Preço, custo e margem vêm
 * do `hubCardapio` — que por sua vez tira o custo da **MESMA explosão que a venda usa pra
 * baixar** (`explodirReceita`, qtd=1) e o preço do **PDV**. Uma fórmula própria aqui
 * divergiria no 1º caso de borda (componente que é outro produto final, intermediário que
 * baixa o pack) e a casa mostraria tijolo sobre um custo que não acontece no ledger.
 *
 * ⭐ O que nasce aqui é UMA subtração e UMA multiplicação:
 * ```
 * sobra/un   = preço − custo        (o que cada venda deixa)
 * sobra TOTAL = sobra/un × unidades  (o tamanho do tijolo)
 * ```
 *
 * ⛔⛔ **E A CASCATA "A APURAR" É LEI:** produto sem preço OU sem custo **não tem sobra** —
 * ele sai da obra, NOMEADO, nunca com custo inventado. O `custoUnitario` do hub já é `null`
 * quando QUALQUER folha falta custo (*"a definir" nunca vira 0,01*), e o `custoParcial` dele
 * é o que a tela mostra ao lado do que falta. **Jamais usar o parcial como se fosse o custo**
 * — seria inflar a sobra com um custo que se sabe incompleto.
 *
 * ⚠️ Função PURA: recebe as linhas do hub, não vai ao banco. É o que permite o guard provar
 * `Σ(tijolos) == sobra total == Σ da liga` sem subir Postgres.
 */

/** o que a sobra precisa saber de cada linha do cardápio — o subconjunto do `LinhaCardapio` */
export interface LinhaParaSobra {
  chave: string
  nome: string
  status: string
  vendasQtd: number
  vendasValor: number
  precoUsado: number | null
  precoOrigem: 'praticado' | 'cardapio' | null
  custoUnitario: number | null
  custoParcial: number
  componentesSemCusto: number
}

export interface ProdutoComSobra {
  chave: string
  nome: string
  unidades: number
  preco: number
  precoOrigem: 'praticado' | 'cardapio' | null
  custo: number
  /** preço − custo */
  sobraUn: number
  /** sobra/un × unidades — **é a área do tijolo** */
  sobraTotal: number
  /** (preço − custo) ÷ preço */
  margemPct: number
}

/**
 * ⭐ O produto que VENDEU e não tem sobra calculável. Ele **não entra na casa** — fica no
 * banquinho 🪑 ao lado, ordenado por vendas, com o motivo. ⛔ Esconder seria pior que
 * mostrar: é justamente a fila de trabalho do dono.
 */
export interface ProdutoForaDaObra {
  chave: string
  nome: string
  unidades: number
  vendasValor: number
  /** por que não dá pra calcular — a frase vai na tela */
  porque: string
  /** o que JÁ se sabe do custo (o parcial do hub), pra a linha não ficar muda */
  custoParcial: number | null
  componentesSemCusto: number
}

export interface Sobras {
  dentro: ProdutoComSobra[]
  fora: ProdutoForaDaObra[]
  /** Σ das sobras totais — **o número que a casa e a liga têm que reproduzir** */
  sobraTotal: number
  /**
   * ⭐⭐ A COBERTURA — e ela é por VENDA, nunca por nº de produtos.
   *
   * ⛔ Medido em prod (07/10): **54 de 214 produtos** têm custo, mas esses 54 são os de maior
   * giro. Contar PRODUTO daria 25% e assustaria sem razão; contar **unidades vendidas** diz o
   * que importa — *"quanto do que eu vendi tem custo conhecido"*. É esse número que destrava
   * (ou não) o placar do dia D.
   */
  cobertura: {
    unidadesDentro: number
    unidadesFora: number
    pct: number | null
    produtosDentro: number
    produtosFora: number
  }
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/**
 * ⚠️ A frase do "fora da obra" distingue os casos, porque cada um pede um gesto DIFERENTE:
 * sem destino → mapear; ficha incompleta → dar custo ao insumo; sem preço → o PDV não
 * registrou valor. *Mensagem que acusa o campo errado faz o dono caçar um erro que não
 * existe* (a lição de 16/09).
 */
function porqueForaDaObra(l: LinhaParaSobra): string {
  if (l.status === 'SEM_DESTINO') return 'ninguém disse o que este produto é — aponte a ficha ou a revenda'
  if (l.status === 'SEM_FICHA') return 'a ficha que este produto apontava foi desativada ou sumiu'
  if (l.componentesSemCusto > 0)
    return `${l.componentesSemCusto} insumo${l.componentesSemCusto > 1 ? 's' : ''} da receita ainda sem custo — a 1ª nota ensina`
  if (l.custoUnitario == null) return 'a receita ainda não tem componente nenhum'
  return 'o PDV não registrou valor de venda, então não dá pra saber a sobra'
}

/**
 * ⭐ A PORTA ÚNICA: linhas do hub → sobras. Todo bloco da tela (linha de chegada, casa, liga,
 * ficha) parte DAQUI — se cada um partisse do hub por conta própria, bastaria um deles tratar
 * o `custoParcial` diferente pra a casa e a liga discordarem do mesmo período.
 */
export function sobrasDoPeriodo(linhas: readonly LinhaParaSobra[]): Sobras {
  const dentro: ProdutoComSobra[] = []
  const fora: ProdutoForaDaObra[] = []

  for (const l of linhas) {
    // ⛔ produto que não vendeu no período não é tijolo nem banquinho: ele não participa
    if (l.vendasQtd <= 0) continue

    if (l.precoUsado == null || l.precoUsado <= 0 || l.custoUnitario == null) {
      fora.push({
        chave: l.chave,
        nome: l.nome,
        unidades: l.vendasQtd,
        vendasValor: round2(l.vendasValor),
        porque: porqueForaDaObra(l),
        custoParcial: l.custoParcial > 0 ? round2(l.custoParcial) : null,
        componentesSemCusto: l.componentesSemCusto,
      })
      continue
    }

    const sobraUn = round2(l.precoUsado - l.custoUnitario)
    dentro.push({
      chave: l.chave,
      nome: l.nome,
      unidades: l.vendasQtd,
      preco: round2(l.precoUsado),
      precoOrigem: l.precoOrigem,
      custo: round2(l.custoUnitario),
      sobraUn,
      sobraTotal: round2(sobraUn * l.vendasQtd),
      margemPct: (l.precoUsado - l.custoUnitario) / l.precoUsado,
    })
  }

  // ⭐ ordem de CONTRIBUIÇÃO — é ela que empilha o tijolo maior na fundação
  dentro.sort((a, b) => b.sobraTotal - a.sobraTotal)
  fora.sort((a, b) => b.unidades - a.unidades)

  const unidadesDentro = dentro.reduce((s, p) => s + p.unidades, 0)
  const unidadesFora = fora.reduce((s, p) => s + p.unidades, 0)
  const totalUn = unidadesDentro + unidadesFora

  return {
    dentro,
    fora,
    sobraTotal: round2(dentro.reduce((s, p) => s + p.sobraTotal, 0)),
    cobertura: {
      unidadesDentro,
      unidadesFora,
      // ⚠️ sem venda nenhuma a cobertura é `null`, NUNCA 0% — ausência não é zero
      pct: totalUn > 0 ? unidadesDentro / totalUn : null,
      produtosDentro: dentro.length,
      produtosFora: fora.length,
    },
  }
}

/**
 * ⭐⭐ A MEDIANA, nunca a média — e o motivo é o mesmo do M2 (02/10) e da sugestão de mínimo:
 * **com média o desviante puxa a própria referência e se esconde**. A PIZZA GRANDE PRECINHO
 * sozinha (R$ 45.297,68 de sobra, 21% do total) levantaria a média acima de quase todo o
 * cardápio, e o selo ⭐ nunca acenderia pra mais ninguém.
 *
 * ⚠️ Mediana de lista vazia é `null` — não existe corte sem população (e aí nenhum selo sai).
 */
export function medianaDe(valores: readonly number[]): number | null {
  if (valores.length === 0) return null
  const v = [...valores].sort((a, b) => a - b)
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}
