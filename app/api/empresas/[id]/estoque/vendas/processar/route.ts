// ESTOQUE FASE 3 passo 2 — POST processar vendas. confirmar=false → PREVIEW (não grava);
// confirmar=true → BAIXA_VENDA (idempotente por dia). reprocessar=true → refaz um dia já
// importado a partir das linhas gravadas (sem re-upload). incluir = nomes marcados (checkbox).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { montarPlanoVenda, processarVendas, reprocessarDia, montarPlanoReprocesso } from '@/lib/stock/vendas/baixa-venda'
import { SuitableParseError } from '@/lib/stock/vendas/parse-suitable'
import { SanidadeNaoConfirmadaError } from '@/lib/stock/vendas/medir-sanidade'
import { BaixaComItemBarradoError } from '@/lib/stock/vendas/itens-pendentes-da-baixa'
import { exigirDiaDecidido, DiaNaoConfirmadoError } from '@/lib/stock/vendas/lei-da-data'
import { irmaoDoPar } from '@/lib/stock/vendas/registrar-arquivo'

interface Params { params: Promise<{ id: string }> }

const schema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data das vendas (AAAA-MM-DD).'),
  html: z.string().max(5_000_000).optional(),
  confirmar: z.boolean().optional(),
  reprocessar: z.boolean().optional(),
  incluir: z.array(z.string()).nullable().optional(),
  // ⭐ o dono viu a pergunta da sanidade e respondeu "pode baixar"
  confirmouSanidade: z.boolean().optional(),
  /**
   * ⭐ os itens que o dono mandou DEIXAR PENDENTES (19/09) — a saída que a recusa oferece
   * quando um item barra o lote. As LINHAS do dia continuam gravadas: resolvido o item, um
   * reprocesso baixa o que faltou, sem reimportar nada.
   */
  itensPendentes: z.array(z.string()).optional(),
  /**
   * ⭐ O NOME DO ARQUIVO que o dono soltou na dropzone (08/10). Guardado junto do Σ
   * declarado, é o que permite a conferência dizer QUAL arquivo explica este dia.
   * ⚠️ Opcional: o reprocesso não tem arquivo (ele relê as linhas já gravadas), e inventar
   * um nome ali seria afirmar uma origem que não houve.
   */
  nomeArquivo: z.string().trim().min(1).max(300).optional(),
  /**
   * ⭐ a resposta do dono à pergunta do dia (a lei da data, 16/10). ⛔ NÃO é um `force`: ela
   * só vale se bater com uma das opções que a pergunta ofereceu.
   */
  confirmouDia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const user = a.user
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' }, { status: 400 })
  const { data, html, confirmar, reprocessar, incluir, confirmouSanidade, itensPendentes, nomeArquivo, confirmouDia } = parsed.data
  try {
    /**
     * ⛔⛔ **A LEI DA DATA, pela porta ÚNICA** — a MESMA que o import de complementos chama
     * (16/10). Duas avaliações, uma por rota, seriam o caminho pra os dois relatórios do
     * MESMO par perguntarem coisas diferentes: exatamente o defeito que a lei fecha.
     *
     * ⚠️ **O REPROCESSO fica fora, e o motivo é de fato:** ele relê as linhas **já gravadas**
     * de um dia que o dono já decidiu — não há data nova sendo apontada. Perguntar ali seria
     * reabrir uma decisão tomada.
     */
    const dia = reprocessar
      ? data
      : exigirDiaDecidido({
          diaEscolhido: data,
          agora: new Date(),
          irmao: await irmaoDoPar(companyId, 'PRODUTOS', prisma),
          confirmouDia,
        })
    if (reprocessar) {
      if (confirmar) return NextResponse.json({ ok: true, recibo: await reprocessarDia(companyId, data, user.sub, prisma, confirmouSanidade ?? false, itensPendentes ?? []) })
      const r = await montarPlanoReprocesso(companyId, data, prisma)
      if (!r) return NextResponse.json({ erro: 'Não há import desse dia pra reprocessar.' }, { status: 404 })
      return NextResponse.json({ plano: r.plano, reprocesso: true, estornaItens: r.estornaItens })
    }
    if (!html) return NextResponse.json({ erro: 'Envie o arquivo do dia.' }, { status: 400 })
    if (confirmar) return NextResponse.json({ ok: true, recibo: await processarVendas(companyId, dia, html, user.sub, prisma, incluir ?? null, confirmouSanidade ?? false, itensPendentes ?? [], nomeArquivo) })
    return NextResponse.json({ plano: await montarPlanoVenda(companyId, dia, html, prisma, incluir ?? null) })
  } catch (e) {
    /** ⭐ 409 = PERGUNTA (o desenho da sanidade): a tela mostra os dois botões e o dono decide */
    if (e instanceof DiaNaoConfirmadoError) {
      return NextResponse.json(
        { erro: e.message, code: 'CONFIRME_O_DIA', dia: e.veredicto },
        { status: 409 },
      )
    }
    if (e instanceof SuitableParseError) return NextResponse.json({ erro: e.message }, { status: 422 })
    // ⭐ 409 = "pergunta", não "erro": a tela mostra os números e o dono decide. Reenviar
    // com confirmouSanidade:true passa — é o desenho do dono (pergunta, nunca recusa cega).
    if (e instanceof SanidadeNaoConfirmadaError) return NextResponse.json({ erro: e.message, code: e.code, sanidade: e.sanidade }, { status: 409 })
    /**
     * ⭐ 409 TAMBÉM AQUI — é pergunta, não erro: a recusa NOMEIA os itens barrados e
     * devolve a saída. Reenviar com `itensPendentes` baixa os outros. ⛔ O lote nunca fica
     * refém de um item sem o dono saber qual é.
     */
    if (e instanceof BaixaComItemBarradoError) {
      return NextResponse.json({ erro: e.message, code: 'ITEM_BARRADO', barrados: e.barrados, quantosSeguem: e.quantosSeguem }, { status: 409 })
    }
    return NextResponse.json({ erro: (e as Error).message }, { status: 500 })
  }
}
