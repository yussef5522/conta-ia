/**
 * ⭐⭐⭐ A CONFERÊNCIA DO GERENTE — a rota (09/10/2026).
 *
 * ⛔⛔⛔ **`stock.manage` NO GET TAMBÉM, E ISSO É O GATE DA COLA DE PROVA.** A lei de 05/10
 * diz que *nenhum número esperado aparece na tela de quem DECLARA* — e o payload desta fila
 * carrega o **veredito do fiscal** (*"o material dava ~51"*). Deixar o GET em `stock.view`
 * mandaria esse veredito pro tablet da cozinha dentro do JSON, e a cola estaria a um DevTools
 * de distância. ⚠️ Por isso ela entra em `LEITURA_SENSIVEL` com o motivo escrito: *ler é ler*
 * continua valendo pro resto do módulo, e aqui a exceção tem nome.
 *
 * ⚠️ **E o POST exige `stock.manage` + PIN.** A sessão prova o PAPEL; o PIN prova a PESSOA.
 * Só a sessão faria "quatro olhos" virar dois numa aba aberta no tablet.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'
import { filaDeConferencia } from '@/lib/stock/producao/fila-de-conferencia'
import { confirmarConclusao, corrigirConclusao, preverCorrecao, MOTIVOS_DA_CORRECAO } from '@/lib/stock/producao/conferencia'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  try {
    return NextResponse.json(await filaDeConferencia(companyId, prisma))
  } catch (e) {
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (r) return NextResponse.json(r, { status: r.status })
    throw e
  }
}

const schema = z.discriminatedUnion('acao', [
  z.object({ acao: z.literal('CONFIRMAR'), conclusaoId: z.string().min(1), pin: z.string().min(1) }),
  z.object({
    acao: z.literal('PREVER_CORRECAO'),
    conclusaoId: z.string().min(1),
    qtdCerta: z.number().positive(),
  }),
  z.object({
    acao: z.literal('CORRIGIR'),
    conclusaoId: z.string().min(1),
    qtdCerta: z.number().positive(),
    /** ⭐ DERIVA da lista fechada da lib — repetir os literais aqui foi o que deixou 2 gestos
     *  mortos por dias em 25/09 (o `z.enum` da rota divergindo do vocabulário da lib) */
    motivo: z.enum(MOTIVOS_DA_CORRECAO),
    observacao: z.string().optional(),
    pin: z.string().min(1),
  }),
])

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ erro: 'Gesto inválido.', code: 'PAYLOAD', detalhe: parsed.error.issues[0]?.message }, { status: 400 })
  }
  const body = parsed.data

  try {
    if (body.acao === 'CONFIRMAR') {
      const r = await confirmarConclusao(
        { companyId, conclusaoId: body.conclusaoId, pin: body.pin, userId: a.user.sub },
        prisma,
      )
      return NextResponse.json({ ok: true, ...r })
    }
    if (body.acao === 'PREVER_CORRECAO') {
      /** ⛔ LEITURA PURA — o dono confere o efeito no estoque ANTES de gravar (ordem dele) */
      return NextResponse.json(await preverCorrecao(companyId, body.conclusaoId, body.qtdCerta, prisma))
    }
    const r = await corrigirConclusao(
      {
        companyId,
        conclusaoId: body.conclusaoId,
        qtdCerta: body.qtdCerta,
        motivo: body.motivo,
        observacao: body.observacao ?? null,
        pin: body.pin,
        userId: a.user.sub,
      },
      prisma,
    )
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    const r = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (r) return NextResponse.json(r, { status: r.status })
    throw e
  }
}
