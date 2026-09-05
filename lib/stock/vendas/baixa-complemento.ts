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
import { ehLinhaDePeriodo } from './import-complementos'
import { criarMovimento, estornarMovimento } from '../movement'
import { custoMedioPorItem, recomputeSaldoCache } from '../saldo'

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
}

type Db = PrismaClient | Prisma.TransactionClient

/** as BAIXA_VENDA ativas (não estornadas) de um dia de complementos */
async function baixasAtivas(db: Db, companyId: string, importId: string) {
  const baixas = await db.stockMovement.findMany({
    where: { companyId, receiptId: importId, tipo: TIPO_BAIXA },
    select: { id: true, itemId: true, quantidade: true },
  })
  if (!baixas.length) return []
  const estornadas = new Set((await db.stockMovement.findMany({
    where: { companyId, tipo: 'ESTORNO', estornoDeId: { in: baixas.map((b) => b.id) } },
    select: { estornoDeId: true },
  })).map((e) => e.estornoDeId))
  return baixas.filter((b) => !estornadas.has(b.id))
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

  const importId = linhas[0].importId
  const ehPeriodo = ehLinhaDePeriodo(importId)

  const maps = await db.stockVendaComplementoMap.findMany({
    where: { companyId, nomeSuitable: { in: linhas.map((l) => l.nomeSuitable) } },
    select: { nomeSuitable: true, alvoTipo: true, fichaId: true },
  })
  const porNome = new Map(maps.map((m) => [m.nomeSuitable, m]))

  const ctx = await montarCtx(companyId, db as PrismaClient)
  const agregado = new Map<string, number>()
  const complementos: PlanoComplementos['complementos'] = []
  const pendentes: PlanoComplementos['pendentes'] = []
  const ignorados: PlanoComplementos['ignorados'] = []

  for (const l of linhas) {
    const m = porNome.get(l.nomeSuitable)
    if (!m) { pendentes.push({ nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias }); continue }
    if (m.alvoTipo !== 'FICHA' || !m.fichaId) { ignorados.push({ nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias }); continue }

    // ⭐ 1 ocorrência = 1 explosão da ficha (a régua do dono), pelo motor de sempre
    const acc = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId: m.fichaId }, l.ocorrencias, ctx, acc)
    for (const [itemId, qtd] of acc) agregado.set(itemId, round2((agregado.get(itemId) ?? 0) + qtd))
    complementos.push({
      nomeSuitable: l.nomeSuitable, ocorrencias: l.ocorrencias,
      alvo: ctx.nomeItem.get(ctx.fichaById?.get(m.fichaId)?.itemProduzidoId ?? '') ?? '(ficha)',
      baixa: [...acc.entries()].map(([itemId, qtd]) => ({ nome: ctx.nomeItem.get(itemId) ?? '(item)', qtd: round2(qtd) })),
    })
  }

  const custoMap = await custoMedioPorItem(db as PrismaClient, companyId)
  const saldos = await saldoAtualPorItem(db, companyId, [...agregado.keys()])
  const agregada: ItemBaixado[] = [...agregado.entries()].map(([itemId, qtd]) => {
    const custo = custoMap.get(itemId) ?? null
    return {
      itemId, nome: ctx.nomeItem.get(itemId) ?? '(item)', qtd: round2(qtd),
      custoMedio: custo, valor: custo != null ? round2(qtd * custo) : null,
      saldoDepois: round2((saldos.get(itemId) ?? 0) - qtd),
    }
  })

  const ativas = await baixasAtivas(db, companyId, importId)
  const baixadoHoje = new Map<string, number>()
  for (const b of ativas) baixadoHoje.set(b.itemId, round2((baixadoHoje.get(b.itemId) ?? 0) + Math.abs(b.quantidade)))
  // ⛔ a marca é DERIVADA (nunca gravada): compara o que ESTÁ baixado com o que as linhas de
  // hoje mandam baixar. Flag gravada envelhece e passa a mentir; esta se corrige sozinha.
  const precisaReprocessar = ativas.length > 0 && (
    baixadoHoje.size !== agregado.size
    || [...agregado.entries()].some(([itemId, qtd]) => Math.abs((baixadoHoje.get(itemId) ?? 0) - qtd) > 0.001)
  )

  return {
    data, importId, ehPeriodo, complementos, pendentes, ignorados, agregada,
    totalOcorrencias: linhas.reduce((s, l) => s + l.ocorrencias, 0),
    ocorrenciasBaixadas: complementos.reduce((s, c) => s + c.ocorrencias, 0),
    jaBaixado: ativas.length > 0,
    precisaReprocessar,
  }
}

/** saldo atual dos itens que vão baixar (pra a tela mostrar o "depois") */
async function saldoAtualPorItem(db: Db, companyId: string, itemIds: string[]): Promise<Map<string, number>> {
  if (!itemIds.length) return new Map()
  const movs = await db.stockMovement.findMany({
    where: { companyId, itemId: { in: itemIds } },
    select: { itemId: true, quantidade: true, tipo: true },
  })
  const saldo = new Map<string, number>()
  for (const m of movs) {
    // ⚠️ PRODUCAO_CONSUMO fica FORA, como no `saldo.ts`: é transferência interna (o insumo já
    // saiu da prateleira na separação). Incluir aqui contaria a baixa duas vezes.
    if (m.tipo === 'PRODUCAO_CONSUMO') continue
    saldo.set(m.itemId, round2((saldo.get(m.itemId) ?? 0) + m.quantidade))
  }
  return saldo
}

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

    const custoMap = await custoMedioPorItem(tx as PrismaClient, companyId)
    for (const a of plano.agregada) {
      if (a.qtd <= 0) continue
      const custo = custoMap.get(a.itemId) ?? 0
      await criarMovimento(tx, {
        companyId, itemId: a.itemId, tipo: TIPO_BAIXA,
        quantidade: -a.qtd, custoUnitario: custo, custoTotal: round2(-a.qtd * custo),
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
      where: { companyId }, select: { data: true, importId: true, ocorrencias: true, criadoEm: true },
    }),
    // ⭐ a régua ÚNICA da dispensa (05/09) — a tela, o aviso e o juiz leem a MESMA
    diasDispensados(db, companyId, 'COMPLEMENTO'),
  ])
  const porDia = new Map<string, { importId: string; linhas: number; ocorrencias: number; importadoEm: Date }>()
  for (const l of linhas) {
    const k = l.data.toISOString().slice(0, 10)
    const a = porDia.get(k) ?? { importId: l.importId, linhas: 0, ocorrencias: 0, importadoEm: l.criadoEm }
    a.linhas++; a.ocorrencias += l.ocorrencias
    // ⚠️ o mais ANTIGO manda: é quando o dia entrou, e é dele que sai a idade do aviso
    if (l.criadoEm < a.importadoEm) a.importadoEm = l.criadoEm
    porDia.set(k, a)
  }

  const out: DiaComplemento[] = []
  for (const [data, a] of [...porDia.entries()].sort((x, y) => y[0].localeCompare(x[0]))) {
    const plano = await montarPlanoComplementos(companyId, data, db).catch(() => null)
    out.push({
      data, importId: a.importId, ehPeriodo: ehLinhaDePeriodo(a.importId),
      linhas: a.linhas, ocorrencias: a.ocorrencias,
      baixado: plano?.jaBaixado ?? false,
      precisaReprocessar: plano?.precisaReprocessar ?? false,
      dispensado: dispensados.has(data),
      importadoEm: a.importadoEm.toISOString(),
    })
  }
  return out
}
