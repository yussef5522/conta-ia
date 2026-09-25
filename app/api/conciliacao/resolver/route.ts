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
  /**
   * ⭐ 24/09 — o MOTIVO da diferença, escolhido na tela. Vai pro rastro da conta.
   * ⚠️ Lista fechada (o rastro é o que o contador lê); `OUTRO` traz o texto do dono.
   */
  motivoDaDiferenca: z.enum(['JUROS', 'MULTA', 'TARIFA', 'DESCONTO', 'OUTRO']).optional(),
  motivoLivre: z.string().trim().max(80).optional(),
  /**
   * ⭐ 25/09 — os dias de atraso/adiantamento que o dono CONFIRMOU no card (a LAMANA).
   *
   * ⚠️ **Tem que estar aqui.** O zod recorta o corpo, então campo que a tela manda e o
   * schema não declara **some em silêncio** — foi assim que o `empresaId` do lote produziu
   * um *"Gesto inválido"* em 23/09, com a tela prometendo o que o servidor nunca recebeu.
   */
  distanciaAceita: z.number().int().nonnegative().optional(),
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
    // ⭐ o CONTEXTO REAL vai junto — o reconcile exige `company.id` e `requirePermission`
    const r = await resolverLinha({ ...p.data, companyId: p.data.empresaId, userId: ctx.user?.id, authCtx: ctx }, prisma)
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
    /**
     * ⛔⛔⛔ **500 SEM CORPO ERA SILÊNCIO** (20/09). O `throw e` daqui devolvia a página de
     * erro do Next — **sem JSON, sem `content-type`** — e o cliente caía no fallback
     * genérico *"Não consegui carregar."*: o dono não sabia **o que** falhou, se gravou, nem
     * tinha como tentar de novo. *É a mesma família do 500 mudo do vínculo de parcela
     * (19/09), agora no ramo de baixo.*
     *
     * ⭐ Agora o inesperado continua sendo **500** (ali o genérico é honesto — ninguém
     * previu), mas com **corpo que DIZ o que falhou** e com `code` pra a tela oferecer o
     * "tentar de novo". O detalhe técnico vai pro log, não pra tela.
     */
    console.error('[conciliacao/resolver] erro inesperado', { acao: p.data.acao, txId: p.data.txId, erro: e })
    return NextResponse.json({
      erro: 'A conciliação não gravou — o servidor falhou no meio do gesto. Nada foi alterado; dá pra tentar de novo.',
      code: 'FALHA_INESPERADA',
    }, { status: 500 })
  }
}
