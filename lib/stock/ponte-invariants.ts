// ESTOQUE ↔ FINANCEIRO — invariantes da PONTE 1 (24/08).
//
// F1 (ERRO): toda conta a pagar com `origin='ESTOQUE_NF'` tem nota-mãe válida e valor
//   batendo com a duplicata. É o contrapeso da exceção de isolamento: o estoque ganhou
//   permissão de escrever no financeiro, então o juiz confere TODA linha que ele escreveu.
//   Sem isso, a ponte poderia inflar o contas a pagar (e o fluxo de caixa) em silêncio.
//
// F2 (ERRO): link apontando conta que não existe mais (alguém apagou a conta pelo
//   financeiro) — o rastro fica órfão e o dono acha que mandou algo que não está lá.
//
// F3 (AVISO): parcela conferida há mais de 7 dias e ainda não enviada pro contas a pagar —
//   boleto esquecido no estoque é boleto que vence sem aparecer no fluxo de caixa.

import type { PrismaClient, Prisma } from '@prisma/client'
import type { StockInvariantFail } from './stock-invariants'
import { ORIGEM_PONTE } from './ponte-contas-pagar'

type Db = PrismaClient | Prisma.TransactionClient

export const F3_DIAS = 7
const CENTAVO = 0.01
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export async function checkPonteInvariants(db: Db, now: Date = new Date()): Promise<StockInvariantFail[]> {
  const fails: StockInvariantFail[] = []

  // ---- F1: toda conta com a marca da ponte é rastreável e bate ----
  const contasDaPonte = await db.transaction.findMany({
    where: { origin: ORIGEM_PONTE },
    // ⚠️ conta a pagar NASCE SEM bankAccount (só ganha ao ser paga) — resolver a empresa
    // por ali devolvia null e o alerta se perdia no filtro por empresa. Vem pelo fornecedor.
    select: {
      id: true, amount: true, dueDate: true, description: true,
      supplier: { select: { companyId: true } },
      bankAccount: { select: { companyId: true } },
    },
  })
  if (contasDaPonte.length) {
    const links = await db.stockPayableLink.findMany({
      where: { transactionId: { in: contasDaPonte.map((c) => c.id) } },
    })
    const linkPorTx = new Map(links.map((l) => [l.transactionId, l]))

    for (const c of contasDaPonte) {
      const link = linkPorTx.get(c.id)
      if (!link) {
        // conta marcada como vinda do estoque, mas SEM amarra: ou a ponte gravou torto,
        // ou alguém marcou `origin` na mão. Nos dois casos o rastro não fecha.
        fails.push({ invariante: 'F1', companyId: c.supplier?.companyId ?? c.bankAccount?.companyId ?? null, detalhe: `conta a pagar "${c.description}" está marcada origem=${ORIGEM_PONTE} mas NÃO tem vínculo com nota/entrada do estoque — rastro quebrado.` })
        continue
      }
      if (Math.abs(round2(c.amount) - round2(link.valor)) > CENTAVO) {
        fails.push({ invariante: 'F1', companyId: link.companyId, detalhe: `conta ${c.id} vale R$ ${round2(c.amount).toFixed(2)} mas a duplicata da nota diz R$ ${round2(link.valor).toFixed(2)} — a ponte inflaria o contas a pagar.` })
      }
      if (link.origem === 'NFE') {
        const nota = await db.stockNfe.findFirst({ where: { id: link.refId, companyId: link.companyId }, select: { id: true } })
        if (!nota) fails.push({ invariante: 'F1', companyId: link.companyId, detalhe: `conta ${c.id} aponta a nota ${link.refId}, que não existe — conta a pagar sem nota-mãe.` })
      } else {
        const ent = await db.stockEntradaManual.findFirst({ where: { id: link.refId, companyId: link.companyId }, select: { id: true } })
        if (!ent) fails.push({ invariante: 'F1', companyId: link.companyId, detalhe: `conta ${c.id} aponta a entrada manual ${link.refId}, que não existe.` })
      }
    }
  }

  // ---- F2: amarra órfã (a conta sumiu do financeiro) ----
  const todosLinks = await db.stockPayableLink.findMany({ select: { id: true, companyId: true, transactionId: true, valor: true } })
  if (todosLinks.length) {
    const existentes = new Set((await db.transaction.findMany({
      where: { id: { in: todosLinks.map((l) => l.transactionId) } }, select: { id: true },
    })).map((t) => t.id))
    for (const l of todosLinks) {
      if (!existentes.has(l.transactionId)) {
        fails.push({ invariante: 'F2', companyId: l.companyId, detalhe: `o estoque diz ter enviado R$ ${round2(l.valor).toFixed(2)} pro contas a pagar (conta ${l.transactionId}), mas essa conta não existe mais — apagada pelo financeiro?` })
      }
    }
  }

  // ---- F3 (aviso): boleto esquecido no estoque ----
  const limite = new Date(now.getTime() - F3_DIAS * 86_400_000)
  const sugestoes = await db.stockPayableSuggestion.findMany({
    where: { criadoEm: { lt: limite } },
    select: { id: true, companyId: true, supplierNome: true, valor: true, nfeId: true, nDup: true, dVenc: true },
  })
  if (sugestoes.length) {
    const enviadas = new Set((await db.stockPayableLink.findMany({
      where: { origem: 'NFE', suggestionId: { in: sugestoes.map((s) => s.id) } }, select: { suggestionId: true },
    })).map((l) => l.suggestionId))
    for (const s of sugestoes) {
      if (enviadas.has(s.id)) continue
      const venc = s.dVenc ? ` (vence ${s.dVenc.toISOString().slice(0, 10)})` : ''
      fails.push({ invariante: 'F3', companyId: s.companyId, nivel: 'aviso', detalhe: `boleto de "${s.supplierNome}" R$ ${round2(s.valor).toFixed(2)}${venc} está conferido há mais de ${F3_DIAS} dias e ainda NÃO foi pro contas a pagar — vence sem aparecer no fluxo de caixa.` })
    }
  }

  return fails
}
