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
import { finalizarTarefa, minhasTarefasDeHoje, TarefaError } from '@/lib/stock/producao/minhas-tarefas'
import { concluirDoTablet } from '@/lib/stock/producao/concluir-do-tablet'
import { OrdemError } from '@/lib/stock/producao/ordens'

interface Params { params: Promise<{ id: string }> }
const schema = z.object({
  pin: z.string().regex(/^\d{4}$/),
  etapaId: z.string().min(1),
  /** ⭐ só na ÚLTIMA etapa: o número que conclui a ordem */
  qtdGerada: z.number().positive().optional(),
  parcial: z.boolean().optional(),
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

  let concluida: { qtdGerada: number; custoUnitarioReal: number | null } | null = null
  try {
    await finalizarTarefa({ companyId, etapaId: parsed.data.etapaId, colaboradorId: quem.colaboradorId }, prisma)
    // ⭐ o número só chega quando a tela sabe que é a última etapa — e mesmo assim o
    // servidor confere que não sobrou etapa aberta antes de concluir.
    if (parsed.data.qtdGerada && etapa) {
      const aberta = await prisma.stockOrdemEtapa.count({ where: { companyId, ordemId: etapa.ordemId, finalizadoEm: null } })
      if (aberta > 0) {
        return NextResponse.json({ erro: `Ainda faltam ${aberta} etapa(s) nesta ordem — não dá pra fechar o lote agora.` }, { status: 409 })
      }
      const r = await concluirDoTablet({
        companyId, ordemId: etapa.ordemId, qtdGerada: parsed.data.qtdGerada,
        colaboradorId: quem.colaboradorId, parcial: parsed.data.parcial,
      }, prisma)
      concluida = { qtdGerada: r.qtdGerada, custoUnitarioReal: r.custoUnitarioReal }
    }
  } catch (e) {
    // ⚠️ a mensagem vai INTEIRA pra tela: "outra pessoa já está nessa tarefa" ensina o que
    // fazer; "erro ao finalizar" manda perguntar pro encarregado.
    if (e instanceof TarefaError || e instanceof OrdemError) return NextResponse.json({ erro: e.message }, { status: 409 })
    throw e
  }

  return NextResponse.json({
    colaborador: { id: quem.colaboradorId, nome: quem.nome },
    tarefas: await minhasTarefasDeHoje(companyId, quem.colaboradorId, new Date(), prisma),
    // ⭐ o instante do servidor — o cronômetro do tablet não confia no relógio do aparelho
    agoraServidor: new Date().toISOString(),
    concluida,
  })
}
