import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { seloDoSistema, SELO_PELO_SISTEMA } from '@/lib/conciliacao/selo-do-sistema'
import { paraSelo } from '@/lib/conciliacao/carimbar-vinculo'
import { transacaoSchema } from '@/lib/validations/transacao'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'
import { recomputeVendasSeVenda } from '@/lib/vendas/recompute-hook'
import { reAncorarContas } from '@/lib/balance/recalcular'
import { checkBalance, BalanceCheckError } from '@/lib/balance/check'
import { NEEDS_REVIEW_WHERE_PRISMA } from '@/lib/transacoes/needs-review'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contaId = searchParams.get('contaId')
    const empresaId = searchParams.get('empresaId')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    // Sprint Filtro de Data Parte A (15/06/2026): cap subiu de 100 → 500.
    // /pendentes pedia limit=500 mas API entregava 100 silente — usuário via
    // só 100 das 206 tx PENDING+semCategoria, perdendo as mais antigas. Cap
    // de 500 cobre fluxos atuais; quem precisar mais usa paginação real.
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '50')))
    const inicio = searchParams.get('inicio')
    const fim = searchParams.get('fim')
    const tipo = searchParams.get('tipo')
    const status = searchParams.get('status')
    const lifecycle = searchParams.get('lifecycle')
    const semCategoria = searchParams.get('semCategoria') === 'true'
    // Sprint 3.0.2 — filtros novos
    const categoryId = searchParams.get('categoryId')
    const q = searchParams.get('q')?.trim() ?? null
    const importId = searchParams.get('importId')
    // Sprint 3.0.3 B4 — filtro por valor (parse seguro)
    const valorMinStr = searchParams.get('valorMin')
    const valorMaxStr = searchParams.get('valorMax')
    const valorMin =
      valorMinStr && Number.isFinite(Number(valorMinStr)) && Number(valorMinStr) >= 0
        ? Number(valorMinStr)
        : null
    const valorMax =
      valorMaxStr && Number.isFinite(Number(valorMaxStr)) && Number(valorMaxStr) >= 0
        ? Number(valorMaxStr)
        : null

    // Resolve companyId pra ter contexto RBAC.
    // Precedência: contaId → empresaId → "global" (todas as empresas do user, sem permissão única).
    let companyId: string | undefined
    let contaSingle: { id: string; balance: number; name: string; bankName: string | null; accountType: string } | null = null

    if (contaId) {
      const conta = await prisma.bankAccount.findUnique({
        where: { id: contaId },
        select: { id: true, companyId: true, balance: true, name: true, bankName: true, accountType: true },
      })
      if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })
      companyId = conta.companyId
      contaSingle = { id: conta.id, balance: conta.balance, name: conta.name, bankName: conta.bankName, accountType: conta.accountType }
    } else if (empresaId) {
      companyId = empresaId
    }

    let contaWhere: Record<string, unknown>

    if (companyId) {
      // Path com empresa identificada → RBAC normal por empresa
      const ctx = await getAuthContext(request, companyId)
      ctx.requirePermission('transaction.view')

      if (contaId) {
        contaWhere = { bankAccountId: contaId }
      } else {
        contaWhere = { bankAccount: { companyId } }
      }
    } else {
      // Path "global": agrega contas de TODAS empresas do user com permissão view.
      // Sem companyId pra checar permission, então iteramos pelas UCRs do user.
      const ctx = await getAuthContext(request)
      const ucrs = await prisma.userCompanyRole.findMany({
        where: { userId: ctx.user.id },
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      })
      const empresasComPermView = ucrs
        .filter((u) => u.role.permissions.some((rp) => rp.permission.key === 'transaction.view' || rp.permission.key === 'transaction.*' || rp.permission.key === '*' || rp.permission.key === '*.view'))
        .map((u) => u.companyId)

      const userContas = await prisma.bankAccount.findMany({
        where: { companyId: { in: empresasComPermView } },
        select: { id: true },
      })
      contaWhere = { bankAccountId: { in: userContas.map((c) => c.id) } }
    }

    const where: Record<string, unknown> = { ...contaWhere }
    if (inicio || fim) {
      where.date = {
        ...(inicio ? { gte: new Date(inicio) } : {}),
        ...(fim ? { lte: new Date(fim + 'T23:59:59.999Z') } : {}),
      }
    }
    if (status) where.status = status
    // Sprint Fix-Caixa-Vinculo (08/06/2026): suporta filtro lifecycle pra
    // lista da conta mostrar só EFFECTED (tx que JÁ saiu/entrou).
    if (lifecycle) where.lifecycle = lifecycle
    if (semCategoria) {
      // Sprint Fundação Status (28/06/2026, modelo QuickBooks/Xero "For Review"):
      // FONTE DE VERDADE ÚNICA via NEEDS_REVIEW_WHERE_PRISMA.
      // Antes este bloco repetia os 10 guards inline (Sprint Fix-Pendentes-
      // Transfer 08/06, B3 09/06, Cartao R6.1 25/06, Pendentes R2 27/06,
      // Pending Transfer 27/06). Endpoints irmãos (ofx-pendentes,
      // bulk-dry-run, dashboard/badges, drill-down) também migram. Pendência
      // é sobre FALTA de classificação — `status` NÃO entra no filtro.
      Object.assign(where, NEEDS_REVIEW_WHERE_PRISMA)
    }
    // type: compõe AND com guard anti-TRANSFER quando semCategoria
    // (pra cobrir o caso da query `tipo` vir junto e sobrescrever).
    if (tipo && semCategoria) {
      where.type = { equals: tipo, not: 'TRANSFER' }
    } else if (tipo) {
      where.type = tipo
    } else if (semCategoria) {
      where.type = { not: 'TRANSFER' }
    }
    // Sprint 3.0.2
    if (categoryId) where.categoryId = categoryId
    if (q) where.description = { contains: q, mode: 'insensitive' }
    if (importId) where.importId = importId
    // Sprint 3.0.3 B4 — amount range
    if (valorMin !== null || valorMax !== null) {
      where.amount = {
        ...(valorMin !== null ? { gte: valorMin } : {}),
        ...(valorMax !== null ? { lte: valorMax } : {}),
      }
    }

    const [total, transacoes] = await Promise.all([
      prisma.transaction.count({ where }),
      prisma.transaction.findMany({
        where,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          // Sprint Fluxo-Único-Retirada (08/06/2026): + dreGroup pra detectar
          // tx categorizadas como Distribuição/Pró-labore órfãs.
          category: {
            select: { id: true, name: true, color: true, type: true, dreGroup: true },
          },
          bankAccount: { select: { id: true, name: true, bankName: true, balance: true, accountType: true, companyId: true, company: { select: { name: true, tradeName: true } } } },
          // Fase 3 Etapa 2: supplier (Camada 2A keyword / 2B BrasilAPI)
          supplier: {
            select: {
              id: true,
              razaoSocial: true,
              nomeFantasia: true,
              fonte: true,
              category: { select: { id: true, name: true } },
            },
          },
          // Sprint 3.0.2 A4 — nome da regra IA pra tooltip do badge
          classifiedByRule: {
            select: { id: true, padrao: true, tipoMatch: true },
          },
          // Sprint Fluxo-Único-Retirada (08/06/2026): bridge pra detectar
          // tx já vinculadas à entrada PF.
          bridge: { select: { id: true } },
          /**
           * ⭐⭐⭐ 27/09 — **OS VÍNCULOS DE GESTO, pra a tela não cobrar o que já foi decidido.**
           *
           * ⛔ Sem eles a tela de Transações mostrava *"Sem categoria · Pendente"* numa linha que
           * o Fluxo de Caixa já chamava de *"Parcela de empréstimo (pelo sistema)"* — **dois
           * andares lendo réguas diferentes: um sabe, o outro cobra** (palavras do dono).
           *
           * ⚠️ O selo é derivado **NO SERVIDOR** (`seloDoSistema`) e vai pronto no payload: se a
           * tela derivasse, nasceria a 4ª régua da mesma pergunta — e ela divergiria no primeiro
           * gesto novo, que é exatamente o que este sprint conserta.
           */
          loanInstallmentPaid: { select: { id: true, number: true, loan: { select: { contractNumber: true } } } },
          loanInstallmentPayments: {
            select: { installment: { select: { number: true, loan: { select: { contractNumber: true } } } } },
            take: 1,
          },
          businessCreditCard: { select: { id: true, name: true } },
          investmentContribution: { select: { id: true, competencia: true, contract: { select: { nome: true } } } },
          loanDisbursement: { select: { id: true, contractNumber: true } },
        },
      }),
    ])

    // Sprint Transfer Display+Sync (20/06/2026): enriquece TRANSFER pareadas
    // com nome da conta do OUTRO lado do par. 1 query por página, não N+1.
    const groupIdsVisiveis = Array.from(
      new Set(
        transacoes
          .filter((t) => t.type === 'TRANSFER' && t.transferGroupId)
          .map((t) => t.transferGroupId as string),
      ),
    )
    const partnerNameByTxId: Record<string, { partnerAccountId: string; partnerAccountName: string }> = {}
    if (groupIdsVisiveis.length > 0) {
      const sides = await prisma.transaction.findMany({
        where: { transferGroupId: { in: groupIdsVisiveis } },
        select: {
          id: true,
          transferGroupId: true,
          bankAccountId: true,
          bankAccount: { select: { name: true } },
        },
      })
      // Agrupa por groupId
      const byGroup = new Map<string, typeof sides>()
      for (const s of sides) {
        const gid = s.transferGroupId!
        if (!byGroup.has(gid)) byGroup.set(gid, [])
        byGroup.get(gid)!.push(s)
      }
      // Pra cada tx visível, encontra o partner (lado != bankAccountId)
      for (const t of transacoes) {
        if (t.type !== 'TRANSFER' || !t.transferGroupId) continue
        const group = byGroup.get(t.transferGroupId)
        if (!group) continue
        const partner = group.find(
          (s) => s.bankAccountId !== t.bankAccountId,
        )
        if (partner && partner.bankAccount) {
          partnerNameByTxId[t.id] = {
            partnerAccountId: partner.bankAccountId ?? '',
            partnerAccountName: partner.bankAccount.name,
          }
        }
      }
    }

    /**
     * ⭐⭐ 27/09 — **O SELO vai PRONTO no payload, derivado pela MESMA função dos outros andares.**
     *
     * ⚠️ E ele carrega o DETALHE (qual contrato, qual cartão, qual competência): *"Parcela de
     * empréstimo"* sem dizer de qual contrato manda o dono adivinhar, e o pedido dele era
     * explícito — *"Parcela de empréstimo → contrato X"*.
     */
    const comSelo = transacoes.map((t) => {
      const selo = seloDoSistema(paraSelo(t as never))
      if (!selo) return { ...t, selo: null }
      const p11 = t.loanInstallmentPaid
      const pn1 = t.loanInstallmentPayments[0]?.installment
      const detalhe =
        selo.familia === 'PARCELA_EMPRESTIMO'
          ? (p11
              ? `contrato ${p11.loan.contractNumber} · parcela ${p11.number}`
              : pn1
                ? `contrato ${pn1.loan.contractNumber} · parcela ${pn1.number}`
                : null)
          : selo.familia === 'FATURA_CARTAO'
            ? [t.businessCreditCard?.name, t.paidInvoiceMonth].filter(Boolean).join(' · ') || null
            : selo.familia === 'APORTE_INVESTIMENTO'
              ? [t.investmentContribution?.contract.nome, t.investmentContribution?.competencia].filter(Boolean).join(' · ') || null
              : selo.familia === 'LIBERACAO_EMPRESTIMO'
                ? (t.loanDisbursement ? `contrato ${t.loanDisbursement.contractNumber}` : null)
                : null
      return {
        ...t,
        selo: { familia: selo.familia, rotulo: selo.rotulo, detalhe, pelo: SELO_PELO_SISTEMA },
      }
    })

    return NextResponse.json({
      transacoes: comSelo,
      conta: contaSingle,
      paginacao: { total, page, limit, totalPages: Math.ceil(total / limit) },
      // Sprint Transfer Display+Sync — opcional, só pra TRANSFER pareadas
      transferPartners: partnerNameByTxId,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = transacaoSchema.parse(body)

    // Deriva companyId da conta antes de validar permissions
    const conta = await prisma.bankAccount.findUnique({
      where: { id: data.bankAccountId },
      select: {
        id: true,
        companyId: true,
        name: true,
        balance: true,
        allowNegativeBalance: true,
        creditLimit: true,
        // Sprint Caixa-Status (08/06/2026): conta CASH não tem extrato OFX
        // pra conciliar — tx nasce RECONCILED direto.
        accountType: true,
      },
    })
    if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const ctx = await getAuthContext(request, conta.companyId)
    ctx.requirePermission('transaction.create')

    // Se tem categoryId, verifica que a categoria pertence à mesma empresa
    if (data.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: data.categoryId, companyId: conta.companyId },
      })
      if (!cat) return NextResponse.json({ erro: 'Categoria inválida' }, { status: 400 })
    }

    // Balance check: bloqueia se DEBIT estoura -creditLimit (ou 0 se !allowNegativeBalance).
    // CREDIT sempre passa (amountChange positivo).
    const amountChange = data.type === 'CREDIT' ? data.amount : -data.amount
    const balanceCheck = checkBalance({
      currentBalance: conta.balance,
      allowNegativeBalance: conta.allowNegativeBalance,
      creditLimit: conta.creditLimit,
      amountChange,
      accountName: conta.name,
    })
    if (!balanceCheck.allowed) {
      throw new BalanceCheckError(balanceCheck)
    }

    // Sprint Caixa-Status (08/06/2026): tx vinculada a conta Caixa (dinheiro
    // físico) nasce RECONCILED. Caixa não tem extrato OFX pra esperar — saída
    // já é definitiva no momento do lançamento. Padrão QuickBooks/Xero/Conta Azul.
    //
    // Sprint Escada-Status (28/06/2026): escada completa nos 2 sentidos.
    // (0) IGNORED via body → mantém (estado manual, fora da escada).
    // (1) CASH → sempre RECONCILED (já existia).
    // (2) categoryId preenchido → RECONCILED (alinha com statusFromCategoryId
    //     da Sprint Fundação Status). 2 das 57 tx Cacula ("receita de venda
    //     em dinheiro") vinham daqui (entravam PENDING+categorizadas).
    // (3) Sem categoria + sem CASH → PENDING (NÃO aceita RECONCILED via body
    //     sem categoria — viola escada da Sprint Fundação Status).
    const statusEfetivo: 'PENDING' | 'RECONCILED' | 'IGNORED' =
      data.status === 'IGNORED'
        ? 'IGNORED'
        : conta.accountType === 'CASH'
        ? 'RECONCILED'
        : data.categoryId
        ? 'RECONCILED'
        : 'PENDING'

    // Cria transação e recalcula saldo em uma transaction
    /**
     * ⭐⭐⭐ item 4 (30/09/2026) — A PORTA QUE CAUSOU O CASO DA STONE.
     *
     * Aqui era `$transaction([create, bankAccount.update({ balance: { increment } })])`.
     * Uma venda em dinheiro de R$ 2.112,00 com data 17/09, lançada em 28/09 numa conta cuja
     * âncora é 25/09, somou por cima de um saldo que o banco já declarou → o cache ficou
     * 2.112,00 acima da régua, e o import seguinte culpou o extrato.
     *
     * ⚠️ A forma ARRAY do `$transaction` tinha que virar CALLBACK: re-ancorar é assíncrono
     * e precisa do client transacional, pra o saldo ficar consistente no MESMO commit que
     * criou a linha.
     */
    const transacao = await prisma.$transaction(async (tx) => {
      const criada = await tx.transaction.create({
        data: {
          bankAccountId: data.bankAccountId,
          categoryId: data.categoryId ?? null,
          date: data.date,
          description: data.description,
          amount: data.amount,
          type: data.type,
          status: statusEfetivo,
          notes: data.notes ?? null,
          origin: 'MANUAL',
        },
        include: { category: { select: { id: true, name: true, color: true, type: true } } },
      })
      await reAncorarContas(tx, [data.bankAccountId])
      return criada
    })

    await logAudit(ctx, {
      action: 'CREATE',
      entityType: 'Transaction',
      entityId: transacao.id,
      metadata: {
        description: transacao.description,
        amount: transacao.amount,
        type: transacao.type,
        bankAccountId: transacao.bankAccountId,
        categoryId: transacao.categoryId,
      },
      request,
    })

    // ⚠️ GATILHO DO MOTOR DE VENDAS (25/08). Faltava AQUI: o hook existia no import
    // OFX, na categorização em lote e na edição de transação — mas NÃO na criação
    // manual. Resultado real: o dono lançou a venda em dinheiro do cofre à mão, a
    // transação nasceu categorizada como Receita de Vendas, e o calendário de vendas
    // NUNCA soube dela (3.135 de 24/08 e 942 de 25/08 ficaram órfãos).
    // fail-soft e só recomputa se a categoria for de venda — no-op nos outros casos.
    await recomputeVendasSeVenda(prisma, conta.companyId, [transacao.categoryId], 'POST /api/transacoes')

    return NextResponse.json({ transacao }, { status: 201 })
  } catch (error) {
    if (error instanceof BalanceCheckError) {
      return NextResponse.json(
        { erro: error.message, saldoCheck: error.result },
        { status: error.status },
      )
    }
    return handleApiError(error)
  }
}
