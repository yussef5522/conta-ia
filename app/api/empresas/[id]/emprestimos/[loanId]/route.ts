// GET /api/empresas/[id]/emprestimos/[loanId] — detalhe completo (KPIs + cronograma).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { linhaDoCronograma, jurosRealizados } from '@/lib/loans/linha-do-cronograma'
import { saldoDevedorAtual } from '@/lib/loans/saldo'
import { estadoDaParcela, ofereceMarcarPaga, rotuloDoGesto } from '@/lib/loans/estado-da-parcela'
import { resumoDoFlexivel } from '@/lib/loans/resumo-do-flexivel'

interface Params {
  params: Promise<{ id: string; loanId: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.view')

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        bankAccount: { select: { id: true, name: true, bankName: true } },
        disbursementTransaction: {
          select: { id: true, date: true, amount: true, description: true },
        },
        installments: {
          orderBy: { number: 'asc' },
          include: {
            reconciledTransaction: {
              select: {
                id: true,
                date: true,
                amount: true,
                description: true,
                bankAccount: { select: { name: true } },
              },
            },
            // ⚠️ A SEGUNDA PORTA (26/08). "Pago" tem DOIS mecanismos: 1:1
            // (reconciledTransactionId) e N:1 (LoanInstallmentPayment, débito parcial).
            // A tela lia só a primeira → parcela paga em 3 mordidas aparecia como um
            // "pago" SECO, sem dizer quando nem quanto entrou em cada uma. É a mesma
            // omissão que em 14/08 fez 8 parcelas passarem por "órfãs" sendo linkadas.
            payments: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                amount: true,
                transaction: {
                  select: { id: true, date: true, description: true, bankAccount: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    })
    if (!loan) {
      return NextResponse.json({ erro: 'Empréstimo não encontrado' }, { status: 404 })
    }
    if (loan.companyId !== empresaId) {
      return NextResponse.json({ erro: 'Empréstimo de outra empresa' }, { status: 403 })
    }

    const now = new Date()

    // Mútuo FLEXIBLE (sem prazo fixo — Arafat): agenda de 7x é NOMINAL. Sem
    // próxima parcela, sem "atrasada", progresso em VALOR (devolvido/base).
    const flexible = loan.scheduleSource === 'FLEXIBLE'

    // Agregados
    const paid = loan.installments.filter((i) => i.status === 'PAID')
    const paidAmort = paid.reduce((s, i) => s + i.amortization, 0)
    // FIX saldo (04/08): agenda válida → closingBalance da última paga; inválida →
    // fórmula conservadora. Fonte única em lib/loans/saldo.ts.
    const saldoDevedor = saldoDevedorAtual(loan, loan.installments)
    // ⛔⛔ O TOTAL DA COLUNA JUROS SOMA SÓ O REALIZADO (10/09/2026, decisão do dono):
    // *"passado realizado + nada inventado no futuro — é o número que conversa com a
    // despesa financeira do DRE"*. Antes era Σ da AGENDA inteira, que num pós-fixado
    // soma a previsão das pagas com ZERO das futuras: nem realizado, nem projeção.
    // Medido no C61021346-2: dizia R$ 3.089,34 com R$ 4.649,06 realizados.
    const jurosTotalContrato = jurosRealizados(loan.installments)
    const jurosPagos = jurosTotalContrato

    // FLEXIBLE: quanto já foi devolvido = base original − saldo atual.
    const devolvido = Math.round((loan.principal - saldoDevedor) * 100) / 100
    const progressoValor = loan.principal > 0 ? Math.round((devolvido / loan.principal) * 100) : 0

    /**
     * ⭐⭐ O HISTÓRICO SAI DOS VÍNCULOS, NÃO DA PARCELA (09/10/2026) — e a diferença é de conceito.
     *
     * Era `parcelas PAID` com `paidTotal ?? amortization`, ou seja **uma linha por REFERÊNCIA**.
     * No flexível a unidade de verdade é a **DEVOLUÇÃO**: ela é o fato (saiu dinheiro, nesta data,
     * neste valor); a referência é só a prateleira onde ela foi encostada. Os dois coincidem
     * enquanto cada devolução cobre uma referência — e divergem no primeiro mês em que o dono
     * devolver duas vezes, ou menos que o nominal.
     *
     * ⚠️ Lê as DUAS portas (1:1 e N:1) pelo motivo de sempre (14/08): o contrato real usa as
     * duas — jul/ago entraram por 1:1 e setembro por N:1 — e **não há dupla contagem**, porque o
     * trigger `loan_installment_no_double_link` torna impossível uma parcela ter as duas.
     */
    const devolucoesComData = loan.installments.flatMap((i) => [
      ...(i.reconciledTransaction
        ? [{ number: i.number, data: i.reconciledTransaction.date, valor: i.reconciledTransaction.amount }]
        : []),
      ...i.payments.flatMap((p) =>
        p.transaction ? [{ number: i.number, data: p.transaction.date, valor: p.amount }] : [],
      ),
    ])
    const historicoDevolucoes = [...devolucoesComData]
      .sort((a, b) => a.data.getTime() - b.data.getTime())
      .map((d) => ({
        number: d.number,
        date: d.data.toISOString(),
        valor: Math.round(d.valor * 100) / 100,
      }))

    /**
     * ⭐⭐⭐ O RESUMO DERIVADO (09/10) — o texto que a tela imprime no lugar da nota velha.
     *
     * ⛔ **O defeito que ele mata, medido em prod:** o `notes` dizia *"Devolvidos 40.000 e
     * 50.000. Saldo 290.000"* enquanto o cartão mostrava R$ 240.000. A nota não mentiu: ela
     * **congelou** no dia em que foi escrita. ⭐ Fato se deriva; decisão se grava.
     */
    const resumoFlex = flexible
      ? resumoDoFlexivel(loan.principal, saldoDevedor, devolucoesComData)
      : null

    /**
     * ⭐⭐⭐ A RÉGUA ÚNICA, CHAMADA UMA VEZ POR PARCELA (02/10/2026) — e o cabeçalho do
     * contrato bebe DELA, não de uma leitura própria.
     *
     * ⛔⛔ Era `installments.find((i) => i.status === 'OPEN')`, que **PULA a PARTIAL**: numa
     * parcial de verdade (pagou metade, falta metade) o cabeçalho saltava pra a parcela
     * SEGUINTE e o contrato dizia *"em dia"* escondendo o resto em aberto. ⚠️ E a comparação
     * é POR DIA, nunca por instante — as duas réguas divergiam no PRÓPRIO dia do vencimento
     * (a cicatriz de fuso do card do cartão, 09/09).
     */
    const veredito = (i: (typeof loan.installments)[number]) =>
      estadoDaParcela(
        {
          dueDate: i.dueDate, payment: i.payment, status: i.status, paidTotal: i.paidTotal,
          pagamentos: i.payments.map((pg) => ({ amount: pg.amount })),
          valorDoVinculo11: i.reconciledTransaction?.amount ?? null,
        },
        { flexible, hoje: now },
      )

    const proximaOpen = flexible
      ? undefined
      : loan.installments.find((i) => veredito(i).estado !== 'PAGA')
    const vProxima = proximaOpen ? veredito(proximaOpen) : null
    const isAtrasada = vProxima?.estado === 'ATRASADA'

    /**
     * ⭐⭐⭐ O ESTADO DE CADA PARCELA VEM DA RÉGUA ÚNICA (02/10/2026).
     *
     * ⛔⛔ Era `i.status === 'PAID' ? 'PAID' : dueDate < now ? 'LATE' : 'OPEN'` — **só conhecia
     * PAID vs resto**. A parcela 22 do C41033828, com os DOIS pagamentos vinculados somando
     * exatamente o devido (7.568,91 + 2.665,44 = 10.234,35), virava **LATE** e a tela dizia
     * *"Atrasada"* com as duas mordidas desenhadas logo abaixo. **Três telas, três respostas.**
     */
    const installments = loan.installments.map((i) => {
      // ⚠️ a MESMA função do cabeçalho — uma segunda chamada com outros argumentos aqui
      // faria o contrato dizer um estado e a linha dizer outro, que é o defeito de origem.
      const v = veredito(i)
      // ⚠️ o contrato com o front é mantido (PAID|OPEN|LATE) e GANHA o estado rico ao lado —
      // trocar o enum num só commit quebraria a tela antes do deploy dela.
      const statusUI: 'PAID' | 'OPEN' | 'LATE' =
        v.estado === 'PAGA' ? 'PAID' : v.estado === 'ATRASADA' ? 'LATE' : 'OPEN'
      // ⭐⭐ PARCELA PAGA RELATA, PARCELA FUTURA PREVÊ (10/09/2026) — a régua mora na
      // lib e a tela só desenha. Os campos `interest`/`payment` continuam indo CRUS
      // (o "Corrigir agenda" edita a PREVISÃO e precisa dela), mas o que a linha do
      // cronograma mostra sai de `linha`.
      const linha = linhaDoCronograma(i)
      return {
        number: i.number,
        dueDate: i.dueDate.toISOString(),
        openingBalance: i.openingBalance,
        interest: i.interest,
        amortization: i.amortization,
        payment: i.payment,
        closingBalance: i.closingBalance,
        status: statusUI,
        /**
         * ⭐⭐ O ESTADO RICO, pra a tela parar de inferir (02/10). `estado` distingue PARCIAL
         * de ATRASADA — o que o enum de 3 valores não conseguia dizer — e `pago`/`falta` vêm
         * **DERIVADOS da Σ dos vínculos**, nunca do `paidTotal` gravado (era ele que mentia).
         */
        estado: v.estado,
        pago: v.pago,
        falta: v.falta,
        selo: v.selo,
        /** ⛔ quitada NÃO oferece "marcar paga" — era por aí que a dupla contagem entrava */
        ofereceMarcarPaga: ofereceMarcarPaga(v, { flexible }),
        rotuloDoGesto: rotuloDoGesto(v),
        paidDate: i.paidDate?.toISOString() ?? null,
        linha: {
          juros: linha.juros,
          amortizacao: linha.amortizacao,
          parcela: linha.parcela,
          realizado: linha.realizado,
          detalhe: linha.detalhe,
        },
        // mordidas do débito parcial (N:1), ordenadas por entrada
        pagamentos: i.payments.map((pg) => ({
          id: pg.id,
          amount: pg.amount,
          date: pg.transaction?.date.toISOString() ?? null,
          description: pg.transaction?.description ?? null,
          accountName: pg.transaction?.bankAccount?.name?.trim() ?? null,
          transactionId: pg.transaction?.id ?? null,
        })),
        reconciledTransaction: i.reconciledTransaction
          ? {
              id: i.reconciledTransaction.id,
              date: i.reconciledTransaction.date.toISOString(),
              amount: i.reconciledTransaction.amount,
              description: i.reconciledTransaction.description,
              accountName: i.reconciledTransaction.bankAccount?.name ?? null,
            }
          : null,
      }
    })

    // Pontos do gráfico = saldo devedor após cada parcela (closingBalance)
    const chartPoints = [
      { x: 0, label: 'Inicial', saldoDevedor: loan.principal },
      ...loan.installments.map((i) => ({
        x: i.number,
        label: i.dueDate.toISOString().slice(0, 7),
        saldoDevedor: i.closingBalance,
      })),
    ]

    return NextResponse.json({
      loan: {
        id: loan.id,
        lender: loan.lender,
        contractNumber: loan.contractNumber,
        principal: loan.principal,
        interestRateMonthly: loan.interestRateMonthly,
        termMonths: loan.termMonths,
        carencia: loan.carencia,
        amortizationSystem: loan.amortizationSystem,
        firstDueDate: loan.firstDueDate.toISOString(),
        iof: loan.iof,
        disbursementDate: loan.disbursementDate.toISOString(),
        status: loan.status,
        // Fix detalhe EM_ANDAMENTO (17/06/2026): expõe campos pra UI detectar
        // que o empréstimo entrou pelo saldo devedor (não pelo principal).
        // Quando outstandingBalanceInitial != null, é em-andamento → badge
        // de "liberação não linkada" NÃO se aplica (liberação foi anterior
        // ao período do CAIXAOS, nunca entrou como receita no DRE).
        outstandingBalanceInitial: loan.outstandingBalanceInitial,
        installmentsPaidBefore: loan.installmentsPaidBefore,
        trackingStartDate: loan.trackingStartDate?.toISOString() ?? null,
        rateType: loan.rateType,
        indexer: loan.indexer,
        indexerPercent: loan.indexerPercent,
        scheduleSource: loan.scheduleSource,
        flexible,
        notes: loan.notes,
        bankAccount: loan.bankAccount,
        disbursementTransaction: loan.disbursementTransaction
          ? {
              id: loan.disbursementTransaction.id,
              date: loan.disbursementTransaction.date.toISOString(),
              amount: loan.disbursementTransaction.amount,
              description: loan.disbursementTransaction.description,
            }
          : null,
      },
      agregados: {
        saldoDevedor,
        jurosTotalContrato: Math.round(jurosTotalContrato * 100) / 100,
        jurosPagos: Math.round(jurosPagos * 100) / 100,
        principalAmortizado: Math.round(paidAmort * 100) / 100,
        parcelasPagas: paid.length,
        parcelasTotal: loan.installments.length,
        // FLEXIBLE: progresso em VALOR (devolvido de base), não por parcela (2.2).
        devolvido: flexible ? devolvido : null,
        valorBase: flexible ? loan.principal : null,
        progressoValor: flexible ? progressoValor : null,
        historicoDevolucoes: flexible ? historicoDevolucoes : null,
        /** ⭐ o resumo DERIVADO — a tela nunca mais imprime total de devolução escrito à mão */
        resumoFlex: resumoFlex
          ? {
              devolucoes: resumoFlex.devolucoes,
              totalDevolvido: resumoFlex.totalDevolvido,
              saldo: resumoFlex.saldo,
              ultima: resumoFlex.ultima?.toISOString() ?? null,
              frase: resumoFlex.frase,
              /** ⛔ `false` = Σ(histórico) ≠ principal − saldo; a tela GRITA em vez de escolher um */
              fecha: resumoFlex.fecha,
            }
          : null,
        proximaParcela: proximaOpen
          ? {
              number: proximaOpen.number,
              dueDate: proximaOpen.dueDate.toISOString(),
              payment: proximaOpen.payment,
              interest: proximaOpen.interest,
              amortization: proximaOpen.amortization,
              isAtrasada,
              /**
               * ⭐ O ESTADO DA PRÓXIMA, pra o cabeçalho poder ser honesto numa PARCIAL:
               * ali o que o dono precisa ver é **o que FALTA**, não o nominal da agenda —
               * mostrar os R$ 10.234,35 cheios numa parcela com 7.568,91 já pagos seria
               * cobrar duas vezes pelo mesmo pedaço.
               */
              estado: vProxima?.estado ?? null,
              falta: vProxima?.falta ?? null,
              selo: vProxima?.selo ?? null,
            }
          : null,
      },
      installments,
      chartPoints,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

// DELETE — remove o Loan inteiro (cascade installments). Tx OFX permanecem.
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId, loanId } = await params
    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.delete')

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { companyId: true },
    })
    if (!loan) return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
    if (loan.companyId !== empresaId) {
      return NextResponse.json({ erro: 'Empréstimo de outra empresa' }, { status: 403 })
    }

    // Limpa reconciledTransactionId antes (FK SetNull já cuida, mas explícito)
    await prisma.loanInstallment.updateMany({
      where: { loanId },
      data: { reconciledTransactionId: null },
    })
    await prisma.loan.delete({ where: { id: loanId } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
