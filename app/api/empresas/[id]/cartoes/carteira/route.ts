// ⭐⭐⭐ CARTÕES v3 (24/11/2026) — GET da PÁGINA de cartões: a carteira inteira em lote (R44/R45).
// ⚠️ Consultas CONSTANTES (`lerCarteira`) — o N+1 da lista antiga morreu. Só leitura.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { lerCarteira } from '@/lib/credit-card-pj/carteira'
import { semearQuitacoes } from '@/lib/credit-card-pj/materializar'
import { diaDoBrasil } from '@/lib/margem/dia'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ erro: 'Sessão expirada ou não autenticado', code: 'AUTH_REQUIRED' }, { status: 401 })
  }
  const acesso = await prisma.userCompany.findFirst({ where: { userId: user.sub, companyId }, select: { companyId: true } })
  if (!acesso) return NextResponse.json({ erro: 'Empresa não encontrada' }, { status: 404 })
  const hoje = diaDoBrasil(new Date())
  // ⭐ R53 — on-read: a fatura de quitação do mês do cartão encerrado nasce aqui se ainda não nasceu
  // (o cron das 3h é o outro disparo). ⚠️ A leitura nunca cai por causa da semeadura.
  try { await semearQuitacoes(prisma, companyId, hoje) } catch { /* idem rotinas */ }
  return NextResponse.json(await lerCarteira(companyId, hoje))
}
