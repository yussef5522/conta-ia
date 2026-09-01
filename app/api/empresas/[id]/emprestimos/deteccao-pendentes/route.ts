// Sprint Casar Pagamento (04/08/2026) — FASE 3/6: detecção de pagamentos de
// empréstimo nas transações pendentes (janela JUL–AGO/2026). READ-ONLY. Alimenta
// a linha "🏦 Empréstimo … — Vincular" e o banner contextual em /pendentes.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { detectLoanPayment, type DetectLoanLite } from '@/lib/loans/detect-payment'
import { sugerirVinculoEmprestimo, type ParcelaLite } from '@/lib/loans/sugerir-vinculo'
import { NEEDS_REVIEW_WHERE_PRISMA } from '@/lib/transacoes/needs-review'

export const runtime = 'nodejs'
interface Params { params: Promise<{ id: string }> }

// ⚠️ JANELA ROLANTE, não datas fixas (26/08). Estava travada em 01/07–31/08/2026: em
// 01/09 a detecção pararia DE FUNCIONAR EM SILÊNCIO — nenhum erro, nenhum aviso, só
// pagamento de empréstimo deixando de ser reconhecido. Agora anda com o relógio.
// (O relógio só define a JANELA DE BUSCA; nunca decide classificação — CLAUDE.md.)
const MESES_JANELA = 3

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const agora = new Date()
    const janelaInicio = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - MESES_JANELA, 1))

    // Empréstimos ativos por conta (dia de vencimento = dia do firstDueDate).
    const loans = await prisma.loan.findMany({
      where: { companyId: empresaId },
      select: { id: true, bankAccountId: true, contractNumber: true, lender: true, status: true, firstDueDate: true },
    })
    const byAccount = new Map<string, DetectLoanLite[]>()
    for (const l of loans) {
      const lite: DetectLoanLite = { id: l.id, contractNumber: l.contractNumber, lender: l.lender, status: l.status, dueDay: l.firstDueDate.getUTCDate() }
      // ⛔ contrato SEM conta não entra no agrupamento: um `null` na lista do `in` faria a
      // busca casar com transações órfãs de conta e sugerir vínculo que não existe.
      if (!l.bankAccountId) continue
      const arr = byAccount.get(l.bankAccountId) ?? []
      arr.push(lite)
      byAccount.set(l.bankAccountId, arr)
    }
    if (loans.length === 0) return NextResponse.json({ detections: {}, count: 0 })

    // Tx pendentes DEBIT na janela, das contas que têm empréstimo.
    const pend = await prisma.transaction.findMany({
      where: {
        ...NEEDS_REVIEW_WHERE_PRISMA,
        bankAccount: { companyId: empresaId },
        bankAccountId: { in: [...byAccount.keys()] },
        type: 'DEBIT',
        date: { gte: janelaInicio, lte: agora },
      },
      select: { id: true, description: true, type: true, date: true, amount: true, bankAccountId: true },
    })

    // Parcelas ABERTAS por contrato — pra sugerir também QUAL parcela (26/08).
    const abertas = await prisma.loanInstallment.findMany({
      where: { loanId: { in: loans.map((l) => l.id) }, status: { not: 'PAID' } },
      select: { loanId: true, number: true, dueDate: true, payment: true, status: true, paidTotal: true },
    })
    const parcelasPorLoan: Record<string, ParcelaLite[]> = {}
    for (const i of abertas) (parcelasPorLoan[i.loanId] ??= []).push(i)

    const detections: Record<string, unknown> = {}
    let count = 0
    for (const t of pend) {
      const accLoans = byAccount.get(t.bankAccountId ?? '') ?? []
      const d = detectLoanPayment({ description: t.description ?? '', type: t.type, date: t.date }, accLoans)
      if (!d) continue
      // ADITIVO: mantém o `kind` que a tela já consome e acrescenta a parcela sugerida.
      // Assim a próxima mordida chega com contrato E parcela prontos — o dono confirma,
      // não escolhe. Sem número de contrato na descrição continua ESCOLHER (2 contratos
      // por conta no Banrisul e na Caixa — adivinhar ali seria pior que perguntar).
      const sug = sugerirVinculoEmprestimo(
        { description: t.description ?? '', type: t.type, date: t.date, amount: t.amount },
        accLoans, parcelasPorLoan,
      )
      detections[t.id] = sug?.kind === 'SUGERIDO'
        ? { ...d, installmentNumber: sug.installmentNumber, rotulo: sug.rotulo, parcial: sug.parcial, faltaDepois: sug.faltaDepois }
        : d
      count++
    }

    return NextResponse.json({ detections, count })
  } catch (error) {
    return handleApiError(error)
  }
}
