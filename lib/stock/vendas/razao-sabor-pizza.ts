/**
 * ⭐⭐⭐ A RÉGUA DO DIA DE VENDA — quem é pizza, quem é sabor, e os 4 SELOS (08/10/2026).
 *
 * ⛔⛔ ESTE ARQUIVO EXISTE POR REGRA 4. A pergunta *"o relatório de complementos deste dia
 * veio completo?"* já tinha dono — `diasComRelatorioSuspeito` em `lib/margem/leitura.ts`,
 * que alimenta o aviso do sininho desde 07/10. A central de import faz **a mesma pergunta**,
 * e uma segunda régua faria a tela dizer *"completo ✓"* sobre o dia que o sininho acusa de
 * incompleto. Agora as duas leem daqui.
 *
 * ⚠️⚠️ E A SEGUNDA RÉGUA QUASE NASCEU NA MINHA MÃO: a 1ª sonda do retrato contou pizza com
 * `nomeSuitable contains 'PIZZA'` e mediu razões de **1,54 a 12,13**. O `EH_PIZZA` de verdade
 * pega também `GRANDE PRECINHO` (1.096 un/mês, **sem a palavra PIZZA no nome**) e os `35CM`
 * — ou seja, a minha contagem **subestimava as pizzas e inflava a razão**, que é justo o
 * sentido que esconde o dia incompleto.
 */

/**
 * ⚠️ `GRANDE` (208 ocorrências em prod) é **TAMANHO vazado** no relatório de complementos,
 * não sabor — decisão do dono em 07/10: *"mapear como não-sabor, ignorar na fila, nunca virar
 * ficha de sabor"*. A lista é FECHADA e mora aqui, com o motivo.
 *
 * ⛔ Lista aberta (qualquer palavra de tamanho) esconderia sabor legítimo: existe pizza
 * chamada `PORTUGUESA GRANDE` no cardápio, e ela É sabor.
 */
export const NAO_SAO_SABOR = new Set(['GRANDE', 'PEQUENA', 'FAMILIA', 'FAMÍLIA', 'MEDIA', 'MÉDIA', 'BROTO'])

const canon = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()

export function ehSaborDeVerdade(nome: string): boolean {
  return !NAO_SAO_SABOR.has(canon(nome))
}

/**
 * ⭐ O que conta como PIZZA no relatório de PRODUTOS.
 *
 * ⚠️ `PRECINHO` e os `NNcm` estão aqui porque o PDV vende `GRANDE PRECINHO` e
 * `Pizza Grande (35cm)` **sem a palavra PIZZA** — e eles são 1.300+ unidades por mês. Tirar
 * qualquer um destes termos infla a razão e **esconde o dia incompleto**.
 */
const EH_PIZZA = /PIZZA|PRECINHO|FAMILIA|BROTO|25\s?CM|35\s?CM|45\s?CM/i

export const ehPizza = (nomeSuitable: string) => EH_PIZZA.test(nomeSuitable)

/**
 * ⚠️ O PISO: dia com poucas pizzas não sustenta razão (a trava do *"um lote não é média"*).
 * ⛔ Sem ele, um dia de 3 pizzas e 2 sabores viraria alarme — e alarme falso repetido é como
 * um alarme morre.
 */
export const PISO_DE_PIZZAS = 20

export type SeloDoDia =
  /** produtos ok E a razão sabores/pizza é possível (≥ 1) */
  | 'COMPLETO'
  /** produtos ok E 0 < razão < 1 — o relatório de sabores veio pela metade */
  | 'COMPLEMENTOS_INCOMPLETOS'
  /** vendeu pizza E ZERO ocorrência de sabor entrou */
  | 'SABORES_NAO_IMPORTADOS'
  /** dia de venda sem arquivo nenhum */
  | 'SEM_IMPORTACAO'

export interface DadosDoDia {
  /** o dia tem import de PRODUTOS? */
  temProdutos: boolean
  /** unidades de PIZZA vendidas (pela régua `ehPizza`) */
  pizzas: number
  /** ocorrências de SABOR de verdade (pela régua `ehSaborDeVerdade`) */
  sabores: number
}

export interface VereditoDoDia {
  selo: SeloDoDia
  /** `null` quando não dá pra calcular (sem pizza no dia) — nunca 0 fingindo razão */
  razao: number | null
  /** ⚠️ a razão existe mas o dia é pequeno demais pra ela valer de régua */
  razaoFracaPorVolume: boolean
  /** a frase do dia, na língua do balcão */
  frase: string
}

const n1 = (x: number) => x.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/**
 * ⭐⭐ O VEREDITO — determinístico, puro, e **na ordem da AÇÃO** (o pior primeiro).
 *
 * ⛔ A ordem não é estética: `SEM_IMPORTACAO` ganha de tudo porque sem arquivo nenhum não há
 * razão pra calcular; `SABORES_NAO_IMPORTADOS` ganha de `INCOMPLETOS` porque zero é um estado
 * próprio (e o gesto é outro: importar × reimportar).
 */
export function vereditoDoDia(d: DadosDoDia): VereditoDoDia {
  if (!d.temProdutos) {
    return {
      selo: 'SEM_IMPORTACAO',
      razao: null,
      razaoFracaPorVolume: false,
      frase: 'dia de venda sem arquivo nenhum',
    }
  }

  const razao = d.pizzas > 0 ? d.sabores / d.pizzas : null
  const fraca = d.pizzas > 0 && d.pizzas < PISO_DE_PIZZAS

  // ⛔ vendeu pizza e ZERO sabor entrou — o caso que o dono nomeou
  if (d.pizzas > 0 && d.sabores === 0) {
    return {
      selo: 'SABORES_NAO_IMPORTADOS',
      razao: 0,
      razaoFracaPorVolume: fraca,
      frase: `vendeu ${d.pizzas} pizzas e ZERO sabores entraram`,
    }
  }

  /**
   * ⛔ razão < 1 é IMPOSSÍVEL: toda pizza obriga ao menos 1 sabor no cardápio. ⚠️ Mas só
   * acusa acima do piso — abaixo dele a razão existe e **não vale de régua**, e a frase diz
   * isso em vez de chamar de incompleto um dia de 4 pizzas.
   */
  if (razao != null && razao < 1 && !fraca) {
    return {
      selo: 'COMPLEMENTOS_INCOMPLETOS',
      razao,
      razaoFracaPorVolume: false,
      frase: `${d.pizzas} pizzas × só ${d.sabores} ocorrências de sabor — o relatório de complementos veio pela metade`,
    }
  }

  return {
    selo: 'COMPLETO',
    razao,
    razaoFracaPorVolume: fraca,
    frase:
      razao == null
        ? 'sem pizza no dia — a razão sabor/pizza não se aplica'
        : fraca
          ? `razão ${n1(razao)} sabores/pizza · dia pequeno (${d.pizzas} pizzas), a razão não vale de régua`
          : `razão ${n1(razao)} sabores/pizza · normal`,
  }
}

/** ⚠️ o rótulo é do SELO, num lugar só — a tela e o aviso do sininho leem daqui */
export const ROTULO_DO_SELO: Record<SeloDoDia, string> = {
  COMPLETO: 'completo ✓',
  COMPLEMENTOS_INCOMPLETOS: 'complementos incompletos ⚠',
  SABORES_NAO_IMPORTADOS: 'sabores não importados ✗',
  SEM_IMPORTACAO: 'sem importação ✗',
}

/** ⭐ só estes 3 pedem ação — é o que o alerta do topo e o sininho contam */
export const SELOS_QUE_PEDEM_ACAO: readonly SeloDoDia[] = [
  'SEM_IMPORTACAO',
  'SABORES_NAO_IMPORTADOS',
  'COMPLEMENTOS_INCOMPLETOS',
]
