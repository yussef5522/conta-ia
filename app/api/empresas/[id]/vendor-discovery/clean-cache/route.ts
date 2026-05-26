// Sprint 5.0.2.o → 5.0.2.p (mudou de path): Limpar cache global envenenado.
//
// O endpoint vive em /api/empresas/[id]/... porque /api/admin/* é bloqueado
// pelo middleware (proxy.ts) fora do admin host (admin.caixaos.com.br).
// A operação em si é GLOBAL (deleta de GlobalVendorKnowledge), mas o usuário
// autenticado precisa ter acesso a alguma empresa pra rodar.
//
// Critério "envenenado":
//   - confidence inicial < 0.60 (cacheado antes da Sprint o)
//   - scoreAtual < 0.50 (cron baixou após rejeições)
//   - categoria genérica: "A Categorizar", "Classificar manualmente",
//     "Despesas Diversas"

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'

const POISONED_CATEGORIES = [
  'A Categorizar',
  'Classificar manualmente',
  'Despesas Diversas',
]

interface Params {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    ctx.requirePermission('transaction.update')

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
      `[CLEAN-POISONED-CACHE] user=${ctx.user.id} company=${companyId} deleted=${deleted.count}`,
    )

    return NextResponse.json({
      deleted: deleted.count,
      mensagem: `${deleted.count} entradas envenenadas removidas do cache global`,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
