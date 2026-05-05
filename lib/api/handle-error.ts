// Handler centralizado de erros pra rotas API (Sub-etapa 5.3.B).
// Mantém formato de resposta consistente:
//   - 401 AuthenticationError → { erro }
//   - 403 ForbiddenError → { erro, permission }
//   - 400 ZodError → { erro, campos }
//   - 500 Error → { erro: error.message }
//   - 500 unknown → { erro: 'Erro interno' }

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AuthenticationError, ForbiddenError } from '@/lib/auth/rbac'

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ erro: error.message }, { status: 401 })
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json(
      { erro: error.message, permission: error.permission },
      { status: 403 },
    )
  }

  if (error instanceof ZodError) {
    const campos: Record<string, string> = {}
    error.errors.forEach((e) => {
      if (e.path[0]) campos[e.path[0] as string] = e.message
    })
    return NextResponse.json(
      { erro: 'Dados inválidos', campos, issues: error.errors },
      { status: 400 },
    )
  }

  if (error instanceof Error) {
    console.error('[API ERROR]', error.name, error.message)
    return NextResponse.json(
      { erro: error.message || 'Erro interno' },
      { status: 500 },
    )
  }

  console.error('[API ERROR] Unknown:', error)
  return NextResponse.json({ erro: 'Erro interno' }, { status: 500 })
}
