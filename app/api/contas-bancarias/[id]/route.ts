import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { contaBancariaSchema } from '@/lib/validations/conta-bancaria'
import { normalizeAndValidateCashAccount } from '@/lib/contas-bancarias/cash-validate'
import { getAuthContext } from '@/lib/auth/rbac'
import { logAudit, diffFields } from '@/lib/audit'
import { handleApiError } from '@/lib/api/handle-error'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const conta = await prisma.bankAccount.findUnique({
      where: { id },
      include: { company: { include: { users: false } } },
    })
    if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const ctx = await getAuthContext(request, conta.companyId)
    ctx.requirePermission('bank_account.view')

    return NextResponse.json({ conta })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const antiga = await prisma.bankAccount.findUnique({ where: { id } })
    if (!antiga) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const ctx = await getAuthContext(request, antiga.companyId)
    ctx.requirePermission('bank_account.update')

    const body = await request.json()
    const data = contaBancariaSchema.parse(body)

    // Sprint Caixa — Trava CASH (mesma lógica do POST)
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

    const conta = await prisma.bankAccount.update({
      where: { id },
      data: {
        name: data.name,
        balance: data.balance,
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
      },
    })

    const fieldsChanged = diffFields(
      antiga as unknown as Record<string, unknown>,
      conta as unknown as Record<string, unknown>,
      [
        'name', 'bankName', 'bankCode', 'agency', 'accountNumber', 'accountType', 'isActive',
        'allowNegativeBalance', 'creditLimit', 'lowBalanceThreshold', 'accountKind',
      ],
    )

    if (fieldsChanged) {
      await logAudit(ctx, {
        action: 'UPDATE',
        entityType: 'BankAccount',
        entityId: conta.id,
        fieldsChanged,
        metadata: { name: conta.name },
        request,
      })
    }

    return NextResponse.json({ conta })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const conta = await prisma.bankAccount.findUnique({ where: { id } })
    if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const ctx = await getAuthContext(request, conta.companyId)
    ctx.requirePermission('bank_account.delete')

    await logAudit(ctx, {
      action: 'DELETE',
      entityType: 'BankAccount',
      entityId: id,
      metadata: { name: conta.name, bankName: conta.bankName },
      request,
    })

    await prisma.bankAccount.delete({ where: { id } })

    return NextResponse.json({ mensagem: 'Conta excluída com sucesso' })
  } catch (error) {
    return handleApiError(error)
  }
}
