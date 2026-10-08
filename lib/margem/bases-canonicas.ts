/**
 * ⭐⭐⭐ A COMPOSIÇÃO CANÔNICA DAS BASES DE PIZZA — pura, sem banco (08/10/2026).
 *
 * ⛔⛔ O PROBLEMA MEDIDO QUE CRIOU ISTO: a Caçula tinha **11 fichas de base pro mesmo
 * cardápio**, com a massa em UMA e a caixa faltando em várias. Custo subestimado → margem
 * inflada (81-89%) → a sobra que a casa e a liga leem vinha maior do que é.
 *
 * ⭐ A COMPOSIÇÃO É DECLARAÇÃO DO DONO (07/10), nunca medição:
 *   PEQUENA = metade de massa ×1 + porção queijo 135g ×1 + caixa 25
 *   GRANDE  = metade de massa ×2 + porção queijo 135g ×2 + caixa 35
 *   FAMÍLIA = metade de massa ×3 + porção queijo 135g ×3 + caixa 45
 *   PRECINHO (G e F) **DERIVA** do tamanho — mesma composição, outro preço.
 *
 * ⛔⛔ E O MOLHO NÃO ENTRA NA COMPOSIÇÃO: a dose é do dono e **nunca se inventa**. Ele vira
 * uma pendência DECLARADA (`stock_dose_a_declarar`) que a ficha mostra — *"falta a dose do
 * molho"* —, não um número chutado. Dose inventada num insumo de 6,22/UN envenenaria o custo
 * de 3.035 pizzas por mês e ninguém desconfiaria, porque o número sai plausível.
 */

export type TamanhoCanonico = 'PEQUENA' | 'GRANDE' | 'FAMILIA'

export const TAMANHOS_CANONICOS: readonly TamanhoCanonico[] = ['PEQUENA', 'GRANDE', 'FAMILIA']

/** ⭐ quantas unidades de cada peça — a declaração do dono, escrita uma vez */
export const COMPOSICAO: Record<TamanhoCanonico, { massa: number; queijo: number; caixa: number }> = {
  PEQUENA: { massa: 1, queijo: 1, caixa: 1 },
  GRANDE: { massa: 2, queijo: 2, caixa: 1 },
  FAMILIA: { massa: 3, queijo: 3, caixa: 1 },
}

/**
 * Os ITENS de estoque que a composição usa. ⚠️ Vêm RESOLVIDOS de fora (o leitor acha por
 * nome e **declara o que achou** no relatório) — a lib pura não adivinha id de item.
 */
export interface ItensDaBase {
  massa: string
  queijo: string
  /** a caixa de cada tamanho */
  caixa: Record<TamanhoCanonico, string>
  /** ⛔ o molho NÃO entra na composição — fica aqui só pra virar pendência declarada */
  molho: string | null
}

export interface ComponenteDaFicha {
  itemId: string
  qtdPlanejada: number
  unidade: string
}

/** ⚠️ o estoque conta estas três peças em UN — a unidade vem do item, não daqui */
export const UNIDADE_DA_BASE = 'UN'

const normaliza = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

/**
 * ⭐⭐ A RÉGUA QUE SEPARA BASE DE PRODUTO PRONTO — e ela é **ESTRUTURAL, nunca o nome**.
 *
 * Base é feita SÓ de massa, queijo e caixa. Proteína dentro (`PIZZA CALABRESA CONGELADA` =
 * queijo + porção de calabresa) é **produto pronto com sabor embutido**, não base de tamanho.
 *
 * ⛔ Classificar pelo NOME erraria nos dois sentidos: `Pizza (Aiq)` é base e não diz tamanho
 * nenhum; `PIZZA CALABRESA CONGELADA` diz PIZZA e não é base. A composição não mente.
 */
export function ehBaseDeTamanho(componentes: readonly ComponenteDaFicha[], itens: ItensDaBase): boolean {
  if (componentes.length === 0) return false
  const permitidos = new Set<string>([itens.massa, itens.queijo, ...Object.values(itens.caixa)])
  return componentes.every((c) => permitidos.has(c.itemId))
}

/** ⚠️ lista FECHADA de palavras de tamanho — inferir de qualquer palavra faria `PIZZA GRANDE
 *  CALABRESA` virar um tamanho, a mesma trava das variações de preço em `tamanhos.ts` */
const PALAVRA_DO_TAMANHO: readonly [RegExp, TamanhoCanonico][] = [
  [/\bFAMILIA\b/, 'FAMILIA'],
  [/\bGRANDE\b/, 'GRANDE'],
  [/\bPEQUENA\b/, 'PEQUENA'],
]

export interface ClassificacaoDaBase {
  tamanho: TamanhoCanonico | null
  /** ⚠️ `PROMO 2 PIZZAS GRANDES` são DUAS pizzas: a composição é 2× a canônica */
  multiplicador: number
  /** `CLARO` = o nome diz o tamanho e é 1 pizza · `PERGUNTA` = o dono decide */
  confianca: 'CLARO' | 'PERGUNTA'
  porque: string
}

/**
 * ⭐ CLASSIFICA uma ficha de base: qual tamanho e quantas pizzas.
 *
 * ⛔ Devolve `PERGUNTA` em vez de chutar quando (a) o nome não diz o tamanho — aí a evidência
 * é a composição atual, que o dono confere —, ou (b) o nome indica mais de uma pizza. **O
 * preview pergunta; o aplicar só mexe no que foi confirmado.**
 */
export function classificarBase(opts: {
  nome: string
  componentes: readonly ComponenteDaFicha[]
  itens: ItensDaBase
}): ClassificacaoDaBase {
  const { nome, componentes, itens } = opts
  const n = normaliza(nome)

  // ⚠️ "2 PIZZAS" / "3 PIZZAS" — combo de N unidades, nunca um tamanho novo
  const mult = n.match(/\b(\d+)\s*PIZZAS\b/)
  const multiplicador = mult ? Number(mult[1]) : 1

  const porNome = PALAVRA_DO_TAMANHO.find(([re]) => re.test(n))?.[1] ?? null
  if (porNome && multiplicador === 1) {
    return { tamanho: porNome, multiplicador: 1, confianca: 'CLARO', porque: `o nome diz ${porNome}` }
  }
  if (porNome && multiplicador > 1) {
    return {
      tamanho: porNome,
      multiplicador,
      confianca: 'PERGUNTA',
      porque: `o nome diz ${porNome} e ${multiplicador} pizzas — a composição proposta é ${multiplicador}× a canônica`,
    }
  }

  // ⭐ o nome não diz o tamanho (`Pizza (Aiq)`): a EVIDÊNCIA é a composição atual, dita ao dono
  const porCaixa = (['PEQUENA', 'GRANDE', 'FAMILIA'] as const).find((t) =>
    componentes.some((c) => c.itemId === itens.caixa[t]),
  )
  if (porCaixa) {
    return {
      tamanho: porCaixa,
      multiplicador,
      confianca: 'PERGUNTA',
      porque: `o nome não diz o tamanho; a ficha hoje usa a caixa de ${porCaixa}`,
    }
  }
  const queijos = componentes.filter((c) => c.itemId === itens.queijo).reduce((s, c) => s + c.qtdPlanejada, 0)
  const porQueijo = TAMANHOS_CANONICOS.find((t) => COMPOSICAO[t].queijo === queijos)
  if (porQueijo) {
    return {
      tamanho: porQueijo,
      multiplicador,
      confianca: 'PERGUNTA',
      porque: `o nome não diz o tamanho; a ficha hoje pede ${queijos} porção(ões) de queijo, que bate com ${porQueijo}`,
    }
  }
  return {
    tamanho: null,
    multiplicador,
    confianca: 'PERGUNTA',
    porque: 'não dá pra dizer o tamanho pelo nome nem pela composição atual',
  }
}

/**
 * ⭐ A composição PROPOSTA pro tamanho — a única fonte do que vai ser gravado.
 *
 * ⚠️ A ordem é fixa (massa · queijo · caixa) porque ela vira a `posicao` do componente: a
 * ficha de todas as bases passa a se ler igual, e a comparação antes×depois fica óbvia.
 */
export function composicaoProposta(
  tamanho: TamanhoCanonico,
  multiplicador: number,
  itens: ItensDaBase,
): ComponenteDaFicha[] {
  const c = COMPOSICAO[tamanho]
  const m = multiplicador
  return [
    { itemId: itens.massa, qtdPlanejada: c.massa * m, unidade: UNIDADE_DA_BASE },
    { itemId: itens.queijo, qtdPlanejada: c.queijo * m, unidade: UNIDADE_DA_BASE },
    { itemId: itens.caixa[tamanho], qtdPlanejada: c.caixa * m, unidade: UNIDADE_DA_BASE },
  ]
}

/**
 * ⭐⭐ O GUARD DO DONO: ficha de TAMANHO sem massa + queijo + caixa é VERMELHO.
 *
 * ⛔ **MOLHO ISENTO** até o dono declarar a dose — cobrar um componente que ninguém pode
 * preencher sem inventar número viraria alarme eterno, e alarme que não dá pra resolver é
 * como o dono aprende a ignorar o alarme (os 111 falsos do juiz de vendas).
 */
export function conferirBaseDeTamanho(
  componentes: readonly ComponenteDaFicha[],
  itens: ItensDaBase,
): { completa: boolean; faltando: ('massa' | 'queijo' | 'caixa')[] } {
  const tem = (itemId: string) => componentes.some((c) => c.itemId === itemId && c.qtdPlanejada > 0)
  const faltando: ('massa' | 'queijo' | 'caixa')[] = []
  if (!tem(itens.massa)) faltando.push('massa')
  if (!tem(itens.queijo)) faltando.push('queijo')
  if (!Object.values(itens.caixa).some((id) => tem(id))) faltando.push('caixa')
  return { completa: faltando.length === 0, faltando }
}
