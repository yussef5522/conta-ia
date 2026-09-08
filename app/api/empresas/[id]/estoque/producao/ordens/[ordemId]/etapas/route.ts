// ETAPAS DA ORDEM — a gerência designa quem faz cada uma (06/09/2026).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { guardStock } from '@/lib/stock/require-stock'
import { etapasDaOrdem, designarEtapa, EtapaError } from '@/lib/stock/producao/etapas'
import { pedirPraFinalizar, finalizarPeloGerente, GestoError } from '@/lib/stock/producao/gestos-do-gerente'
import { concluirDoTablet } from '@/lib/stock/producao/concluir-do-tablet'
import { designarParticipantes } from '@/lib/stock/producao/participantes'
import { DuplaError } from '@/lib/stock/producao/dupla-na-etapa'

interface Params { params: Promise<{ id: string; ordemId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  const a = await guardStock(request, companyId, 'stock.view')
  if (a.erro) return a.erro
  return NextResponse.json({ etapas: await etapasDaOrdem(companyId, ordemId, new Date(), prisma) })
}

const schema = z.object({
  etapaId: z.string().min(1),
  // ⚠️ null = tirar a designação (a etapa volta a ser "quem pegar com o PIN")
  colaboradorId: z.string().min(1).nullable().optional(),
  /**
   * ⭐⭐ A DUPLA (08/09): a lista FINAL de quem faz a etapa — 0, 1 ou 2 pessoas.
   *
   * ⛔ O teto de 2 é validado na GRAVAÇÃO (`designarParticipantes` → `validarEntrada`),
   * nunca aqui no schema: schema é contrato de forma, e a regra do negócio tem que valer
   * pra quem chamar a rota de qualquer jeito.
   */
  colaboradorIds: z.array(z.string().min(1)).max(5).optional(),
})

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  // ⭐ designar é OPERAR, não gerenciar: é o encarregado montando o dia, não mexendo em ficha
  const a = await guardStock(request, companyId, 'stock.operate')
  if (a.erro) return a.erro
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  try {
    if (parsed.data.colaboradorIds) {
      // ⭐ caminho da DUPLA: a lista manda, e o primeiro continua sendo o `colaboradorId` da
      // etapa — é dele que a régua de sequência e os relatórios antigos leem.
      await designarParticipantes({
        companyId, etapaId: parsed.data.etapaId,
        colaboradorIds: parsed.data.colaboradorIds, userId: a.user.sub,
      }, prisma)
      await designarEtapa({
        companyId, etapaId: parsed.data.etapaId,
        colaboradorId: parsed.data.colaboradorIds[0] ?? null, userId: a.user.sub,
      }, prisma)
    } else {
      await designarEtapa({ companyId, etapaId: parsed.data.etapaId, colaboradorId: parsed.data.colaboradorId ?? null, userId: a.user.sub }, prisma)
    }
  } catch (e) {
    if (e instanceof EtapaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    // ⚠️ a mensagem do teto vai INTEIRA pra tela ("tire alguém antes de colocar outra"):
    // ela ENSINA a saída, e um 422 genérico mandaria adivinhar.
    if (e instanceof DuplaError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
  return NextResponse.json({ etapas: await etapasDaOrdem(companyId, ordemId, new Date(), prisma) })
}

// ⭐⭐ OS DOIS GESTOS DO GERENTE PRA ETAPA ABERTA (07/09/2026).
//
// **A ordem do dono:** *"gerente NUNCA fica preso olhando uma etapa aberta sem poder agir."*
//
// ⛔ AQUI É `stock.manage`, e a diferença pro PATCH acima é de PAPEL: designar é o encarregado
// montando o dia (operar); **fechar a tarefa de outra pessoa** é decisão de gestão — mexe no
// rastro de quem trabalhou, e é a mesma fronteira do relatório comparativo.
const gestoSchema = z.object({
  etapaId: z.string().min(1),
  acao: z.enum(['pedir-finalizar', 'finalizar-pelo-gerente']),
  observacao: z.string().max(300).nullable().optional(),
  /**
   * ⭐⭐ CONCLUIR NO MESMO GESTO (08/09/2026) — decisão do dono, pro HOJE ao vivo.
   *
   * *"Se a tarefa finalizada pelo gerente é a ÚLTIMA etapa da ordem, o gesto pergunta ALI
   * MESMO 'quantos saíram?' e conclui pelo MESMO concluir() — consumo, custo, sobra, motor
   * único. Um fluxo, na tela onde estou."*
   *
   * ⛔ `qtdGerada` só é aceita junto de `finalizar-pelo-gerente`, e a conclusão passa por
   * `concluirDoTablet` — o MESMO caminho do tablet. Nada de um segundo motor de conclusão.
   */
  qtdGerada: z.number().positive().optional(),
  parcial: z.boolean().optional(),
})

export async function POST(request: NextRequest, { params }: Params) {
  const { id: companyId, ordemId } = await params
  const a = await guardStock(request, companyId, 'stock.manage')
  if (a.erro) return a.erro
  const parsed = gestoSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ erro: 'Dados inválidos.' }, { status: 400 })
  try {
    if (parsed.data.acao === 'pedir-finalizar') {
      await pedirPraFinalizar({ companyId, etapaId: parsed.data.etapaId, userId: a.user.sub }, prisma)
    } else {
      await finalizarPeloGerente({ companyId, etapaId: parsed.data.etapaId, userId: a.user.sub, observacao: parsed.data.observacao }, prisma)
      // ⭐ era a ÚLTIMA etapa e o gerente disse quanto saiu → conclui pelo MESMO motor
      if (parsed.data.qtdGerada != null) {
        await concluirDoTablet({
          companyId, ordemId, qtdGerada: parsed.data.qtdGerada,
          colaboradorId: null, parcial: parsed.data.parcial ?? false,
        }, prisma)
      }
    }
  } catch (e) {
    if (e instanceof GestoError) return NextResponse.json({ erro: e.message }, { status: 422 })
    throw e
  }
  return NextResponse.json({ etapas: await etapasDaOrdem(companyId, ordemId, new Date(), prisma) })
}
