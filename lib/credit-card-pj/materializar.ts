// ⭐⭐⭐ CARTÕES v3 — A PORTA QUE FAZ A FATURA E AS PARCELAS FUTURAS EXISTIREM (24/11/2026).
//
// R46 (fatura é registro) e R47 (parcela futura é compromisso gravado). Dois chamadores, UMA
// função: o `confirm` do import (fatura nova) e o backfill (as faturas que já estavam no banco).
// ⛔ Uma cópia no script de backfill seria a 2ª régua de "que parcela falta" — a que diverge no
// primeiro banco com descrição esquisita.
//
// ⚠️ IDEMPOTENTE por construção: a fatura é `(cardId, mes)` único (upsert) e a previsão é
// `(cardId, grupo, numero)` único, criada só se ainda não existe. Rodar 2× não duplica nada.
// ⛔ Nada se apaga: a previsão que a fatura nova traz de verdade é REALIZADA (`realizadaTxId`).

import type { PrismaClient, Prisma } from '@prisma/client'
import { agruparParcelas, parcelasQueFaltam, datasDoCiclo, quitacaoASemear } from './ciclo'

type Db = PrismaClient | Prisma.TransactionClient

export async function registrarFatura(
  db: Db,
  f: {
    companyId: string; cardId: string; mes: string; closingDay: number; dueDay: number
    origem: 'IMPORT' | 'BACKFILL'
    totalDeclarado?: number | null; disponivelDeclarado?: number | null; importId?: string | null
    /** R53 — fatura de quitação semeada pelo sistema (cartão encerrado) */
    quitacao?: boolean
  },
): Promise<{ criada: boolean }> {
  const antes = await db.faturaCartaoPJ.findUnique({ where: { cardId_mes: { cardId: f.cardId, mes: f.mes } }, select: { id: true } })
  const d = datasDoCiclo(f.mes, f.closingDay, f.dueDay)
  const datas = { fechamento: new Date(d.fechamento + 'T12:00:00Z'), vencimento: new Date(d.vencimento + 'T12:00:00Z') }
  await db.faturaCartaoPJ.upsert({
    where: { cardId_mes: { cardId: f.cardId, mes: f.mes } },
    create: {
      companyId: f.companyId, cardId: f.cardId, mes: f.mes, ...datas, origem: f.origem,
      totalDeclarado: f.totalDeclarado ?? null, disponivelDeclarado: f.disponivelDeclarado ?? null, importId: f.importId ?? null,
      ...(f.quitacao ? { quitacao: true } : {}),
    },
    // ⚠️ o backfill nunca reescreve; o import (a fonte mais nova, o PDF) atualiza o que declarou
    update: f.origem === 'IMPORT'
      // ⭐ R53 — a fatura REAL do banco manda: o import sobre uma quitação a converte em fatura do banco
      ? { origem: 'IMPORT', totalDeclarado: f.totalDeclarado ?? null, disponivelDeclarado: f.disponivelDeclarado ?? null, importId: f.importId ?? null, quitacao: null }
      : {},
  })
  return { criada: !antes }
}

/**
 * R47 — recalcula as previsões de UM cartão a partir do que está importado.
 * ⭐ "Viva" = compra cuja última parcela vista está na fatura MAIS RECENTE do cartão. A que parou
 * de aparecer antes disso NÃO é projetada (seria compromisso fantasma — quitada, estornada ou
 * antecipada); ela volta a contar sozinha se reaparecer.
 */
export interface LinhaParceladaDoBanco { id: string; description: string; amount: number; installmentNumber: number; installmentTotal: number; invoiceMonth: string }
export interface PrevisaoExistente { id: string; grupo: string; numero: number; realizadaTxId: string | null; canceladaEm: Date | null }
export interface PlanoDeParcelas {
  novas: { grupo: string; descricao: string; numero: number; total: number; valor: number; mes: string; origemTxId: string }[]
  realizar: { id: string; txId: string }[]
  cancelar: string[]
  reativar: string[]
  vivas: number
  /** R$ do que fica previsto depois do plano (o "comprometido" do cartão) */
  valorPrevisto: number
}

/**
 * ⭐ A DECISÃO, pura: o que criar, realizar, cancelar e reativar. O backfill em modo simulação conta
 * POR ELA o que o modo real vai gravar — a mesma função, nunca uma estimativa à parte.
 */
export function planoDeParcelas(cardId: string, linhas: LinhaParceladaDoBanco[], existentes: PrevisaoExistente[], mesMaisRecente: string | null): PlanoDeParcelas {
  const plano: PlanoDeParcelas = { novas: [], realizar: [], cancelar: [], reativar: [], vivas: 0, valorPrevisto: 0 }
  if (!mesMaisRecente || linhas.length === 0) return plano
  const ls = linhas.map((l) => ({ ...l, cardId }))
  const grupoDe = agruparParcelas(ls)
  const porGrupo = new Map<string, typeof ls>()
  for (const l of ls) { const g = grupoDe.get(l.id)!; porGrupo.set(g, [...(porGrupo.get(g) ?? []), l]) }
  const jaExiste = new Map(existentes.map((e) => [`${e.grupo}#${e.numero}`, e]))
  for (const [grupo, doGrupo] of porGrupo) {
    // a previsão que virou lançamento de verdade é REALIZADA, nunca apagada
    const realizadasAgora = new Set<string>()
    for (const l of doGrupo) {
      const e = jaExiste.get(`${grupo}#${l.installmentNumber}`)
      if (e && !e.realizadaTxId) { plano.realizar.push({ id: e.id, txId: l.id }); realizadasAgora.add(e.id) }
    }
    const topo = doGrupo.reduce((a, b) => (b.installmentNumber > a.installmentNumber ? b : a))
    const viva = topo.installmentNumber < topo.installmentTotal && topo.invoiceMonth === mesMaisRecente
    // ⚠️ a compra que parou de aparecer: as previsões pendentes saem da conta (marcadas, não apagadas);
    // a que reapareceu volta
    for (const e of existentes) {
      if (e.grupo !== grupo || e.realizadaTxId || realizadasAgora.has(e.id)) continue
      if (!viva && !e.canceladaEm) plano.cancelar.push(e.id)
      if (viva && e.canceladaEm) plano.reativar.push(e.id)
      if (viva) plano.valorPrevisto += Math.abs(topo.amount)
    }
    if (!viva) continue
    plano.vivas++
    for (const p of parcelasQueFaltam(topo.installmentNumber, topo.installmentTotal, topo.invoiceMonth)) {
      if (jaExiste.has(`${grupo}#${p.numero}`)) continue
      plano.novas.push({ grupo, descricao: topo.description, numero: p.numero, total: topo.installmentTotal, valor: Math.abs(topo.amount), mes: p.mes, origemTxId: topo.id })
      plano.valorPrevisto += Math.abs(topo.amount)
    }
  }
  plano.valorPrevisto = Math.round(plano.valorPrevisto * 100) / 100
  return plano
}

export async function lerEntradaDoPlano(db: Db, cardId: string): Promise<{ linhas: LinhaParceladaDoBanco[]; existentes: PrevisaoExistente[]; mesMaisRecente: string | null }> {
  const [linhas, ultima, existentes] = await Promise.all([
    db.transaction.findMany({
      where: { businessCreditCardId: cardId, isCardPayment: false, installmentTotal: { gt: 1 }, installmentNumber: { not: null }, invoiceMonth: { not: null } },
      select: { id: true, description: true, amount: true, installmentNumber: true, installmentTotal: true, invoiceMonth: true },
    }),
    db.transaction.aggregate({ where: { businessCreditCardId: cardId, isCardPayment: false, invoiceMonth: { not: null } }, _max: { invoiceMonth: true } }),
    db.parcelaFuturaPJ.findMany({ where: { cardId }, select: { id: true, grupo: true, numero: true, realizadaTxId: true, canceladaEm: true } }),
  ])
  return {
    linhas: linhas.map((l) => ({ id: l.id, description: l.description, amount: l.amount, installmentNumber: l.installmentNumber!, installmentTotal: l.installmentTotal!, invoiceMonth: l.invoiceMonth! })),
    existentes,
    mesMaisRecente: ultima._max.invoiceMonth,
  }
}

/** R47 — aplica o plano de UM cartão (o import e o backfill chamam ESTA) */
export async function projetarParcelas(db: Db, companyId: string, cardId: string): Promise<{ criadas: number; realizadas: number; vivas: number; canceladas: number }> {
  const e = await lerEntradaDoPlano(db, cardId)
  const plano = planoDeParcelas(cardId, e.linhas, e.existentes, e.mesMaisRecente)
  for (const r of plano.realizar) await db.parcelaFuturaPJ.update({ where: { id: r.id }, data: { realizadaTxId: r.txId } })
  if (plano.cancelar.length) await db.parcelaFuturaPJ.updateMany({ where: { id: { in: plano.cancelar } }, data: { canceladaEm: new Date() } })
  if (plano.reativar.length) await db.parcelaFuturaPJ.updateMany({ where: { id: { in: plano.reativar } }, data: { canceladaEm: null } })
  if (plano.novas.length) await db.parcelaFuturaPJ.createMany({ data: plano.novas.map((n) => ({ ...n, companyId, cardId })) })
  return { criadas: plano.novas.length, realizadas: plano.realizar.length, vivas: plano.vivas, canceladas: plano.cancelar.length }
}

/**
 * ⭐⭐⭐ R53 — SEMEIA A FATURA DE QUITAÇÃO do mês corrente dos cartões ENCERRADOS de uma empresa.
 * A receita das rotinas: decisão pura (`quitacaoASemear`) + o índice único (cardId, mes) como trava —
 * chamada na LEITURA da página (on-read) e no cron das 3h (virar do mês). Rodar 2× não duplica.
 */
export async function semearQuitacoes(db: Db, companyId: string, hoje: string): Promise<{ semeadas: { cardId: string; mes: string; total: number }[] }> {
  const encerrados = await db.businessCreditCard.findMany({
    where: { companyId, isActive: true, encerradoEm: { not: null } },
    select: { id: true, closingDay: true, dueDay: true, encerradoEm: true },
  })
  const semeadas: { cardId: string; mes: string; total: number }[] = []
  for (const c of encerrados) {
    const mes = hoje.slice(0, 7)
    const [faturas, prev] = await Promise.all([
      db.faturaCartaoPJ.findMany({ where: { cardId: c.id }, select: { mes: true } }),
      db.parcelaFuturaPJ.findMany({ where: { cardId: c.id, mes, realizadaTxId: null, canceladaEm: null }, select: { valor: true } }),
    ])
    const s = quitacaoASemear({
      encerradoEm: c.encerradoEm!.toISOString().slice(0, 10), hoje,
      mesesComFatura: new Set(faturas.map((f) => f.mes)),
      previstasDoMes: () => prev.reduce((a, p) => a + p.valor, 0),
    })
    if (!s) continue
    try {
      const r = await registrarFatura(db, { companyId, cardId: c.id, mes: s.mes, closingDay: c.closingDay, dueDay: c.dueDay, origem: 'BACKFILL', totalDeclarado: s.total, quitacao: true })
      if (r.criada) semeadas.push({ cardId: c.id, ...s })
    } catch (e) {
      // ⚠️ dois disparos simultâneos: o segundo bate no índice único — já existe, é o que se queria
      if ((e as { code?: string })?.code !== 'P2002') throw e
    }
  }
  return { semeadas }
}
