/**
 * ⭐⭐ OS CANAIS DE VENDA E A TAXA — config do dono, com rastro (item 4 do v2).
 *
 * A mesma pizza deixa dinheiros diferentes dependendo de por onde ela saiu: no balcão o preço
 * é o preço; no app, a plataforma leva um pedaço. Sem isso a margem do cardápio é a do balcão
 * aplicada a tudo — e o produto que só vende no iFood aparece mais lucrativo do que é.
 *
 * ⛔⛔ TAXA `null` É "A DECLARAR", NUNCA 0% — e isso não é preciosismo: 0% afirma que o canal
 * é de graça, e a sobra sairia maior do que a real **no canal em que ela é menor**. É a mesma
 * disciplina do *"a apurar nunca vira R$ 0,00"* do resto do sistema.
 *
 * ⚠️ A taxa é FRAÇÃO (0.2 = 20%), a mesma convenção da `margem.pct` da casa — duas escalas de
 * percentual no mesmo módulo é como o `taxaPct` de um lado viraria 20 e do outro 0,2.
 */

export interface CanalDeVenda {
  id: string
  nome: string
  /** `null` = o dono ainda não disse a taxa deste canal */
  taxaPct: number | null
  ativo: boolean
}

/**
 * ⭐ O SEED — os números que o dono ditou em 07/10.
 *
 * ⚠️ Tele-entrega própria é **0% de propósito, e isso é uma declaração, não ausência**: o
 * entregador é custo à parte (sai na folha/entregador do custo fixo), não comissão sobre o
 * preço. Descontá-lo aqui contaria o mesmo custo duas vezes.
 */
export const CANAIS_SEMEADOS: readonly { nome: string; taxaPct: number }[] = [
  { nome: 'balcão', taxaPct: 0 },
  { nome: 'tele-entrega própria', taxaPct: 0 },
  { nome: 'iFood', taxaPct: 0.2 },
]

/** ⛔ o teto existe porque taxa ≥ 1 significa que o canal leva o preço inteiro — é digitação
 * torta (20 no lugar de 0,20), e o CHECK do banco recusa. A tela precisa recusar ANTES. */
export const TAXA_MAXIMA = 0.99

export interface SobraNoCanal {
  canal: string
  /** `null` quando a taxa é "a declarar" OU o custo do produto é desconhecido */
  sobra: number | null
  /** `null` pelos mesmos motivos — margem sem custo é chute */
  margemPct: number | null
  /** ⚠️ o que o canal levou, NOMEADO: sem isso o dono vê a sobra cair e não sabe por quê */
  taxaValor: number | null
  /**
   * ⭐ A TAXA do canal, pra a tela escrever *"no iFood (taxa 20%)"* como a referência manda.
   *
   * ⛔ `null` = **a declarar**, e isso NÃO é 0%: taxa ausente faria a sobra sair maior que a
   * real justo no canal em que ela é menor. A `sobra` já vem `null` nesse caso.
   */
  taxaPct: number | null
  porque: string | null
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/**
 * ⭐ A SOBRA POR CANAL — a conta é `preço × (1 − taxa) − custo`.
 *
 * ⛔ A taxa incide sobre o PREÇO, nunca sobre a sobra: a plataforma cobra do faturamento, e
 * aplicá-la sobre a sobra daria um número menor e errado (o erro cresce com a margem).
 */
export function sobraNoCanal(
  preco: number | null,
  custo: number | null,
  canal: CanalDeVenda,
): SobraNoCanal {
  if (preco == null) {
    return { canal: canal.nome, sobra: null, margemPct: null, taxaValor: null, taxaPct: canal.taxaPct, porque: 'sem preço declarado' }
  }
  if (custo == null) {
    return { canal: canal.nome, sobra: null, margemPct: null, taxaValor: null, taxaPct: canal.taxaPct, porque: 'custo a apurar' }
  }
  if (canal.taxaPct == null) {
    return {
      canal: canal.nome,
      sobra: null,
      margemPct: null,
      taxaValor: null,
      taxaPct: null,
      porque: 'a taxa deste canal ainda não foi declarada',
    }
  }
  const taxaValor = round2(preco * canal.taxaPct)
  const sobra = round2(preco - taxaValor - custo)
  return {
    canal: canal.nome,
    sobra,
    // ⚠️ a margem é sobre o PREÇO cheio (é o que o dono compara com o cardápio), não sobre o
    // líquido do canal — senão o mesmo produto teria duas margens "certas"
    margemPct: preco > 0 ? sobra / preco : null,
    taxaValor,
    taxaPct: canal.taxaPct,
    porque: null,
  }
}

/** ⚠️ ordem estável: canal com taxa primeiro declarado, "a declarar" por último — a tela não
 * pode abrir com uma coluna muda no lugar de honra */
export function ordenarCanais(canais: readonly CanalDeVenda[]): CanalDeVenda[] {
  return [...canais].sort((a, b) => {
    if ((a.taxaPct == null) !== (b.taxaPct == null)) return a.taxaPct == null ? 1 : -1
    if (a.taxaPct != null && b.taxaPct != null && a.taxaPct !== b.taxaPct) return a.taxaPct - b.taxaPct
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })
}
