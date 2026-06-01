// Sprint Asaas FATIA 3A (31/05/2026)
// GET /api/admin/asaas/health — confirma conexão com Asaas.
// RBAC: Gerenciador OWNER only (mexe com credencial de pagamento).

import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, loadGerenciador } from '@/lib/admin-auth/session'
import { checkAsaasConnection } from '@/lib/asaas/health'

export async function GET(_request: NextRequest) {
  const session = await getAdminSession()
  if (!session) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  const gerenciador = await loadGerenciador(session.gerenciadorId)
  if (!gerenciador || !gerenciador.active) {
    return NextResponse.json({ erro: 'Gerenciador inativo' }, { status: 401 })
  }

  // 🚨 RBAC: APENAS OWNER pode tocar em credencial de pagamento.
  if (gerenciador.role !== 'OWNER') {
    return NextResponse.json(
      {
        erro: 'Apenas gerenciadores OWNER podem acessar endpoints Asaas.',
        code: 'FORBIDDEN_RBAC',
      },
      { status: 403 },
    )
  }

  const result = await checkAsaasConnection()
  // result NUNCA contém a apiKey. Pode retornar direto.
  return NextResponse.json(result)
}
