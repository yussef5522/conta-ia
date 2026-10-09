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
 *
 * ⛔⛔⛔ E "SÓ MASSA/QUEIJO/CAIXA" É NECESSÁRIO, **NÃO SUFICIENTE** — o preview em prod provou
 * isso no pior lugar possível. O **«Combo Caçula»** (2 queijo + caixa 35 + 3 massa + caixa 25,
 * R$ 30.707 de faturamento em 30 dias, o maior do cardápio) passou pela régua de cima e foi
 * classificado como base de PEQUENA: a proposta **destruiria a receita dele**, de R$ 15,18 pra
 * R$ 6,94. Duas travas estruturais fecham isso, e cada uma sai da declaração do dono:
 *
 *  1. **UM TIPO DE CAIXA.** Base é de UM tamanho; caixa de 25 **e** de 35 na mesma ficha é um
 *     combo que atravessa dois tamanhos. ⚠️ Repare que `PROMO 2 PIZZAS GRANDES` (2 × caixa 35)
 *     continua passando — é a MESMA caixa duas vezes, que é combo do mesmo tamanho e o
 *     `multiplicador` trata.
 *  2. **MASSA E QUEIJO NA MESMA QUANTIDADE.** A canônica é sempre N:N (1/1 · 2/2 · 3/3). O
 *     Combo pede 3 massas pra 2 queijos — razão que nenhum tamanho tem.
 */
export function ehBaseDeTamanho(componentes: readonly ComponenteDaFicha[], itens: ItensDaBase): boolean {
  if (componentes.length === 0) return false
  const permitidos = new Set<string>([itens.massa, itens.queijo, ...Object.values(itens.caixa)])
  if (!componentes.every((c) => permitidos.has(c.itemId))) return false

  const soma = (itemId: string) =>
    componentes.filter((c) => c.itemId === itemId).reduce((s, c) => s + c.qtdPlanejada, 0)

  // 1. um TIPO de caixa só (a mesma caixa 2× é combo do mesmo tamanho, e isso passa)
  const tiposDeCaixa = Object.values(itens.caixa).filter((id) => soma(id) > 0)
  if (tiposDeCaixa.length > 1) return false

  // 2. massa e queijo, quando os dois existem, vêm na MESMA quantidade
  const m = soma(itens.massa)
  const q = soma(itens.queijo)
  if (m > 0 && q > 0 && m !== q) return false

  return true
}

/** ⚠️ lista FECHADA de palavras de tamanho — inferir de qualquer palavra faria `PIZZA GRANDE
 *  CALABRESA` virar um tamanho, a mesma trava das variações de preço em `tamanhos.ts` */
const PALAVRA_DO_TAMANHO: readonly [RegExp, TamanhoCanonico][] = [
  // ⚠️ o `S?` do plural não é detalhe: `PROMO 2 PIZZAS GRANDES` tem a palavra no PLURAL, e
  //    `\bGRANDE\b` **não casa** `GRANDES`. Sem ele o nome caía no ramo da evidência e acertava
  //    GRANDE **por acidente** (pela caixa) — um teste pegou isso.
  [/\bFAMILIAS?\b/, 'FAMILIA'],
  [/\bGRANDES?\b/, 'GRANDE'],
  [/\bPEQUENAS?\b/, 'PEQUENA'],
]

/**
 * ⭐⭐ O CANAL NÃO É TAMANHO — lista FECHADA, e ela é a régua do dono de 08/10.
 *
 * `Pizza (Aiq)` é o produto do **Aiqfome**: o parêntese diz por onde ele vende, nunca de que
 * tamanho ele é. ⛔ Inferir "canal" de qualquer parêntese faria `(Novo)` ou `(Promo)` virar
 * canal — a mesma trava da lista fechada dos qualificadores de bebida (14/09) e dos sufixos
 * societários (13/09): o que não está na lista **não vira régua**.
 */
const CANAIS: readonly RegExp[] = [/\bAIQ\b/, /\bAIQFOME\b/]

/**
 * ⭐⭐⭐ AS REGRAS NOMEADAS DO MAPEAMENTO — toda classificação diz QUAL régua decidiu.
 *
 * ⚠️ É união FECHADA de propósito: ramo novo sem nome **não compila**, então não existe
 * decisão anônima neste mapa. É o que faz o relatório poder dizer *"quem decidiu foi a régua
 * do canal"* em vez de só mostrar o resultado — e é o "rastro" que o dono pediu em 08/10.
 */
export type RegraDoMapeamento =
  /** o nome traz a palavra do tamanho (`PIZZA FAMILIA 45CM`) */
  | 'PALAVRA_DO_NOME'
  /** ⭐ a régua do dono (08/10): nome de CANAL sem palavra de tamanho é GRANDE */
  | 'CANAL_SEM_TAMANHO_E_GRANDE'
  /** o nome diz N pizzas — combo, a composição é N× a canônica e o dono confirma */
  | 'COMBO_DE_N_PIZZAS'
  /** ⛔ a régua do canal diria GRANDE e a composição atual diz outro tamanho */
  | 'CANAL_CONTRA_EVIDENCIA'
  /** o nome não diz nada; a evidência é a caixa que a ficha usa hoje */
  | 'EVIDENCIA_DA_CAIXA'
  /** idem, pela contagem de porções de queijo */
  | 'EVIDENCIA_DO_QUEIJO'
  /** nem nome nem evidência — devolve `null`, nunca chuta */
  | 'SEM_RESPOSTA'

export interface ClassificacaoDaBase {
  tamanho: TamanhoCanonico | null
  /** ⚠️ `PROMO 2 PIZZAS GRANDES` são DUAS pizzas: a composição é 2× a canônica */
  multiplicador: number
  /** `CLARO` = dá pra decidir por régua declarada · `PERGUNTA` = o dono decide */
  confianca: 'CLARO' | 'PERGUNTA'
  /** ⭐ QUAL régua decidiu — viaja até o relatório, nunca fica só na prosa do `porque` */
  regra: RegraDoMapeamento
  porque: string
}

/**
 * ⭐ CLASSIFICA uma ficha de base: qual tamanho e quantas pizzas.
 *
 * ⛔ Devolve `PERGUNTA` em vez de chutar quando (a) o nome não diz o tamanho **e não há régua
 * declarada que o cubra** — aí a evidência é a composição atual, que o dono confere —, ou (b) o
 * nome indica mais de uma pizza. **O preview pergunta; o aplicar só mexe no que foi confirmado.**
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

  /** a evidência da composição ATUAL, calculada antes porque a régua do canal a consulta */
  const porCaixa = (['PEQUENA', 'GRANDE', 'FAMILIA'] as const).find((t) =>
    componentes.some((c) => c.itemId === itens.caixa[t]),
  )
  const queijos = componentes.filter((c) => c.itemId === itens.queijo).reduce((s, c) => s + c.qtdPlanejada, 0)
  /** ⚠️ comparação CRUA de propósito: dividir pelo `multiplicador` mudaria a evidência do ramo
   *  de combo, que ninguém pediu pra mexer. A régua do canal só roda com multiplicador 1, onde
   *  dividir seria identidade — então o aperto não traria nada e abriria regressão de graça. */
  const porQueijo = TAMANHOS_CANONICOS.find((t) => COMPOSICAO[t].queijo === queijos)
  const evidencia = porCaixa ?? porQueijo ?? null

  // ─────────── 1. a PALAVRA do nome ganha de tudo ───────────
  const porNome = PALAVRA_DO_TAMANHO.find(([re]) => re.test(n))?.[1] ?? null
  if (porNome && multiplicador === 1) {
    return {
      tamanho: porNome,
      multiplicador: 1,
      confianca: 'CLARO',
      regra: 'PALAVRA_DO_NOME',
      porque: `o nome diz ${porNome}`,
    }
  }
  if (porNome && multiplicador > 1) {
    return {
      tamanho: porNome,
      multiplicador,
      confianca: 'PERGUNTA',
      regra: 'COMBO_DE_N_PIZZAS',
      porque: `o nome diz ${porNome} e ${multiplicador} pizzas — a composição proposta é ${multiplicador}× a canônica`,
    }
  }

  /**
   * ─────────── 2. ⭐ A RÉGUA DO CANAL (declaração do dono, 08/10/2026) ───────────
   *
   * *"Nome SEM tamanho = GRANDE; nome com FAMÍLIA depois do Aiq = FAMÍLIA."* A segunda metade
   * já é atendida pelo passo 1 (a palavra ganha de tudo), então aqui só vive a primeira.
   *
   * ⛔⛔ E ELA **NÃO SOBRESCREVE EVIDÊNCIA QUE A CONTRADIZ** — é a trava que o «Combo Caçula»
   * ensinou em 08/10: lá a régua passou e a proposta **destruiria a receita** (R$ 15,18 → 6,94).
   * Ficha de canal cuja composição de hoje diz PEQUENA volta a PERGUNTAR, nomeando o conflito;
   * aplicar GRANDE em silêncio ali trocaria uma pizza pequena por uma grande no custo de todo
   * dia, e o número sairia plausível. ⚠️ Hoje isso não morde (o `Pizza (Aiq)` real é GRANDE pela
   * régua **e** pela evidência) — a trava existe pro produto de canal que ainda vai nascer.
   */
  const ehCanal = CANAIS.some((re) => re.test(n))
  if (ehCanal && multiplicador === 1) {
    if (evidencia && evidencia !== 'GRANDE') {
      return {
        tamanho: evidencia,
        multiplicador,
        confianca: 'PERGUNTA',
        regra: 'CANAL_CONTRA_EVIDENCIA',
        porque: `a régua do canal diria GRANDE, mas a ficha hoje tem composição de ${evidencia} — o dono decide qual vale`,
      }
    }
    return {
      tamanho: 'GRANDE',
      multiplicador: 1,
      confianca: 'CLARO',
      regra: 'CANAL_SEM_TAMANHO_E_GRANDE',
      porque: 'régua do dono (08/10): nome de canal sem palavra de tamanho é GRANDE',
    }
  }

  // ─────────── 3. a EVIDÊNCIA da composição atual, dita ao dono ───────────
  if (porCaixa) {
    return {
      tamanho: porCaixa,
      multiplicador,
      confianca: 'PERGUNTA',
      regra: 'EVIDENCIA_DA_CAIXA',
      porque: `o nome não diz o tamanho; a ficha hoje usa a caixa de ${porCaixa}`,
    }
  }
  if (porQueijo) {
    return {
      tamanho: porQueijo,
      multiplicador,
      confianca: 'PERGUNTA',
      regra: 'EVIDENCIA_DO_QUEIJO',
      porque: `o nome não diz o tamanho; a ficha hoje pede ${queijos} porção(ões) de queijo, que bate com ${porQueijo}`,
    }
  }
  return {
    tamanho: null,
    multiplicador,
    confianca: 'PERGUNTA',
    regra: 'SEM_RESPOSTA',
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
 * ⭐ O MOTIVO da pendência de dose — PURO, porque ele carrega uma regra.
 *
 * ⛔ Ele vivia montado dentro do laço da gravação, e ali **só dava pra conferir por grep**.
 * A regra é a ordem do dono de 08/10 (*"molho segue a declarar ×2 como nas irmãs"*): a ficha
 * de combo tem que DIZER quantas pizzas são, senão o dono abre a ficha e declara a dose de
 * UMA pizza. ⚠️ `stock_dose_a_declarar` não tem coluna de quantidade — e nem deve, porque ali
 * quantidade seria justamente o número que o sistema se recusa a inventar.
 */
export function motivoDaDoseADeclarar(multiplicador: number): string {
  const base = 'a dose do molho é declaração do dono — o sistema não inventa quantidade de insumo'
  if (multiplicador <= 1) return base
  return `${base} · ⚠️ esta ficha são ${multiplicador} pizzas: a dose é ${multiplicador}× a da base de um tamanho`
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
