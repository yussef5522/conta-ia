/**
 * ⭐⭐ INVESTIMENTOS — a lista e o cadastro (25/09/2026).
 *
 * ⚠️ Mesma fronteira de papel do empréstimo: ver é `transaction.view`, mexer é
 * `transaction.update` — cadastrar contrato de investimento é decisão financeira do dono.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/rbac'
import { prisma } from '@/lib/db'
import { contratosComTotais, ehTipoValido, TIPOS_DE_INVESTIMENTO } from '@/lib/investimentos/contratos'

const schema = z.object({
  nome: z.string().trim().min(1).max(80),
  tipo: z.string().refine(ehTipoValido, 'tipo desconhecido'),
  valorParcela: z.number().positive(),
  diaDoMes: z.number().int().min(1).max(31),
  totalParcelas: z.number().int().positive().nullable().optional(),
  parcelasPagasAoIniciar: z.number().int().min(0).nullable().optional(),
  bankAccountId: z.string().nullable().optional(),
  observacao: z.string().trim().max(200).nullable().optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: empresaId } = await params
  const ctx = await getAuthContext(request, empresaId)
  if (!ctx) return NextResponse.json({ erro: 'Sessão expirada ou não autenticado' }, { status: 401 })
  ctx.requirePermission('transaction.view')
  const incluirInativos = request.nextUrl.searchParams.get('inativos') === '1'
  const contratos = await contratosComTotais(empresaId, prisma, { incluirInativos })
  return NextResponse.json({ contratos, tipos: TIPOS_DE_INVESTIMENTO })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: empresaId } = await params
  const ctx = await getAuthContext(request, empresaId)
  if (!ctx) return NextResponse.json({ erro: 'Sessão expirada ou não autenticado' }, { status: 401 })
  ctx.requirePermission('transaction.update')

  const p = schema.safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ erro: 'Dados do contrato inválidos.' }, { status: 400 })

  // ⛔ REGRA 8: a conta é conferida DENTRO da empresa — nunca aceita id de fora
  if (p.data.bankAccountId) {
    const ok = await prisma.bankAccount.findFirst({ where: { id: p.data.bankAccountId, companyId: empresaId }, select: { id: true } })
    if (!ok) return NextResponse.json({ erro: 'Conta bancária não é desta empresa.' }, { status: 400 })
  }

  const c = await prisma.investmentContract.create({
    data: {
      companyId: empresaId,
      nome: p.data.nome,
      tipo: p.data.tipo,
      valorParcela: p.data.valorParcela,
      diaDoMes: p.data.diaDoMes,
      totalParcelas: p.data.totalParcelas ?? null,
      parcelasPagasAoIniciar: p.data.parcelasPagasAoIniciar ?? null,
      bankAccountId: p.data.bankAccountId ?? null,
      observacao: p.data.observacao ?? null,
    },
    select: { id: true, nome: true },
  })
  return NextResponse.json({ ok: true, contrato: c })
}
