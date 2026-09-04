// ESTOQUE FASE 1 item 2 — POST confirmar a conferência. Gera movimentos + contas a
// pagar sugerido + Confirmação SEFAZ. Só escreve stock_*. Auth + empresa.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { confirmarConferencia } from '@/lib/stock/confirmar-conferencia'
import { getAuthContext } from '@/lib/auth/rbac'
import { enviarParaContasPagar } from '@/lib/stock/ponte-contas-pagar'

interface Params { params: Promise<{ id: string; nfeId: string }> }

const itemSchema = z.object({
  nfeItemId: z.string(),
  cProd: z.string().default(''),
  xProd: z.string(),
  uCom: z.string().default(''),
  qtdNota: z.coerce.number(),
  vUnCom: z.coerce.number(),
  qtdRecebida: z.coerce.number().positive('quantidade recebida tem que ser > 0'),
  motivo: z.string().nullable().optional(),
  fotoBase64: z.string().nullable().optional(),
  mapeado: z.object({
    itemId: z.string(),
    nome: z.string().min(1),
    unidadeControle: z.enum(['KG', 'UN', 'LT']),
    categoria: z.enum(['MATERIA_PRIMA', 'REVENDA', 'EMBALAGEM', 'LIMPEZA', 'USO_INTERNO']).optional(),
    fatorConversao: z.coerce.number().positive().default(1),
    novo: z.boolean(),
  }),
})
const bodySchema = z.object({
  fornecedor: z.object({ cnpj: z.string(), nome: z.string(), uf: z.string().nullable().optional() }),
  /**
   * ⭐ O BOLETO DE PAPEL (04/09) — OPCIONAL. Quando o XML não traz duplicata mas o boleto veio
   * junto com a mercadoria, o dono digita aqui e o payable nasce com a data certa, no fluxo
   * normal. ⚠️ Sem isso a parcela nasce "A DEFINIR" — o certo pra pix/dinheiro combinado.
   */
  pagamento: z.object({
    parcelas: z.array(z.object({
      dVenc: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data da parcela inválida.'),
      valor: z.number().positive('Valor da parcela inválido.'),
    })).max(24),
  }).optional(),
  itens: z.array(itemSchema).min(1),
  // PONTE 1 — bloco "BOLETOS DA NOTA": nada vai pro financeiro sem estes campos.
  enviarBoletos: z.boolean().optional(),
  /** nº das duplicatas marcadas (as sugestões só nascem no confirmar); vazio = todas */
  boletosSelecionados: z.array(z.string()).optional(),
  /** aceite pra cadastrar o fornecedor no financeiro com o dado do XML */
  cadastrarFornecedor: z.boolean().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, nfeId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const user = a.user

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos', detalhe: parsed.error.issues[0]?.message }, { status: 400 })

  try {
    const r = await confirmarConferencia({ companyId, nfeId, userId: user.sub, fornecedor: parsed.data.fornecedor, itens: parsed.data.itens,
      pagamento: parsed.data.pagamento
        ? { parcelas: parsed.data.pagamento.parcelas.map((p) => ({ dVenc: new Date(`${p.dVenc}T00:00:00.000Z`), valor: p.valor })) }
        : undefined })

    // PONTE 1 — os boletos que o dono marcou no bloco "BOLETOS DA NOTA" viram conta a
    // pagar de verdade. Só acontece com aceite EXPLÍCITO e só pra quem tem stock.manage:
    // o operador de loja confere a nota (o estoque entra normal) mas NÃO cria obrigação
    // financeira — as parcelas ficam esperando o dono aprovar em /estoque/contas-a-pagar.
    let ponte: Awaited<ReturnType<typeof enviarParaContasPagar>> | null = null
    if (parsed.data.enviarBoletos) {
      const ctx = await getAuthContext(request, companyId)
      if (ctx.hasPermission('stock.manage')) {
        // as sugestões acabaram de nascer no confirmarConferencia; a tela marcou por nDup
        const sugestoes = await prisma.stockPayableSuggestion.findMany({ where: { companyId, nfeId }, select: { id: true, nDup: true } })
        const marcados = parsed.data.boletosSelecionados
        const escolhidas = marcados?.length
          ? sugestoes.filter((x) => marcados.includes(x.nDup ?? '')).map((x) => x.id)
          : sugestoes.map((x) => x.id)
        if (escolhidas.length) {
          ponte = await enviarParaContasPagar({
            companyId, suggestionIds: escolhidas,
            cadastrarFornecedores: parsed.data.cadastrarFornecedor ?? true,
            ctx, userId: user.sub,
          }, prisma)
        }
      }
    }
    return NextResponse.json({ ok: true, resultado: r, ponte })
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 422 })
  }
}
