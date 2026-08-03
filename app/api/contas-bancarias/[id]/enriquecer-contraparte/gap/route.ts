// Sprint Enriquecer entry (03/08/2026) — GET read-only do "gap de contraparte".
// Conta quantas tx de transferência (PIX/TED/DOC) da conta ainda estão SEM o nome
// de quem recebeu/pagou. Alimenta o banner que leva pra tela de enriquecimento.
// NÃO grava nada. NUNCA retorna nome (LGPD) — só a contagem.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { countCounterpartyGap } from '@/lib/counterparty/gap'

export const runtime = 'nodejs'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: contaId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
  }

  // Multi-tenant: conta tem que ser de empresa do usuário.
  const conta = await prisma.bankAccount.findFirst({
    where: { id: contaId, company: { users: { some: { userId: user.sub } } } },
    select: { id: true, bankName: true, bankCode: true },
  })
  if (!conta) return NextResponse.json({ erro: 'Conta não encontrada' }, { status: 404 })

  // Enriquecimento por PDF só existe pra Banrisul hoje (mesmo gate do /preview).
  // Se a conta não é Banrisul, não há porta pra oferecer.
  const supported = /banrisul/i.test(conta.bankName ?? '') || conta.bankCode === '041'
  if (!supported) {
    return NextResponse.json({ supported: false, pixSemContraparte: 0 })
  }

  // Só descrição + contraparte (bounded por conta). NUNCA logar nome.
  const txs = await prisma.transaction.findMany({
    where: { bankAccountId: contaId, counterpartyName: null },
    select: { description: true, counterpartyName: true },
  })
  const pixSemContraparte = countCounterpartyGap(txs)

  return NextResponse.json({ supported: true, pixSemContraparte })
}
