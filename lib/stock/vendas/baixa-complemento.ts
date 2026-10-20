// ⭐⭐⭐ A BAIXA DOS COMPLEMENTOS — o sabor sai do estoque (03/09/2026).
//
// ⭐ A REGRA DE NEGÓCIO, do dono: **1 ocorrência = 1 explosão da ficha, SEMPRE**. Quem
// garante é o CARDÁPIO — pizza pequena obriga 2 sabores, grande 4 — então uma pizza grande
// inteira de calabresa chega como **4 ocorrências**. ⚠️ NADA de fração por tamanho: o PDV já
// entregou a conta feita.
//
// ⭐⭐ E O MOTOR É O MESMO DA BAIXA DE PRODUTOS (`explodir`), não uma segunda cópia: a
// decisão "pack × explodir" é por COMPONENTE e já está lá, testada. Um segundo motor
// divergiria na primeira borda — é a doença que custou 7 detectores de transferência a este
// projeto.
//
// ⛔⛔ AS DUAS ARMADILHAS, escritas antes de o problema existir (02/09) e agora fechadas:
//   1. LINHA DE PERÍODO NÃO BAIXA. O relatório do Suitable não traz data; o dono pode
//      exportar um DIA ou um PERÍODO. Período baixando como dia mandaria **7.648 ocorrências
//      do mês inteiro** ao ledger com cara de rotina.
//   2. REIMPORT DE DIA JÁ BAIXADO não se resolve em silêncio. As linhas são substituídas no
//      import; se a baixa ficasse como está, sobrariam **linha nova + movimento velho**
//      convivendo — o estoque baixado por um número que a tela não mostra mais.

import { diasDispensados } from './dia-dispensado'
import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { montarCtx, explodir } from './baixa-venda'
import { ehLinhaDePeriodo } from './identidade-import-complemento'
import { confrontarMotorComLedger } from './confronto-motor-ledger'
import { criarMovimento, estornarMovimento } from '../movement'
import { recomputeSaldoCache } from '../saldo'
import { custoDaBaixa, estadoParaBaixa, valorPrevistoDaBaixa } from './custo-da-baixa'

export class BaixaComplementoError extends Error {}

const TIPO_BAIXA = 'BAIXA_VENDA'
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const diaUtc = (s: string) => new Date(`${s.slice(0, 10)}T00:00:00.000Z`)

export interface ItemBaixado {
  itemId: string
  nome: string
  qtd: number
  custoMedio: number | null
  valor: number | null
  /** ⚠️ o saldo que fica DEPOIS desta baixa — negativo é sinal, não erro (ver abaixo) */
  saldoDepois: number
}

export interface PlanoComplementos {
  data: string
  importId: string
  /** ⛔ import de PERÍODO: mostra tudo, mas NÃO deixa baixar */
  ehPeriodo: boolean
  /** o que vai baixar, por complemento */
  complementos: { nomeSuitable: string; ocorrencias: number; alvo: string; baixa: { nome: string; qtd: number }[] }[]
  /** ⚠️ nomes sem destino: NÃO baixam e NÃO somem — ficam à vista */
  pendentes: { nomeSuitable: string; ocorrencias: number }[]
  ignorados: { nomeSuitable: string; ocorrencias: number }[]
  agregada: ItemBaixado[]
  totalOcorrencias: number
  ocorrenciasBaixadas: number
  /** já existe baixa ATIVA deste dia? (então este plano é um REPROCESSO) */
  jaBaixado: boolean
  /** ⛔ o que está baixado HOJE difere do que as linhas atuais mandam baixar */
  precisaReprocessar: boolean
  /**
   * ⭐ As FICHAS que a explosão atravessou (rastro da porta única). O juiz M1 usa pra
   * distinguir *"a receita mudou depois"* de *"alguém baixou fora da porta"*.
   */
  fichasUsadas: string[]
}

type Db = PrismaClient | Prisma.TransactionClient

interface BaixaAtiva { id: string; itemId: string; quantidade: number }

/**
 * ⭐⭐ As BAIXA_VENDA ativas (não estornadas) de N dias, em **2 consultas** — nunca 2 por dia.
 *
 * ⛔ Esta é a ÚNICA régua de *"o que está baixado e ainda vale"* (o estorno do estorna-e-refaz
 * tira a linha de cena). `baixasAtivas` virou casca fina sobre ela: uma segunda implementação
 * divergiria no 1º caso de borda, e aí a LISTA diria "pendente" sobre um dia que o PREVIEW
 * mostra baixado — que é exatamente o tipo de contradição que esta tela já cometeu.
 */
async function baixasAtivasEmLote(
  db: Db, companyId: string, importIds: string[],
): Promise<Map<string, BaixaAtiva[]>> {
  const out = new Map<string, BaixaAtiva[]>()
  for (const i of importIds) out.set(i, [])
  if (!importIds.length) return out

  const baixas = await db.stockMovement.findMany({
    where: { companyId, receiptId: { in: importIds }, tipo: TIPO_BAIXA },
    select: { id: true, itemId: true, quantidade: true, receiptId: true },
  })
  if (!baixas.length) return out

  const estornadas = new Set((await db.stockMovement.findMany({
    where: { companyId, tipo: 'ESTORNO', estornoDeId: { in: baixas.map((b) => b.id) } },
    select: { estornoDeId: true },
  })).map((e) => e.estornoDeId))

  for (const b of baixas) {
    if (estornadas.has(b.id)) continue
    out.get(b.receiptId ?? '')?.push({ id: b.id, itemId: b.itemId, quantidade: b.quantidade })
  }
  return out
}

/** casca fina sobre o lote — a régua mora num lugar só */
async function baixasAtivas(db: Db, companyId: string, importId: string) {
  return (await baixasAtivasEmLote(db, companyId, [importId])).get(importId) ?? []
}

/**
 * DRY-RUN: o que a baixa deste dia faria. **Não grava nada.**
 *
 * ⚠️ SALDO NEGATIVO NÃO BLOQUEIA e não é erro: `INTERMEDIARIO` baixa o **pack pronto**, e
 * negativo quer dizer **"vendeu sem produzir"** — é exatamente o sinal que o dono quer ver.
 * Esconder isso (bloqueando ou zerando) trocaria uma informação verdadeira por um estoque
 * bonito e falso.
 */
export async function montarPlanoComplementos(
  companyId: string, data: string, db: PrismaClient = defaultPrisma,
): Promise<PlanoComplementos> {
  const dia = diaUtc(data)
  const linhas = await db.stockVendaComplementoLinha.findMany({
    where: { companyId, data: dia },
    select: { importId: true, nomeSuitable: true, ocorrencias: true },
  })
  if (!linhas.length) throw new BaixaComplementoError(`Não há complementos importados em ${data}.`)
  return planoDeLinhas(companyId, data, linhas[0].importId, linhas, db)
}

/**
 * ⭐⭐ O MESMO PLANO, A PARTIR DE LINHAS QUE AINDA NÃO ESTÃO NO BANCO (07/09/2026).
 *
 * É o que faz o **preview do import mostrar a baixa** antes do confirmar. ⚠️ E é a MESMA
 * função (`planoDeLinhas`) que a baixa executa — um segundo cálculo "só pro preview" faria a
 * tela prometer um número e o ledger gravar outro, que é a doença que este módulo mais paga.
 */
export async function preverBaixaDasLinhas(
  companyId: string, data: string, importId: string,
  linhas: { nomeSuitable: string; ocorrencias: number }[],
  db: PrismaClient = defaultPrisma,
): Promise<PlanoComplementos> {
  return planoDeLinhas(companyId, data, importId, linhas, db)
}

type Ctx = Awaited<ReturnType<typeof montarCtx>>
type MapaDoNome = Map<string, { alvoTipo: string; fichaId: string | null }>

/**
 * ⭐⭐ A EXPLOSÃO — PURA, e com **UM dono** (20/10/2026).
 *
 * O plano (que a tela de baixa desenha) e a LISTA DE DIAS (que só quer saber se o dia bate
 * com o ledger) precisam do MESMO agregado. ⛔ Enquanto isso vivia dentro de `planoDeLinhas`,
 * a lista tinha duas saídas: ou chamar o plano INTEIRO por dia (o N+1 de 12s que o dono
 * cronometrou) ou escrever a 2ª cópia da explosão — e a 2ª cópia divergiria no 1º componente
 * novo, com a tela dizendo "fecha" e a lista dizendo "pendente".
 *
 * ⚠️ Recebe o `ctx` por PARÂMETRO de propósito: é ele que custa consulta, e o lote monta um
 * só pros N dias.
 */
function explodirLinhas(
  linhas: { nomeSuitable: string; ocorrencias: number }[],
  porNome: MapaDoNome,
  ctx: Ctx,
) {
  const agregado = new Map<string, number>()
  const fichasUsadas = new Set<string>()
  const complementos: PlanoComplementos['complementos'] = []
  const pendentes: PlanoComplementos['pendentes'] = []
  const ignorados: PlanoComplementos['ignorados'] = []

  for (const l of linhas) {
    const m = porNome.get(l.nomeSuitable)
    if (!m) { pendentes.push({ nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias }); continue }
    if (m.alvoTipo !== 'FICHA' || !m.fichaId) { ignorados.push({ nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias }); continue }

    // ⭐ 1 ocorrência = 1 explosão da ficha (a régua do dono), pelo motor de sempre
    const acc = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId: m.fichaId }, l.ocorrencias, ctx, acc, fichasUsadas)
    for (const [itemId, qtd] of acc) agregado.set(itemId, round2((agregado.get(itemId) ?? 0) + qtd))
    complementos.push({
      nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias,
      alvo: ctx.nomeItem.get(ctx.fichaById?.get(m.fichaId)?.itemProduzidoId ?? '') ?? '(ficha)',
      baixa: [...acc.entries()].map(([itemId, qtd]) => ({ nome: ctx.nomeItem.get(itemId) ?? '(item)', qtd: round2(qtd) })),
    })
  }
  return { agregado, fichasUsadas: [...fichasUsadas], complementos, pendentes, ignorados }
}

/** a comparação motor × ledger de UM dia — a régua é a MESMA do plano e do juiz */
function estadoDoDia(agregado: Map<string, number>, ativas: BaixaAtiva[]) {
  const baixadoHoje = new Map<string, number>()
  for (const b of ativas) baixadoHoje.set(b.itemId, round2((baixadoHoje.get(b.itemId) ?? 0) + Math.abs(b.quantidade)))
  return {
    jaBaixado: ativas.length > 0,
    precisaReprocessar: ativas.length > 0 && !confrontarMotorComLedger(agregado, baixadoHoje).fecha,
  }
}

async function planoDeLinhas(
  companyId: string, data: string, importId: string,
  linhas: { nomeSuitable: string; ocorrencias: number }[],
  db: PrismaClient,
): Promise<PlanoComplementos> {
  const ehPeriodo = ehLinhaDePeriodo(importId)

  const maps = await db.stockVendaComplementoMap.findMany({
    where: { companyId, nomeSuitable: { in: linhas.map((l) => l.nomeSuitable) } },
    select: { nomeSuitable: true, alvoTipo: true, fichaId: true },
  })
  const porNome = new Map(maps.map((m) => [m.nomeSuitable, m]))

  const ctx = await montarCtx(companyId, db as PrismaClient)
  const { agregado, fichasUsadas, complementos, pendentes, ignorados } = explodirLinhas(linhas, porNome, ctx)

  /**
   * ⭐⭐ O PREVIEW LÊ O MESMO ESTADO QUE A GRAVAÇÃO (19/10/2026) — e isto fechou **duas**
   * cópias de régua que viviam aqui:
   *
   *   1. **o VALOR** saía de `qtd × custoMedioArredondado`, enquanto o ledger passou a usar
   *      precisão cheia → a tela prometeria `R$ 39,69` e o ledger escreveria `R$ 39,57`.
   *   2. ⛔⛔ **o SALDO DEPOIS** saía de um `saldoAtualPorItem` LOCAL, que excluía só o
   *      `PRODUCAO_CONSUMO` e **não conhecia o `idsDeEstornoInterno`** (a régua de 09/09, que
   *      tira o estorno de movimento interno da prateleira). Era uma **QUARTA** resposta pra
   *      *"qual é o saldo de prateleira?"* — e ela podia mostrar na tela um "depois" que a
   *      Posição não confirma. Agora os dois saem de `saldosDaEmpresa`, o dono da pergunta.
   *
   * ⚠️ O `custoMedio` exibido continua **arredondado**: é leitura, e é o número da Posição.
   */
  const estado = await estadoParaBaixa(db, companyId)
  const agregada: ItemBaixado[] = [...agregado.entries()].map(([itemId, qtd]) => ({
    itemId, nome: ctx.nomeItem.get(itemId) ?? '(item)', qtd: round2(qtd),
    custoMedio: estado.porItem.get(itemId)?.custoMedio ?? null,
    valor: valorPrevistoDaBaixa(itemId, round2(qtd), estado),
    saldoDepois: round2((estado.porItem.get(itemId)?.saldo ?? 0) - qtd),
  }))

  /**
   * ⛔ A marca é DERIVADA (nunca gravada): compara o que ESTÁ baixado com o que as linhas de
   * hoje mandam baixar. Flag gravada envelhece e passa a mentir; esta se corrige sozinha.
   *
   * ⭐⭐ E A RÉGUA SAIU DAQUI (02/10/2026): quem responde *"o ledger bate com o motor?"* é
   * `confrontarMotorComLedger`, a MESMA função que o juiz noturno usa. Enquanto a comparação
   * morava num `some(...)` local, o juiz teria que escrever a dele — e as duas divergiriam no
   * 1º caso de borda, com a tela dizendo "fecha" e o e-mail dizendo "não fecha".
   * ⭐ 20/10: `estadoDoDia` é o mesmo que a LISTA DE DIAS consome, em lote.
   */
  const { jaBaixado, precisaReprocessar } =
    estadoDoDia(agregado, await baixasAtivas(db, companyId, importId))

  return {
    data, importId, ehPeriodo, complementos, pendentes, ignorados, agregada,
    totalOcorrencias: linhas.reduce((s, l) => s + l.ocorrencias, 0),
    ocorrenciasBaixadas: complementos.reduce((s, c) => s + c.ocorrencias, 0),
    jaBaixado,
    precisaReprocessar,
    fichasUsadas,
  }
}

// ⛔⛔ `saldoAtualPorItem` MORREU AQUI (19/10/2026) — era a **4ª** resposta pra *"qual é o
// saldo de prateleira?"*, e ela só conhecia metade da régua: excluía o `PRODUCAO_CONSUMO` e
// **não conhecia o `idsDeEstornoInterno`** (09/09). Quem responde é `saldosDaEmpresa`, pela
// `estadoParaBaixa`. ⚠️ **Apagada, não deixada sem chamador:** enquanto a função existe no
// arquivo, alguém a religa — a lição do `GruposSugeridos` (23/09).

export interface ReciboComplementos {
  importId: string
  data: string
  complementosBaixados: number
  ocorrencias: number
  itensBaixados: number
  valorBaixado: number
  pendentes: number
  estornou: number
}

/**
 * EXECUTA a baixa do dia. Idempotente: rodar de novo **estorna** as baixas ativas e refaz.
 *
 * ⛔ RECUSA import de PERÍODO — ver a armadilha 1 no topo do arquivo.
 * ⚠️ Movimento é IMUTÁVEL: correção é sempre estorno + novo, nunca UPDATE.
 */
export async function processarComplementos(
  companyId: string, data: string, userId?: string, db: PrismaClient = defaultPrisma,
): Promise<ReciboComplementos> {
  const plano = await montarPlanoComplementos(companyId, data, db)
  if (plano.ehPeriodo) {
    throw new BaixaComplementoError(
      'Este import é de um PERÍODO, não de um dia — ele serve pra montar a lista de sabores, não pra baixar estoque. '
      + 'Importe o relatório do DIA pra baixar.',
    )
  }
  if (!plano.complementos.length) {
    throw new BaixaComplementoError('Nenhum complemento deste dia tem ficha ainda — nada a baixar.')
  }

  const dia = diaUtc(data)
  const estornou = await db.$transaction(async (tx) => {
    const ativas = await baixasAtivas(tx, companyId, plano.importId)
    for (const b of ativas) await estornarMovimento(tx, b.id, { criadoPorId: userId ?? null })

    /**
     * ⭐⭐ O CUSTO VEM DA PORTA ÚNICA (19/10/2026) — e isto é a cura de um defeito medido.
     *
     * ⛔⛔ **Antes, aqui:** `custoMedioPorItem` (o custo **arredondado em 2 casas**, que é
     * número de TELA) multiplicado pela quantidade. A baixa dos complementos de 17/10 foi
     * **BARRADA pelo guarda do estado impossível**:
     *
     * ```
     * «porçao calabresa ralada 50 grama» · 49 UN · valor R$ 39,57
     *    HOJE: custo 0,81          × 49 = R$ 39,69  →  final 0 UN / −R$ 0,12  ⛔
     *    A LEI: custo 0,8075510204… × 49 = R$ 39,57  →  final 0 UN /   R$ 0,00  ⭐
     * ```
     *
     * ⭐ Com precisão cheia o resíduo **não nasce**: zerar a quantidade dá
     * `saldo × (valor/saldo) = valor` **exato**. ⚠️ E ela traz de graça a lei de 15/10 — item
     * **negativado** passa a sair pelo **custo vigente** em vez de R$ 0,00 (o furo que pôs
     * 293 movimentos a custo zero no ledger).
     *
     * ⛔ **O guarda ficou como está:** ele pegou um estado que não existe e estava certo.
     */
    const estado = await estadoParaBaixa(tx, companyId)
    for (const a of plano.agregada) {
      if (a.qtd <= 0) continue
      const { custoUnitario, custoTotal } = custoDaBaixa(a.itemId, a.qtd, estado)
      await criarMovimento(tx, {
        companyId, itemId: a.itemId, tipo: TIPO_BAIXA,
        quantidade: -a.qtd, custoUnitario, custoTotal,
        receiptId: plano.importId, origem: 'MANUAL', criadoPorId: userId ?? null, dataMovimento: dia,
      })
    }
    return ativas.length
  })

  await recomputeSaldoCache(db, companyId)
  return {
    importId: plano.importId, data,
    complementosBaixados: plano.complementos.length,
    ocorrencias: plano.ocorrenciasBaixadas,
    itensBaixados: plano.agregada.length,
    valorBaixado: round2(plano.agregada.reduce((s, a) => s + (a.valor ?? 0), 0)),
    pendentes: plano.pendentes.length,
    estornou,
  }
}

export interface DiaComplemento {
  data: string
  importId: string
  ehPeriodo: boolean
  linhas: number
  ocorrencias: number
  baixado: boolean
  /** ⭐ 05/09: o dono decidiu NÃO baixar este dia — sai do aviso e do juiz, reversível */
  dispensado: boolean
  /** quando o dia entrou (a idade que o aviso de 24h usa) */
  importadoEm: string
  precisaReprocessar: boolean
  /**
   * ⛔⛔ `false` = **não deu pra apurar o estado da baixa deste dia**. 20/10: antes isto caía
   * num `.catch(() => false)` e o dia aparecia como **"pendente — não baixou"**, ou seja a
   * tela AFIRMAVA que a baixa não rodou sobre um dia que podia estar baixado.
   * ⭐ *Ausência de MEDIÇÃO não é ausência de baixa* — a mesma régua do "sem contagem" do
   * estoque, e é por isso que o estado é PRÓPRIO em vez de colapsar em `baixado: false`.
   *
   * ⚠️⚠️ **MEDIDO em 20/10, e a honestidade importa: hoje ele é SEMPRE `true`.** A cadeia
   * dentro do `try` (`explodirReceita` → `comoConsome` → `confrontarMotorComLedger`) tem
   * **ZERO `throw`** — ela acumula AVISOS (`FICHA_SEM_COMPONENTE`, `DOSE_ZERO`,
   * `PROFUNDIDADE`) em vez de lançar. ⭐ O campo e a rede ficam porque o CONTRATO é o certo e
   * custam zero: no dia em que a porta da explosão ganhar um `throw` (ciclo, teto novo), o
   * estado honesto já existe e a tela já o desenha. ⛔ O que NÃO se pode é chamá-lo de trava
   * em funcionamento — *linha que não pode falhar é linha que finge ser trava* (a lição do
   * `ehVizinho`, 17/10). Ele é **contrato preparado**, com a medição escrita.
   */
  apurado: boolean
}

/**
 * Os dias importados e o estado da baixa de cada um.
 *
 * ⛔⛔ É AQUI QUE A ARMADILHA 2 FICA VISÍVEL: reimportar um dia já baixado substitui as
 * linhas e o `precisaReprocessar` acende sozinho — **não existe o caminho "substituiu e
 * ninguém soube"**. O gesto de corrigir continua sendo do dono (preview → estorna e refaz),
 * porque mexer no ledger sozinho, a partir de um import, é o oposto da disciplina do módulo.
 */
export async function listarDiasComplemento(
  companyId: string, db: PrismaClient = defaultPrisma,
): Promise<DiaComplemento[]> {
  const [linhas, dispensados] = await Promise.all([
    db.stockVendaComplementoLinha.findMany({
      where: { companyId },
      select: { data: true, importId: true, nomeSuitable: true, ocorrencias: true, criadoEm: true },
    }),
    // ⭐ a régua ÚNICA da dispensa (05/09) — a tela, o aviso e o juiz leem a MESMA
    diasDispensados(db, companyId, 'COMPLEMENTO'),
  ])

  interface Acc { importId: string; linhas: number; ocorrencias: number; importadoEm: Date; nomes: { nomeSuitable: string; ocorrencias: number }[] }
  const porDia = new Map<string, Acc>()
  for (const l of linhas) {
    const k = l.data.toISOString().slice(0, 10)
    const a = porDia.get(k) ?? { importId: l.importId, linhas: 0, ocorrencias: 0, importadoEm: l.criadoEm, nomes: [] }
    a.linhas++; a.ocorrencias += l.ocorrencias
    a.nomes.push({ nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias })
    // ⚠️ o mais ANTIGO manda: é quando o dia entrou, e é dele que sai a idade do aviso
    if (l.criadoEm < a.importadoEm) a.importadoEm = l.criadoEm
    porDia.set(k, a)
  }
  const dias = [...porDia.entries()].sort((x, y) => y[0].localeCompare(x[0]))
  if (!dias.length) return []

  /**
   * ⭐⭐⭐ O LOTE (20/10/2026) — e a medição que o motivou: a lista levava **~12 s** com 42
   * dias, porque montava um PLANO COMPLETO por dia (`montarPlanoComplementos` num `await`
   * dentro do laço). Cada plano relia o mapa, remontava o `ctx` das fichas e varria saldo e
   * custo do ledger inteiro — **42×** — pra a lista aproveitar DOIS booleanos.
   *
   * ⛔ As três leituras caras são **por EMPRESA, não por dia**, então saem do laço e são
   * lidas UMA vez. E `estadoParaBaixa` (saldo/custo) **não entra**: ele serve ao `agregada` do
   * plano, que esta lista não desenha. ⚠️ O guard mede **CONTAGEM DE CONSULTAS que não cresce
   * com N** (o padrão de 28/09, das receitas) — nunca milissegundo, que passa ou falha pela
   * máquina de quem roda.
   */
  const nomes = [...new Set(linhas.map((l) => l.nomeSuitable))]
  const [maps, ctx, ativasPorImport] = await Promise.all([
    db.stockVendaComplementoMap.findMany({
      where: { companyId, nomeSuitable: { in: nomes } },
      select: { nomeSuitable: true, alvoTipo: true, fichaId: true },
    }),
    montarCtx(companyId, db),
    baixasAtivasEmLote(db, companyId, [...new Set(dias.map(([, a]) => a.importId))]),
  ])
  const porNome: MapaDoNome = new Map(maps.map((m) => [m.nomeSuitable, m]))

  return dias.map(([data, a]) => {
    let estado: { jaBaixado: boolean; precisaReprocessar: boolean } | null = null
    try {
      const { agregado } = explodirLinhas(a.nomes, porNome, ctx)
      estado = estadoDoDia(agregado, ativasPorImport.get(a.importId) ?? [])
    } catch {
      // ⛔ não dá pra apurar: NUNCA cai em "pendente" (ver `apurado` acima)
      estado = null
    }
    return {
      data, importId: a.importId, ehPeriodo: ehLinhaDePeriodo(a.importId),
      linhas: a.linhas, ocorrencias: a.ocorrencias,
      baixado: estado?.jaBaixado ?? false,
      precisaReprocessar: estado?.precisaReprocessar ?? false,
      apurado: estado !== null,
      dispensado: dispensados.has(data),
      importadoEm: a.importadoEm.toISOString(),
    }
  })
}

/**
 * ⭐⭐ A BAIXA QUE ANDA JUNTO DO IMPORT (07/09/2026) — decisão do dono.
 *
 * *"O botão 'baixar' separado é estado intermediário que só serve pra ser esquecido — provou
 * isso a semana inteira (dias 02–04 importados e nunca baixados)."*
 *
 * ⚠️ **PADRÃO DO RECEBIMENTO: commit + ponte.** As linhas já estão gravadas quando esta
 * função roda; se a baixa falhar, o import **NÃO se desfaz** — devolve o motivo pra a tela
 * dizer. Uma transação única desfaria um import legítimo por causa de uma ficha com problema,
 * e o dono perderia o arquivo que acabou de subir.
 *
 * ⛔ E "não baixou" NÃO É ERRO em dois casos legítimos, que ganham FRASE em vez de alarme:
 * import de **PERÍODO** (nunca baixa, é a trava de 02/09) e dia em que **nenhum complemento
 * tem ficha ainda** (ele entra na prateleira pra ser mapeado — é o trabalho, não a falha).
 */
export async function baixarSeHouverFicha(
  companyId: string, data: string, userId?: string, db: PrismaClient = defaultPrisma,
): Promise<{ recibo: ReciboComplementos | null; motivo: string | null; falhou: boolean }> {
  try {
    return { recibo: await processarComplementos(companyId, data, userId, db), motivo: null, falhou: false }
  } catch (e) {
    // ⚠️ recusa PREVISTA (período / sem ficha) é informação, não incidente
    if (e instanceof BaixaComplementoError) return { recibo: null, motivo: e.message, falhou: false }
    // ⛔ qualquer outra falha AVISA ALTO e não some: o import ficou gravado sem a baixa, e é
    // exatamente esse estado que o "precisa reprocessar" e o juiz de 24h existem pra cobrar.
    return { recibo: null, motivo: (e as Error).message, falhou: true }
  }
}
