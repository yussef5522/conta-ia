// POST /api/empresas/[id]/retiradas-orfas/lote — Sprint Fechar-Ponte (08/08/2026)
//
// Resolve VÁRIAS retiradas órfãs de uma vez: o usuário escolhe perfil PF, conta
// PF, tipo e (opcional) categoria de gasto UMA vez; aqui cada tx vira uma ponte
// via createBridge (atomic, mesmo caminho da tela individual). Fluxo A/B quando
// spendCategoryId presente (entra + sai, saldo PF net 0).
//
// Sequencial de propósito: as pontes tocam a MESMA linha de saldo da conta PF —
// concorrência daria deadlock/race. NUNCA aplica sem o preview do cliente.

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'
import { createBridge } from '@/lib/bridges/create'
import { isBridgeError, type BridgeKind } from '@/lib/bridges/types'
import { invalidateLucroCache } from '@/lib/withdrawals/lucro-disponivel'

interface Params {
  params: Promise<{ id: string }>
}

const schema = z.object({
  pjTransactionIds: z.array(z.string().min(1)).min(1).max(200),
  profileId: z.string().min(1),
  pfBankAccountId: z.string().min(1),
  // Sprint Entrada-Fixa-Ponte (13/08/2026): entrada resolvida no servidor.
  // Aceito e ignorado se vier de client antigo.
  pfCategoryId: z.string().optional(),
  kind: z.enum(['PRO_LABORE', 'DISTRIBUICAO', 'REEMBOLSO', 'ADIANTAMENTO', 'RETIRADA_SOCIOS']),
  socioPFId: z.string().nullish(),
  spendCategoryId: z.string().min(1).nullish(),
})

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: empresaId } = await params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ erro: 'JSON inválido' }, { status: 400 })
    }
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos', code: 'VALIDATION_ERROR' },
        { status: 400 },
      )
    }

    const ctx = await getAuthContext(request, empresaId)
    ctx.requirePermission('transaction.create')

    const { pjTransactionIds, profileId, pfBankAccountId, kind, socioPFId, spendCategoryId } =
      parsed.data

    const results: Array<{ pjTransactionId: string; ok: boolean; erro?: string; code?: string }> = []
    for (const pjTransactionId of pjTransactionIds) {
      try {
        await createBridge({
          userId: ctx.user.id,
          companyId: empresaId,
          pjTransactionId,
          profileId,
          pfBankAccountId,
          kind: kind as BridgeKind,
          createdVia: 'CREATED_MANUAL',
          socioPFId: socioPFId ?? null,
          spend: spendCategoryId ? { categoryId: spendCategoryId } : undefined,
        })
        results.push({ pjTransactionId, ok: true })
      } catch (err) {
        if (isBridgeError(err)) {
          results.push({ pjTransactionId, ok: false, erro: err.message, code: err.code })
        } else {
          // Erro inesperado numa tx não derruba o lote inteiro — registra e segue.
          results.push({ pjTransactionId, ok: false, erro: 'Erro inesperado' })
        }
      }
    }

    const criadas = results.filter((r) => r.ok).length
    const falhas = results.length - criadas

    if (criadas > 0) {
      invalidateLucroCache(empresaId)
      try {
        // Next.js 16: revalidateTag(tag, profile) — usa 'default' 1min.
        revalidateTag(`retiradas-pendentes:${empresaId}`, 'default')
      } catch {
        /* test env */
      }
    }

    return NextResponse.json({ criadas, falhas, results })
  } catch (err) {
    if (err instanceof AuthenticationError) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ erro: err.message }, { status: 403 })
    }
    return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
  }
}
