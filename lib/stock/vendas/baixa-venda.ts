// ESTOQUE FASE 3 passo 2 — BAIXA_VENDA. A venda baixa o estoque: produto que MONTA na
// venda (PRODUTO_FINAL) EXPLODE nos componentes recursivamente; intermediário produzido em
// lote (beef, porção) baixa o PACK; matéria-prima/revenda baixa direto. Idempotente por dia
// (reprocessar estorna as baixas anteriores e refaz — movimento é imutável). Só stock_.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { parseSuitable } from './parse-suitable'
import { criarMovimento, estornarMovimento } from '../movement'
import { custoMedioPorItem, recomputeSaldoCache } from '../saldo'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const TIPO_BAIXA = 'BAIXA_VENDA'

// ⭐ EXPORTADOS (27/08) pro hub do cardápio calcular o custo do produto pela MESMA explosão
// que a venda usa pra BAIXAR. Se o cardápio tivesse fórmula própria, o custo da tela e o
// custo que sai do estoque divergiriam no 1º caso de borda — a doença dos 7 detectores de
// par. Nenhuma linha de lógica mudou aqui: só a visibilidade.
export interface Ctx {
  componentesByFicha: Map<string, { itemId: string; qtdPlanejada: number }[]>
  fichaByItemProduzido: Map<string, { id: string; tipoProduto: string }>
  fichaById: Map<string, { id: string; tipoProduto: string; itemProduzidoId: string }>
  nomeItem: Map<string, string>
}

export async function montarCtx(companyId: string, db: PrismaClient): Promise<Ctx> {
  const fichas = await db.stockFicha.findMany({ where: { companyId, ativo: true }, select: { id: true, tipoProduto: true, itemProduzidoId: true, versaoAtual: true } })
  const componentesByFicha = new Map<string, { itemId: string; qtdPlanejada: number }[]>()
  for (const f of fichas) {
    const v = await db.stockFichaVersao.findFirst({ where: { companyId, fichaId: f.id, versao: f.versaoAtual }, select: { id: true } })
    const comps = v ? await db.stockFichaComponente.findMany({ where: { companyId, versaoId: v.id }, select: { itemId: true, qtdPlanejada: true } }) : []
    componentesByFicha.set(f.id, comps)
  }
  const itens = await db.stockItem.findMany({ where: { companyId }, select: { id: true, nome: true } })
  return {
    componentesByFicha,
    fichaByItemProduzido: new Map(fichas.map((f) => [f.itemProduzidoId, { id: f.id, tipoProduto: f.tipoProduto }])),
    fichaById: new Map(fichas.map((f) => [f.id, { id: f.id, tipoProduto: f.tipoProduto, itemProduzidoId: f.itemProduzidoId }])),
    nomeItem: new Map(itens.map((i) => [i.id, i.nome])),
  }
}

/** Explode um alvo (ficha ou item) × qtd em baixas por item (LEAF). PRODUTO_FINAL explode;
 *  intermediário/raw/revenda baixa direto. Recursão limitada (o ciclo já é bloqueado na ficha). */
export function explodir(alvo: { tipo: 'REVENDA'; itemId: string } | { tipo: 'FICHA'; fichaId: string }, qtd: number, ctx: Ctx, acc: Map<string, number>, depth = 0): void {
  if (depth > 12) throw new Error('Explosão de venda muito profunda (ciclo?).')
  if (alvo.tipo === 'REVENDA') { acc.set(alvo.itemId, round2((acc.get(alvo.itemId) ?? 0) + qtd)); return }
  const comps = ctx.componentesByFicha.get(alvo.fichaId) ?? []
  for (const c of comps) {
    const fichaComp = ctx.fichaByItemProduzido.get(c.itemId)
    if (fichaComp && fichaComp.tipoProduto === 'PRODUTO_FINAL') {
      explodir({ tipo: 'FICHA', fichaId: fichaComp.id }, round2(qtd * c.qtdPlanejada), ctx, acc, depth + 1) // monta na venda → explode
    } else {
      acc.set(c.itemId, round2((acc.get(c.itemId) ?? 0) + qtd * c.qtdPlanejada)) // pack/raw/revenda → baixa direto
    }
  }
}

export interface ProdutoBaixa { nome: string; quantidade: number; alvoTipo: 'FICHA' | 'REVENDA'; alvoNome: string; baixa: { itemId: string; nome: string; qtd: number; custoMedio: number | null }[] }
export interface PlanoVenda {
  data: string
  produtos: ProdutoBaixa[]
  pendentes: { nome: string; quantidade: number }[]
  fora: { nome: string; quantidade: number }[] // mapeado, mas o dono NÃO marcou pra este processamento
  agregada: { itemId: string; nome: string; qtd: number; custoMedio: number | null; valor: number | null }[]
  totalUnidades: number
  totalMapeados: number
  totalPendentes: number
}

export interface LinhaVenda { produto: string; quantidade: number; valorTotal: number }

/** DRY-RUN a partir de LINHAS (parseadas ou do banco). incluir = nomes marcados pelo dono
 *  (null = todos os mapeados). Mapeado não-marcado → "fora" (não baixa, não é pendente). */
export async function montarPlanoDeLinhas(companyId: string, data: string, linhas: LinhaVenda[], incluir: string[] | null, db: PrismaClient = defaultPrisma): Promise<PlanoVenda> {
  const [mapa, ctx, custoMap] = await Promise.all([
    db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true, itemId: true } }),
    montarCtx(companyId, db),
    custoMedioPorItem(db, companyId),
  ])
  const mapaPorNome = new Map(mapa.map((m) => [m.nomeSuitable, m]))
  const incluirSet = incluir ? new Set(incluir) : null
  const nomeAlvo = (m: { alvoTipo: string; fichaId: string | null; itemId: string | null }) =>
    m.alvoTipo === 'FICHA' ? ctx.nomeItem.get(ctx.fichaById.get(m.fichaId ?? '')?.itemProduzidoId ?? '') ?? '(ficha)' : ctx.nomeItem.get(m.itemId ?? '') ?? '(item)'

  const produtos: ProdutoBaixa[] = []
  const pendentes: { nome: string; quantidade: number }[] = []
  const fora: { nome: string; quantidade: number }[] = []
  const agregada = new Map<string, number>()

  for (const l of linhas) {
    const m = mapaPorNome.get(l.produto)
    if (!m) { pendentes.push({ nome: l.produto, quantidade: l.quantidade }); continue }
    if (incluirSet && !incluirSet.has(l.produto)) { fora.push({ nome: l.produto, quantidade: l.quantidade }); continue }
    const acc = new Map<string, number>()
    if (m.alvoTipo === 'FICHA' && m.fichaId) explodir({ tipo: 'FICHA', fichaId: m.fichaId }, l.quantidade, ctx, acc)
    else if (m.alvoTipo === 'REVENDA' && m.itemId) explodir({ tipo: 'REVENDA', itemId: m.itemId }, l.quantidade, ctx, acc)
    const baixa = [...acc.entries()].map(([itemId, qtd]) => ({ itemId, nome: ctx.nomeItem.get(itemId) ?? '(item)', qtd: round2(qtd), custoMedio: custoMap.get(itemId) ?? null }))
    for (const [itemId, qtd] of acc) agregada.set(itemId, round2((agregada.get(itemId) ?? 0) + qtd))
    produtos.push({ nome: l.produto, quantidade: l.quantidade, alvoTipo: m.alvoTipo as 'FICHA' | 'REVENDA', alvoNome: nomeAlvo(m), baixa })
  }

  return {
    data, produtos, pendentes, fora,
    agregada: [...agregada.entries()].map(([itemId, qtd]) => { const c = custoMap.get(itemId) ?? null; return { itemId, nome: ctx.nomeItem.get(itemId) ?? '(item)', qtd: round2(qtd), custoMedio: c, valor: c != null ? round2(qtd * c) : null } }),
    totalUnidades: linhas.reduce((s, l) => s + l.quantidade, 0),
    totalMapeados: produtos.length,
    totalPendentes: pendentes.length,
  }
}

/** DRY-RUN a partir do HTML do Suitable. */
export async function montarPlanoVenda(companyId: string, data: string, html: string, db: PrismaClient = defaultPrisma, incluir: string[] | null = null): Promise<PlanoVenda> {
  return montarPlanoDeLinhas(companyId, data, parseSuitable(html).linhas, incluir, db)
}

export interface ReciboVenda { importId: string; data: string; baixados: number; itensBaixados: number; pendentes: number; valorBaixado: number }

/** EXECUTA a partir do HTML (import novo do dia). */
export async function processarVendas(companyId: string, data: string, html: string, userId: string | undefined, db: PrismaClient = defaultPrisma, incluir: string[] | null = null): Promise<ReciboVenda> {
  return gravarVenda(companyId, data, parseSuitable(html).linhas, incluir, userId, db)
}

/** DRY-RUN do reprocesso: o que vai acontecer se refizer um dia já importado (com o mapa
 *  ATUAL) + quantas baixas ativas serão estornadas. Não grava. */
export async function montarPlanoReprocesso(companyId: string, data: string, db: PrismaClient = defaultPrisma): Promise<{ plano: PlanoVenda; estornaItens: number } | null> {
  const dataDate = new Date(`${data}T12:00:00`)
  const imp = await db.stockVendaImport.findUnique({ where: { companyId_data: { companyId, data: dataDate } }, select: { id: true } })
  if (!imp) return null
  const linhas = await db.stockVendaLinha.findMany({ where: { companyId, importId: imp.id }, select: { nomeSuitable: true, quantidade: true, valorTotal: true } })
  const plano = await montarPlanoDeLinhas(companyId, data, linhas.map((l) => ({ produto: l.nomeSuitable, quantidade: l.quantidade, valorTotal: l.valorTotal })), null, db)
  const baixas = await db.stockMovement.findMany({ where: { companyId, receiptId: imp.id, tipo: 'BAIXA_VENDA' }, select: { id: true } })
  const estornos = new Set((await db.stockMovement.findMany({ where: { companyId, tipo: 'ESTORNO', estornoDeId: { in: baixas.map((b) => b.id) } }, select: { estornoDeId: true } })).map((e) => e.estornoDeId))
  return { plano, estornaItens: baixas.filter((b) => !estornos.has(b.id)).length }
}

/** REPROCESSA um dia já importado a partir das linhas GRAVADAS (sem re-upload) — quando o
 *  dono mapeia mais fichas depois. incluir = null → todos os mapeados atuais. Idempotente. */
export async function reprocessarDia(companyId: string, data: string, userId: string | undefined, db: PrismaClient = defaultPrisma): Promise<ReciboVenda> {
  const dataDate = new Date(`${data}T12:00:00`)
  const imp = await db.stockVendaImport.findUnique({ where: { companyId_data: { companyId, data: dataDate } }, select: { id: true } })
  if (!imp) throw new Error('Não há import desse dia pra reprocessar.')
  const linhas = await db.stockVendaLinha.findMany({ where: { companyId, importId: imp.id }, select: { nomeSuitable: true, quantidade: true, valorTotal: true } })
  return gravarVenda(companyId, data, linhas.map((l) => ({ produto: l.nomeSuitable, quantidade: l.quantidade, valorTotal: l.valorTotal })), null, userId, db)
}

/** EXECUTA: cria/atualiza o import do dia (idempotente), estorna baixas anteriores e refaz,
 *  grava BAIXA_VENDA no ledger + as linhas (pra pendentes/reprocessar). */
async function gravarVenda(companyId: string, data: string, linhas: LinhaVenda[], incluir: string[] | null, userId: string | undefined, db: PrismaClient = defaultPrisma): Promise<ReciboVenda> {
  const plano = await montarPlanoDeLinhas(companyId, data, linhas, incluir, db)
  const dataDate = new Date(`${data}T12:00:00`)
  const totalUnidades = linhas.reduce((s, l) => s + l.quantidade, 0)

  const importId = await db.$transaction(async (tx) => {
    // import do dia (idempotente por data)
    const imp = await tx.stockVendaImport.upsert({
      where: { companyId_data: { companyId, data: dataDate } },
      create: { companyId, data: dataDate, totalLinhas: linhas.length, totalUnidades, status: 'CONFIRMADO', criadoPorId: userId ?? null },
      update: { totalLinhas: linhas.length, totalUnidades, status: 'CONFIRMADO' },
    })
    // REPROCESSO: estorna as BAIXA_VENDA ativas deste import (movimento imutável → estorno)
    const baixasAntigas = await tx.stockMovement.findMany({ where: { companyId, receiptId: imp.id, tipo: TIPO_BAIXA }, select: { id: true } })
    const estornos = await tx.stockMovement.findMany({ where: { companyId, tipo: 'ESTORNO', estornoDeId: { in: baixasAntigas.map((b) => b.id) } }, select: { estornoDeId: true } })
    const jaEstornado = new Set(estornos.map((e) => e.estornoDeId))
    for (const b of baixasAntigas) if (!jaEstornado.has(b.id)) await estornarMovimento(tx, b.id, { criadoPorId: userId ?? null })

    // baixa nova (agregada por item; quantidade NEGATIVA = saiu por venda)
    const custoMap = await custoMedioPorItem(tx, companyId)
    for (const a of plano.agregada) {
      if (a.qtd <= 0) continue
      const custo = custoMap.get(a.itemId) ?? 0
      await criarMovimento(tx, { companyId, itemId: a.itemId, tipo: TIPO_BAIXA, quantidade: -a.qtd, custoUnitario: custo, custoTotal: round2(-a.qtd * custo), receiptId: imp.id, origem: 'MANUAL', criadoPorId: userId ?? null, dataMovimento: dataDate })
    }

    // linhas (todas) pra pendentes/reprocessar — reescreve
    await tx.stockVendaLinha.deleteMany({ where: { companyId, importId: imp.id } })
    const mapaNomes = new Set((await tx.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } })).map((m) => m.nomeSuitable))
    await tx.stockVendaLinha.createMany({ data: linhas.map((l) => ({ companyId, importId: imp.id, data: dataDate, nomeSuitable: l.produto, quantidade: l.quantidade, valorTotal: l.valorTotal, mapeadoNoImport: mapaNomes.has(l.produto) })) })
    return imp.id
  })

  await recomputeSaldoCache(db, companyId)
  return {
    importId, data,
    baixados: plano.totalMapeados,
    itensBaixados: plano.agregada.length,
    pendentes: plano.totalPendentes,
    valorBaixado: round2(plano.agregada.reduce((s, a) => s + (a.valor ?? 0), 0)),
  }
}

export interface DiaProcessado { data: string; totalLinhas: number; totalUnidades: number; baixados: number; itensBaixados: number; valorBaixado: number; pendentes: number; status: string }

/** Histórico "Processados" — um dia por linha, com o que baixou e quantos pendentes. */
export async function listProcessados(companyId: string, db: PrismaClient = defaultPrisma): Promise<DiaProcessado[]> {
  const imports = await db.stockVendaImport.findMany({ where: { companyId }, orderBy: { data: 'desc' }, take: 90 })
  const out: DiaProcessado[] = []
  for (const imp of imports) {
    const [movs, linhas, mapa] = await Promise.all([
      db.stockMovement.findMany({ where: { companyId, receiptId: imp.id, tipo: 'BAIXA_VENDA' }, select: { id: true, itemId: true, custoTotal: true } }),
      db.stockVendaLinha.findMany({ where: { companyId, importId: imp.id }, select: { nomeSuitable: true } }),
      db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } }),
    ])
    // baixas ATIVAS (sem estorno) — custo total baixado
    const estornos = new Set((await db.stockMovement.findMany({ where: { companyId, tipo: 'ESTORNO', estornoDeId: { in: movs.map((m) => m.id) } }, select: { estornoDeId: true } })).map((e) => e.estornoDeId))
    const ativas = movs.filter((m) => !estornos.has(m.id))
    const mapeados = new Set(mapa.map((m) => m.nomeSuitable))
    const pendentes = new Set(linhas.filter((l) => !mapeados.has(l.nomeSuitable)).map((l) => l.nomeSuitable)).size
    out.push({
      data: imp.data.toISOString().slice(0, 10), totalLinhas: imp.totalLinhas, totalUnidades: imp.totalUnidades,
      baixados: linhas.length - pendentes, itensBaixados: new Set(ativas.map((m) => m.itemId)).size,
      valorBaixado: round2(ativas.reduce((s, m) => s + Math.abs(m.custoTotal), 0)), pendentes, status: imp.status,
    })
  }
  return out
}

/** Pendentes de mapa (linhas de qualquer dia cujo nome ainda não foi mapeado). */
export async function vendasPendentesDeMapa(companyId: string, db: PrismaClient = defaultPrisma) {
  const [linhas, mapa] = await Promise.all([
    db.stockVendaLinha.findMany({ where: { companyId }, orderBy: { data: 'desc' }, select: { nomeSuitable: true, quantidade: true, data: true } }),
    db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true } }),
  ])
  const mapeados = new Set(mapa.map((m) => m.nomeSuitable))
  const agg = new Map<string, { quantidade: number; dias: number; ultima: string }>()
  for (const l of linhas) {
    if (mapeados.has(l.nomeSuitable)) continue
    const cur = agg.get(l.nomeSuitable) ?? { quantidade: 0, dias: 0, ultima: l.data.toISOString() }
    cur.quantidade += l.quantidade; cur.dias += 1
    agg.set(l.nomeSuitable, cur)
  }
  return [...agg.entries()].map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.quantidade - a.quantidade)
}
