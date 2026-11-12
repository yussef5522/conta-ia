// A ação de `finalizar` na janela da cozinha. O PIN volta em toda ação: o servidor resolve
// QUEM é, nunca aceita um `colaboradorId` da tela (senão o PIN não protegeria nada).
//
// ⭐⭐ E NA ÚLTIMA ETAPA ELA CONCLUI A ORDEM (06/09): o "quantos saíram?" é perguntado ALI,
// por quem sabe o número — sem digitação dupla na tela de Produção. ⛔ Pelo MESMO motor
// (`concluir`), nunca por uma segunda conclusão (REGRA 4).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { quemEstaComOPin } from '@/lib/stock/producao/pin'
import { minhasTarefasDeHoje, TarefaError } from '@/lib/stock/producao/minhas-tarefas'
import { finalizarEConcluirDoTablet, avaliarGrandezaDaConclusao } from '@/lib/stock/producao/concluir-do-tablet'
import { respostaDeErroDoEstoque } from '@/lib/stock/erro-da-tela'
import { OrdemError } from '@/lib/stock/producao/ordens'

interface Params { params: Promise<{ id: string }> }
const schema = z.object({
  pin: z.string().regex(/^\d{4}$/),
  etapaId: z.string().min(1),
  /** ⭐ só na ÚLTIMA etapa: o número que conclui a ordem */
  qtdGerada: z.number().positive().optional(),
  parcial: z.boolean().optional(),
  /** ⭐ a cozinha olhou o aviso de grandeza e disse que é isso mesmo */
  confirmouGrandeza: z.boolean().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId } = await params
  const a = await guardStock(request, companyId, ['stock.executar', 'stock.operate'])
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'PIN não confere.' }, { status: 401 })
  const quem = await quemEstaComOPin(companyId, parsed.data.pin, prisma)
  if (!quem) return NextResponse.json({ erro: 'PIN não confere.' }, { status: 401 })

  // ⚠️ a ordem é lida ANTES de finalizar: depois a etapa pode não dizer mais o que precisamos
  const etapa = await prisma.stockOrdemEtapa.findFirst({
    where: { id: parsed.data.etapaId, companyId }, select: { ordemId: true },
  })
  // ⛔ (12/11, lei v7 M2) TAREFA: FINALIZAR em um toque — nunca grandeza, nunca lote
  const ehTarefa = etapa ? (await prisma.stockTarefa.count({ where: { id: etapa.ordemId, companyId } })) > 0 : false
  if (ehTarefa && parsed.data.qtdGerada != null) return NextResponse.json({ erro: 'Tarefa não fecha lote — é só apertar FINALIZAR.' }, { status: 409 })

  /**
   * ⛔⛔ A PERGUNTA DA GRANDEZA VEM ANTES DE FINALIZAR A ETAPA (19/09).
   *
   * A etapa fecha ANTES da conclusão; se a recusa viesse depois, a cozinha digitaria
   * 22864, levaria o aviso e ficaria **com a tarefa fechada e sem como repetir** — estado
   * pela metade no meio do turno. Aqui nada foi escrito ainda.
   */
  if (parsed.data.qtdGerada != null && etapa && !parsed.data.confirmouGrandeza) {
    const v = await avaliarGrandezaDaConclusao(companyId, etapa.ordemId, parsed.data.qtdGerada, prisma)
    if (v.decisao !== 'OK') {
      return NextResponse.json({
        erro: v.mensagem, code: v.decisao === 'RECUSA' ? 'GRANDEZA' : 'GRANDEZA_AVISO',
        grandeza: { qtdProvavel: v.qtdProvavel, fator: v.fator },
      }, { status: 409 })
    }
  }

  // ⭐⭐ (12/11) UM ATO SÓ: etapa + conclusão na MESMA transação. Recusou = NADA gravou, e a
  // funcionária vê o MOTIVO e pode tentar de novo (antes: etapa fechada, ordem aberta, 2º clique
  // "já foi finalizada" — o escritório virava o único jeito de fechar).
  let concluida: { qtdGerada: number; custoUnitarioReal: number | null } | null = null
  try {
    const r = await finalizarEConcluirDoTablet({
      companyId, etapaId: parsed.data.etapaId, colaboradorId: quem.colaboradorId,
      qtdGerada: etapa ? parsed.data.qtdGerada : undefined, parcial: parsed.data.parcial, confirmouGrandeza: parsed.data.confirmouGrandeza,
    }, prisma)
    concluida = r.concluida
  } catch (e) {
    if (e instanceof TarefaError || e instanceof OrdemError) return NextResponse.json({ erro: e.message }, { status: 409 })
    // ⭐ a trava do estoque, a grandeza… a recusa com FRASE, nunca 500 sem corpo
    const resp = respostaDeErroDoEstoque(e, { empresaId: companyId })
    if (resp) return NextResponse.json({ ...resp, erro: `${resp.erro} Nada foi gravado — dá pra tentar de novo.` }, { status: resp.status === 422 ? 409 : resp.status })
    console.error('[minhas-tarefas/finalizar] falhou:', (e as Error)?.name)
    return NextResponse.json({ erro: 'Não consegui finalizar agora. Nada foi gravado — tente de novo; se repetir, chame o encarregado.' }, { status: 500 })
  }
  return NextResponse.json({
    colaborador: { id: quem.colaboradorId, nome: quem.nome },
    tarefas: await minhasTarefasDeHoje(companyId, quem.colaboradorId, new Date(), prisma),
    // ⭐ o instante do servidor — o cronômetro do tablet não confia no relógio do aparelho
    agoraServidor: new Date().toISOString(),
    concluida,
  })
}
