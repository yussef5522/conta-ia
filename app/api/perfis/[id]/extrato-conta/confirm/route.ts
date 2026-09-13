// ⭐ PF FASE 1 (13/09) — CONFIRMAR o extrato da conta pessoal.
//
// ⛔⛔ **O PREVIEW E O CONFIRM RODAM O MESMO MOTOR** (`previewDoExtratoPF`), com o mesmo
// arquivo. É a régua de 13/08 (`resolveImportStatuses`): tela e gravação não têm como
// divergir porque não existe uma segunda conta — o que o dono viu é o que entra.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { checkProfileAccess } from '@/lib/personal-profile/queries'
import { previewDoExtratoPF } from '@/lib/pf-extrato/orquestrador'
import { carregarContexto } from '@/lib/pf-extrato/contexto'
import { gravarExtratoPF } from '@/lib/pf-extrato/gravar'
import { parseOFX } from '@/lib/ofx/parser'
import { classificarLinhas } from '@/lib/pf-extrato/classificar'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: profileId } = await params
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  try { await checkProfileAccess(user.sub, profileId) }
  catch { return NextResponse.json({ erro: 'Perfil não encontrado' }, { status: 404 }) }

  const form = await request.formData()
  const file = form.get('arquivo')
  const contaId = String(form.get('contaId') ?? '')
  const aprender = form.get('aprenderConta') === 'true'
  if (!(file instanceof File)) return NextResponse.json({ erro: 'Mande o arquivo OFX.' }, { status: 400 })

  const ctx = await carregarContexto(profileId, contaId, prisma)
  if (!ctx) return NextResponse.json({ erro: 'Conta não encontrada neste perfil.' }, { status: 404 })

  const raw = await file.text()
  const preview = previewDoExtratoPF({ raw, ...ctx })
  // ⛔ o que o preview BLOQUEIA, o confirm não grava — nem que o cliente insista
  if (preview.bloqueio) return NextResponse.json({ erro: preview.bloqueio.erro, code: preview.bloqueio.code }, { status: 422 })

  const p = parseOFX(raw)
  const categorias = await classificarLinhas(profileId, preview.novas, prisma)
  const r = await gravarExtratoPF({
    profileId, contaId, userId: user.sub, fileName: file.name, preview,
    ledgerBal: p.ledgerBalance ?? null,
    aprender: aprender ? preview.aprender : null,
    categorias,
  }, prisma)
  return NextResponse.json(r)
}
