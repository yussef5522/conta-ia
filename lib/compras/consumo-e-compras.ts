/**
 * ⭐⭐⭐ A MATEMÁTICA DO PEDIDO E DO PLANO — lib PURA (16/10/2026).
 *
 * **A lei é `docs/consumo-e-compras-referencia.html` (v3, aprovada pelo dono).** O `<script>`
 * dela É a especificação: `contaDoPedido` e `contaDoPlano` nascem com os MESMOS nomes e a
 * MESMA conta, e o guard `consumo-e-compras-bate-com-a-referencia` **lê o arquivo** e roda
 * estas funções contra a amostra dele. ⛔ Se a conta divergir, é esta lib que está errada.
 *
 * ⛔⛔ **A TELA ECOA, NUNCA CALCULA** (lei C15): a conta mora aqui porque o projeto roda em
 * `environment: node`, sem jsdom — ***regra que mora num `useMemo` é regra que ninguém
 * prova***, e foi assim que o prefill do cardápio quebrou duas vezes (28/08) antes de virar
 * função.
 *
 * ═══ ⚠️⚠️ O ÍNDICE DO DIA É **SEG-FIRST**, E ISSO NÃO É DETALHE ═══
 *
 * A referência indexa `DIAS=["SEG"…"DOM"]` (0=SEG) e os chips da config são SEG..DOM — então
 * a lib fala SEG-first. ⛔ Mas o JavaScript (`getUTCDay`) e a `mediaPorDiaDaSemana` das vendas
 * falam **DOM-first** (0=dom). Duas convenções no mesmo arquivo é um deslocamento de um dia
 * que **não dá erro nenhum**: o pedido simplesmente cobre a janela errada. Por isso a
 * conversão tem **um lugar só** (`segPrimeiro`) e um teste próprio.
 */

/** ⭐ a folga que o dono pediu: pedir 10% a mais do que a média diz (lei C5/C8) */
export const FOLGA_PADRAO = 1.1
/** ⭐ o mínimo das porções: 3 dias de média na prateleira (lei C9) */
export const PAR_DIAS = 3
/** ⭐ prazo do fornecedor em dias, quando o dono não declarou outro (lei C5) */
export const ANTECEDENCIA_PADRAO = 1

/**
 * ⭐⭐ A JANELA DA BASELINE — 28 dias, e ela é **INDEPENDENTE DO SELETOR DA TELA**.
 *
 * ⛔⛔ Esta é a decisão mais importante do arquivo. O seletor (dia · semana · mês · datas)
 * governa o que o dono **OLHA**: o número herói, as barras, a coluna "NA SEMANA". A conta do
 * PEDIDO, não — ela sai de uma janela fixa de 4 semanas, que é o que dá **4 amostras por
 * dia-da-semana** e faz a média passar do `MIN_AMOSTRAS_DO_DIA` das vendas.
 *
 * ⚠️ Se a média do pedido seguisse o seletor: (a) em "semana" cada dia-da-semana teria **1
 * amostra** — e *"média de uma amostra"* é o que o dono já recusou em 10/10, então a mesa
 * inteira viraria "a apurar"; (b) pior, **o tamanho do pedido mudaria porque o dono trocou a
 * VISÃO** — e o seletor é pra olhar, nunca pra decidir compra.
 */
export const DIAS_DA_BASELINE = 28

/** ⭐ SEG-first, como a referência e como os chips da config */
export const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'] as const
export type NomeDoDia = (typeof DIAS)[number]

/**
 * ⭐ A ÚNICA conversão entre as duas convenções de dia-da-semana.
 * `getUTCDay()`/`mediaPorDiaDaSemana` → DOM-first (0=dom); a referência → SEG-first (0=SEG).
 */
export const segPrimeiro = (jsDow: number): number => (jsDow + 6) % 7

/** ⚠️ 2 casas: o estoque anda em 3 (grama/ml), mas quantidade de PEDIDO é de balcão */
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface ItemParaPedido {
  /** SEG-first (0=SEG … 6=DOM) — os dias em que a mercadoria CHEGA (config do dono) */
  diasChegada: readonly number[]
  /** prazo do fornecedor: quantos dias ANTES da chegada o pedido tem que sair */
  antecedenciaDias: number
  /** FATOR, não percentual: `1.1` = +10%. ⚠️ confundir os dois pediria 10% do necessário. */
  folga: number
  /** posição atual do item (unidade de controle) */
  estoque: number
  /**
   * média de consumo por dia-da-semana, **SEG-first**, 7 posições.
   * ⛔ `null` = sem amostra suficiente → a conta devolve "a apurar" (lei C2: proibido inventar).
   */
  mediaPorDia: readonly (number | null)[]
}

export interface PedidoResolvido {
  ok: true
  /** em quantos dias a próxima chegada acontece (1 = amanhã) */
  chegaEm: number
  /** o dia-da-semana da próxima chegada (SEG-first) */
  chegaDia: number
  /** os dias que este pedido COBRE: da chegada até a véspera da chegada seguinte */
  janela: number[]
  /** quanto sai na janela, pela média */
  saiJanela: number
  /** `saiJanela × folga` — o que precisa estar na prateleira na chegada */
  precisa: number
  /** quanto sai de hoje até a chegada (inclui HOJE inteiro — ver a nota abaixo) */
  saiAteChegar: number
  /** o que sobra do estoque atual quando a mercadoria chegar, nunca negativo */
  sobraNaChegada: number
  /** ⭐ O NÚMERO DO DONO: quanto pedir pra não faltar, já com a folga */
  pedir: number
  /** em quantos dias o pedido tem que SAIR. `<= 0` = hoje (ou atrasado) */
  pedirEm: number
}

export type ContaDoPedido = PedidoResolvido | { ok: false; porque: string }

/**
 * ⭐⭐⭐ A CONTA DO PEDIDO (lei C6).
 *
 * *Um pedido que chega no dia X cobre de X até a PRÓXIMA chegada configurada.* Então:
 *   precisa  = Σ(média dos dias da janela) × folga
 *   sobra    = estoque − o que sai de hoje até a chegada  (nunca negativo)
 *   PEDIR    = precisa − sobra                            (nunca negativo)
 *
 * ⚠️ **`saiAteChegar` INCLUI O DIA DE HOJE INTEIRO** — é a conta da referência, e ela é
 * conservadora de propósito: no meio da tarde parte do consumo de hoje já aconteceu, então
 * descontar o dia cheio **sobra-estima o que falta sair** e o pedido vem um pouco maior.
 * ⛔ Errar pra cima aqui custa estoque parado; errar pra baixo custa faltar no balcão.
 *
 * ⛔ **FOLGA SÓ NO `precisa`, nunca no `sobra`.** Inflar os dois se cancelaria e a folga
 * viraria enfeite.
 */
export function contaDoPedido(it: ItemParaPedido, hoje: number): ContaDoPedido {
  if (!it.diasChegada.length) {
    return { ok: false, porque: 'configura os dias de chegada' }
  }

  // ── a próxima chegada
  let chegaEm = 0
  let chegaDia = -1
  for (let k = 1; k <= 7; k++) {
    const d = (hoje + k) % 7
    if (it.diasChegada.includes(d)) {
      chegaEm = k
      chegaDia = d
      break
    }
  }
  // ⚠️ inalcançável com a lista não-vazia (os 7 dias são varridos) — o guard é pra o dia em
  // que alguém gravar um dia fora de 0..6 por outra porta: melhor "a apurar" que NaN na tela.
  if (chegaDia < 0) return { ok: false, porque: 'os dias de chegada estão fora da semana' }

  // ── a chegada SEGUINTE define o tamanho da janela que este pedido cobre
  let dur = 7
  for (let k = 1; k <= 7; k++) {
    if (it.diasChegada.includes((chegaDia + k) % 7)) {
      dur = k
      break
    }
  }
  const janela = Array.from({ length: dur }, (_, j) => (chegaDia + j) % 7)

  // ── as médias que a conta precisa, e o que falta medir
  const ateChegar = Array.from({ length: chegaEm }, (_, c) => (hoje + c) % 7)
  const faltando = [...new Set([...janela, ...ateChegar])].filter((d) => it.mediaPorDia[d] == null)
  if (faltando.length) {
    const nomes = faltando.sort((a, b) => a - b).map((d) => DIAS[d].toLowerCase())
    return {
      ok: false,
      porque:
        faltando.length === 1
          ? `sem consumo medido o bastante na ${nomes[0]}`
          : `sem consumo medido o bastante em ${nomes.join(', ')}`,
    }
  }

  const soma = (ds: number[]) => ds.reduce((s, d) => s + (it.mediaPorDia[d] as number), 0)
  const saiJanela = round2(soma(janela))
  const precisa = round2(saiJanela * it.folga)
  const saiAteChegar = round2(soma(ateChegar))
  const sobraNaChegada = round2(Math.max(0, it.estoque - saiAteChegar))
  const pedir = round2(Math.max(0, precisa - sobraNaChegada))

  return {
    ok: true,
    chegaEm,
    chegaDia,
    janela,
    saiJanela,
    precisa,
    saiAteChegar,
    sobraNaChegada,
    pedir,
    pedirEm: chegaEm - it.antecedenciaDias,
  }
}

/**
 * ⭐ O DIA EM QUE O PEDIDO SAI — `"HOJE"` quando `pedirEm <= 0`.
 *
 * ⚠️ `<= 0` e não `=== 0`: antecedência maior que a distância até a chegada significa que o
 * pedido **já devia ter saído**, e a tela precisa dizer HOJE ⚠, nunca um dia no passado.
 */
export function diaPedir(p: PedidoResolvido, hoje: number): NomeDoDia | 'HOJE' {
  return p.pedirEm <= 0 ? 'HOJE' : DIAS[(hoje + p.pedirEm) % 7]
}

export interface ItemParaPlano {
  estoque: number
  /** SEG-first, 7 posições; `null` = sem amostra */
  mediaPorDia: readonly (number | null)[]
}

export type ContaDoPlano =
  | { ok: true; minimo: number; saiHoje: number; produzir: number }
  | { ok: false; porque: string }

/**
 * ⭐⭐ A CONTA DO PLANO DE PRODUÇÃO (lei C9) — porção não se compra, se PRODUZ.
 *
 *   mínimo   = 3 dias × média        (`PAR_DIAS`)
 *   produzir = mínimo + o que sai hoje − o que tem agora   (nunca negativo)
 *
 * ⚠️ **`ceil`, nunca `round`** — porção é unidade inteira, e arredondar pra baixo deixa a
 * prateleira abaixo do mínimo que o próprio número acabou de declarar.
 */
export function contaDoPlano(it: ItemParaPlano, hoje: number): ContaDoPlano {
  const semAmostra = it.mediaPorDia.filter((m) => m == null).length
  if (semAmostra > 0) {
    return {
      ok: false,
      porque:
        semAmostra === 7
          ? 'sem consumo medido ainda'
          : `sem consumo medido o bastante em ${semAmostra} dia(s) da semana`,
    }
  }
  const media = (it.mediaPorDia as number[]).reduce((s, m) => s + m, 0) / 7
  const minimo = Math.ceil(media * PAR_DIAS)
  const saiHoje = it.mediaPorDia[hoje] as number
  return { ok: true, minimo, saiHoje: round2(saiHoje), produzir: Math.max(0, Math.ceil(minimo + saiHoje - it.estoque)) }
}

/**
 * ⭐ A COBERTURA (lei C13) — `estoque ÷ média diária`, em dias.
 *
 * ⛔ `null` quando não há média (a apurar) **e quando a média é ZERO**: item que não consome
 * tem cobertura infinita, e "∞ dias" na tela é número morto. ⚠️ Estoque ≤ 0 devolve 0 — é
 * um fato ("não tem"), não ausência de dado.
 */
export function coberturaEmDias(estoque: number, mediaPorDia: readonly (number | null)[]): number | null {
  const medidos = mediaPorDia.filter((m): m is number => m != null)
  if (medidos.length === 0) return null
  const media = medidos.reduce((s, m) => s + m, 0) / medidos.length
  if (media <= 0) return null
  return round2(Math.max(0, estoque) / media)
}

export type FarolDaCobertura = 'CORAL' | 'AMBAR' | 'VERDE' | 'A_APURAR'

/**
 * ⭐⭐ O FAROL (lei C13): **coral quando acaba ANTES da próxima chegada possível**, âmbar
 * quando acaba antes de `chegada + 2`.
 *
 * ⚠️ O degrau é relativo à CHEGADA do item, nunca um número fixo de dias: 2 dias de cobertura
 * é tranquilo pra quem recebe todo dia e é incêndio pra quem recebe só na segunda. Um limiar
 * fixo gritaria no primeiro e calaria no segundo — que é o caso que importa.
 */
export function farolDaCobertura(cobertura: number | null, chegaEm: number | null): FarolDaCobertura {
  if (cobertura == null) return 'A_APURAR'
  // sem dias de chegada configurados não há contra o que comparar — a tela cobra a config
  if (chegaEm == null) return 'A_APURAR'
  if (cobertura < chegaEm) return 'CORAL'
  if (cobertura < chegaEm + 2) return 'AMBAR'
  return 'VERDE'
}

/**
 * ⭐⭐ O TEXTO DO PEDIDO PRO WHATSAPP (lei C8) — *"Pedido Caçula Mix — Fornecedor (entrega
 * SEG): FRANGO 6,6 KG · ACÉM 26,6 KG"*.
 *
 * ⛔ Ele mora na LIB, não no `onClick`: é o texto que o fornecedor recebe, e um segundo
 * montador na tela divergiria do que a mesa mostra no primeiro ajuste de formato.
 */
export function textoDoPedido(input: {
  empresa: string
  fornecedor: string | null
  chegaDia: number
  linhas: readonly { nome: string; quantidade: number; unidade: string }[]
}): string {
  const itens = input.linhas
    .map((l) => `${l.nome} ${fmt1(l.quantidade)} ${l.unidade}`)
    .join(' · ')
  const quem = input.fornecedor ? ` — ${input.fornecedor}` : ''
  return `Pedido ${input.empresa}${quem} (entrega ${DIAS[input.chegaDia]}): ${itens}`
}

/** ⭐ 1 casa, pt-BR — o formato que a referência imprime em toda quantidade */
export function fmt1(v: number): string {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
}
