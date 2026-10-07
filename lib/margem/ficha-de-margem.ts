/**
 * ⭐⭐ A FICHA DE MARGEM POR PRODUTO (07/10/2026).
 *
 * ```
 * preço (PDV)  −  INSUMOS  −  EMBALAGEM  −  TAXA DO CANAL  =  SOBRA R$ e %
 * ```
 *
 * ⛔⛔ **ZERO CONTA NOVA:** as folhas vêm do `explodirReceita` (a MESMA explosão que a venda
 * usa pra baixar) e o custo de cada uma do **custo médio do ledger**. O que nasce aqui é a
 * SEPARAÇÃO visual — e ela não é estética: *"ó, a caixa da pizza custa mais que o queijo"* é
 * uma decisão de compra, e com insumo e embalagem somados num número só ela não aparece.
 *
 * ⭐⭐ **A EMBALAGEM NÃO É ENTIDADE NOVA — ela JÁ ESTÁ DECLARADA.** Medido em prod (07/10):
 * **28 itens** com `categoria='EMBALAGEM'` e **40 componentes de ficha** apontando pra eles
 * (a `CAIXA P/ PIZZA 35 cm` está na base da grande desde sempre). Criar uma tabela de
 * embalagem seria a **segunda** fonte do mesmo fato; o que faltava era a tela **separar**.
 *
 * ⚠️ Função PURA.
 */

export type CategoriaDaFolha = string

export interface FolhaDoCusto {
  itemId: string
  nome: string
  categoria: CategoriaDaFolha
  /** quanto sai do estoque por 1 unidade vendida */
  qtd: number
  unidade: string
  /** custo médio do ledger. `null` = insumo sem custo → a ficha fica "a apurar" */
  custoUnitario: number | null
}

export interface LinhaDoCusto {
  itemId: string
  nome: string
  qtd: number
  unidade: string
  custoUnitario: number | null
  /** qtd × custo. `null` quando o insumo não tem custo */
  subtotal: number | null
}

export interface CanalNaFicha {
  id: string
  nome: string
  /** fração (0.12 = 12%). `null` = o dono ainda não declarou → "a declarar", nunca 0% */
  taxaPct: number | null
  /** preço × taxa */
  taxa: number | null
  /** preço − custo − taxa */
  sobra: number | null
  margemPct: number | null
  /** ⭐ quantas unidades por DIA pagam a casa, NESTE canal */
  quantosPagamACasa: number | null
}

export interface FichaDeMargem {
  chave: string
  nome: string
  preco: number | null
  precoOrigem: 'praticado' | 'cardapio' | null
  /** ⭐ as DUAS listas separadas — é o ponto da tela */
  insumos: LinhaDoCusto[]
  embalagem: LinhaDoCusto[]
  custoInsumos: number | null
  custoEmbalagem: number | null
  custoTotal: number | null
  /** quantos insumos ainda não têm custo — o que torna o total `null` */
  semCusto: number
  /** o que JÁ se sabe somar (nunca usado como se fosse o total) */
  parcial: number
  sobra: number | null
  margemPct: number | null
  /** ⭐ "QUANTOS PAGAM A CASA: N/dia" — no canal sem taxa (balcão) */
  quantosPagamACasa: number | null
  canais: CanalNaFicha[]
  /** a frase quando não dá pra calcular — nunca um número inventado */
  porque: string | null
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/** ⚠️ a lista é FECHADA e mora aqui: "é embalagem?" tem uma resposta só no sistema */
const CATEGORIAS_DE_EMBALAGEM = new Set(['EMBALAGEM'])

export function ehEmbalagem(categoria: string): boolean {
  return CATEGORIAS_DE_EMBALAGEM.has(categoria.toUpperCase())
}

export function montarFichaDeMargem(opts: {
  chave: string
  nome: string
  preco: number | null
  precoOrigem: 'praticado' | 'cardapio' | null
  folhas: readonly FolhaDoCusto[]
  canais: readonly { id: string; nome: string; taxaPct: number | null }[]
  /** o custo fixo de UM dia aberto — alimenta o "quantos pagam a casa" */
  casaDoDia: number | null
}): FichaDeMargem {
  const linha = (f: FolhaDoCusto): LinhaDoCusto => ({
    itemId: f.itemId,
    nome: f.nome,
    qtd: f.qtd,
    unidade: f.unidade,
    custoUnitario: f.custoUnitario,
    subtotal: f.custoUnitario == null ? null : round2(f.custoUnitario * f.qtd),
  })

  const insumos = opts.folhas.filter((f) => !ehEmbalagem(f.categoria)).map(linha)
  const embalagem = opts.folhas.filter((f) => ehEmbalagem(f.categoria)).map(linha)

  const semCusto = opts.folhas.filter((f) => f.custoUnitario == null).length
  const soma = (ls: LinhaDoCusto[]) =>
    ls.some((l) => l.subtotal == null) ? null : round2(ls.reduce((s, l) => s + (l.subtotal as number), 0))

  const custoInsumos = soma(insumos)
  const custoEmbalagem = soma(embalagem)
  // ⛔ UM insumo sem custo torna o TOTAL `null` — "a definir" nunca vira 0,01 (a régua do hub)
  const custoTotal = semCusto > 0 || opts.folhas.length === 0 ? null : round2((custoInsumos ?? 0) + (custoEmbalagem ?? 0))
  const parcial = round2(opts.folhas.reduce((s, f) => s + (f.custoUnitario ?? 0) * f.qtd, 0))

  const preco = opts.preco != null && opts.preco > 0 ? round2(opts.preco) : null
  const sobra = preco != null && custoTotal != null ? round2(preco - custoTotal) : null
  const margemPct = preco != null && sobra != null ? sobra / preco : null

  /**
   * ⭐ "QUANTOS PAGAM A CASA" = custo fixo diário ÷ sobra. ⛔ Sobra ≤ 0 → `null`, NUNCA
   * infinito nem um número gigante: vender abaixo do custo não paga a casa com volume
   * nenhum, e um "4.000 por dia" na tela seria absurdo com cara de meta.
   */
  const quantos = (s: number | null) =>
    s != null && s > 0 && opts.casaDoDia != null && opts.casaDoDia > 0
      ? Math.ceil(opts.casaDoDia / s)
      : null

  const canais: CanalNaFicha[] = opts.canais.map((c) => {
    const taxa = preco != null && c.taxaPct != null ? round2(preco * c.taxaPct) : null
    const s = preco != null && custoTotal != null && taxa != null ? round2(preco - custoTotal - taxa) : null
    return {
      id: c.id,
      nome: c.nome,
      taxaPct: c.taxaPct,
      taxa,
      sobra: s,
      margemPct: s != null && preco != null ? s / preco : null,
      quantosPagamACasa: quantos(s),
    }
  })

  return {
    chave: opts.chave,
    nome: opts.nome,
    preco,
    precoOrigem: opts.precoOrigem,
    insumos,
    embalagem,
    custoInsumos,
    custoEmbalagem,
    custoTotal,
    semCusto,
    parcial,
    sobra,
    margemPct,
    quantosPagamACasa: quantos(sobra),
    canais,
    // ⚠️ a frase distingue os casos porque cada um pede um gesto diferente
    porque:
      opts.folhas.length === 0
        ? 'a receita ainda não tem componente nenhum'
        : semCusto > 0
          ? `${semCusto} insumo${semCusto > 1 ? 's' : ''} sem custo — a 1ª nota ensina`
          : preco == null
            ? 'o PDV não registrou valor de venda; informe o preço pra eu calcular a sobra'
            : null,
  }
}
