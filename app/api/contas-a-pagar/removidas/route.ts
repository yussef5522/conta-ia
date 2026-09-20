// ⭐ A LIXEIRA — o que sumiu, com quem e por qual caminho (20/09/2026).
//
// ⚠️ Ela LÊ a auditoria: não existe tabela de lixeira, e é de propósito — uma cópia da
// conta apagada seria uma segunda fonte do mesmo fato (ver `lib/contas-pagar/lixeira.ts`).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { contasRemovidas, parecidasComARemovida } from '@/lib/contas-pagar/lixeira'

export async function GET(request: NextRequest) {
  try {
  const empresaId = new URL(request.url).searchParams.get('empresaId') ?? ''
  const ctx = await getAuthContext(request, empresaId)
  ctx.requirePermission('transaction.view')

  const dias = Number(new URL(request.url).searchParams.get('dias') ?? '90')
  const removidas = await contasRemovidas(empresaId, Number.isFinite(dias) ? dias : 90, prisma)

  /**
   * ⭐⭐ AS PARECIDAS VÊM JUNTO — o dono disse que *"hoje adicionei contas que podem ser as
   * mesmas de novo"*. Descobrir a duplicata só DEPOIS de restaurar seria tarde: a tela
   * mostra as duas lado a lado antes do clique.
   */
  const comParecidas = await Promise.all(removidas.map(async (r) => ({
    ...r,
    parecidas: await parecidasComARemovida(empresaId, r, prisma),
  })))

  return NextResponse.json({
    removidas: comParecidas,
    total: comParecidas.length,
    // ⭐ o mapa por dia/caminho — é ele que responde "existe algo apagando sem meu gesto?"
    porDia: Object.entries(comParecidas.reduce<Record<string, { n: number; quem: Set<string>; caminhos: Set<string> }>>((acc, r) => {
      const dia = r.removidaEm.toISOString().slice(0, 10)
      acc[dia] ??= { n: 0, quem: new Set(), caminhos: new Set() }
      acc[dia].n++; acc[dia].quem.add(r.quem); acc[dia].caminhos.add(r.caminho)
      return acc
    }, {})).map(([dia, v]) => ({ dia, quantas: v.n, quem: [...v.quem], caminhos: [...v.caminhos] })).sort((x, y) => y.dia.localeCompare(x.dia)),
  })
  } catch (e) { return handleApiError(e) }
}
