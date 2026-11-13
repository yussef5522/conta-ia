// ⛔⛔ A ETAPA QUE A ORDEM LEVOU JUNTO (06/09/2026) — a fresta entre os DOIS caminhos.
//
// **CASO REAL:** etapa iniciada com o PIN da Carlise às 16:38; a ordem foi concluída pela
// **tela de Produção** (o caminho do encarregado, que ajusta o consumo e não passa pelo
// tablet). A etapa ficou **aberta há 7h05 e sem NENHUM gesto que a resolvesse** — o tablet
// recusa (ordem encerrada) e a Produção não tinha botão. E o "HOJE ao vivo" a contava no
// AGORA: *"Carlise · fazendo há 7h05"*, o retrato do presente mentindo por causa de uma ordem
// que já acabou.
//
// ⛔ **NÃO É "FINALIZAR POR ELA".** Carimbar um `finalizadoEm` inventaria um horário que
// ninguém mediu, e esse tempo entraria na média de min/un **como fato**. É a mesma regra que
// já vale no alarme de 4h (*"ela nunca fecha sozinha — fechar seria inventar um horário"*).
// O que se registra é outra coisa: **a ordem encerrou e levou a etapa junto**.
//
// ⚠️ Por isso o estado tem NOME PRÓPRIO (`ENCERRADA_SEM_FINALIZAR`) em vez de virar "feita":
// quem lê a tela precisa saber que ali não há tempo medido. "Feita" e "encerrada sem
// finalizar" são fatos diferentes, e colapsar os dois esconderia justamente o que interessa.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

export type MotivoDoEncerramento = 'ORDEM_CONCLUIDA' | 'ORDEM_CANCELADA'

export interface EtapaAberta {
  etapaId: string
  nome: string
  posicao: number
  /** quem apertou INICIAR (o PIN) — pode ser null em etapa iniciada sem executor */
  executorId: string | null
  executorNome: string | null
  iniciadoEm: Date
}

/**
 * ⭐ AS ETAPAS ABERTAS DE UMA ORDEM — a matéria-prima do AVISO e do encerramento.
 *
 * "Aberta" = alguém iniciou e ninguém finalizou. ⚠️ Etapa que nunca começou **não** entra:
 * não há nada pendurado nela, e avisar sobre ela viraria ruído em toda ordem parcial.
 */
export async function etapasAbertasDaOrdem(
  companyId: string, ordemId: string, db: Db = defaultPrisma,
): Promise<EtapaAberta[]> {
  const rows = await db.stockOrdemEtapa.findMany({
    where: { companyId, ordemId, iniciadoEm: { not: null }, finalizadoEm: null },
    orderBy: { posicao: 'asc' },
  })
  if (!rows.length) return []
  // ⚠️ e a que JÁ foi encerrada não conta de novo — senão a mesma etapa apareceria no aviso
  // de uma conclusão parcial e outra vez na final.
  const jaEncerradas = new Set(
    (await db.stockEtapaEncerrada.findMany({
      where: { companyId, etapaId: { in: rows.map((r) => r.id) } }, select: { etapaId: true },
    })).map((x) => x.etapaId),
  )
  const abertas = rows.filter((r) => !jaEncerradas.has(r.id))
  if (!abertas.length) return []
  const ids = [...new Set(abertas.map((r) => r.executorId).filter((x): x is string => !!x))]
  const colabs = ids.length
    ? await db.stockColaborador.findMany({ where: { companyId, id: { in: ids } }, select: { id: true, nome: true } })
    : []
  const nome = new Map(colabs.map((c) => [c.id, c.nome]))
  return abertas.map((r) => ({
    etapaId: r.id, nome: r.nome, posicao: r.posicao,
    executorId: r.executorId,
    executorNome: r.executorId ? nome.get(r.executorId) ?? null : null,
    iniciadoEm: r.iniciadoEm!,
  }))
}

/**
 * ⭐⭐ REGISTRA que a ordem levou as etapas abertas junto. Devolve quantas encerrou.
 *
 * ⚠️ Roda DENTRO da transação de quem encerra a ordem (`concluir`/`cancelarOrdem`): se
 * ficasse do lado de fora, uma falha no meio deixaria a ordem CONCLUÍDA com a etapa órfã —
 * exatamente o estado que este arquivo existe pra eliminar.
 *
 * ⛔ **Não toca em `finalizadoEm` nem em `executorId`.** A etapa continua sem tempo medido, e
 * é isso que a mantém fora das médias.
 */
export async function encerrarEtapasAbertas(
  input: { companyId: string; ordemId: string; motivo: MotivoDoEncerramento; userId?: string | null },
  db: Db = defaultPrisma,
): Promise<number> {
  const abertas = await etapasAbertasDaOrdem(input.companyId, input.ordemId, db)
  if (!abertas.length) return 0
  for (const a of abertas) {
    await db.stockEtapaEncerrada.create({
      data: {
        companyId: input.companyId, etapaId: a.etapaId, ordemId: input.ordemId,
        motivo: input.motivo, encerradaPorId: input.userId ?? null,
      },
    })
  }
  return abertas.length
}

/** ⭐ quais destas etapas foram encerradas pela ordem — o que as telas consultam */
export async function encerramentosDasEtapas(
  companyId: string, etapaIds: string[], db: Db = defaultPrisma,
): Promise<Map<string, { motivo: MotivoDoEncerramento; encerradaEm: Date }>> {
  if (!etapaIds.length) return new Map()
  const rows = await db.stockEtapaEncerrada.findMany({
    where: { companyId, etapaId: { in: etapaIds } },
    select: { etapaId: true, motivo: true, encerradaEm: true },
  })
  return new Map(rows.map((r) => [r.etapaId, { motivo: r.motivo as MotivoDoEncerramento, encerradaEm: r.encerradaEm }]))
}

// ⚠️ a FRASE do aviso mora em `aviso-etapas-abertas.ts` (pura, sem Prisma) — a tela de
// conclusão é client component e importar daqui arrastaria o Prisma pro bundle. Re-exportada
// pra quem já está no servidor não precisar saber disso.
export { avisoDeEtapasAbertas, type EtapaAbertaResumo } from './aviso-etapas-abertas'
