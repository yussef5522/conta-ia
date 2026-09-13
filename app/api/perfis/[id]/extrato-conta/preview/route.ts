// ⭐ PF FASE 1 (13/09) — PREVIEW do extrato da CONTA pessoal.
//
// ⛔ Só o dono do perfil: `checkProfileAccess` antes de qualquer leitura. Foi a lacuna que
// o sprint do cartão PF fechou em 26/08 — `getCardInProfile` conferia o cartão e não o
// USUÁRIO, e bastava trocar o id na URL.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkProfileAccess } from '@/lib/personal-profile/queries'
import { previewDoExtratoPF } from '@/lib/pf-extrato/orquestrador'
import { carregarContexto } from '@/lib/pf-extrato/contexto'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  try { await checkProfileAccess(user.sub, profileId) }
  catch { return NextResponse.json({ erro: 'Perfil não encontrado' }, { status: 404 }) }

  const form = await request.formData()
  const file = form.get('arquivo')
  const contaId = String(form.get('contaId') ?? '')
  if (!(file instanceof File)) return NextResponse.json({ erro: 'Mande o arquivo OFX.' }, { status: 400 })
  if (!contaId) return NextResponse.json({ erro: 'Escolha a conta.' }, { status: 400 })

  const ctx = await carregarContexto(profileId, contaId, prisma)
  if (!ctx) return NextResponse.json({ erro: 'Conta não encontrada neste perfil.' }, { status: 404 })

  const preview = previewDoExtratoPF({ raw: await file.text(), ...ctx })
  return NextResponse.json({ ...preview, fileName: file.name, contaId })
}
