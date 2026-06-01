// Sprint Gestão de Conta (31/05/2026)
// GET /api/admin/clientes/[userId] — detalhe do cliente
// DELETE /api/admin/clientes/[userId] — exclui cliente (cascade LGPD)
//   ⚠️ APENAS Gerenciador role=OWNER pode excluir (irreversível).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAdminSession, loadGerenciador } from '@/lib/admin-auth/session'
import { reAuthGerenciador } from '@/lib/admin-clientes/re-auth'
import { deleteUserCascade } from '@/lib/admin-clientes/delete-user-cascade'

interface Params {
  params: Promise<{ userId: string }>
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const { userId } = await params
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          companies: true,
          couponRedemptions: true,
          ofxImports: true,
          recurringSchedules: true,
        },
      },
    },
  })
  if (!user) {
    return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 })
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    counts: {
      empresas: user._count.companies,
      cuponsResgatados: user._count.couponRedemptions,
      importsOfx: user._count.ofxImports,
      agendamentosRecorrentes: user._count.recurringSchedules,
    },
  })
}

const deleteSchema = z.object({
  gerenciadorPassword: z.string().min(1, 'Senha obrigatória'),
  confirmEmail: z.string().email('Email inválido'),
})

export async function DELETE(request: NextRequest, { params }: Params) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  const gerenciador = await loadGerenciador(session.gerenciadorId)
  if (!gerenciador || !gerenciador.active) {
    return NextResponse.json({ erro: 'Gerenciador inativo' }, { status: 401 })
  }

  // 🚨 RBAC: APENAS OWNER pode excluir cliente (irreversível).
  if (gerenciador.role !== 'OWNER') {
    return NextResponse.json(
      {
        erro: 'Apenas gerenciadores OWNER podem excluir clientes. Solicite a um OWNER.',
        code: 'FORBIDDEN_RBAC',
      },
      { status: 403 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ erro: 'Body JSON inválido' }, { status: 400 })
  }
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 },
    )
  }

  // Re-auth Gerenciador
  const reauth = await reAuthGerenciador(
    gerenciador.id,
    parsed.data.gerenciadorPassword,
    'delete-user',
  )
  if (!reauth.ok) {
    if (reauth.code === 'RATE_LIMITED') {
      return NextResponse.json(
        {
          erro: 'Muitas tentativas. Aguarde antes de tentar novamente.',
          retryAfterMs: reauth.retryAfterMs,
        },
        { status: 429 },
      )
    }
    return NextResponse.json(
      { erro: 'Senha do gerenciador incorreta' },
      { status: 401 },
    )
  }

  const { userId } = await params
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  })
  if (!user) {
    return NextResponse.json({ erro: 'Cliente não encontrado' }, { status: 404 })
  }

  // Confirmação obrigatória: email digitado deve bater (case-insensitive)
  if (parsed.data.confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      {
        erro: 'Email de confirmação não bate com o email do cliente',
        code: 'EMAIL_CONFIRMATION_MISMATCH',
      },
      { status: 400 },
    )
  }

  // Cascade atomic
  const result = await prisma.$transaction(async (tx) => {
    return deleteUserCascade(tx, userId)
  })

  // Audit log
  await prisma.gerenciadorAuditLog.create({
    data: {
      gerenciadorId: gerenciador.id,
      action: 'ADMIN_DELETE_USER',
      entityType: 'User',
      entityId: userId,
      metadata: JSON.stringify(result),
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
        request.headers.get('x-real-ip') ??
        null,
      userAgent: request.headers.get('user-agent') ?? null,
    },
  })

  return NextResponse.json({ success: true, result })
}
