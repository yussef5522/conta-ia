// Define o vencimento de uma parcela "A DEFINIR".
//
// ⚠️ `stock.manage`: combinar quando o dinheiro sai é decisão de DONO — a mesma fronteira de
// papel do envio de boleto pro financeiro (a operadora confere a nota; o dono decide o
// compromisso).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { getAuthContext } from '@/lib/auth/rbac'
import { enviarParaContasPagar } from '@/lib/stock/ponte-contas-pagar'
import { definirVencimento, parcelasSemData, rastroDoVencimento, VencimentoError } from '@/lib/stock/ponte/vencimento'

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  const sug = new URL(request.url).searchParams.get('suggestionId')
  if (sug) return NextResponse.json({ rastro: await rastroDoVencimento(companyId, sug, prisma) })
  return NextResponse.json({ semData: await parcelasSemData(companyId, prisma) })
}

const schema = z.object({
  suggestionId: z.string().min(1),
  dVenc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data (AAAA-MM-DD).'),
  origem: z.enum(['DONO', 'BOLETO']).optional(),
  /** ⛔ o OK do dono quando o boleto traz data diferente da que ele pôs */
  aceitarConflito: z.boolean().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  const { suggestionId, dVenc, origem, aceitarConflito } = parsed.data
  try {
    const r = await definirVencimento(
      companyId, suggestionId, new Date(`${dVenc}T00:00:00.000Z`),
      origem ?? 'DONO', a.user!.sub, prisma, aceitarConflito ?? false,
    )
    // ⭐⭐ DEFINIU A DATA → VAI DIRETO PRO FINANCEIRO (04/09). Não existe mais fila
    // intermediária: definir o vencimento É a aprovação, do mesmo jeito que confirmar a
    // conferência é. ⚠️ Não roda quando houve CONFLITO (o dono ainda vai decidir qual data).
    let ponte: Awaited<ReturnType<typeof enviarParaContasPagar>> | null = null
    let ponteErro: string | null = null
    if (r.gravou) {
      const ctx = await getAuthContext(request, companyId)
      try {
        ponte = await enviarParaContasPagar({
          companyId, suggestionIds: [suggestionId], cadastrarFornecedores: true, ctx, userId: a.user!.sub,
        }, prisma)
      } catch (e) {
        // ⛔ a data FICA gravada mesmo se a ponte falhar — e a tela diz que a conta não nasceu
        ponteErro = (e as Error).message
      }
    }
    return NextResponse.json({ ...r, ponte, ponteErro })
  } catch (e) {
    if (e instanceof VencimentoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
