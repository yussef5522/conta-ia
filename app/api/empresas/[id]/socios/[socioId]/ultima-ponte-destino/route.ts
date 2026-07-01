// Sprint Fluxo-Unificado-Retirada (30/06/2026) — sugestão de destino PF.
//
// Retorna profileId + bankAccountId + categoryId da ÚLTIMA ponte deste
// socioPF, pra pré-preencher NovaPonteForm quando user aceita convite
// pós-categorização ou clica "Enviar ao PF" na fila.
//
// Validado 30/06: 13/13 pontes Cacula do único SocioPF (Yussef) foram
// idênticas — banrisul + "Pró-labore/Lucros". Um simples "last used"
// resolve 100% dos casos reais.
//
// 🔒 PRIVACIDADE: só devolve destino se o user logado for dono do
// perfil PF de destino (owned_by_user). Sócio B não vê pra qual conta
// pessoal do sócio A a última distribuição foi.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext, AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'
import { getUserOwnedProfileIds } from '@/lib/bridges/queries'

export interface UltimaPonteDestino {
  profileId: string | null
  bankAccountId: string | null
  categoryId: string | null
}

function errorResponse(err: unknown) {
  if (err instanceof AuthenticationError) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ erro: err.message }, { status: 403 })
  }
  throw err
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; socioId: string }> },
) {
  try {
    const { id: companyId, socioId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.view')

    const ownedProfileIds = await getUserOwnedProfileIds(ctx.user.id)
    if (ownedProfileIds.length === 0) {
      return NextResponse.json<UltimaPonteDestino>({
        profileId: null,
        bankAccountId: null,
        categoryId: null,
      })
    }

    // Última ponte do socio + pfTransaction (destino) — filtrada por
    // profileId do user (privacidade). Se nenhuma bater, retorna nulls.
    const last = await prisma.pJtoPFBridge.findFirst({
      where: {
        companyId,
        socioPFId: socioId,
        profileId: { in: ownedProfileIds },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        profileId: true,
        pfTransaction: {
          select: { bankAccountId: true, categoryId: true },
        },
      },
    })

    if (!last) {
      return NextResponse.json<UltimaPonteDestino>({
        profileId: null,
        bankAccountId: null,
        categoryId: null,
      })
    }

    return NextResponse.json<UltimaPonteDestino>({
      profileId: last.profileId,
      bankAccountId: last.pfTransaction?.bankAccountId ?? null,
      categoryId: last.pfTransaction?.categoryId ?? null,
    })
  } catch (err) {
    return errorResponse(err)
  }
}
