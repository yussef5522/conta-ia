// ⭐⭐⭐ CARTÕES v3 — A LEITURA DA PÁGINA, EM LOTE (R44/R45, 24/11/2026).
//
// ⛔ O dossiê de 23/11 achou a lista fazendo UMA consulta por cartão (`listCardsForCompany`, o
// `findMany` dentro do `for`) e o detalhe recalculando a empresa INTEIRA pra mostrar um cartão.
// ⭐ Aqui o número de consultas é CONSTANTE (7 na página, 6 no detalhe), com 1 cartão ou com 40 — o guard conta.
//
// ⚠️ O ESTADO da fatura não é gravado: sai de `estadoCiclo` (lei) sobre total (Σ linhas), pago
// (Σ pagamentos vinculados por `paidInvoiceMonth`) e fechada (fatura importada = fechada — o PDF
// só existe depois do fechamento). A fatura ABERTA é a competência seguinte à última importada,
// e o que se sabe dela são as PARCELAS já lançadas (as compras novas só chegam com o PDF).

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import {
  disponivel, estadoCiclo, pagoDaFatura, mesSoma, datasDoCiclo, diasAte, INICIO_DO_MODULO,
  type EstadoCiclo,
} from './ciclo'

type Db = PrismaClient | Prisma.TransactionClient
const r2 = (n: number) => Math.round(n * 100) / 100

export interface FaturaResumo {
  mes: string
  total: number
  pago: number
  estado: EstadoCiclo
  fechamento: string
  vencimento: string
  linhas: number
  pagamentos: { id: string; data: string; valor: number; conta: string | null }[]
  /** R53 — fatura de quitação (semeada das parcelas do cartão encerrado; não tem linhas) */
  quitacao: boolean
}

export interface CartaoNaCarteira {
  id: string
  name: string
  bankName: string | null
  brand: string | null
  lastDigits: string | null
  creditLimit: number
  closingDay: number
  dueDay: number
  closingDayRule: string
  defaultPaymentBankAccountId: string | null
  defaultTreatment: string
  socioPFId: string | null
  /** a fatura do card: a mais recente IMPORTADA (ou null — cartão sem fatura) */
  atual: FaturaResumo | null
  /** todas as faturas do cartão, a mais recente primeiro (a navegação de mês) */
  faturas: FaturaResumo[]
  /** a próxima competência, acumulando: só o que já se sabe (parcelas lançadas) */
  aberta: { mes: string; total: number; fechamento: string; vencimento: string }
  /** fechadas (desde o marco) ainda não pagas: total − pago */
  fechadasNaoPagas: number
  /** R45 — a régua ÚNICA */
  disponivel: number
  /** limite usado (limite − disponível), 0..1 */
  usoPct: number
  /** R47 — Σ das parcelas futuras previstas (não lançadas, não canceladas) */
  parcelasFuturas: number
  /** R47 — por mês, a partir da aberta */
  futurasPorMes: { mes: string; valor: number }[]
  /** pro "excluir" dizer o que some (R23) */
  historia: { lancamentos: number; faturas: number }
  /** ⭐ R53 — encerrado no banco, ainda em quitação (null = ativo) */
  encerradoEm: string | null
  /** R53 — a régua de QUITAÇÃO do encerrado: falta quitar · N parcelas · última em; quitado = nada mais a pagar */
  quitacao: { falta: number; parcelas: number; ultima: string | null; quitado: boolean } | null
}

export interface Carteira {
  hoje: string
  cartoes: CartaoNaCarteira[]
  /** R23 — arquivado some das telas mas não da história: a página oferece reativar */
  arquivados: { id: string; name: string; bankName: string | null; lastDigits: string | null }[]
  hero: {
    aPagar: { valor: number; cartaoId: string | null; banco: string | null; dias: number | null; mes: string | null }
    abertas: { valor: number; cartoes: number }
    comprometido: { valor: number; porMes: { mes: string; valor: number }[] }
    limite: { total: number; disponivel: number; usoPct: number; cartoes: number }
  }
}

/** Σ linhas por (cartão, mês) com sinal — a régua `faturaNetTotal`, em SQL agrupado */
type Soma = { cardId: string; mes: string; total: number; linhas: number }

export async function lerCarteira(
  companyId: string,
  hoje: string,
  db: Db = defaultPrisma,
  /** ⭐ o detalhe pede UM cartão — e as mesmas 6 consultas rodam só sobre ele (nunca a empresa inteira) */
  opts: { cardId?: string } = {},
): Promise<Carteira> {
  // 1 — os cartões
  const cards = await db.businessCreditCard.findMany({
    where: { companyId, isActive: true, ...(opts.cardId ? { id: opts.cardId } : {}) },
    orderBy: { name: 'asc' },
  })
  const arquivados = opts.cardId ? [] : await db.businessCreditCard.findMany({
    where: { companyId, isActive: false }, select: { id: true, name: true, bankName: true, lastDigits: true }, orderBy: { name: 'asc' },
  })
  const ids = cards.map((c) => c.id)
  if (ids.length === 0) return { ...carteiraVazia(hoje), arquivados }

  // 2..6 — tudo em lote, em paralelo
  const [registros, somas, pagamentos, previstas, linhasPorCartao] = await Promise.all([
    db.faturaCartaoPJ.findMany({ where: { cardId: { in: ids } }, select: { cardId: true, mes: true, fechamento: true, vencimento: true, totalDeclarado: true, quitacao: true } }),
    db.transaction.groupBy({
      by: ['businessCreditCardId', 'invoiceMonth', 'type'],
      where: { businessCreditCardId: { in: ids }, isCardPayment: false, invoiceMonth: { not: null } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.transaction.findMany({
      where: { businessCreditCardId: { in: ids }, isCardPayment: true, paidInvoiceMonth: { not: null } },
      select: { id: true, businessCreditCardId: true, paidInvoiceMonth: true, amount: true, date: true, bankAccount: { select: { name: true } } },
      orderBy: { date: 'desc' },
    }),
    db.parcelaFuturaPJ.findMany({
      where: { cardId: { in: ids }, realizadaTxId: null, canceladaEm: null },
      select: { cardId: true, mes: true, valor: true },
    }),
    db.transaction.groupBy({ by: ['businessCreditCardId'], where: { businessCreditCardId: { in: ids } }, _count: { _all: true } }),
  ])

  const porCartaoMes = new Map<string, Soma>()
  for (const s of somas) {
    const k = `${s.businessCreditCardId}|${s.invoiceMonth}`
    const cur = porCartaoMes.get(k) ?? { cardId: s.businessCreditCardId!, mes: s.invoiceMonth!, total: 0, linhas: 0 }
    cur.total += (s.type === 'CREDIT' ? -1 : 1) * (s._sum.amount ?? 0)
    cur.linhas += s._count._all
    porCartaoMes.set(k, cur)
  }
  const pagosPor = new Map<string, typeof pagamentos>()
  for (const p of pagamentos) {
    const k = `${p.businessCreditCardId}|${p.paidInvoiceMonth}`
    pagosPor.set(k, [...(pagosPor.get(k) ?? []), p])
  }
  // ⭐ R46 — a fatura É o registro; ⚠️ mas mês com linhas e sem registro NÃO some (aparece, derivado)
  const regPor = new Map(registros.map((r) => [`${r.cardId}|${r.mes}`, r]))
  for (const r of registros) {
    const k = `${r.cardId}|${r.mes}`
    if (!porCartaoMes.has(k)) porCartaoMes.set(k, { cardId: r.cardId, mes: r.mes, total: 0, linhas: 0 })
  }
  const historiaLanc = new Map(linhasPorCartao.map((l) => [l.businessCreditCardId!, l._count._all]))

  const cartoes: CartaoNaCarteira[] = cards.map((c) => {
    const faturas = [...porCartaoMes.values()].filter((s) => s.cardId === c.id).sort((a, b) => (a.mes < b.mes ? 1 : -1))
    const resumo = (s: Soma): FaturaResumo => {
      const reg = regPor.get(`${c.id}|${s.mes}`)
      // ⭐ R53 — a quitação não tem linhas: o total é o que foi semeado (Σ das parcelas do mês)
      const ehQuitacao = reg?.quitacao === true && s.linhas === 0
      const total = r2(ehQuitacao ? (reg?.totalDeclarado ?? 0) : s.total)
      const pg = pagosPor.get(`${c.id}|${s.mes}`) ?? []
      const pago = pagoDaFatura(total, pg.map((p) => p.amount))
      const dd = datasDoCiclo(s.mes, c.closingDay, c.dueDay)
      const d = {
        fechamento: reg?.fechamento?.toISOString().slice(0, 10) ?? dd.fechamento,
        vencimento: reg?.vencimento?.toISOString().slice(0, 10) ?? dd.vencimento,
      }
      return {
        mes: s.mes, total, pago, estado: estadoCiclo({ total, pago, fechada: true }),
        fechamento: d.fechamento, vencimento: d.vencimento, linhas: s.linhas,
        pagamentos: pg.map((p) => ({ id: p.id, data: p.date.toISOString().slice(0, 10), valor: p.amount, conta: p.bankAccount?.name ?? null })),
        quitacao: ehQuitacao,
      }
    }
    const todas = faturas.map(resumo)
    const atual = todas[0] ?? null
    const fechadasNaoPagas = r2(todas
      .filter((f) => f.mes >= INICIO_DO_MODULO && (f.estado === 'fechada' || f.estado === 'parcial'))
      .reduce((a, f) => a + (f.total - f.pago), 0))
    // a aberta: a competência seguinte à última importada (cartão sem fatura: a do ciclo de hoje)
    const mesAberta = atual ? mesSoma(atual.mes, 1) : competenciaDoCicloDeHoje(hoje, c.closingDay, c.dueDay)
    const prevs = previstas.filter((p) => p.cardId === c.id && p.mes >= mesAberta)
    const totalAberta = r2(prevs.filter((p) => p.mes === mesAberta).reduce((a, p) => a + p.valor, 0))
    const disp = r2(disponivel(c.creditLimit, totalAberta, fechadasNaoPagas))
    const meses = [...new Set(prevs.map((p) => p.mes))].sort()
    const dA = datasDoCiclo(mesAberta, c.closingDay, c.dueDay)
    const encerradoEm = c.encerradoEm ? c.encerradoEm.toISOString().slice(0, 10) : null
    // ⭐ R53 — a régua de QUITAÇÃO: o que ainda deve (fechadas não pagas + as que vêm), em quantas e até quando
    let quitacao: CartaoNaCarteira['quitacao'] = null
    if (encerradoEm) {
      const quitacoesEmAberto = todas.filter((f) => f.quitacao && f.estado !== 'paga').map((f) => f.mes)
      const pend = previstas.filter((p) => p.cardId === c.id && (p.mes >= mesAberta || quitacoesEmAberto.includes(p.mes)))
      const ultima = pend.length ? pend.map((p) => p.mes).sort().at(-1)! : null
      const falta = r2(fechadasNaoPagas + prevs.reduce((a, p) => a + p.valor, 0))
      quitacao = { falta, parcelas: pend.length, ultima, quitado: falta <= 0.009 && pend.length === 0 }
    }
    return {
      id: c.id, name: c.name, bankName: c.bankName, brand: c.brand, lastDigits: c.lastDigits,
      creditLimit: c.creditLimit, closingDay: c.closingDay, dueDay: c.dueDay, closingDayRule: c.closingDayRule,
      defaultPaymentBankAccountId: c.defaultPaymentBankAccountId, defaultTreatment: c.defaultTreatment, socioPFId: c.socioPFId,
      atual,
      faturas: todas,
      aberta: { mes: mesAberta, total: totalAberta, fechamento: dA.fechamento, vencimento: dA.vencimento },
      fechadasNaoPagas,
      disponivel: disp,
      usoPct: c.creditLimit > 0 ? Math.min(1, Math.max(0, (c.creditLimit - disp) / c.creditLimit)) : 0,
      parcelasFuturas: r2(prevs.reduce((a, p) => a + p.valor, 0)),
      futurasPorMes: meses.map((m) => ({ mes: m, valor: r2(prevs.filter((p) => p.mes === m).reduce((a, p) => a + p.valor, 0)) })),
      historia: { lancamentos: historiaLanc.get(c.id) ?? 0, faturas: faturas.length },
      encerradoEm,
      quitacao,
    }
  })

  // ── o hero (R44) ──
  const aPagarFat = cartoes
    .filter((c) => c.atual && c.atual.mes >= INICIO_DO_MODULO && (c.atual.estado === 'fechada' || c.atual.estado === 'parcial'))
    .sort((a, b) => (a.atual!.vencimento < b.atual!.vencimento ? -1 : 1))
  const prox = aPagarFat[0] ?? null
  // ⛔ R53 — cartão ENCERRADO não tem limite: sai da conta dos DOIS lados (total e usado)
  const ativos = cartoes.filter((c) => !c.encerradoEm)
  const totalLimite = r2(ativos.reduce((a, c) => a + c.creditLimit, 0))
  const totalDisp = r2(ativos.reduce((a, c) => a + c.disponivel, 0))
  const mesesFut = [...new Set(cartoes.flatMap((c) => c.futurasPorMes.map((f) => f.mes)))].sort().slice(0, 6)
  return {
    hoje,
    cartoes,
    arquivados,
    hero: {
      aPagar: {
        valor: r2(cartoes.reduce((a, c) => a + c.fechadasNaoPagas, 0)),
        cartaoId: prox?.id ?? null,
        banco: prox ? (prox.bankName ?? prox.name) : null,
        dias: prox ? diasAte(hoje, prox.atual!.vencimento) : null,
        mes: prox?.atual?.mes ?? null,
      },
      // ⛔ R53 — encerrado não acumula compra: nada de fatura "aberta" dele
      abertas: { valor: r2(ativos.reduce((a, c) => a + c.aberta.total, 0)), cartoes: ativos.filter((c) => c.aberta.total > 0).length },
      comprometido: {
        valor: r2(cartoes.reduce((a, c) => a + c.parcelasFuturas, 0)),
        porMes: mesesFut.map((m) => ({ mes: m, valor: r2(cartoes.reduce((a, c) => a + (c.futurasPorMes.find((f) => f.mes === m)?.valor ?? 0), 0)) })),
      },
      limite: { total: totalLimite, disponivel: totalDisp, usoPct: totalLimite > 0 ? Math.min(1, Math.max(0, (totalLimite - totalDisp) / totalLimite)) : 0, cartoes: ativos.length },
    },
  }
}

function carteiraVazia(hoje: string): Carteira {
  return {
    hoje, cartoes: [], arquivados: [],
    hero: {
      aPagar: { valor: 0, cartaoId: null, banco: null, dias: null, mes: null },
      abertas: { valor: 0, cartoes: 0 },
      comprometido: { valor: 0, porMes: [] },
      limite: { total: 0, disponivel: 0, usoPct: 0, cartoes: 0 },
    },
  }
}

/** a competência cujo ciclo contém `hoje` (o 1º vencimento cujo fechamento ainda não passou) */
export function competenciaDoCicloDeHoje(hoje: string, closingDay: number, dueDay: number): string {
  let m = hoje.slice(0, 7)
  for (let k = 0; k < 3; k++) {
    if (datasDoCiclo(m, closingDay, dueDay).fechamento >= hoje) return m
    m = mesSoma(m, 1)
  }
  return m
}
