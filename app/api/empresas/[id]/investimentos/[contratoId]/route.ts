/** ⭐ editar / encerrar um contrato de investimento (25/09/2026) */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db'
import { ehTipoValido } from '@/lib/investimentos/contratos'

const patch = z.object({
  nome: z.string().trim().min(1).max(80).optional(),
  tipo: z.string().refine(ehTipoValido, 'tipo desconhecido').optional(),
  valorParcela: z.number().positive().optional(),
  diaDoMes: z.number().int().min(1).max(31).optional(),
  totalParcelas: z.number().int().positive().nullable().optional(),
  parcelasPagasAoIniciar: z.number().int().min(0).nullable().optional(),
  bankAccountId: z.string().nullable().optional(),
  observacao: z.string().trim().max(200).nullable().optional(),
  ativo: z.boolean().optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; contratoId: string }> }) {
  const { id: empresaId, contratoId } = await params
  const ctx = await getAuthContext(request, empresaId)
  if (!ctx) return NextResponse.json({ erro: 'Sessão expirada ou não autenticado' }, { status: 401 })
  ctx.requirePermission('transaction.update')

  const p = patch.safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })

  const existe = await prisma.investmentContract.findFirst({ where: { id: contratoId, companyId: empresaId }, select: { id: true } })
  if (!existe) return NextResponse.json({ erro: 'Contrato não encontrado.' }, { status: 404 })

  if (p.data.bankAccountId) {
    const ok = await prisma.bankAccount.findFirst({ where: { id: p.data.bankAccountId, companyId: empresaId }, select: { id: true } })
    if (!ok) return NextResponse.json({ erro: 'Conta bancária não é desta empresa.' }, { status: 400 })
  }

  await prisma.investmentContract.update({ where: { id: contratoId }, data: p.data })
  return NextResponse.json({ ok: true })
}

/**
 * ⛔ APAGAR só o que NUNCA recebeu aporte. Com histórico, o caminho é **encerrar**
 * (`ativo: false`) — apagar levaria os vínculos junto (o `onDelete: Cascade`) e a linha do
 * extrato perderia o rastro de onde o dinheiro foi parar. *A régua do "sumir com o item"
 * do estoque (09/09): sem movimento apaga, com história arquiva.*
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; contratoId: string }> }) {
  const { id: empresaId, contratoId } = await params
  const ctx = await getAuthContext(request, empresaId)
  if (!ctx) return NextResponse.json({ erro: 'Sessão expirada ou não autenticado' }, { status: 401 })
  ctx.requirePermission('transaction.update')

  const c = await prisma.investmentContract.findFirst({
    where: { id: contratoId, companyId: empresaId },
    select: { id: true, nome: true, _count: { select: { aportes: true } } },
  })
  if (!c) return NextResponse.json({ erro: 'Contrato não encontrado.' }, { status: 404 })
  if (c._count.aportes > 0) {
    return NextResponse.json({
      erro: `O «${c.nome}» já tem ${c._count.aportes} aporte(s) conciliado(s) — apagar apagaria o rastro deles. Encerre o contrato em vez de apagar.`,
      code: 'TEM_HISTORICO',
    }, { status: 409 })
  }
  await prisma.investmentContract.delete({ where: { id: contratoId } })
  return NextResponse.json({ ok: true })
}
