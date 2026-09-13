// ⭐⭐ "DEFINIR PARCELAS" — o gesto que tira a nota do limbo (13/09/2026).
//
// GET  → a nota está no estado A DEFINIR? quanto deve? (pra a tela abrir preenchida)
// POST → preview (`confirmar:false`) ou grava as parcelas E cria as contas a pagar.
//
// ⛔ **`stock.manage`, não `operate`** — a fronteira de 24/08 continua: conferir a nota é
// operação do dia; **criar obrigação financeira é decisão do dono.** O que muda é que antes
// não havia gesto NENHUM, e a nota ficava invisível pra sempre.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { getAuthContext } from '@/lib/auth/rbac'
import { combinadoDaNota } from '@/lib/stock/ponte/combinado'
import { estadoDasParcelas } from '@/lib/stock/ponte/estado-das-parcelas'
import {
  previewDefinirParcelas, definirParcelasEEnviar, DefinirParcelasError,
} from '@/lib/stock/ponte/definir-parcelas'

interface Params { params: Promise<{ id: string; nfeId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  // ⚠️ LER é `stock.view` — a régua "ler é ler" do guard estrutural de rotas
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res

  const combinado = await combinadoDaNota(companyId, nfeId, prisma)
  if (!combinado) return NextResponse.json({ erro: 'Nota não encontrada' }, { status: 404 })
  const parcelas = await estadoDasParcelas(companyId, nfeId, prisma)
  return NextResponse.json({
    totalNota: combinado.totalNota,
    aDefinir: parcelas.some((p) => p.estado === 'A_DEFINIR'),
    parcelas,
  })
}

const schema = z.object({
  confirmar: z.boolean().default(false),
  parcelas: z.array(z.object({
    valor: z.coerce.number().positive(),
    dVenc: z.string().min(8),
  })).min(1).max(60),
  motivo: z.string().max(200).nullish(),
  cadastrarFornecedores: z.boolean().default(true),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Digite ao menos uma parcela com valor e vencimento.' }, { status: 400 })
  }
  const { confirmar, parcelas, motivo, cadastrarFornecedores } = parsed.data

  try {
    const preview = await previewDefinirParcelas(companyId, nfeId, parcelas, motivo ?? null, prisma)
    // ⭐ PREVIEW e GRAVAÇÃO usam a MESMA validação (`validarCombinado`) — a tela não tem
    // como mostrar "pode gravar" e o servidor recusar (a lição do preview × confirm do OFX).
    if (!confirmar) return NextResponse.json({ ok: true, preview })
    if (!preview.podeGravar) return NextResponse.json({ erro: preview.erros.join(' '), preview }, { status: 422 })

    const ctx = await getAuthContext(request, companyId)
    const r = await definirParcelasEEnviar(
      { companyId, nfeId, parcelas, motivo, cadastrarFornecedores, ctx, userId: auth.userId },
      prisma,
    )
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof DefinirParcelasError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
}
