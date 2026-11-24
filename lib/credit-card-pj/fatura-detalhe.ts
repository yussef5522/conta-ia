// ⭐⭐⭐ CARTÕES v3 — A FATURA (R46–R50, 24/11/2026).
//
// ⛔ O detalhe antigo (`getCardDashboard`) chamava `listCardsForCompany(companyId)` — a empresa
// INTEIRA, com o N+1 dentro — pra mostrar UM cartão. Aqui tudo é filtrado pelo cartão: a mesma
// leitura da página (`lerCarteira` com `cardId`) + as linhas da fatura escolhida.
// ⛔ E os candidatos a pagamento usavam SEMPRE os totais da ÚLTIMA fatura importada, mesmo
// olhando uma fatura antiga: agora o alvo é o total (e o que falta) da fatura NA TELA.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { lerCarteira, type CartaoNaCarteira, type FaturaResumo } from './carteira'
import { mesSoma, datasDoCiclo, INICIO_DO_MODULO } from './ciclo'
import { signedFaturaAmount } from './fatura-net-total'
import { findCardPaymentCandidatesInBank } from './queries'
import { loadActiveRules, buildRuleIndex } from '@/lib/ai-categorizer/apply'
import { predictCategory } from '@/lib/ai-categorizer/predict'
import { categoriasDestinoDespesa, type CategoriaDestino } from '@/lib/categorias/destino-valido'

type Db = PrismaClient | Prisma.TransactionClient
const r2 = (n: number) => Math.round(n * 100) / 100

export interface LinhaDaFatura {
  id: string
  date: string
  description: string
  amount: number
  type: string
  installmentNumber: number | null
  installmentTotal: number | null
  categoryId: string | null
  categoryName: string | null
  /** ⭐ regra APRENDIDA do dono — só pra linha sem categoria; sugere, nunca aplica */
  suggestedCategoryId: string | null
  usd: number | null
  cotacaoDolar: number | null
}

export interface CandidatoDePagamento {
  id: string
  date: string
  description: string
  amount: number
  bankAccountName: string | null
  currentCategoryName: string | null
  matchScore: number
  matchLabel: string
}

export interface FaturaDetalhe {
  hoje: string
  cartao: CartaoNaCarteira
  fatura: FaturaResumo | null
  /** R46 — a linha do tempo: abriu → fechou → vence → paga */
  ciclo: { abriu: string; fechou: string; vence: string; paga: string | null } | null
  linhas: LinhaDaFatura[]
  /** ⭐ as categorias que a GRAVAÇÃO aceita — a MESMA fonte (`categoriasDestinoDespesa`) */
  expenseCategories: CategoriaDestino[]
  porCategoria: { categoryId: string | null; nome: string; valor: number }[]
  /** R47 — o que já está comprometido nos próximos meses (deste cartão) */
  futuras: { total: number; porMes: { mes: string; valor: number }[]; compras: { descricao: string; valor: number; faltam: number; ate: string }[] }
  /** R50 — fatura por mês (até 6, mais antiga primeiro) */
  evolucao: { mes: string; total: number }[]
  candidatos: CandidatoDePagamento[]
  /** R53 — fatura de quitação: as parcelas que a compõem (ela não tem linhas do banco) */
  parcelasDaQuitacao: { descricao: string; numero: number; total: number; valor: number }[]
}

/** a pontuação visual do candidato — a mesma escada do preview (R5) */
export function pontuarCandidato(amount: number, alvo: number | null, alvo2: number | null, jaMarcado: boolean): { matchScore: number; matchLabel: string } {
  let s = 0
  let l = ''
  if (alvo && Math.abs(amount - alvo) <= 0.02) { s = 1; l = 'valor exato da fatura' }
  else if (alvo2 && Math.abs(amount - alvo2) <= 0.02) { s = 0.95; l = 'valor exato do que falta pagar' }
  else if (alvo && Math.abs(amount - alvo) <= 1) { s = 0.9; l = 'valor próximo' }
  else if (alvo2 && Math.abs(amount - alvo2) <= 1) { s = 0.85; l = 'valor próximo' }
  if (jaMarcado) { s = Math.max(s, 0.7); if (!l) l = 'detectado pelo extrato' }
  return { matchScore: s, matchLabel: l }
}

export async function lerFatura(
  companyId: string,
  cardId: string,
  mes: string | null,
  hoje: string,
  db: Db = defaultPrisma,
): Promise<FaturaDetalhe | null> {
  const cart = await lerCarteira(companyId, hoje, db, { cardId })
  const cartao = cart.cartoes[0]
  if (!cartao) return null
  const fatura = (mes ? cartao.faturas.find((f) => f.mes === mes) : null) ?? cartao.atual
  const [txs, expenseCategories, previstas] = await Promise.all([
    fatura
      ? db.transaction.findMany({
          where: { businessCreditCardId: cardId, invoiceMonth: fatura.mes, isCardPayment: false },
          orderBy: { date: 'desc' },
          take: 1000,
          include: { category: { select: { name: true } } },
        })
      : Promise.resolve([]),
    categoriasDestinoDespesa(companyId),
    db.parcelaFuturaPJ.findMany({
      where: { cardId, realizadaTxId: null, canceladaEm: null, mes: { gte: cartao.aberta.mes } },
      select: { grupo: true, descricao: true, valor: true, mes: true },
      orderBy: { mes: 'asc' },
    }),
  ])
  const parcelasDaQuitacao = fatura?.quitacao
    ? (await db.parcelaFuturaPJ.findMany({
        where: { cardId, mes: fatura.mes, realizadaTxId: null, canceladaEm: null },
        select: { descricao: true, numero: true, total: true, valor: true }, orderBy: { valor: 'desc' },
      }))
    : []

  // ⭐ a sugestão é a regra APRENDIDA (determinística, barata) — e ela SUGERE: quem aplica é o clique
  const sugestao = new Map<string, string>()
  const semCat = txs.filter((t) => !t.categoryId)
  if (semCat.length > 0) {
    const idx = buildRuleIndex(companyId, await loadActiveRules(companyId))
    for (const t of semCat) {
      const p = predictCategory({ description: t.description }, idx)
      if (p?.categoryId && p.confidence >= 0.6) sugestao.set(t.id, p.categoryId)
    }
  }

  const porCat = new Map<string, { categoryId: string | null; nome: string; valor: number }>()
  for (const t of txs) {
    const k = t.categoryId ?? 'sem'
    const c = porCat.get(k) ?? { categoryId: t.categoryId, nome: t.category?.name ?? 'Sem categoria', valor: 0 }
    c.valor += signedFaturaAmount(t)
    porCat.set(k, c)
  }

  // R47 — as compras do painel: uma linha por grupo (quantas faltam, valor/mês, até quando)
  const porGrupo = new Map<string, { descricao: string; valor: number; faltam: number; ate: string }>()
  for (const p of previstas) {
    const g = porGrupo.get(p.grupo) ?? { descricao: p.descricao, valor: p.valor, faltam: 0, ate: p.mes }
    g.faltam++
    if (p.mes > g.ate) g.ate = p.mes
    porGrupo.set(p.grupo, g)
  }
  const mesesF = [...new Set(previstas.map((p) => p.mes))].sort()

  // candidatos: só pra fatura que ainda deve (e desde o marco)
  let candidatos: CandidatoDePagamento[] = []
  if (fatura && fatura.estado !== 'paga' && fatura.mes >= INICIO_DO_MODULO) {
    const falta = r2(fatura.total - fatura.pago)
    const alvos = [fatura.total, falta].filter((v, i, a) => v > 0 && a.indexOf(v) === i)
    const raw = await findCardPaymentCandidatesInBank(companyId, alvos)
    candidatos = raw
      .map((c) => ({
        id: c.id, date: c.date.toISOString().slice(0, 10), description: c.description, amount: c.amount,
        bankAccountName: c.bankAccount?.name ?? null, currentCategoryName: c.category?.name ?? null,
        ...pontuarCandidato(c.amount, fatura.total, falta !== fatura.total ? falta : null, c.isCardPayment),
      }))
      .sort((a, b) => (b.matchScore - a.matchScore) || (a.date < b.date ? 1 : -1))
  }

  let ciclo: FaturaDetalhe['ciclo'] = null
  if (fatura) {
    const ant = datasDoCiclo(mesSoma(fatura.mes, -1), cartao.closingDay, cartao.dueDay).fechamento
    const abriu = new Date(Date.parse(ant + 'T12:00:00Z') + 86_400_000).toISOString().slice(0, 10)
    const pagaEm = fatura.pagamentos.length > 0 && fatura.pago > 0 ? fatura.pagamentos[0].data : null
    ciclo = { abriu, fechou: fatura.fechamento, vence: fatura.vencimento, paga: pagaEm }
  }

  return {
    hoje,
    cartao,
    fatura,
    ciclo,
    linhas: txs.map((t) => ({
      id: t.id, date: t.date.toISOString().slice(0, 10), description: t.description, amount: t.amount, type: t.type,
      installmentNumber: t.installmentNumber, installmentTotal: t.installmentTotal,
      categoryId: t.categoryId, categoryName: t.category?.name ?? null,
      suggestedCategoryId: sugestao.get(t.id) ?? null,
      usd: t.cardUsdAmount ?? null, cotacaoDolar: t.cardFxRate ?? null,
    })),
    expenseCategories,
    porCategoria: [...porCat.values()].map((c) => ({ ...c, valor: r2(c.valor) })).sort((a, b) => b.valor - a.valor),
    futuras: {
      total: r2(previstas.reduce((a, p) => a + p.valor, 0)),
      porMes: mesesF.map((m) => ({ mes: m, valor: r2(previstas.filter((p) => p.mes === m).reduce((a, p) => a + p.valor, 0)) })),
      compras: [...porGrupo.values()].map((g) => ({ ...g, valor: r2(g.valor) })).sort((a, b) => b.valor * b.faltam - a.valor * a.faltam),
    },
    evolucao: cartao.faturas.slice(0, 6).map((f) => ({ mes: f.mes, total: f.total })).reverse(),
    candidatos,
    parcelasDaQuitacao,
  }
}
