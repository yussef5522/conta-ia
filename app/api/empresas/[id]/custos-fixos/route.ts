/**
 * ⭐⭐ A ROTA DOS CUSTOS FIXOS (06/10/2026) — uma leitura, três gestos, UM choke-point.
 *
 * ⛔⛔ **OS TRÊS GESTOS PASSAM PELO MESMO POST, e isso é desenho.** Três rotas (marcar, tirar,
 * planejar) seriam três lugares pra lembrar do rastro, da permissão e de devolver o payload
 * fresco — e é assim que um deles nasce sem o rastro (a doença dos 11 gestos da caixa, que só
 * ganharam auditoria quando o `switch` foi envolvido por um lugar só).
 *
 * ⚠️ **O POST DEVOLVE A TELA INTEIRA RECALCULADA.** A tela nunca deduz o estado novo a partir
 * do próprio clique — ela desenha o que o SERVIDOR aceitou. Dizer "marcado" a partir do clique
 * afirmaria uma gravação que pode não ter acontecido (a lição do check verde de 30/08).
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext } from '@/lib/auth/rbac'
import { handleApiError } from '@/lib/api/handle-error'
import { mesCorrente } from '@/lib/periodo/mes-corrente'
import { lerCustosFixos } from '@/lib/custos-fixos/leitura'
import { marcarComoFixa, tirarDaLista, definirPlanejado, CustoFixoError, MES_RE } from '@/lib/custos-fixos/gestos'
import { previaDaSemente, semear, type PreviaDaSemente } from '@/lib/custos-fixos/semear'

interface Params { params: Promise<{ id: string }> }

const corpo = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('MARCAR'), categoryId: z.string().min(1), mes: z.string().regex(MES_RE).optional() }),
  z.object({ acao: z.literal('TIRAR'), categoryId: z.string().min(1), mes: z.string().regex(MES_RE).optional() }),
  z.object({
    acao: z.literal('PLANEJAR'),
    categoryId: z.string().min(1),
    mes: z.string().regex(MES_RE),
    /** ⚠️ `null` APAGA o plano (volta pra "não declarei"); 0 é "declarei zero" */
    valor: z.number().min(0).nullable(),
  }),
  /**
   * ⭐⭐ SEMEAR EM LOTE — e o `confirmar` é o que separa a PRÉVIA da GRAVAÇÃO.
   *
   * ⛔ `confirmar: false` **não escreve nada** e devolve a prévia; `true` grava **o que a
   * prévia disse**. Um endpoint só pros dois é o que torna impossível a tela mostrar uma
   * lista e a gravação executar outra (a cicatriz do preview × confirm do import, 17/08).
   */
  z.object({
    acao: z.literal('SEMEAR'),
    mes: z.string().regex(MES_RE),
    mesReferencia: z.string().regex(MES_RE).nullable().optional(),
    incluirComPlano: z.boolean().default(false),
    confirmar: z.boolean().default(false),
  }),
])

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    // ⛔ custo fixo É o dinheiro da empresa — a mesma trava do Fluxo de Caixa (30/08)
    ctx.requirePermission('transaction.view')

    const p = request.nextUrl.searchParams.get('mes')
    const mes = p && MES_RE.test(p) ? p : mesCorrente()
    // ⭐ a referência é escolha do dono (o "[mês]" do «preencher todos»); sem ela, o anterior
    const r = request.nextUrl.searchParams.get('ref')
    const ref = r && MES_RE.test(r) ? r : null

    return NextResponse.json(await lerCustosFixos(companyId, mes, new Date(), undefined, ref))
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: companyId } = await params
    const ctx = await getAuthContext(request, companyId)
    // ⛔ declarar o que a casa custa é decisão de dinheiro — não é gesto de quem só LÊ
    ctx.requirePermission('transaction.update')

    const body = corpo.parse(await request.json())
    const mes = body.mes && MES_RE.test(body.mes) ? body.mes : mesCorrente()
    const quem = ctx.user?.id ?? null

    let previa: PreviaDaSemente | null = null
    let aplicados = 0
    let referencia: string | null = null
    try {
      if (body.acao === 'MARCAR') await marcarComoFixa(companyId, body.categoryId, quem)
      else if (body.acao === 'TIRAR') await tirarDaLista(companyId, body.categoryId, quem)
      else if (body.acao === 'PLANEJAR') await definirPlanejado(companyId, body.categoryId, mes, body.valor, quem)
      else {
        referencia = body.mesReferencia ?? null
        if (body.confirmar) {
          const r = await semear(companyId, mes, referencia, body.incluirComPlano, quem)
          previa = r.previa
          aplicados = r.aplicados
        } else {
          // ⛔ PRÉVIA: nada é gravado aqui
          previa = await previaDaSemente(companyId, mes, referencia, body.incluirComPlano)
        }
        referencia = previa.mesReferencia
      }
    } catch (e) {
      /**
       * ⚠️ A RECUSA ENSINA A SAÍDA, nunca devolve 500 mudo — a régua do tradutor de erro do
       * estoque (16/09): erro de domínio vira 422 COM a frase; o que ninguém previu segue 500.
       */
      if (e instanceof CustoFixoError) {
        return NextResponse.json({ erro: e.message, code: e.code }, { status: 422 })
      }
      throw e
    }

    const tela = await lerCustosFixos(companyId, mes, new Date(), undefined, referencia)
    return NextResponse.json({ ...tela, previa, aplicados })
  } catch (e) {
    return handleApiError(e)
  }
}
