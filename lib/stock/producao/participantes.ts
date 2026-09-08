// ⭐⭐ A CAMADA DE BANCO DA DUPLA (08/09/2026) — as regras puras moram em `dupla-na-etapa.ts`.
//
// ⛔⛔ A ETAPA CONTINUA CARREGANDO `executorId/iniciadoEm/finalizadoEm`, e isso NÃO é dívida:
// é o que faz a regra de SEQUÊNCIA e todo o relatório antigo continuarem valendo sem uma
// linha de mudança. `etapa.finalizadoEm` passa a ser carimbado **quando o último participante
// finaliza** — que é exatamente a decisão 2 do dono ("a etapa 2 libera com a 1 FEITA"),
// obtida sem tocar na régua de sequência. Uma regra só, igual à de hoje.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { validarEntrada, etapaEstaFeita, type Participante } from './dupla-na-etapa'

type Db = PrismaClient | Prisma.TransactionClient

/** os participantes de uma etapa, na forma que as regras puras esperam */
export async function participantesDaEtapa(
  etapaId: string, db: Db = defaultPrisma,
): Promise<(Participante & { designadoEm: Date | null })[]> {
  const ps = await db.stockOrdemEtapaParticipante.findMany({
    where: { etapaId },
    select: { colaboradorId: true, iniciadoEm: true, finalizadoEm: true, designadoEm: true },
    orderBy: { criadoEm: 'asc' },
  })
  return ps
}

/**
 * ⭐ DESIGNAR — até 2, com o teto travado AQUI (na gravação), não na tela.
 *
 * ⚠️ Substitui a designação inteira: a tela manda a lista final, e quem saiu **perde a
 * designação mas nunca o relógio** — se a pessoa já tinha iniciado, a linha dela fica.
 * Apagar o relógio de quem trabalhou seria perder tempo medido de verdade.
 */
export async function designarParticipantes(
  input: { companyId: string; etapaId: string; colaboradorIds: readonly string[]; userId?: string },
  db: Db = defaultPrisma,
): Promise<void> {
  const atuais = await participantesDaEtapa(input.etapaId, db)
  const ids = [...new Set(input.colaboradorIds.filter(Boolean))]

  // ⛔ o teto vale sobre a lista FINAL — pedir 3 é recusado antes de qualquer escrita
  if (ids.length > 2) validarEntrada([{ colaboradorId: 'x', iniciadoEm: null, finalizadoEm: null }, { colaboradorId: 'y', iniciadoEm: null, finalizadoEm: null }], 'z')

  const agora = new Date()
  for (const colaboradorId of ids) {
    await db.stockOrdemEtapaParticipante.upsert({
      where: { etapaId_colaboradorId: { etapaId: input.etapaId, colaboradorId } },
      create: {
        companyId: input.companyId, etapaId: input.etapaId, colaboradorId,
        designadoPorId: input.userId ?? null, designadoEm: agora,
      },
      // ⚠️ redesignar quem já está NÃO mexe no relógio dele
      update: { designadoPorId: input.userId ?? null, designadoEm: agora },
    })
  }
  // quem saiu do plano E não tinha começado some; quem começou fica, com o relógio dele
  const sair = atuais.filter((a) => !ids.includes(a.colaboradorId) && a.iniciadoEm == null)
  if (sair.length) {
    await db.stockOrdemEtapaParticipante.deleteMany({
      where: { etapaId: input.etapaId, colaboradorId: { in: sair.map((s) => s.colaboradorId) }, iniciadoEm: null },
    })
  }
}

/**
 * ⭐ O TOQUE NO INICIAR, do lado do participante.
 *
 * ⛔ O teto de 2 vale aqui também: uma terceira pessoa **não entra** nem pegando a tarefa
 * solta pelo PIN. A tela não é a trava — a gravação é.
 */
export async function registrarInicio(
  input: { companyId: string; etapaId: string; colaboradorId: string; agora: Date },
  db: Db = defaultPrisma,
): Promise<void> {
  const atuais = await participantesDaEtapa(input.etapaId, db)
  validarEntrada(atuais, input.colaboradorId)
  await db.stockOrdemEtapaParticipante.upsert({
    where: { etapaId_colaboradorId: { etapaId: input.etapaId, colaboradorId: input.colaboradorId } },
    create: {
      companyId: input.companyId, etapaId: input.etapaId, colaboradorId: input.colaboradorId,
      iniciadoEm: input.agora,
    },
    update: { iniciadoEm: input.agora },
  })
}

/**
 * ⭐⭐ O TOQUE NO FINALIZAR — e é aqui que a decisão 2 acontece.
 *
 * Devolve `etapaFechou: true` quando **todos que iniciaram** finalizaram; é esse sinal que
 * manda o caller carimbar `etapa.finalizadoEm` e, com ele, liberar a etapa seguinte.
 */
export async function registrarFim(
  input: { companyId: string; etapaId: string; colaboradorId: string; agora: Date },
  db: Db = defaultPrisma,
): Promise<{ etapaFechou: boolean }> {
  await db.stockOrdemEtapaParticipante.updateMany({
    where: { etapaId: input.etapaId, colaboradorId: input.colaboradorId },
    data: { finalizadoEm: input.agora },
  })
  const depois = await participantesDaEtapa(input.etapaId, db)
  // ⚠️ etapa SEM linha de participante nenhuma é o caminho antigo (uma pessoa só, pré-08/09):
  // aí quem fecha é o próprio toque, como sempre foi.
  return { etapaFechou: depois.length === 0 ? true : etapaEstaFeita(depois) }
}

/** ⚠️ desfaz o toque (devolver "não é meu turno") — sem gravar tempo nenhum */
export async function desfazerInicio(
  etapaId: string, colaboradorId: string, db: Db = defaultPrisma,
): Promise<void> {
  await db.stockOrdemEtapaParticipante.updateMany({
    where: { etapaId, colaboradorId }, data: { iniciadoEm: null, finalizadoEm: null },
  })
}
