// ⭐⭐ TAREFA — TIPO PRÓPRIO (lei v7 M2, docs/producao-referencia.html, 12/11/2026).
//
// "ABRIR LATAS DE ERVILHA · 5 LATAS": trabalho de cozinha que NÃO produz estoque. Até 12/11 a
// equipe fingia isso com receitas de 0,0001 KG (ABRIR MILHO, ABRIR ERVILHA, ENCHER TUBO
// KETCHUP) — e a gambiarra derrubou o tablet (D2 do raio-X: consumo arredondado a zero → 409).
//
// ⛔⛔ TAREFA NUNCA TEM CAMINHO DE LOTE/ESTOQUE: sem ficha, sem separação, sem "quantos
// saíram", sem movimento. Este arquivo não importa NADA de estoque (guard estrutural em
// `__tests__/tarefa-tipo-proprio.integration.test.ts`).
//
// ⭐ A EXECUÇÃO É A MESMA DA PRODUÇÃO (porta única): uma linha de `stock_ordem_etapa` com
// `ordemId = tarefa.id`, posição 0. INICIAR/FINALIZAR/devolver/dupla/recado/uma-por-pessoa são
// as funções de sempre (`minhas-tarefas.ts`, `participantes.ts`, `gestos-do-gerente.ts`) — G3,
// G6, G7, G8, G12 valem sem uma linha copiada.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { diaEmSaoPaulo, janelaDoDiaSP } from '@/lib/datas/dia-sao-paulo'
import { designarParticipantes } from './participantes'
import { definirPlanoDaEtapa } from './plano-etapas'
import { resolverEstadoDasEtapas } from './gestos-do-gerente'
import { naTransacao, type DbOuTx } from './transacao'
import type { EstadoDaEtapa } from './estado-da-etapa'
import { minutosDaEtapa } from './etapas'

type Db = PrismaClient | Prisma.TransactionClient

export class TarefaTipoError extends Error {}

export const MAX_NOME_TAREFA = 80
export const MAX_INSTRUCAO = 60

/** ⭐ o que distingue as duas coisas que a cozinha executa. Lei v7: `TIPOS={PRODUCAO:{fechaLote:true},TAREFA:{fechaLote:false}}` */
export type TipoDoTrabalho = 'PRODUCAO' | 'TAREFA'
export const TIPOS: Record<TipoDoTrabalho, { fechaLote: boolean }> = {
  PRODUCAO: { fechaLote: true },
  TAREFA: { fechaLote: false },
}

export interface NovaTarefa {
  companyId: string
  nome: string
  instrucao?: string | null
  /** pessoa da cozinha (id) — ou `'EQUIPE'` = "liberada pra equipe" (G6: escolha explícita) */
  quem: string
  /** `YYYY-MM-DD` (dia de São Paulo) */
  dia: string
  userId?: string
}

/**
 * CRIAR. Cabeçalho + a etapa única + a designação/liberação — num ato só.
 *
 * ⛔ "quem faz" é OBRIGATÓRIO: sem nome e sem "liberada" a tarefa seria rascunho invisível
 * (G6) — e tarefa criada pra ninguém ver é tarefa que ninguém faz.
 */
export async function criarTarefa(input: NovaTarefa, db: DbOuTx = defaultPrisma): Promise<{ tarefaId: string; etapaId: string }> {
  const nome = input.nome.trim().replace(/\s+/g, ' ').toUpperCase()
  const instrucao = (input.instrucao ?? '').trim().replace(/\s+/g, ' ').toUpperCase() || null
  if (!nome) throw new TarefaTipoError('Diga o que fazer.')
  if (nome.length > MAX_NOME_TAREFA) throw new TarefaTipoError(`O nome passa de ${MAX_NOME_TAREFA} letras.`)
  if (instrucao && instrucao.length > MAX_INSTRUCAO) throw new TarefaTipoError(`A instrução passa de ${MAX_INSTRUCAO} letras.`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dia)) throw new TarefaTipoError('Informe o dia.')
  if (!input.quem) throw new TarefaTipoError('Escolha quem faz — ou libere pra equipe.')

  return naTransacao(db, async (tx) => {
    const t = tx as unknown as PrismaClient
    let colaboradorId: string | null = null
    if (input.quem !== 'EQUIPE') {
      // ⛔ REGRA 8: pessoa resolvida por ID dentro da empresa, ativa
      const c = await tx.stockColaborador.findFirst({ where: { id: input.quem, companyId: input.companyId, ativo: true }, select: { id: true } })
      if (!c) throw new TarefaTipoError('Essa pessoa não existe nesta empresa (ou está inativa).')
      colaboradorId = c.id
    }
    const dia = janelaDoDiaSP(input.dia, input.dia).de
    const tarefa = await tx.stockTarefa.create({
      data: { companyId: input.companyId, nome, instrucao, dia, criadoPorId: input.userId ?? null },
      select: { id: true },
    })
    const agora = new Date()
    const etapa = await tx.stockOrdemEtapa.create({
      data: {
        companyId: input.companyId, ordemId: tarefa.id, posicao: 0, nome,
        colaboradorId, designadoPorId: colaboradorId ? input.userId ?? null : null, designadoEm: colaboradorId ? agora : null,
      },
      select: { id: true },
    })
    if (colaboradorId) {
      await designarParticipantes({ companyId: input.companyId, etapaId: etapa.id, colaboradorIds: [colaboradorId], userId: input.userId }, t)
    } else {
      await definirPlanoDaEtapa({ companyId: input.companyId, etapaId: etapa.id, liberadaParaEquipe: true, userId: input.userId }, t)
    }
    return { tarefaId: tarefa.id, etapaId: etapa.id }
  })
}

/**
 * CANCELAR — pelo escritório, como nas ordens. ⛔ Nunca apaga: o cabeçalho ganha autor e
 * instante; a etapa que estava rodando vira "encerrada sem finalizar" pelo MESMO resolvedor
 * das ordens (`resolverEstadoDasEtapas`), o que solta a pessoa pra pegar outra (G7).
 */
export async function cancelarTarefa(
  input: { companyId: string; tarefaId: string; userId: string }, db: Db = defaultPrisma,
): Promise<void> {
  const t = await db.stockTarefa.findFirst({ where: { id: input.tarefaId, companyId: input.companyId }, select: { id: true, canceladaEm: true } })
  if (!t) throw new TarefaTipoError('Tarefa não encontrada.')
  if (t.canceladaEm) throw new TarefaTipoError('Essa tarefa já foi cancelada.')
  const e = await db.stockOrdemEtapa.findFirst({ where: { companyId: input.companyId, ordemId: t.id }, select: { finalizadoEm: true } })
  if (e?.finalizadoEm) throw new TarefaTipoError('Tarefa feita não se cancela.')
  await db.stockTarefa.update({ where: { id: t.id }, data: { canceladaEm: new Date(), canceladaPorId: input.userId } })
}

/** ⭐ quais destes `ordemId` de etapa são TAREFAS (e o cabeçalho de cada). Uma consulta, N leitores. */
export async function tarefasDosIds(
  companyId: string, ids: readonly string[], db: Db = defaultPrisma,
): Promise<Map<string, { id: string; nome: string; instrucao: string | null; dia: Date; canceladaEm: Date | null }>> {
  if (!ids.length) return new Map()
  const ts = await db.stockTarefa.findMany({
    where: { companyId, id: { in: [...new Set(ids)] } },
    select: { id: true, nome: true, instrucao: true, dia: true, canceladaEm: true },
  })
  return new Map(ts.map((t) => [t.id, t]))
}

/** ⭐ as tarefas vivas que a JANELA DA COZINHA considera hoje: não canceladas, do dia de hoje ou de antes (prazo vencido continua à vista até alguém fazer ou o escritório cancelar). */
export async function tarefasVivasAte(
  companyId: string, agora: Date, db: Db = defaultPrisma,
): Promise<{ id: string; nome: string; instrucao: string | null; dia: Date }[]> {
  const hoje = diaEmSaoPaulo(agora)
  const fim = janelaDoDiaSP(hoje, hoje).ate
  return db.stockTarefa.findMany({
    where: { companyId, canceladaEm: null, dia: { lte: fim } },
    select: { id: true, nome: true, instrucao: true, dia: true },
    orderBy: { criadoEm: 'asc' },
  })
}

export interface TarefaDoEscritorio {
  tarefaId: string
  etapaId: string | null
  nome: string
  instrucao: string | null
  dia: string
  quem: string[]
  liberada: boolean
  estado: EstadoDaEtapa | 'CANCELADA'
  iniciadoEm: string | null
  /** ⭐ (lei v9 M7.e) o painel mostra quem · hora · DURAÇÃO da tarefa feita — nunca R$/un nem % */
  finalizadoEm: string | null
  /** minutos medidos (`minutosDaEtapa`, o dono único): só FEITA tem; correndo é o cronômetro; resto `null` */
  minutos: number | null
}

/**
 * ⭐ o que o escritório vê: as VIVAS (sempre, como as ordens abertas) + as encerradas no PERÍODO
 * (`de..ate`, dia de Brasília; sem período = hoje), com quem e estado.
 * ⚠️ (lei v9) o painel segue o filtro hoje/semana/mês nas Concluídas — a tarefa obedece igual ao lote.
 */
export async function tarefasDoEscritorio(
  companyId: string, agora: Date = new Date(), db: Db = defaultPrisma,
  periodo?: { de: string; ate: string },
): Promise<TarefaDoEscritorio[]> {
  const hoje = diaEmSaoPaulo(agora)
  const de = periodo?.de ?? hoje
  const ate = periodo?.ate ?? hoje
  const janela = janelaDoDiaSP(de, ate)
  const ts = await db.stockTarefa.findMany({
    where: { companyId, OR: [{ canceladaEm: null, dia: { lte: janelaDoDiaSP(hoje, hoje).ate } }, { dia: { gte: janela.de, lte: janela.ate } }] },
    select: { id: true, nome: true, instrucao: true, dia: true, canceladaEm: true },
    orderBy: { criadoEm: 'asc' },
  })
  if (!ts.length) return []
  const etapas = await db.stockOrdemEtapa.findMany({ where: { companyId, ordemId: { in: ts.map((t) => t.id) } } })
  const etapaDe = new Map(etapas.map((e) => [e.ordemId, e]))
  const [res, parts, planos, pessoas] = await Promise.all([
    resolverEstadoDasEtapas(companyId, etapas, db),
    db.stockOrdemEtapaParticipante.findMany({ where: { companyId, etapaId: { in: etapas.map((e) => e.id) } }, select: { etapaId: true, colaboradorId: true } }),
    db.stockEtapaPlano.findMany({ where: { companyId, etapaId: { in: etapas.map((e) => e.id) } }, select: { etapaId: true, liberadaParaEquipe: true } }),
    db.stockColaborador.findMany({ where: { companyId }, select: { id: true, nome: true } }),
  ])
  const nome = new Map(pessoas.map((p) => [p.id, p.nome]))
  const lib = new Map(planos.map((p) => [p.etapaId, p.liberadaParaEquipe]))
  const out: TarefaDoEscritorio[] = []
  for (const t of ts) {
    const e = etapaDe.get(t.id) ?? null
    const estado = t.canceladaEm ? 'CANCELADA' as const : e ? res.get(e.id)!.estado : 'AGUARDANDO' as const
    // ⚠️ encerrada fora do período não é "do período": só as vivas e as do período aparecem
    const noPeriodo = (d: Date) => { const x = diaEmSaoPaulo(d); return x >= de && x <= ate }
    if (estado !== 'AGUARDANDO' && estado !== 'EM_ANDAMENTO' && !(e?.finalizadoEm ? noPeriodo(e.finalizadoEm) : noPeriodo(t.dia))) continue
    const ids = [...new Set([...parts.filter((p) => p.etapaId === e?.id).map((p) => p.colaboradorId), ...(e?.executorId ? [e.executorId] : []), ...(e?.colaboradorId ? [e.colaboradorId] : [])])]
    out.push({
      tarefaId: t.id, etapaId: e?.id ?? null, nome: t.nome, instrucao: t.instrucao, dia: diaEmSaoPaulo(t.dia),
      quem: ids.map((i) => nome.get(i)).filter((x): x is string => !!x),
      liberada: e ? lib.get(e.id) ?? false : false,
      estado, iniciadoEm: e?.iniciadoEm?.toISOString() ?? null,
      finalizadoEm: e?.finalizadoEm?.toISOString() ?? null,
      minutos: e && estado !== 'CANCELADA' ? minutosDaEtapa(e, agora, estado) : null,
    })
  }
  return out
}

/** ⭐ os nomes já usados (pra o escritório não redigitar "ABRIR MILHO" todo dia). */
export async function nomesDeTarefasUsados(companyId: string, db: Db = defaultPrisma): Promise<string[]> {
  const ts = await db.stockTarefa.findMany({ where: { companyId }, select: { nome: true }, orderBy: { criadoEm: 'desc' }, take: 300 })
  return [...new Set(ts.map((t) => t.nome))].slice(0, 40)
}

/**
 * ⭐⭐ APOSENTAR A RECEITA QUE ERA TAREFA DISFARÇADA (lei v7 M2).
 *
 * ⛔⛔ DESATIVA, NUNCA APAGA: as ordens antigas (40 de ABRIR MILHO…) são história e apontam pra
 * ela. Por isso NÃO passa por `excluirFicha` — aquele gesto APAGA quando não há lote, e aqui
 * nada pode ser apagado em caso nenhum.
 * ⚠️ Idempotente: já inativa = não mexe e diz.
 */
export async function aposentarReceitaQueEraTarefa(
  companyId: string, fichaId: string, db: Db = defaultPrisma,
): Promise<{ fichaId: string; nome: string; jaEstava: boolean }> {
  const f = await db.stockFicha.findFirst({ where: { id: fichaId, companyId }, select: { id: true, ativo: true, itemProduzidoId: true } })
  if (!f) throw new TarefaTipoError('Receita não encontrada nesta empresa.')
  const it = await db.stockItem.findFirst({ where: { id: f.itemProduzidoId, companyId }, select: { nome: true } })
  if (!f.ativo) return { fichaId, nome: it?.nome ?? '', jaEstava: true }
  await db.stockFicha.update({ where: { id: f.id }, data: { ativo: false } })
  return { fichaId, nome: it?.nome ?? '', jaEstava: false }
}
