// Sprint Fase 3 CAMADA 3 (15/08/2026) — O JUIZ NOTURNO. Roda os invariantes do
// módulo contra o banco INTEIRO (todas as empresas) + o cache de saldo. Read-only
// (o I9 usa recalcularSaldoConta numa transação com ROLLBACK — reusa a lógica
// exata sem alterar o dado). Retorna o relatório; quem chama persiste + alerta.
//
// Cobre: I1,I3,I4,I5,I7,I8 (por contrato, via checkModuleInvariants) + I6 (tx
// compartilhada entre parcelas) + I9 (balance == Σtx). I2 (companyId NOT NULL) é
// constraint de schema — não precisa vigiar.

import type { PrismaClient } from '@prisma/client'
import { checkModuleInvariants, type InvLoan } from './module-invariants'
import { recalcularSaldoConta } from '../balance/recalcular'
import { findDuplicateStableKeys } from './tx-duplicate-invariant'
import { checkVendasForCompany } from '../vendas/vendas-invariants'
import { checkCardInvariants } from '../credit-card-pj/card-invariants'

export interface JudgeReport {
  passed: boolean
  totalContracts: number
  totalFail: number
  balanceIssues: number
  // I10 (17/08) — duplicata de tx (mesmo stableKey, imports diferentes). Contagem
  // separada pra o selo/e-mail somarem no total de falhas.
  dupIssues: number
  durationMs: number
  byCompany: { companyId: string; name: string; contracts: number; fails: { contract: string; fails: string[] }[] }[]
  sharedTx: { txId: string; parcelas: string[] }[]
  balanceChecks: { accountId: string; name: string; stored: number; recomputed: number; delta: number }[]
  dupStableKey: { accountId: string; accountName: string; stableKey: string; txIds: string[]; date: string; amount: number; memo: string }[]
  // VENDAS V1-V4 (17/08) — invariantes da VendaDiaria (só competência >= 12/08).
  vendaIssues: number
  vendaChecks: { invariante: string; companyName: string; detalhe: string }[]
  // CARTÃO K1-K7 (18/08)
  cardIssues: number
  cardChecks: { invariante: string; companyName: string; detalhe: string }[]
  cardResumo: { companyName: string; filaCount: number; filaSoma: number; filaMaisAntigaDias: number | null; visionBancos: string[] }[]
}

const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export async function runModuleJudge(prisma: PrismaClient): Promise<JudgeReport> {
  const start = Date.now()

  const companies = new Map<string, string>()
  for (const c of await prisma.company.findMany({ select: { id: true, name: true } })) companies.set(c.id, c.name)

  const loans = await prisma.loan.findMany({
    select: {
      contractNumber: true, companyId: true, rateType: true, scheduleSource: true, termMonths: true,
      installmentsPaidBefore: true, interestRateMonthly: true, principal: true,
      installments: {
        select: {
          number: true, dueDate: true, status: true, openingBalance: true, amortization: true, interest: true,
          correcao: true, payment: true, closingBalance: true, paidTotal: true, paidInterest: true,
          paidCorrection: true, paidPenalty: true, reconciledTransactionId: true,
          payments: { select: { transactionId: true, amount: true } },
        },
      },
    },
  })

  const byCompanyLoans = new Map<string, InvLoan[]>()
  const linkOwners = new Map<string, string[]>() // txId → ["contrato#n", ...]  (I6)

  for (const l of loans) {
    const inv: InvLoan = {
      contractNumber: l.contractNumber, rateType: l.rateType, scheduleSource: l.scheduleSource,
      termMonths: l.termMonths, installmentsPaidBefore: l.installmentsPaidBefore,
      interestRateMonthly: l.interestRateMonthly, principal: l.principal,
      installments: l.installments.map((i) => ({
        number: i.number, dueDate: i.dueDate.toISOString().slice(0, 10), status: i.status,
        openingBalance: i.openingBalance, amortization: i.amortization, interest: i.interest, correcao: i.correcao,
        payment: i.payment, closingBalance: i.closingBalance, paidTotal: i.paidTotal, paidInterest: i.paidInterest,
        paidCorrection: i.paidCorrection, paidPenalty: i.paidPenalty,
        hasReconciled: i.reconciledTransactionId !== null,
        paymentsCount: i.payments.length,
        paymentsSum: r2(i.payments.reduce((s, x) => s + x.amount, 0)),
      })),
    }
    if (!byCompanyLoans.has(l.companyId)) byCompanyLoans.set(l.companyId, [])
    byCompanyLoans.get(l.companyId)!.push(inv)

    const label = (n: number) => `${l.contractNumber ?? 'FLEX'}#${n}`
    for (const i of l.installments) {
      if (i.reconciledTransactionId) {
        const a = linkOwners.get(i.reconciledTransactionId) ?? []; a.push(label(i.number)); linkOwners.set(i.reconciledTransactionId, a)
      }
      for (const pay of i.payments) {
        const a = linkOwners.get(pay.transactionId) ?? []; a.push(label(i.number)); linkOwners.set(pay.transactionId, a)
      }
    }
  }

  let totalFail = 0, totalContracts = 0
  const byCompany: JudgeReport['byCompany'] = []
  for (const [companyId, invLoans] of byCompanyLoans) {
    const results = checkModuleInvariants(invLoans)
    const fails = results.filter((r) => !r.pass).map((r) => ({ contract: r.contract, fails: r.fails }))
    totalFail += fails.length
    totalContracts += results.length
    byCompany.push({ companyId, name: companies.get(companyId) ?? companyId, contracts: results.length, fails })
  }

  // I6 — tx linkada a 2+ parcelas (double-count entre contratos)
  const sharedTx = [...linkOwners.entries()]
    .filter(([, v]) => v.length > 1)
    .map(([txId, parcelas]) => ({ txId, parcelas }))

  // I9 — balance == Σtx (vigia o cache). recalcularSaldoConta em ROLLBACK.
  const balanceChecks: JudgeReport['balanceChecks'] = []
  const accounts = await prisma.bankAccount.findMany({ select: { id: true, name: true } })
  for (const acc of accounts) {
    try {
      await prisma.$transaction(async (tx) => {
        const r = await recalcularSaldoConta(tx as unknown as PrismaClient, acc.id)
        if (Math.abs(r.delta) > 0.02) {
          balanceChecks.push({ accountId: acc.id, name: acc.name, stored: r2(r.saldoAntes), recomputed: r2(r.saldoDepois), delta: r2(r.delta) })
        }
        throw new Error('__ROLLBACK__')
      })
    } catch (e) {
      if ((e as Error).message !== '__ROLLBACK__') throw e
    }
  }

  const balanceIssues = balanceChecks.length

  // I10 — DUPLICATA DE TX: 2+ tx EFFECTED com o MESMO stableKey vindas de imports
  // DIFERENTES (a linha foi criada 2× em vez de deduplicada). Varre o HISTÓRICO
  // INTEIRO, independente da âncora → fecha a lacuna do saldo/I9, que são cegos pra
  // duplicata pré-anchor (bug PIX 7.000: a dup era 13/08, o anchor 17/08, ninguém via).
  // dedupHash = `stableKey#batchId:occ`. Genuíno repeat na MESMA fatura compartilha o
  // batchId (occ :0/:1); duplicata cross-import tem batchIds DIFERENTES pro mesmo
  // stableKey. Legado sem esse formato (sha256/null) → não dá pra julgar, pula.
  const accNames = new Map(accounts.map((a) => [a.id, a.name]))
  const dupTx = await prisma.transaction.findMany({
    where: { lifecycle: 'EFFECTED', dedupHash: { not: null }, bankAccountId: { not: null } },
    select: { id: true, bankAccountId: true, dedupHash: true, date: true, amount: true, description: true },
  })
  const dupStableKey = findDuplicateStableKeys(dupTx, accNames)
  const dupIssues = dupStableKey.length

  // VENDAS V1-V4 — só empresas com perfil de recebimento (módulo ligado); só
  // competência >= início do módulo (min vigenteDe do perfil = 12/08 na Cacula).
  const vendaChecks: JudgeReport['vendaChecks'] = []
  const perfis = await prisma.perfilRecebimento.findMany({ select: { companyId: true } })
  for (const perfil of perfis) {
    const primeira = await prisma.regraRecebimento.findFirst({
      where: { companyId: perfil.companyId }, orderBy: { vigenteDe: 'asc' }, select: { vigenteDe: true },
    })
    if (!primeira) continue
    const fails = await checkVendasForCompany(prisma, perfil.companyId, companies.get(perfil.companyId) ?? perfil.companyId, primeira.vigenteDe)
    for (const f of fails) vendaChecks.push({ invariante: f.invariante, companyName: f.companyName, detalhe: f.detalhe })
  }
  const vendaIssues = vendaChecks.length

  // CARTÃO K1-K7 — todas as empresas com cartão. Só competência agosto+.
  const nowJudge = new Date()
  const cardChecks: JudgeReport['cardChecks'] = []
  const cardResumo: JudgeReport['cardResumo'] = []
  const empresasComCartao = await prisma.businessCreditCard.findMany({ select: { companyId: true }, distinct: ['companyId'] })
  for (const e of empresasComCartao) {
    const nome = companies.get(e.companyId) ?? e.companyId
    const { fails, resumo } = await checkCardInvariants(prisma, e.companyId, nome, nowJudge)
    for (const f of fails) cardChecks.push({ invariante: f.invariante, companyName: f.companyName, detalhe: f.detalhe })
    cardResumo.push({ companyName: nome, filaCount: resumo.filaCount, filaSoma: resumo.filaSoma, filaMaisAntigaDias: resumo.filaMaisAntigaDias, visionBancos: resumo.visionBancos })
  }
  const cardIssues = cardChecks.length

  const passed = totalFail === 0 && sharedTx.length === 0 && balanceIssues === 0 && dupIssues === 0 && vendaIssues === 0 && cardIssues === 0
  return {
    passed, totalContracts, totalFail, balanceIssues, dupIssues, vendaIssues, cardIssues,
    durationMs: Date.now() - start, byCompany, sharedTx, balanceChecks, dupStableKey, vendaChecks, cardChecks, cardResumo,
  }
}
