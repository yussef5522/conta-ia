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
  // ⭐ 05/09: a unidade tributária (o desempate) e a que o dono conferiu
  uTrib: z.string().nullable().optional(),
  unidadeEntrada: z.string().nullable().optional(),
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

    // ⭐⭐⭐ UM GESTO SÓ (04/09/2026 — decisão do dono): confirmar a conferência FAZ TUDO —
    // a mercadoria entra no estoque **e** os boletos viram conta a pagar no financeiro,
    // direto. *"Quando eu confirmo a nota, eu JÁ aprovei — me pedir de novo em outra tela é
    // aprovar duas vezes."* A fila intermediária de aprovação foi aposentada.
    //
    // ⚠️ SÓ VAI O QUE TEM DATA. Parcela sem vencimento fica "A DEFINIR" (o dono combina
    // depois e ela vai direto, sem passar por fila) — a ponte recusaria sem `dVenc` de
    // qualquer jeito, e mandar pra recusar seria erro na cara do dono sem motivo.
    //
    // ⚠️⚠️ E NÃO É A MESMA TRANSAÇÃO DO ESTOQUE, por limite real: `createContaPendente` (a
    // função ÚNICA que cria conta a pagar, compartilhada com o formulário do financeiro)
    // abre a própria `$transaction`, e Prisma **não aninha** — a mesma limitação que mordeu
    // na marcação de import em 29/08. Então a ordem é: estoque commita, ponte roda em
    // seguida. Se a ponte falhar, **a mercadoria fica** (ela chegou de verdade) e a resposta
    // DIZ que a conta não nasceu — nunca em silêncio. É o mesmo desenho da Confirmação
    // 210200, que também roda fora da transação pelo mesmo motivo.
    let ponte: Awaited<ReturnType<typeof enviarParaContasPagar>> | null = null
    let ponteErro: string | null = null
    const ctx = await getAuthContext(request, companyId)
    if (ctx.hasPermission('stock.manage')) {
      const sugestoes = await prisma.stockPayableSuggestion.findMany({
        where: { companyId, nfeId, dVenc: { not: null } }, select: { id: true },
      })
      if (sugestoes.length) {
        try {
          ponte = await enviarParaContasPagar({
            companyId, suggestionIds: sugestoes.map((x) => x.id),
            cadastrarFornecedores: parsed.data.cadastrarFornecedor ?? true,
            ctx, userId: user.sub,
          }, prisma)
        } catch (e) {
          // ⛔ falha aqui NÃO desfaz o recebimento físico — mas aparece na tela
          ponteErro = (e as Error).message
        }
      }
    }
    return NextResponse.json({ ok: true, resultado: r, ponte, ponteErro })
  } catch (e) {
    return NextResponse.json({ erro: (e as Error).message }, { status: 422 })
  }
}
