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

      return NextResponse.json({
        contas: contas.map((c) => ({
          ...c,
          lastSuccessfulImportAt: lastMap.get(c.id) ?? null,
        })),
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
