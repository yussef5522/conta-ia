// Sprint 5.0.2.o — Limpar entradas envenenadas do cache global.
//
// Critério "envenenado":
//   - confidence inicial < 0.60 (já não deveria ter sido cacheada, mas Sprint
//     anterior cacheou tudo até "A Categorizar")
//   - scoreAtual < 0.50 (cron de auto-ajuste baixou após muitas rejeições)
//   - categoria genérica que não ajuda ("A Categorizar", "Classificar...",
//     "Despesas Diversas")
//
// AUTH: hoje qualquer user autenticado pode rodar (Yussef precisa testar).
// Sprint futura: limitar a role admin global.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { handleApiError } from '@/lib/api/handle-error'

const POISONED_CATEGORIES = [
  'A Categorizar',
  'Classificar manualmente',
  'Despesas Diversas',
]

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
    }

    const deleted = await prisma.globalVendorKnowledge.deleteMany({
      where: {
        OR: [
          { categoriaConfidence: { lt: 0.6 } },
          { scoreAtual: { lt: 0.5 } },
          { categoriaSugerida: { in: POISONED_CATEGORIES } },
        ],
      },
    })

    console.log(
      `[CLEAN-POISONED-CACHE] user=${user.sub} deleted=${deleted.count}`,
    )

    return NextResponse.json({
      deleted: deleted.count,
      mensagem: `${deleted.count} entradas envenenadas removidas do cache global`,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
