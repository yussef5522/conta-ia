// GET /api/conciliacao/sugestoes-pendentes — a sugestão de vínculo DENTRO da fila
// de Pendentes.
//
// ⭐ O buraco que o dono achou: *"o matcher existe, a sugestão existe — mas a tela
// de Pendentes NÃO roda o matcher nem oferece o vínculo. Resultado: eu olhando uma
// conta a pagar casável e sem gesto pra casar."*
//
// ⛔ É a MESMA função que a Conciliação e o import usam (`sugerirVinculos`) — fonte
// única de sugestão, não uma segunda régua que diverge no primeiro caso de borda.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { sugestoesParaPendentes } from '@/lib/conciliacao/fila-de-conciliacao'

const querySchema = z.object({ empresaId: z.string().cuid() })

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const data = querySchema.parse(Object.fromEntries(url.searchParams))

    const ctx = await getAuthContext(request, data.empresaId)
    ctx.requirePermission('transaction.view')

    // ⚠️ a forma do payload é a MESMA de antes (`{ sugestoes }`) e ganhou `{ lotes }`
    // ao lado — contrato aditivo, então uma tela que ainda não lê `lotes` não quebra.
    const { sugestoes, lotes } = await sugestoesParaPendentes(data.empresaId)
    return NextResponse.json({ sugestoes, lotes })
  } catch (error) {
    return handleApiError(error)
  }
}
