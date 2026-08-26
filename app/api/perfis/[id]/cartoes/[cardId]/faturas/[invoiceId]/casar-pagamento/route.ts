// Casar o pagamento da fatura PF com um lançamento QUE JÁ ESTÁ no extrato (26/08).
// GET  → candidatos (o dono escolhe; o sistema não adivinha)
// POST → amarra · DELETE → desfaz

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { candidatosPagamentoPF, casarPagamentoPF, desfazerCasamentoPF } from '@/lib/credit-card/casar-pagamento-pf'
import { isCreditCardError, isProfileAccessError } from '@/lib/credit-card/queries'

export const runtime = 'nodejs'
type P = { params: Promise<{ id: string; cardId: string; invoiceId: string }> }

function erro(e: unknown) {
  if (isProfileAccessError(e)) return NextResponse.json({ erro: e.message }, { status: e.code === 'NO_ACCESS' ? 404 : 403 })
  if (isCreditCardError(e)) return NextResponse.json({ erro: e.message, code: e.code }, { status: 400 })
  return NextResponse.json({ erro: e instanceof Error ? e.message : 'Erro' }, { status: 500 })
}

export async function GET(request: NextRequest, { params }: P) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    const { id, invoiceId } = await params
    return NextResponse.json(await candidatosPagamentoPF({ userId: user.sub, profileId: id, invoiceId }))
  } catch (e) { return erro(e) }
}

const body = z.object({ transactionId: z.string().min(1) })

export async function POST(request: NextRequest, { params }: P) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    const { id, invoiceId } = await params
    const { transactionId } = body.parse(await request.json())
    return NextResponse.json(await casarPagamentoPF({ userId: user.sub, profileId: id, invoiceId, transactionId }))
  } catch (e) { return erro(e) }
}

export async function DELETE(request: NextRequest, { params }: P) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    const { id } = await params
    const { transactionId } = body.parse(await request.json())
    return NextResponse.json(await desfazerCasamentoPF({ userId: user.sub, profileId: id, transactionId }))
  } catch (e) { return erro(e) }
}
