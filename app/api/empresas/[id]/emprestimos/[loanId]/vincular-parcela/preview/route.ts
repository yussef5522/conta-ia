// Sprint Casar Pagamento (04/08/2026) — FASE 4: dados do painel de vínculo N:1.
// READ-ONLY. Mostra a parcela alvo, os lançamentos do contrato já agrupados, o
// split (amortização fora do DRE + encargos despesa financeira) e saldo antes→
// depois. Janela JUL–AGO/2026. Nada grava.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { buildLinkGroup, computeLinkSplit, storedScheduleValid, shouldWriteSplit, pickTargetInstallment, bloqueioDoVinculo } from '@/lib/loans/link-payment'
import { exigeContaDoEmprestimo, MutuoSemContaError } from '@/lib/loans/exige-conta'

export const runtime = 'nodejs'
interface Params { params: Promise<{ id: string; loanId: string }> }

/**
 * ⛔⛔⛔ ISTO ERA UMA JANELA FIXA — `2026-07-01` a `2026-08-31` — e ela EXPLODIU EM 01/09.
 *
 * É a bomba de calendário que a casa proibiu em 01/09/2026 (*"data fixa não é futuro, é
 * uma data que o calendário alcança"*), e ela sobreviveu aqui. **O estrago, medido em
 * 10/09:** a parcela #3 do C61021346-2 venceu HOJE, o débito de R$ 4.337,52 entrou HOJE —
 * e o grupo do vínculo **nem buscava** essa linha. Sobravam as de julho, de OUTRO
 * contrato: o dono via 7 candidatos e nenhum era o pagamento dele.
 *
 * ⭐ A JANELA AGORA É RELATIVA AO VENCIMENTO DA PARCELA ALVO — que é a pergunta certa:
 * *"que débitos podem ter pago ESTA parcela?"*, não *"que débitos existem em julho?"*.
 */
/** ⚠️ 2 casas, a mesma régua de dinheiro do resto do módulo */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const DIAS_ANTES = 45
const DIAS_DEPOIS = 15

const bodySchema = z.object({
  installmentNumber: z.number().int().positive().optional(),
  transactionIds: z.array(z.string()).optional(),
  // tx que originou o clique — SEMPRE entra pré-selecionada no grupo (BUG 1).
  originTxId: z.string().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.update')
    const body = bodySchema.parse(await request.json())

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        companyId: true, bankAccountId: true, contractNumber: true, lender: true,
        interestRateMonthly: true, rateType: true, installmentsPaidBefore: true, scheduleSource: true,
      },
    })
    if (!loan) return NextResponse.json({ erro: 'Empréstimo não encontrado' }, { status: 404 })
    if (loan.companyId !== empresaId) return NextResponse.json({ erro: 'Outra empresa' }, { status: 403 })

    const installments = await prisma.loanInstallment.findMany({
      where: { loanId }, orderBy: { number: 'asc' },
      select: { id: true, number: true, dueDate: true, amortization: true, openingBalance: true, closingBalance: true, interest: true, correcao: true, payment: true, status: true, isEstimate: true, reconciledTransactionId: true },
    })

    /**
     * ⭐⭐⭐ OS CONTRATOS DA EMPRESA — É ELES QUE TORNAM A EXCEÇÃO DA CONTA GARANTIDA
     * ALCANÇÁVEL (19/10/2026).
     *
     * ⛔⛔ Sem este campo o `linhasDaContaGarantida` **nunca roda** (`buildLinkGroup` cai no
     * `new Set()` vazio) e as duas linhas de 16/10 seguem barradas pelo guard Cancian — o
     * motor estava em prod e **inalcançável**, que é a *"porta sem maçaneta"* desta casa pela
     * enésima vez.
     *
     * ⚠️ A lista é a dos **cadastrados**, e é isso que mantém o guard mordendo: a exceção só
     * vale pra número que **não** é de contrato nenhum (se é, o dinheiro tem dono — a família
     * Cancian). Daí a pergunta ser *"quais contratos existem?"*, nunca *"este número parece
     * auxiliar?"*.
     */
    const contratosCadastrados = (
      await prisma.loan.findMany({
        where: { companyId: empresaId },
        select: { contractNumber: true },
      })
    ).map((l) => l.contractNumber)
    const startNumber = loan.installmentsPaidBefore + 1
    const openList = installments.filter((i) => i.number >= startNumber && i.status !== 'PAID')

    // Candidatos: DEBIT pendentes da conta, na janela, ainda não vinculados, que
    // batem com o contrato (Sicredi tem nº na descrição; outros bancos: sem nº,
    // caem aqui só se o nº bater — pra keyword-only o painel é aberto manualmente).
    // ⚠️ a janela pende das parcelas EM ABERTO — o alvo ainda não foi escolhido aqui
    const contaDoEmprestimo = exigeContaDoEmprestimo(loan, 'pré-visualizar o vínculo')
    const vencs = (openList.length ? openList : installments).map((i) => i.dueDate.getTime())
    const CANDIDATO_WHERE = {
      bankAccountId: contaDoEmprestimo, type: 'DEBIT' as const, lifecycle: 'EFFECTED' as const,
      loanInstallmentPaid: { is: null }, loanInstallmentPayments: { none: {} },
    }
    const pendJanela = await prisma.transaction.findMany({
      where: {
        ...CANDIDATO_WHERE,
        date: {
          gte: new Date(Math.min(...vencs) - DIAS_ANTES * 86400_000),
          lte: new Date(Math.max(...vencs) + DIAS_DEPOIS * 86400_000),
        },
      },
      orderBy: { date: 'asc' },
      select: { id: true, description: true, amount: true, date: true },
    })

    /**
     * ⭐⭐ A SEMENTE ENTRA POR ID, mesmo fora da janela — *"ela é o PRIMEIRO item do grupo,
     * pré-marcada, sempre"* (ordem do dono).
     *
     * ⛔ Sem isto, o vínculo dependia de a janela ter acertado a linha que o dono
     * ACABOU de clicar — e quando errava, o painel abria sem o pagamento e sem dizer por
     * quê. Buscar por id é a única forma de a semente não depender de heurística nenhuma.
     */
    const semente = body.originTxId && !pendJanela.some((t) => t.id === body.originTxId)
      ? await prisma.transaction.findFirst({
          where: { ...CANDIDATO_WHERE, id: body.originTxId },
          select: { id: true, description: true, amount: true, date: true },
        })
      : null
    const pend = semente ? [semente, ...pendJanela] : pendJanela

    // FIX matcher por data (05/08): casa a parcela pela DATA do débito, não pela
    // mais antiga aberta. Alerta quando o valor não distingue (parcelas iguais).
    const originTx = body.originTxId ? pend.find((t) => t.id === body.originTxId) : undefined
    const pick = pickTargetInstallment(openList, originTx?.date ?? null, originTx?.amount ?? null)
    const targetNumber = body.installmentNumber ?? pick.target?.number
    const target = targetNumber != null ? installments.find((i) => i.number === targetNumber) : undefined
    if (!target) return NextResponse.json({ erro: 'Nenhuma parcela em aberto pra vincular' }, { status: 400 })
    const group = buildLinkGroup({
      pend, contractNumber: loan.contractNumber, originTxId: body.originTxId,
      transactionIds: body.transactionIds, contratosCadastrados,
    })
    const paidTotal = group.paidTotal

    /**
     * ⭐⭐⭐ O PREVIEW MOSTRA A RECUSA ANTES DO CLIQUE — A MESMA FUNÇÃO DA PORTA (19/10/2026).
     *
     * ⛔⛔ **Item 4 do brief, literal:** *"preview mostra exatamente o que será gravado (porta
     * única nos dois)"*. Antes as três travas viviam só no `vincularPagamentoDeParcela`: o
     * painel acendia o botão, o dono clicava, e o servidor dizia não — *fazer o dono clicar
     * pra levar um «não» é trabalho que dava pra poupar*.
     *
     * ⚠️ E reescrever a régua aqui seria pior que não ter: as duas divergiriam no primeiro
     * degrau novo, e a tela passaria a **oferecer um vínculo que a gravação recusa** — a
     * doença do *"preview e confirm discordando"* (17/08).
     *
     * ⛔⛔⛔ **E LIGAR A RÉGUA ÚNICA ACHOU UM DEFEITO PRÉ-EXISTENTE AQUI:** o `group.paidTotal`
     * é só a Σ das **selecionadas** — o `CANDIDATO_WHERE` exclui transação já vinculada
     * (`loanInstallmentPayments: { none: {} }`), então as mordidas ANTERIORES não estão em
     * `pend` e **não entram nessa soma**. A porta, por sua vez, grava
     * `jaVinculados + txs` (02/10). Numa parcela que já tem mordida, **o preview mostrava um
     * split e a gravação fazia outro** — e é exatamente o caso real de 16/10, se o dono
     * vincular as duas linhas em dois gestos.
     *
     * ⭐ Por isso há DOIS números com nomes diferentes, e cada um responde a sua pergunta:
     * `paidTotal` = o que as linhas marcadas somam (o rótulo *"Pago (grupo)"*);
     * `paidTotalGravado` = o que a porta vai escrever. O split e o bloqueio saem do SEGUNDO.
     */
    const jaVinculadosDaParcela = await prisma.loanInstallmentPayment.findMany({
      where: { installmentId: target.id },
      select: { amount: true },
    })
    const jaVinculado = round2(jaVinculadosDaParcela.reduce((s, p) => s + p.amount, 0))
    const paidTotalGravado = round2(jaVinculado + paidTotal)

    const bloqueio = bloqueioDoVinculo({
      installmentNumber: target.number,
      temVinculo11: target.reconciledTransactionId != null,
      status: target.status,
      jaVinculados: { quantos: jaVinculadosDaParcela.length, soma: jaVinculado },
      paidTotal: paidTotalGravado,
      amortization: target.amortization,
      interest: target.interest,
      openingBalance: target.openingBalance,
      rateMonthly: loan.interestRateMonthly,
    })

    const split = computeLinkSplit({
      installment: { amortization: target.amortization, openingBalance: target.openingBalance },
      rateMonthly: loan.interestRateMonthly, paidTotal: paidTotalGravado,
    })

    // Agenda armazenada fecha? (decide se o split flui pro DRE — FASE 5.3)
    const tracked = installments.filter((i) => i.number >= startNumber)
    const base = tracked[0]?.openingBalance ?? 0
    const agendaValida = storedScheduleValid(tracked, base, loan.interestRateMonthly > 0, loan.rateType === 'POS')

    return NextResponse.json({
      loan: { contractNumber: loan.contractNumber, lender: loan.lender, rateType: loan.rateType },
      installment: { number: target.number, dueDate: target.dueDate, amortization: target.amortization, openingBalance: target.openingBalance, status: target.status, isEstimate: target.isEstimate },
      openInstallments: openList.map((i) => ({ number: i.number, dueDate: i.dueDate, status: i.status })),
      candidates: group.candidates.map((t) => ({ id: t.id, description: t.description, amount: t.amount, date: t.date, selected: t.selected })),
      paidTotal,
      /** ⭐ o que JÁ está vinculado nesta parcela, e o que a porta vai gravar no fim */
      jaVinculado,
      paidTotalGravado,
      split,
      saldoAntes: target.openingBalance,
      saldoDepois: split.closingBalance,
      agendaValida,
      /**
       * ⛔ `bloqueio` ≠ null → o Vincular **não pode acender**, e a frase já diz o porquê.
       * É a MESMA mensagem que a porta lançaria, então não há como a tela explicar diferente.
       */
      bloqueio,
      // O split (juros) VAI ser gravado? IMPORTED confia no amort do banco mesmo
      // com juros=0 nas OPEN (dono único shouldWriteSplit — igual ao confirm).
      splitInjected: shouldWriteSplit({
        scheduleSource: loan.scheduleSource,
        isZeroRate: loan.interestRateMonthly === 0,
        agendaValida,
        isPartial: split.isPartial,
      }),
      // FIX matcher por data: como a parcela foi escolhida (alerta se ambíguo).
      match: {
        byDate: pick.byDate, valorAmbiguo: pick.valorAmbiguo, dateAmbiguo: pick.dateAmbiguo,
        txDate: originTx?.date ?? null,
        alternatives: pick.alternatives.slice(0, 6).map((i) => ({ number: i.number, dueDate: i.dueDate })),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
