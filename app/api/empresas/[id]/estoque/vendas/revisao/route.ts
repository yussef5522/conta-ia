// ⭐⭐ A REVISÃO DO IMPORT — o extrato do que chegou (14/09/2026).
//
// GET  ?data=&relatorio= → a lista POR NOME com estado, destino e o que desconta
// POST ?preview          → o que muda se reprocessar (só os nomes que mudaram de estado)
//
// ⛔ `stock.manage`: mudar vínculo é **escrita em estoque** (o nome passa a descontar
// item), e isso é decisão do dono — a mesma fronteira do mapa de vendas desde 22/08.
// ⚠️ LER é `stock.view` (a régua "ler é ler" do guard estrutural de rotas).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireStock } from '@/lib/stock/require-stock'
import { montarRevisao, previewDoAjuste } from '@/lib/stock/vendas/revisao-do-import'
import { reprocessarDia, montarPlanoReprocesso } from '@/lib/stock/vendas/baixa-venda'
import { processarComplementos, montarPlanoComplementos } from '@/lib/stock/vendas/baixa-complemento'

interface Params { params: Promise<{ id: string }> }

const q = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  relatorio: z.enum(['PRODUTOS', 'COMPLEMENTOS']).default('PRODUTOS'),
})

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.view')
  if (!auth.ok) return auth.res
  const p = q.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!p.success) return NextResponse.json({ erro: 'Informe a data do import.' }, { status: 400 })
  return NextResponse.json({ revisao: await montarRevisao(companyId, p.data.data, p.data.relatorio, prisma) })
}

const body = q.extend({ confirmar: z.boolean().default(false), confirmouSanidade: z.boolean().default(false) })

/**
 * O plano do dia já na forma que o `PlanoVendaModal` desenha — os dois relatórios.
 *
 * ⚠️ **fail-soft**: dia sem import devolve `null` e a tela diz isso; o modal não pode
 * derrubar o caminho de confirmar por causa de um resumo.
 */
async function planoDoDia(companyId: string, data: string, relatorio: 'PRODUTOS' | 'COMPLEMENTOS') {
  try {
    if (relatorio === 'COMPLEMENTOS') {
      const p = await montarPlanoComplementos(companyId, data, prisma)
      return {
        produtos: p.complementos.map((c) => ({ nome: c.nomeSuitable, quantidade: c.ocorrencias, alvoNome: c.alvo })),
        pendentes: p.pendentes.map((c) => ({ nome: c.nomeSuitable, quantidade: c.ocorrencias })),
        // ⚠️ "fora" aqui são os IGNORADOS — decisão do dono, nomeada e não escondida
        fora: p.ignorados.map((c) => ({ nome: c.nomeSuitable, quantidade: c.ocorrencias })),
        agregada: p.agregada.map((a) => ({ nome: a.nome, qtd: a.qtd, valor: a.valor })),
      }
    }
    const r = await montarPlanoReprocesso(companyId, data, prisma)
    if (!r) return null
    return {
      produtos: r.plano.produtos.map((x) => ({ nome: x.nome, quantidade: x.quantidade, alvoNome: x.alvoNome })),
      pendentes: r.plano.pendentes,
      fora: [...r.plano.fora, ...r.plano.ignorados],
      agregada: r.plano.agregada.map((a) => ({ nome: a.nome, qtd: a.qtd, valor: a.valor })),
      sanidade: r.plano.sanidade,
    }
  } catch { return null }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const auth = await requireStock(request, companyId, 'stock.manage')
  if (!auth.ok) return auth.res
  const p = body.safeParse(await request.json().catch(() => null))
  if (!p.success) return NextResponse.json({ erro: 'Informe a data do import.' }, { status: 400 })
  const { data, relatorio, confirmar, confirmouSanidade } = p.data

  const preview = await previewDoAjuste(companyId, data, relatorio, prisma)
  // ⛔⛔ NADA BAIXA SEM O PREVIEW: mudança de vínculo é escrita em estoque, e a régua da
  // casa é preview → confirmo → rastro. A rota devolve o preview e PARA.
  if (!confirmar) {
    /**
     * ⭐⭐⭐ O PLANO NA FORMA DO MODAL ÚNICO (14/09) — o que faltava pro botão do dia.
     *
     * **O dono, navegando:** *"clico 'Confirmar e baixar' → NADA acontece: nenhum modal de
     * prévia, nenhum recibo. Eu continuo sem saber o que vai baixar."* ⛔ E era PIOR que
     * nada: **o clique GRAVAVA** (medido no ledger, 19:33:17) e a tela não dizia.
     *
     * ⚠️ Sai do MESMO motor que a baixa executa (`montarPlano*`) — um cálculo "só pro
     * modal" faria a tela prometer um número e o ledger gravar outro.
     */
    const plano = await planoDoDia(companyId, data, relatorio)
    return NextResponse.json({ ok: true, preview, plano })
  }

  try {
    const recibo = relatorio === 'COMPLEMENTOS'
      ? await processarComplementos(companyId, data, auth.userId, prisma)
      : await reprocessarDia(companyId, data, auth.userId, prisma, confirmouSanidade)
    return NextResponse.json({ ok: true, preview, recibo })
  } catch (e) {
    // ⚠️ a recusa da sanidade tem mensagem própria e ENSINA a saída — nunca um 500 mudo
    return NextResponse.json({ erro: (e as Error).message }, { status: 422 })
  }
}
