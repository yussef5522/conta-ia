import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { transacaoLoteClassificacaoSchema } from '@/lib/validations/transacao-lote'
import { montarUpdateClassificacaoManual } from '@/lib/transacoes/classificar'

// PATCH /api/transacoes/lote
// Atualiza a categoria de várias transações em uma única chamada.
// Body: { transactionIds: string[], categoryId: string | null }
//
// Multi-tenancy:
//   1. Categoria (se fornecida) precisa pertencer a uma empresa do usuário.
//   2. updateMany com filtro por bankAccount.company.users — IDs de outras
//      empresas são silenciosamente ignorados (refletido em naoEncontradas).
//
// Sempre seta classificationSource='MANUAL' e limpa os metadados de IA.
// NÃO cria/atualiza AiLearningRule — isso vem na sub-etapa 4.6.
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })

  try {
    const body = await request.json()
    const data = transacaoLoteClassificacaoSchema.parse(body)

    // Verifica que a categoria, se informada, pertence a uma empresa do usuário
    if (data.categoryId) {
      const cat = await prisma.category.findFirst({
        where: {
          id: data.categoryId,
          company: { users: { some: { userId: user.sub } } },
        },
      })
      if (!cat) return NextResponse.json({ erro: 'Categoria inválida' }, { status: 400 })
    }

    const result = await prisma.transaction.updateMany({
      where: {
        id: { in: data.transactionIds },
        bankAccount: { company: { users: { some: { userId: user.sub } } } },
      },
      data: montarUpdateClassificacaoManual(data.categoryId),
    })

    return NextResponse.json({
      atualizadas: result.count,
      naoEncontradas: data.transactionIds.length - result.count,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      const campos: Record<string, string> = {}
      error.errors.forEach((e) => { if (e.path[0]) campos[e.path[0] as string] = e.message })
      return NextResponse.json({ erro: 'Dados inválidos', campos }, { status: 400 })
    }
    console.error('[TRANSACOES PATCH lote] Erro:', error)
    return NextResponse.json({ erro: 'Erro interno do servidor' }, { status: 500 })
  }
}
