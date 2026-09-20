// ⭐⭐ A PORTA DO BALCÃO — um gesto, um efeito (15/09/2026).
//
// ⛔ A régua e a recusa moram na LIB (`resolverLinha`); aqui é casca fina. E a lei do
// SENTIDO é checada lá, no servidor — esconder o botão não impede a chamada.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getAuthContext } from '@/lib/auth/rbac'
import { resolverLinha, destinoDaAcao, ResolverError } from '@/lib/conciliacao/resolver-linha'

const schema = z.object({
  empresaId: z.string().min(1),
  txId: z.string().min(1),
  acao: z.enum(['CASAR_PAGAR', 'PGTO_CARTAO', 'PARCELA_EMPRESTIMO', 'TRANSFERENCIA_ENVIADA',
    'CASAR_RECEBER', 'RECEBIMENTO_VENDA', 'TRANSFERENCIA_RECEBIDA', 'ESTORNO', 'CATEGORIA', 'IGNORAR']),
  cardId: z.string().optional(),
  invoiceMonth: z.string().nullable().optional(),
  loanId: z.string().optional(),
  installmentNumber: z.number().int().optional(),
  categoryId: z.string().optional(),
  estornoDeTxId: z.string().optional(),
  parTxId: z.string().optional(),
  /** ⭐ o(s) alvo(s) do CASAR quando o palpite já os traz POR ID (20/09) */
  contaIds: z.array(z.string().min(1)).max(50).optional(),
  diferencaAceita: z.number().optional(),
})

export async function POST(request: NextRequest) {
  const p = schema.safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ erro: 'Gesto inválido.' }, { status: 400 })
  const ctx = await getAuthContext(request, p.data.empresaId)
  if (!ctx) return NextResponse.json({ erro: 'Sessão expirada ou não autenticado' }, { status: 401 })
  // ⚠️ resolver linha do extrato MEXE em dinheiro: é `transaction.update`, a mesma fronteira
  // da conciliação e da categorização.
  if (!ctx.permissions.some((k) => k === '*' || k === 'transaction.update')) {
    return NextResponse.json({ erro: 'Sem permissão pra resolver linhas do extrato.', permission: 'transaction.update' }, { status: 403 })
  }
  try {
    const r = await resolverLinha({ ...p.data, companyId: p.data.empresaId, userId: ctx.user?.id }, prisma)
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof ResolverError) {
      /**
       * ⭐ AS AÇÕES DE VÍNCULO NÃO GRAVAM AQUI — elas LEVAM ao lugar onde o alvo se escolhe
       * (o card do "escolher na mão", o `/parear`). ⛔ E devolver o caminho é o que impede
       * que "não gravou" vire silêncio: o gesto **sempre** responde alguma coisa.
       */
      if (e.message === 'DEEP_LINK') {
        return NextResponse.json({ ok: true, deepLink: destinoDaAcao(p.data.acao, p.data.empresaId, p.data.txId), saiuDaCaixa: false })
      }
      // ⭐ o code chega na tela pra ela oferecer o gesto certo (o chip de categoria)
      return NextResponse.json({ erro: e.message, code: e.code }, { status: 422 })
    }
    throw e
  }
}
