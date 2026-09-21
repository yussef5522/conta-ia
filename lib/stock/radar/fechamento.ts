// ⭐⭐⭐ RADAR DO ESTOQUE — A PORTA ÚNICA DO FECHAMENTO (20/09/2026).
//
// **O desenho do dono:** *"tinha ontem → comprou/produziu → vendeu → DEVIA TER → CONTAMOS
// → FALTOU"* — a conta de padeiro, na língua da cozinha.
//
// ⛔⛔ **NENHUMA SEGUNDA RÉGUA DE SALDO OU CONSUMO** (ordem dele, e a lição desta casa:
// *"segunda derivação diverge no 1º caso de borda"*). Este arquivo **não calcula variância**
// — ela já está gravada:
//
//   | pergunta            | de onde vem                                   |
//   |---------------------|-----------------------------------------------|
//   | DEVIA TER           | `stock_contagem_item.saldoSistema` (snapshot) |
//   | CONTAMOS            | `stock_contagem_item.qtdContada`              |
//   | FALTOU / SOBROU     | `divergencia` · `valorDivergencia`            |
//   | os baldes do meio   | o LEDGER, pelos MESMOS `TIPOS` do Real vs Teórico |
//   | custo médio         | `custoMedioPorItem` — a MESMA fonte da Posição |
//
// ⭐ E o "vendeu" é **as mesmas fichas da baixa**, por construção: o `BAIXA_VENDA` do ledger
// foi escrito pela explosão da ficha quando a venda baixou. Re-explodir aqui seria a
// segunda régua que a ordem proíbe.
//
// ⭐⭐ **A JANELA É POR ITEM — a decisão do dono (padrão mundial: variância ENTRE
// contagens):** *"usa a ÚLTIMA CONTAGEM do item como ponto de partida, com o período
// ESCRITO na conta de padeiro pra nunca mentir o tamanho da janela."* Por isso cada linha
// carrega `desde`/`diasDaJanela`: duas linhas da mesma tela podem falar de janelas
// diferentes, e **esconder isso seria mentir o tamanho do furo**.
//
// ⚠️ **"FALTA CONTAR" É ESTADO PRÓPRIO, NUNCA ZERO** — item sem contagem na ponta do
// período não tem "real", então não tem variância. Zero afirmaria que bateu.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { saldosDaEmpresa } from '@/lib/stock/saldo'
import { TIPOS, PISO_DADOS } from '@/lib/stock/real-vs-teorico'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const round3 = (n: number) => Math.round((n + 1e-9) * 1000) / 1000
const EPS = 0.0001

/** ⚠️ o consumo de produção NÃO move a prateleira (já saiu na separação) — a MESMA
 *  exclusão do `saldo.ts` e do Real vs Teórico. Incluir aqui dobraria a baixa. */
const NAO_PRATELEIRA = 'PRODUCAO_CONSUMO'

/** ⭐ o veredito de uma linha — o semáforo do mock, decidido no SERVIDOR */
export type Veredito = 'FALTOU_GRANDE' | 'FALTOU_PEQUENO' | 'SOBROU' | 'BATEU' | 'SEM_CONTAGEM'

/**
 * ⭐ O DEGRAU ENTRE "faltou grande" e "faltou pequeno" (vermelho × âmbar).
 *
 * ⚠️ É em DINHEIRO, não em %: 3% de um item barato não tira o sono de ninguém, e R$ 100
 * somem do caixa do mesmo jeito venham de onde vierem. É a mesma régua do ranking (*"o
 * mundo prioriza R$, não %"*) e do freio da contagem (23/08), que também é em dinheiro.
 */
export const DEGRAU_VERMELHO = 50

export interface BaldeDaConta {
  chave: 'comprou' | 'produziu' | 'vendeu' | 'perdas' | 'devolveu' | 'estornos'
  rotulo: string
  qtd: number
  valor: number
  /** quantos movimentos formaram o balde — o "1 nota" / "3 ordens" da tela */
  movimentos: number
  /**
   * ⭐⭐ A RESSALVA ESCRITA (v1.1, ordem do dono): *"se a baixa de vendas de HOJE ainda não
   * foi lançada, a linha do «vendeu» diz isso — nunca fingir que já desceu o que não
   * desceu."* O número continua sendo o que o sistema SABE; o que muda é ele parar de se
   * passar por completo.
   */
  ressalva?: string
}

export interface ContaDePadeiro {
  /** AAAA-MM-DD da contagem anterior (o "tinha") — null na 1ª contagem do item */
  desde: string | null
  /** AAAA-MM-DD da contagem que dá o veredito — ou HOJE, quando ainda não houve contagem */
  ate: string
  /** ⭐ o tamanho REAL da janela, escrito na tela pra nunca mentir */
  diasDaJanela: number | null
  tinha: number
  baldes: BaldeDaConta[]
  /**
   * ⭐⭐ v1.1: com contagem é o **DEVIA TER** (o `saldoSistema` gravado no instante); sem
   * contagem é o **DEVE TER AGORA** (o saldo do sistema hoje). O número é o mesmo tipo de
   * coisa — o que muda é o tempo verbal, e a tela troca o rótulo.
   */
  deviaTer: number
  /** ⛔ `null` quando ainda não contaram — a variância continua exigindo contagem */
  contamos: number | null
  faltou: number | null
  faltouValor: number | null
  /**
   * ⛔ `tinha + Σbaldes` tem que dar `deviaTer`. Quando não dá (movimento datado fora de
   * ordem, ajuste avulso no meio), a tela **DIZ** em vez de mostrar uma conta que não
   * fecha — *"número que não soma é como a confiança na tela se perde"*.
   */
  naoExplicado: number
}

export interface LinhaDoRadar {
  itemId: string
  nome: string
  unidadeControle: string
  custoMedio: number | null
  /**
   * ⭐⭐ v1.1 — **TODA LINHA DIZ QUANTO O SISTEMA ACHA QUE TEM AGORA** (decisão do dono).
   * ⛔ Vem da MESMA porta da Posição (`saldosDaEmpresa`): segunda régua de saldo aqui
   * faria a tela do Radar e a da Posição discordarem sobre o mesmo item.
   */
  saldoSistema: number
  valorSistema: number
  veredito: Veredito
  /** null quando SEM_CONTAGEM — nunca 0 */
  faltou: number | null
  faltouValor: number | null
  /** AAAA-MM-DD da última contagem do item (mesmo fora do período) */
  ultimaContagem: string | null
  conta: ContaDePadeiro | null
}

export interface PlacarDoRadar {
  /** Σ dos vereditos das listas — o número grande */
  valor: number
  tom: 'FALTOU' | 'SOBROU' | 'BATEU' | 'SEM_CONTAGEM'
  /**
   * ⭐ v1.1 — o que as listas valem NO SISTEMA agora. Sem contagem o placar mostra ISTO no
   * lugar do traço: *"suas listas somam R$ X no sistema agora"*. ⛔ Não é variância e a
   * tela não pode pintá-lo de vermelho — é o tamanho do que está sendo vigiado.
   */
  valorNoSistema: number
  itensContados: number
  itensNasListas: number
  /** o item que mais pesou ("quase todo no queijo") — null quando nada faltou */
  maiorOfensor: string | null
  /**
   * ⭐⭐ O QUE ESTÁ FORA DAS LISTAS (honestidade que o desenho exige): o placar soma o que
   * o dono VIGIA. Se houver furo fora disso, ele aparece nomeado — senão o número grande
   * subestimaria em silêncio, que é a família do *"erro disfarçado de vazio"*.
   */
  foraDasListasValor: number
  foraDasListasItens: number
}

export interface RadarDoEstoque {
  de: string
  ate: string
  placar: PlacarDoRadar
  caros: LinhaDoRadar[]
  porcoes: LinhaDoRadar[]
  /** ⭐ o gráfico do computador: um ponto por dia do período (null = dia sem contagem) */
  porDia: { dia: string; valor: number | null }[]
  avisos: string[]
}

/** ⚠️ a fronteira do dia é a do BRASIL — o servidor roda em UTC e às 21h já viraria amanhã */
function diaBR(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}
const hojeBR = () => diaBR(new Date())
const br = (d: string) => d.split('-').reverse().slice(0, 2).join('/')

export function vereditoDe(faltouValor: number | null): Veredito {
  if (faltouValor == null) return 'SEM_CONTAGEM'
  if (Math.abs(faltouValor) < 0.005) return 'BATEU'
  if (faltouValor > 0) return 'SOBROU'
  return -faltouValor >= DEGRAU_VERMELHO ? 'FALTOU_GRANDE' : 'FALTOU_PEQUENO'
}

/**
 * ⭐ A ORDEM DA LISTA — *"quem faltou mais DINHEIRO primeiro"*.
 *
 * ⚠️ E o resto da ordem não é detalhe: quem BATEU ou SOBROU vem depois (é notícia boa, não
 * trabalho), e **"falta contar" fica por último** — é ausência de medição, e no topo ela
 * empurraria pra baixo o furo que existe.
 */
export function ordenarPorDinheiro(linhas: LinhaDoRadar[]): LinhaDoRadar[] {
  const peso = (l: LinhaDoRadar) =>
    l.veredito === 'SEM_CONTAGEM' ? 3 : (l.faltouValor ?? 0) < 0 ? 0 : l.veredito === 'SOBROU' ? 1 : 2
  return [...linhas].sort((a, b) => {
    const pa = peso(a), pb = peso(b)
    if (pa !== pb) return pa - pb
    return (a.faltouValor ?? 0) - (b.faltouValor ?? 0)
  })
}

interface ContagemDaLinha {
  itemId: string
  contadoEm: Date
  saldoSistema: number
  qtdContada: number
  divergencia: number
  valorDivergencia: number
}

/**
 * ⭐⭐ A PORTA ÚNICA. Tudo que a tela do Radar mostra sai daqui — placar, linhas, conta de
 * padeiro e gráfico. Uma segunda consulta na tela seria a segunda derivação de sempre.
 */
export async function calcularFechamentoDoDia(
  input: { companyId: string; de: string; ate: string; caros: string[]; porcoes: string[] },
  db: PrismaClient = defaultPrisma,
): Promise<RadarDoEstoque> {
  const avisos: string[] = []
  let de = input.de
  if (de < PISO_DADOS) {
    avisos.push(`O período começa em ${PISO_DADOS.split('-').reverse().join('/')}: antes disso o estoque tem erro conhecido, e variância sobre dado torto aponta furo que não existe.`)
    de = PISO_DADOS
  }
  const ate = input.ate
  const inicio = new Date(`${de}T00:00:00-03:00`)
  const fim = new Date(`${ate}T23:59:59.999-03:00`)
  const daLista = [...new Set([...input.caros, ...input.porcoes])]

  const [itens, contagensNoPeriodo, saldos, baixaNaPonta] = await Promise.all([
    db.stockItem.findMany({
      where: { companyId: input.companyId, id: { in: daLista } },
      select: { id: true, nome: true, unidadeControle: true },
    }),
    // ⭐ TODAS as contagens do período (não só as das listas): o placar precisa do "fora
    // das listas" pra não subestimar em silêncio.
    db.stockContagemItem.findMany({
      where: { companyId: input.companyId, contadoEm: { gte: inicio, lte: fim } },
      select: { itemId: true, contadoEm: true, saldoSistema: true, qtdContada: true, divergencia: true, valorDivergencia: true },
      orderBy: { contadoEm: 'asc' },
    }),
    // ⭐ a MESMA porta da Posição — saldo, valor e custo médio de uma vez só
    saldosDaEmpresa(db, input.companyId),
    /**
     * ⭐⭐ v1.1 — *"nunca fingir que já desceu o que não desceu"*: o dia da ponta já teve
     * baixa de venda? Uma consulta por TELA (não por item), e a ressalva sai daqui.
     */
    db.stockMovement.findFirst({
      where: {
        companyId: input.companyId, tipo: { in: [...TIPOS.VENDA] },
        dataMovimento: { gte: new Date(`${ate}T00:00:00-03:00`), lte: new Date(`${ate}T23:59:59.999-03:00`) },
      },
      select: { id: true },
    }),
  ])
  const custos = new Map(saldos.map((x) => [x.itemId, x.custoMedio]))
  const saldoDe = new Map(saldos.map((x) => [x.itemId, x.saldo]))
  const valorDe = new Map(saldos.map((x) => [x.itemId, x.valor]))
  const ressalvaDaVenda = baixaNaPonta
    ? undefined
    : `as vendas de ${ate === hojeBR() ? 'hoje' : br(ate)} ainda não foram baixadas`

  /** a contagem de REFERÊNCIA de cada item = a mais recente dentro do período */
  const refPorItem = new Map<string, ContagemDaLinha>()
  for (const c of contagensNoPeriodo) refPorItem.set(c.itemId, c)

  /**
   * ⭐ A CONTAGEM ANTERIOR — é ela que dá o "tinha" e o tamanho da janela.
   *
   * ⭐⭐ v1.1: a busca virou **"a última contagem antes do fim da janela"**, e isso cobre os
   * DOIS casos com uma régua só — com contagem de referência a janela fecha nela; sem
   * contagem ela fecha no fim do período, e o "tinha" continua sendo a última vez que
   * alguém contou. *Um caminho, não um `if` por caso.*
   */
  const fimDaJanelaDe = (itemId: string) => refPorItem.get(itemId)?.contadoEm ?? fim
  const anteriores = daLista.length
    ? await Promise.all(daLista.map(async (itemId) => {
      const ant = await db.stockContagemItem.findFirst({
        where: { companyId: input.companyId, itemId, contadoEm: { lt: fimDaJanelaDe(itemId) } },
        orderBy: { contadoEm: 'desc' },
        select: { contadoEm: true, qtdContada: true },
      })
      return [itemId, ant] as const
    }))
    : []
  const antPorItem = new Map(anteriores)

  // ⭐ a última contagem de CADA item da lista, mesmo fora do período (pra tela dizer
  // "última contagem 18/09" no estado SEM_CONTAGEM em vez de calar)
  const ultimas = daLista.length
    ? await db.stockContagemItem.findMany({
      where: { companyId: input.companyId, itemId: { in: daLista } },
      select: { itemId: true, contadoEm: true },
      orderBy: { contadoEm: 'desc' },
    })
    : []
  const ultimaPorItem = new Map<string, Date>()
  for (const u of ultimas) if (!ultimaPorItem.has(u.itemId)) ultimaPorItem.set(u.itemId, u.contadoEm)

  // ── os baldes: o ledger entre as duas contagens de cada item ──────────────────
  // ⭐ v1.1 — TODO item da lista tem janela, tenha contagem ou não
  const janelas = daLista.map((itemId) => ({
    itemId,
    t0: antPorItem.get(itemId)?.contadoEm ?? null,
    t1: fimDaJanelaDe(itemId),
  }))

  const movs = janelas.length
    ? await db.stockMovement.findMany({
      where: {
        companyId: input.companyId,
        itemId: { in: janelas.map((j) => j.itemId) },
        tipo: { notIn: [NAO_PRATELEIRA, ...TIPOS.AJUSTE] },
        dataMovimento: { lte: fim },
      },
      select: { itemId: true, tipo: true, quantidade: true, custoTotal: true, dataMovimento: true },
    })
    : []
  const movsPorItem = new Map<string, typeof movs>()
  for (const m of movs) movsPorItem.set(m.itemId, [...(movsPorItem.get(m.itemId) ?? []), m])

  const linhaDe = (itemId: string): LinhaDoRadar => {
    const it = itens.find((i) => i.id === itemId)
    const custoMedio = custos.get(itemId) ?? null
    const ultima = ultimaPorItem.get(itemId) ?? null
    const ref = refPorItem.get(itemId)
    const base: LinhaDoRadar = {
      itemId,
      nome: it?.nome ?? '(item removido)',
      unidadeControle: it?.unidadeControle ?? '—',
      custoMedio,
      // ⭐ v1.1 — o que o SISTEMA diz que tem agora, em toda linha (a porta da Posição)
      saldoSistema: round3(saldoDe.get(itemId) ?? 0),
      valorSistema: round2(valorDe.get(itemId) ?? 0),
      veredito: 'SEM_CONTAGEM',
      faltou: null,
      faltouValor: null,
      ultimaContagem: ultima ? diaBR(ultima) : null,
      conta: null,
    }

    /**
     * ⭐⭐ v1.1 — A CONTA DE PADEIRO ABRE **MESMO SEM CONTAGEM** (decisão do dono).
     *
     * ⛔ E ela continua **não inventando variância**: sem contagem, `contamos` e `faltou`
     * vão `null`, e a tela escreve *"— falta contar"* nas duas últimas linhas. O que o
     * sistema SABE (tinha → comprou → vendeu → deve ter agora) ele mostra; o que depende
     * de alguém ir lá contar, ele diz que falta.
     */
    const j = janelas.find((x) => x.itemId === itemId)
    if (!j) return base
    const ms = (movsPorItem.get(itemId) ?? []).filter(
      (m) => (j.t0 === null || m.dataMovimento > j.t0) && m.dataMovimento <= j.t1,
    )
    const balde = (chave: BaldeDaConta['chave'], rotulo: string, tipos: readonly string[], inverter = false): BaldeDaConta => {
      const sel = ms.filter((m) => tipos.includes(m.tipo))
      const q = sel.reduce((s, m) => s + m.quantidade, 0)
      const v = sel.reduce((s, m) => s + m.custoTotal, 0)
      return { chave, rotulo, qtd: round3(inverter ? -q : q), valor: round2(Math.abs(v)), movimentos: sel.length }
    }
    const vendeu = balde('vendeu', 'vendeu (pelas fichas)', TIPOS.VENDA)
    // ⭐ a ressalva só faz sentido se a janela ALCANÇA o dia da ponta
    if (ressalvaDaVenda && diaBR(j.t1) === ate) vendeu.ressalva = ressalvaDaVenda
    const baldes = [
      balde('comprou', 'comprou', TIPOS.ENTRADA),
      balde('produziu', 'produziu', TIPOS.GERACAO),
      vendeu,
      balde('perdas', 'perdas lançadas', TIPOS.PERDA),
      balde('devolveu', 'separado pra produção', [...TIPOS.SEPARACAO, ...TIPOS.DEVOLUCAO]),
      balde('estornos', 'estornos', TIPOS.ESTORNO),
    ]
    const somaBaldes = baldes.reduce((s, b) => s + b.qtd, 0)
    const tinha = round3(antPorItem.get(itemId)?.qtdContada
      ?? (ref ? ref.saldoSistema - somaBaldes : 0))
    /**
     * ⭐ COM contagem, o "devia ter" é o `saldoSistema` **gravado** no instante dela.
     * ⭐ SEM contagem, é o que o ledger explica no fim da janela (`tinha + baldes`) —
     * ⛔ e NÃO o saldo de hoje: num período passado, o saldo de hoje seria outro número e
     * a conta mentiria o fechamento daquela janela.
     */
    const deviaTer = ref ? round3(ref.saldoSistema) : round3(tinha + somaBaldes)
    const naoExplicado = round3(deviaTer - (tinha + somaBaldes))
    const t0 = j.t0
    const conta: ContaDePadeiro = {
      desde: t0 ? diaBR(t0) : null,
      ate: diaBR(j.t1),
      diasDaJanela: t0 ? Math.max(0, Math.round((+j.t1 - +t0) / 86_400_000)) : null,
      tinha,
      baldes: baldes.filter((b) => Math.abs(b.qtd) > EPS || b.movimentos > 0),
      deviaTer,
      // ⛔ sem contagem não existe "real" — `null`, e a tela escreve "— falta contar"
      contamos: ref ? round3(ref.qtdContada) : null,
      faltou: ref ? round3(ref.divergencia) : null,
      faltouValor: ref ? round2(ref.valorDivergencia) : null,
      naoExplicado: Math.abs(naoExplicado) < 0.005 ? 0 : naoExplicado,
    }
    if (!ref) return { ...base, conta }
    return {
      ...base,
      veredito: vereditoDe(round2(ref.valorDivergencia)),
      faltou: round3(ref.divergencia),
      faltouValor: round2(ref.valorDivergencia),
      conta,
    }
  }

  const caros = ordenarPorDinheiro(input.caros.map(linhaDe))
  const porcoes = ordenarPorDinheiro(input.porcoes.map(linhaDe))
  const todas = [...caros, ...porcoes]

  // ── o placar: Σ dos vereditos das listas ─────────────────────────────────────
  const comContagem = todas.filter((l) => l.faltouValor != null)
  const valor = round2(comContagem.reduce((s, l) => s + (l.faltouValor ?? 0), 0))
  const piores = comContagem.filter((l) => (l.faltouValor ?? 0) < 0).sort((a, b) => a.faltouValor! - b.faltouValor!)

  const naLista = new Set(daLista)
  const fora = contagensNoPeriodo.filter((c) => !naLista.has(c.itemId))
  const foraPorItem = new Map<string, number>()
  for (const c of fora) foraPorItem.set(c.itemId, c.valorDivergencia)

  const placar: PlacarDoRadar = {
    valor: Math.abs(valor),
    tom: comContagem.length === 0 ? 'SEM_CONTAGEM' : valor < -0.005 ? 'FALTOU' : valor > 0.005 ? 'SOBROU' : 'BATEU',
    itensContados: comContagem.length,
    itensNasListas: todas.length,
    maiorOfensor: piores[0]?.nome ?? null,
    foraDasListasValor: round2([...foraPorItem.values()].reduce((s, v) => s + v, 0)),
    foraDasListasItens: foraPorItem.size,
    // ⭐ v1.1: sem contagem o placar deixa de ser um traço — ele diz o tamanho do que
    // está sendo vigiado. ⛔ Não é variância: a tela não pinta de vermelho.
    valorNoSistema: round2(todas.reduce((s, l) => s + l.valorSistema, 0)),
  }

  // ── o gráfico por dia (o computador desenha; o celular ignora) ────────────────
  const porDiaMap = new Map<string, number>()
  for (const c of contagensNoPeriodo) {
    if (!naLista.has(c.itemId)) continue
    const d = diaBR(c.contadoEm)
    porDiaMap.set(d, round2((porDiaMap.get(d) ?? 0) + c.valorDivergencia))
  }
  const porDia: { dia: string; valor: number | null }[] = []
  for (let t = new Date(`${de}T12:00:00-03:00`); diaBR(t) <= ate; t = new Date(+t + 86_400_000)) {
    const d = diaBR(t)
    // ⛔ dia SEM contagem é `null`, nunca 0 — no gráfico ele vira barra vazia, e zero se
    // leria como "bateu certinho" (a mesma régua do "falta contar" da linha).
    porDia.push({ dia: d, valor: porDiaMap.has(d) ? porDiaMap.get(d)! : null })
  }

  if (todas.length === 0) {
    avisos.push('Suas listas estão vazias — escolha os itens caros e as porções que você quer vigiar pra o radar ter o que apontar.')
  } else if (comContagem.length === 0) {
    avisos.push('Nenhum item das suas listas foi contado neste período. Sem contagem não existe "real", então não há variância a mostrar.')
  }

  return { de, ate, placar, caros, porcoes, porDia, avisos }
}
