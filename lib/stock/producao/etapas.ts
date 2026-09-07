// ⭐⭐ ETAPAS DA PRODUÇÃO — DUAS MÃOS, DOIS TEMPOS, DOIS NOMES (06/09/2026).
//
// **O FATO DA COZINHA, do dono:** a maioria das produções tem duas etapas com funcionários
// DIFERENTES. No beef, um pega acém/peito/gordura e faz o GESSADO na máquina; **outro** faz
// as bolinhas e molda. Até aqui a ordem tinha UM `colaboradorId` no cabeçalho — ou seja, o
// sistema só sabia registrar a segunda mão, e o mês fechava sem saber de quem foi o quê.
//
// ⭐ AS ETAPAS MORAM NA **VERSÃO** DA RECEITA, junto dos componentes e pelo mesmo motivo:
// mudar a lista de etapas é mudar o MÉTODO. Se morassem na ficha, renomear uma etapa hoje
// reescreveria o que aconteceu na cozinha em agosto.
//
// ⛔⛔ E RECEITA SEM ETAPA CONTINUA FUNCIONANDO — resolvido na LEITURA, nunca por backfill.
// Criar uma linha "produção" pras ~30 receitas existentes seria gravar 30 vezes a mesma
// informação que a AUSÊNCIA já dá, e ainda transformaria uma decisão ("esta receita não
// precisa de etapas") num dado que alguém pode editar por engano.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { type MotivoDoEncerramento } from './encerrar-etapas-abertas'
import { resolverEstadoDasEtapas } from './gestos-do-gerente'
import { temTempoMedido, rotuloDoEstado, type EstadoDaEtapa } from './estado-da-etapa'

type Db = PrismaClient | Prisma.TransactionClient

export class EtapaError extends Error {}

/** o nome da etapa única de quem não declarou etapa nenhuma */
export const ETAPA_UNICA = 'produção'

/** ⚠️ teto de sanidade: receita com 20 etapas é lista de tarefas, não método de preparo */
export const MAX_ETAPAS = 12

export interface EtapaDaReceita {
  posicao: number
  nome: string
  setorId: string | null
}

/**
 * ⭐⭐ A RÉGUA ÚNICA — PURA. `[]` vira a etapa única; o resto passa como está.
 *
 * Toda leitura (a ordem, a janela do funcionário, o relatório) chama ISTO. Se cada uma
 * tratasse a ausência do seu jeito, uma delas mostraria "nenhuma etapa" e outra mostraria
 * "produção" pro mesmo lote — a doença dos 7 detectores de par, em escala menor.
 */
export function resolverEtapas(declaradas: EtapaDaReceita[]): EtapaDaReceita[] {
  if (declaradas.length) return [...declaradas].sort((a, b) => a.posicao - b.posicao)
  return [{ posicao: 0, nome: ETAPA_UNICA, setorId: null }]
}

/** normaliza o que a tela mandou: apara, descarta vazio, recusa duplicata e excesso */
export function normalizarEtapas(nomes: { nome: string; setorId?: string | null }[]): EtapaDaReceita[] {
  const limpos = nomes
    .map((e, i) => ({ posicao: i, nome: e.nome.trim(), setorId: e.setorId ?? null }))
    .filter((e) => e.nome.length > 0)
    .map((e, i) => ({ ...e, posicao: i }))
  if (limpos.length > MAX_ETAPAS) throw new EtapaError(`No máximo ${MAX_ETAPAS} etapas por receita.`)
  // ⚠️ duas etapas com o mesmo nome tornariam o relatório por TIPO de tarefa ambíguo —
  // "moldar beefs: média 47min" deixaria de responder sobre o quê.
  const vistos = new Set<string>()
  for (const e of limpos) {
    const chave = e.nome.toLowerCase()
    if (vistos.has(chave)) throw new EtapaError(`A etapa “${e.nome}” está repetida. Cada etapa tem um nome só.`)
    vistos.add(chave)
  }
  return limpos
}

/** as etapas DECLARADAS de uma versão (sem resolver a ausência — quem resolve é quem lê) */
export async function etapasDaVersao(companyId: string, versaoId: string, db: Db = defaultPrisma): Promise<EtapaDaReceita[]> {
  const rows = await db.stockFichaEtapa.findMany({
    where: { companyId, versaoId }, orderBy: { posicao: 'asc' },
    select: { posicao: true, nome: true, setorId: true },
  })
  return rows
}

/** grava as etapas de uma versão RECÉM-CRIADA (versão é imutável: nunca reescreve as de uma antiga) */
export async function gravarEtapasDaVersao(
  companyId: string, versaoId: string, etapas: EtapaDaReceita[], db: Db,
): Promise<void> {
  if (!etapas.length) return
  await db.stockFichaEtapa.createMany({
    data: etapas.map((e) => ({ companyId, versaoId, posicao: e.posicao, nome: e.nome, setorId: e.setorId })),
  })
}

/**
 * ⭐ MATERIALIZA as etapas na ORDEM, no momento em que ela nasce.
 *
 * ⚠️ Copia o NOME (snapshot), não uma referência: a receita pode ganhar versão nova amanhã e
 * a ordem de hoje tem que continuar dizendo o que foi feito. É o mesmo desenho do
 * `versaoFicha` que a ordem já guarda.
 */
export async function materializarEtapasDaOrdem(
  companyId: string, ordemId: string, versaoId: string | null, db: Db,
): Promise<number> {
  const declaradas = versaoId ? await etapasDaVersao(companyId, versaoId, db) : []
  const etapas = resolverEtapas(declaradas)
  await db.stockOrdemEtapa.createMany({
    data: etapas.map((e) => ({ companyId, ordemId, posicao: e.posicao, nome: e.nome, setorId: e.setorId })),
  })
  return etapas.length
}

// ── a execução ───────────────────────────────────────────────────────────────────────

// ⭐⭐ OS CINCO ESTADOS moram em `estado-da-etapa.ts` — UMA derivação pra TODAS as telas
// (07/09). Antes existiam duas (esta e a do "HOJE ao vivo", inline), e foi por isso que "na
// fila" sobreviveu numa ordem já concluída. É a lição do B1 aplicada à etapa.
export type { EstadoDaEtapa } from './estado-da-etapa'

export interface EtapaDaOrdem {
  id: string
  posicao: number
  nome: string
  colaboradorId: string | null
  colaboradorNome: string | null
  executorId: string | null
  executorNome: string | null
  iniciadoEm: string | null
  finalizadoEm: string | null
  estado: EstadoDaEtapa
  /** minutos: MEDIDOS só em FEITA; em EM_ANDAMENTO é o cronômetro correndo; nos outros três
   *  é `null` = "a apurar", porque ali não há tempo que alguém tenha medido. */
  minutos: number | null
  /** ⛔ por que a ordem levou a etapa junto — `null` quando não foi encerrada assim */
  encerradaPor: MotivoDoEncerramento | null
  /** ⭐ o rastro do gesto do gerente: "finalizada por X em nome de Y" */
  finalizadaPorNome: string | null
  emNomeDeNome: string | null
  /** ⭐ o gerente já pediu pra ela finalizar — o recado está no tablet dela */
  pedidoEmAberto: boolean
  /** ⭐ o rótulo pronto: a MESMA frase nas três telas (fonte única) */
  rotulo: string
}

/**
 * minutos da etapa. PURA — `agora` é parâmetro (o relógio nunca decide num teste).
 *
 * ⛔⛔ SÓ **FEITA** TEM TEMPO MEDIDO. Em EM_ANDAMENTO o número é o cronômetro correndo (a
 * tela mostra, ninguém grava); nos outros três é `null`. Contar `agora − iniciadoEm` numa
 * etapa encerrada daria um tempo que só cresce com o relógio sobre trabalho que já acabou, e
 * carimbar um fim inventaria um horário que ninguém mediu.
 */
export function minutosDaEtapa(
  e: { iniciadoEm: Date | null; finalizadoEm: Date | null }, agora: Date, estado: EstadoDaEtapa = 'FEITA',
): number | null {
  if (!e.iniciadoEm) return null
  if (estado === 'EM_ANDAMENTO') return Math.max(0, Math.round((agora.getTime() - e.iniciadoEm.getTime()) / 60000))
  if (!temTempoMedido(estado) || !e.finalizadoEm) return null
  return Math.max(0, Math.round((e.finalizadoEm.getTime() - e.iniciadoEm.getTime()) / 60000))
}

/**
 * ⚠️ O ALARME DE TAREFA ABERTA — 4h (decisão do dono, 06/09).
 *
 * Mais apertado que as 24h do P2 (ordem parada) **de propósito**: ordem parada é trabalho
 * que não andou; tarefa aberta **corrompe a média de min/kg**, porque o tempo continua
 * correndo depois que a pessoa foi embora. E ela **nunca fecha sozinha** — fechar seria
 * inventar um horário que ninguém mediu.
 */
export const HORAS_ATE_ALARME = 4

export async function etapasDaOrdem(
  companyId: string, ordemId: string, agora: Date = new Date(), db: Db = defaultPrisma,
): Promise<EtapaDaOrdem[]> {
  const rows = await db.stockOrdemEtapa.findMany({ where: { companyId, ordemId }, orderBy: { posicao: 'asc' } })
  const ids = [...new Set(rows.flatMap((r) => [r.colaboradorId, r.executorId]).filter((x): x is string => !!x))]
  const colabs = ids.length
    ? await db.stockColaborador.findMany({ where: { companyId, id: { in: ids } }, select: { id: true, nome: true } })
    : []
  const nome = new Map(colabs.map((c) => [c.id, c.nome]))
  // ⭐⭐ FONTE ÚNICA: o estado sai do MESMO resolvedor que o "HOJE ao vivo" e o relatório usam
  const resolvidas = await resolverEstadoDasEtapas(companyId, rows, db)
  return rows.map((r) => {
    const res = resolvidas.get(r.id)!
    return {
      id: r.id, posicao: r.posicao, nome: r.nome,
      colaboradorId: r.colaboradorId, colaboradorNome: r.colaboradorId ? nome.get(r.colaboradorId) ?? null : null,
      executorId: r.executorId, executorNome: r.executorId ? nome.get(r.executorId) ?? null : null,
      iniciadoEm: r.iniciadoEm?.toISOString() ?? null,
      finalizadoEm: r.finalizadoEm?.toISOString() ?? null,
      estado: res.estado,
      minutos: minutosDaEtapa(r, agora, res.estado),
      encerradaPor: res.encerradaPor,
      finalizadaPorNome: res.finalizadaPorNome,
      emNomeDeNome: res.emNomeDeNome ?? (r.executorId ? nome.get(r.executorId) ?? null : null),
      pedidoEmAberto: res.pedidoEmAberto,
      rotulo: rotuloDoEstado(res.estado, {
        iniciou: !!r.iniciadoEm, ordemCancelada: res.ordemCancelada,
        gerente: res.finalizadaPorNome,
        pessoa: res.emNomeDeNome ?? (r.executorId ? nome.get(r.executorId) ?? null : null),
      }),
    }
  })
}

/** a GERÊNCIA designa (ou tira) o colaborador de uma etapa. Designar é reversível e não trava nada. */
export async function designarEtapa(
  input: { companyId: string; etapaId: string; colaboradorId: string | null; userId?: string },
  db: PrismaClient = defaultPrisma,
): Promise<void> {
  const etapa = await db.stockOrdemEtapa.findFirst({ where: { id: input.etapaId, companyId: input.companyId } })
  if (!etapa) throw new EtapaError('Etapa não encontrada.')
  // ⛔ REGRA 8: colaborador resolvido por ID **dentro da empresa** — nunca por nome, e nunca
  // aceitando um id que veio da tela sem conferir de quem ele é.
  if (input.colaboradorId) {
    const c = await db.stockColaborador.findFirst({ where: { id: input.colaboradorId, companyId: input.companyId, ativo: true } })
    if (!c) throw new EtapaError('Esse colaborador não existe nesta empresa (ou está inativo).')
  }
  // ⚠️ trocar quem VAI fazer é normal; trocar quem JÁ fez seria reescrever o passado — o
  // `executorId` (quem apertou o botão) não se toca por aqui.
  await db.stockOrdemEtapa.update({
    where: { id: etapa.id },
    data: {
      colaboradorId: input.colaboradorId,
      designadoPorId: input.userId ?? null,
      designadoEm: input.colaboradorId ? new Date() : null,
    },
  })
}
