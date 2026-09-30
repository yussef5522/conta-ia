import { destaqueDoCard } from '@/lib/balance/destaque-do-card'
import { podeConferirPorLedgerbal, resolveBankProfile } from '@/lib/bank-profiles'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { contaBancariaSchema } from '@/lib/validations/conta-bancaria'
import {
  CashValidationError,
  normalizeAndValidateCashAccount,
} from '@/lib/contas-bancarias/cash-validate'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'
import type { EstadoConferencia } from '@/lib/balance/ledgerbal-invariants'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const empresaId = searchParams.get('empresaId')

    if (empresaId) {
      // Path com empresa: validação RBAC normal
      const ctx = await getAuthContext(request, empresaId)
      ctx.requirePermission('bank_account.view')

      const contas = await prisma.bankAccount.findMany({
        where: { companyId: empresaId },
        include: { company: { select: { name: true, tradeName: true } } },
        orderBy: { createdAt: 'asc' },
      })

      // Onda 2 Sprint 2.4 — anexa lastSuccessfulImport pra badge freshness
      const lastImports = await prisma.ofxImport.groupBy({
        by: ['bankAccountId'],
        where: {
          bankAccountId: { in: contas.map((c) => c.id) },
          status: 'SUCCESS',
        },
        _max: { createdAt: true },
      })
      const lastMap = new Map(
        lastImports.map((i) => [i.bankAccountId, i._max.createdAt]),
      )

      // ⭐ SÉRIE B NA TELA (29/08/2026) — "conferido ✓ / divergente / nunca conferida".
      //
      // ⚠️ O motor (`conferenciaDasContas`) existia e estava testado desde 28/08, mas
      // vivia SÓ no juiz noturno: o dono só sabia da divergência por e-mail, e a tela
      // onde ele olha o saldo todo dia não dizia nada. Saldo sem procedência parece
      // conferido — que é justamente como um buraco vive semanas em silêncio.
      //
      // ⚠️ FALHA MACIA de propósito: se a conferência estourar, a lista de contas
      // continua abrindo (sem selo). Diagnóstico nunca pode derrubar a tela principal.
      let conferenciaMap = new Map<string, EstadoConferencia>()
      try {
        const { conferenciaDasContas } = await import('@/lib/balance/ler-conferencia')
        const estados = await conferenciaDasContas(empresaId, prisma)
        conferenciaMap = new Map(estados.map((e) => [e.bankAccountId, e]))
      } catch (e) {
        console.error('[contas] conferência falhou (a lista segue sem selo):', e)
      }

      // ⭐⭐ SELO POR DIA (01/09/2026) — o único que vale pro Banrisul, cujo LEDGERBAL é o
      // saldo DISPONÍVEL (desconta o bloqueado) e por isso não serve de régua. Mesma falha
      // macia: se estourar, a lista abre sem o selo diário.
      const seloMap = new Map<string, unknown>()
      try {
        const { seloPorDiaDaConta } = await import('@/lib/balance/selo-por-dia')
        for (const c of contas) seloMap.set(c.id, await seloPorDiaDaConta(c.id, prisma))
      } catch (e) {
        console.error('[contas] selo por dia falhou (a lista segue sem ele):', e)
      }

      // ⭐⭐⭐ O DESTAQUE DO CARD (05/09) — decisão do dono: onde o saldo declarado embute
      // bloqueio, o número grande é o **DEVEDOR** (o mesmo do app do banco), datado, com o
      // contábil e o selo ao lado. ⛔ É a FICHA que decide, nunca um `if (Banrisul)`.
      // ⛔⛔ E é SÓ apresentação: `balance` (contábil) continua no payload e é ele que o
      // Saldo Total soma — ver `lib/balance/destaque-do-card.ts`.
      return NextResponse.json({
        contas: contas.map((c) => {
          const selo = seloMap.get(c.id) as { diasQueFecham?: number; diasConferidos?: number } | undefined
          return {
            ...c,
            lastSuccessfulImportAt: lastMap.get(c.id) ?? null,
            conferencia: conferenciaMap.get(c.id) ?? null,
            seloDiario: seloMap.get(c.id) ?? null,
            destaque: destaqueDoCard({
              contabil: c.balance,
              declarado: c.ledgerBal ?? null,
              declaradoEm: c.ledgerBalDate ?? null,
              bloqueio: c.blockedAmount ?? null,
              bloqueioEm: c.blockedAt ?? null,
              declaradoEhRegua: podeConferirPorLedgerbal(resolveBankProfile(c.bankCode ?? null)),
              selo: selo?.diasConferidos ? { fecham: selo.diasQueFecham ?? 0, conferidos: selo.diasConferidos } : null,
            }),
          }
        }),
      })
    }

    // Path "global": agrega contas de todas empresas onde o user tem bank_account.view
    const ctx = await getAuthContext(request)
    const ucrs = await prisma.userCompanyRole.findMany({
      where: { userId: ctx.user.id },
      include: {
        role: { include: { permissions: { include: { permission: true } } } },
      },
    })
    const empresasComPermView = ucrs
      .filter((u) =>
        u.role.permissions.some((rp) => {
          const k = rp.permission.key
          return k === 'bank_account.view' || k === 'bank_account.*' || k === '*' || k === '*.view'
        }),
      )
      .map((u) => u.companyId)

    const contas = await prisma.bankAccount.findMany({
      where: { companyId: { in: empresasComPermView } },
      include: { company: { select: { name: true, tradeName: true } } },
      orderBy: { createdAt: 'asc' },
    })

    // Onda 2 Sprint 2.4 — lastSuccessfulImportAt no path global também
    const lastImports = await prisma.ofxImport.groupBy({
      by: ['bankAccountId'],
      where: {
        bankAccountId: { in: contas.map((c) => c.id) },
        status: 'SUCCESS',
      },
      _max: { createdAt: true },
    })
    const lastMap = new Map(
      lastImports.map((i) => [i.bankAccountId, i._max.createdAt]),
    )

    return NextResponse.json({
      contas: contas.map((c) => ({
        ...c,
        lastSuccessfulImportAt: lastMap.get(c.id) ?? null,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { empresaId, ...rest } = body

    if (!empresaId) {
      return NextResponse.json({ erro: 'empresaId é obrigatório' }, { status: 400 })
    }

    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('bank_account.create')

    const data = contaBancariaSchema.parse(rest)

    // Sprint Caixa — Trava CASH (força allowNegativeBalance=false,
    // creditLimit=0, zera campos bancários; rejeita configurações inválidas)
    const safe = normalizeAndValidateCashAccount({
      accountType: data.accountType,
      allowNegativeBalance: data.allowNegativeBalance ?? true,
      creditLimit: data.creditLimit ?? 0,
      cashKind: data.cashKind ?? null,
      bankName: data.bankName || null,
      bankCode: data.bankCode || null,
      agency: data.agency || null,
      accountNumber: data.accountNumber || null,
      lowBalanceThreshold: data.lowBalanceThreshold ?? null,
    })

    /**
     * ⭐⭐⭐ A ABERTURA VIRA LANÇAMENTO (30/09/2026) — a porta que fecha a mina do item 4.
     *
     * ⚠️ **A MINA, medida:** o saldo passou a ser DERIVADO do ledger em todas as portas
     * (item 4, pra matar o drift que pôs a Stone 2.112,00 acima da régua). Mas conta criada
     * com saldo digitado e NENHUM lançamento correspondente teria `Σ(tx) = 0` — e o primeiro
     * lançamento manual **zeraria o saldo de abertura em silêncio**. É a mina que este doc
     * registra desde 31/07 (*"contas com abertura digitada seriam ZERADAS por um recalc
     * ingênuo"*), e ela estava VIVA nas duas criações de conta (PJ e PF).
     *
     * ⭐ **Medido em prod antes de escolher o conserto: exposição ZERO.** As 5 contas sem
     * âncora (cofre, banco caixa, e as 3 de outras empresas) têm `balance == Σ(tx)` ao
     * centavo — na prática o dono sempre lançou a abertura como transação. Ou seja: derivar
     * é seguro HOJE, e o risco era só pra conta NOVA.
     *
     * ⛔ Então a cura é na ORIGEM, não um caso especial no cálculo: o saldo digitado nasce
     * como um LANÇAMENTO de abertura. Aí `Σ(tx)` é a verdade pra sempre, em qualquer conta,
     * e a derivação não tem exceção pra lembrar (REGRA 5).
     */
    const conta = await prisma.bankAccount.create({
      data: {
        name: data.name,
        balance: data.balance,
        companyId: empresaId,
        accountType: safe.accountType,
        cashKind: safe.cashKind,
        allowNegativeBalance: safe.allowNegativeBalance,
        creditLimit: safe.creditLimit,
        lowBalanceThreshold: safe.lowBalanceThreshold,
        bankName: safe.bankName,
        bankCode: safe.bankCode,
        agency: safe.agency,
        accountNumber: safe.accountNumber,
        accountKind: data.accountKind ?? 'PJ',
        /**
         * ⭐⭐ A ABERTURA É ÂNCORA, NÃO MOVIMENTO (30/09/2026).
         *
         * ⚠️ Minha 1ª tentativa foi criar um LANÇAMENTO de "saldo inicial" — e os testes
         * pegaram o efeito colateral: ele contava como **ENTRADA nos últimos 30 dias** no
         * resumo do perfil. Abertura de conta não é receita; ela é o ponto de partida.
         * Materializá-la como movimento poluiria todo relatório de entrada/saída.
         *
         * ⭐ A casa já tem o lugar certo pra isso: `openingBalance`/`openingDate`, o desenho
         * de 01/09 (*"saldo declarado é CONFERÊNCIA, não fonte"*). Com a abertura ali, o
         * `recalcularSaldoConta` entra em ABERTURA_CONFERIDA e deriva **exato**, sem
         * lançamento nenhum e sem sujar nada.
         *
         * ⛔ Datada em ONTEM porque o ledger conta do dia SEGUINTE à âncora — a abertura
         * tem que ficar ANTES do primeiro lançamento que a conta vai receber hoje.
         */
        ...(Math.abs(data.balance) > 0.005
          ? { openingBalance: data.balance, openingDate: aberturaDeHoje() }
          : {}),
      },
    })

    await logAudit(ctx, {
      action: 'CREATE',
      entityType: 'BankAccount',
      entityId: conta.id,
      metadata: {
        name: conta.name,
        bankName: conta.bankName,
        accountType: conta.accountType,
      },
      request,
    })

    return NextResponse.json({ conta }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * O dia da âncora de abertura: ONTEM ao meio-dia UTC.
 *
 * ⚠️ Meio-dia é a convenção de data desta casa (o `date` das transações é carimbado assim);
 * meia-noite faria a comparação de âncora escorregar um dia em fuso negativo — a cicatriz
 * de 01/09, quando as 10 tx de 31/07 entraram duas vezes no saldo por causa disso.
 */
function aberturaDeHoje(): Date {
  const d = new Date()
  d.setUTCHours(12, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - 1)
  return d
}
