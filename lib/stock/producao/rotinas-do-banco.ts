// ⭐⭐ ROTINAS NO BANCO (lei docs/rotinas-referencia.html, R25–R31, 13/11/2026).
//
// A rotina é a FÁBRICA (R31): ela não executa nada — ela SEMEIA tarefas normais (`criarTarefa`, a
// porta única do nascimento de tarefa) e guarda o vínculo tarefa ↔ rotina+dia. Daí em diante a
// tarefa é a MESMA de sempre: Janela, Painel, Ao vivo, Desempenho. Sem R$/un/%/conferência (M7.e).
//
// ⭐ R25 — SEMEADURA IDEMPOTENTE NO BANCO: o índice único (rotinaId, dia) de `stock_tarefa_rotina`
// é quem garante "rodar duas vezes não duplica". A conta em memória (`semear`) é a régua da lei; o
// índice é a trava (dois disparos simultâneos: o segundo bate no P2002 e a transação inteira volta,
// tarefa incluída).
// ⭐ R27 — o dia seguinte nasce limpo: tarefa de rotina NUNCA migra (`tarefasVivasAte` corta).
// ⭐ R26 — grupo: o tique grava quem (o PIN da sessão) e quando; o último tique conclui a etapa.

import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { diaEmSaoPaulo, janelaDoDiaSP, horaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'
import { criarTarefa, MAX_NOME_TAREFA, MAX_INSTRUCAO } from './tarefa'
import { naTransacao, type DbOuTx } from './transacao'
import {
  semeiaHoje, semear, proxima, atrasada, regraValida, rotuloRegra, min,
  destinoExclusaoRotina, textoExcluirRotina, type RegraRotina,
} from './rotinas'

type Db = PrismaClient | Prisma.TransactionClient

export class RotinaError extends Error {}

export const MAX_ITENS_ROTINA = 30
export const MAX_TEXTO_ITEM = MAX_INSTRUCAO

const limpa = (s: string) => s.trim().replace(/\s+/g, ' ')
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const minutosAgora = (agora: Date) => min(horaEmSaoPaulo(agora))

export interface DadosDaRotina {
  nome: string
  regra: RegraRotina
  /** 'HH:MM' ou null */
  ate: string | null
  /** id da pessoa ou 'LIVRE' */
  quem: string
  itens: string[]
}

/** valida e normaliza o que veio da tela; lança RotinaError com a frase pro dono */
async function normalizar(companyId: string, d: DadosDaRotina, db: Db) {
  const nome = limpa(d.nome).toUpperCase()
  if (!nome) throw new RotinaError('Dê um nome à rotina.')
  if (nome.length > MAX_NOME_TAREFA) throw new RotinaError(`O nome passa de ${MAX_NOME_TAREFA} letras.`)
  const regra = regraValida(d.regra)
  if (!regra) throw new RotinaError('Escolha quando a rotina repete.')
  let limiteMin: number | null = null
  if (d.ate != null && d.ate !== '') {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.ate)) throw new RotinaError('Hora limite no formato HH:MM.')
    limiteMin = min(d.ate)
  }
  const itens = d.itens.map(limpa).filter(Boolean)
  if (!itens.length) throw new RotinaError('A rotina precisa de pelo menos 1 item.')
  if (itens.length > MAX_ITENS_ROTINA) throw new RotinaError(`No máximo ${MAX_ITENS_ROTINA} itens.`)
  const longo = itens.find((i) => i.length > MAX_TEXTO_ITEM)
  if (longo) throw new RotinaError(`O item "${longo.slice(0, 20)}…" passa de ${MAX_TEXTO_ITEM} letras.`)
  let colaboradorId: string | null = null
  if (d.quem !== 'LIVRE') {
    // ⛔ REGRA 8: pessoa por ID dentro da empresa, ativa
    const c = await db.stockColaborador.findFirst({ where: { id: d.quem, companyId, ativo: true }, select: { id: true } })
    if (!c) throw new RotinaError('Essa pessoa não existe nesta empresa (ou está inativa).')
    colaboradorId = c.id
  }
  return { nome, regra, limiteMin, colaboradorId, itens }
}

export async function criarRotina(
  input: DadosDaRotina & { companyId: string; userId: string; agora?: Date }, db: PrismaClient = defaultPrisma,
): Promise<{ rotinaId: string; semeadasHoje: number }> {
  const n = await normalizar(input.companyId, input, db)
  const r = await db.stockRotina.create({
    data: {
      companyId: input.companyId, nome: n.nome, regra: JSON.stringify(n.regra), limiteMin: n.limiteMin,
      colaboradorId: n.colaboradorId, criadoPorId: input.userId,
      itens: { create: n.itens.map((texto, posicao) => ({ posicao, texto })) },
    },
    select: { id: true },
  })
  // a rotina que cai hoje já cai agora (a leitura do dia semearia de qualquer jeito)
  const s = await semearRotinasDoDia(input.companyId, diaEmSaoPaulo(input.agora ?? new Date()), db)
  return { rotinaId: r.id, semeadasHoje: s.criadas }
}

async function rotinaViva(companyId: string, rotinaId: string, db: Db) {
  const r = await db.stockRotina.findFirst({ where: { id: rotinaId, companyId, excluidaEm: null } })
  if (!r) throw new RotinaError('Rotina não encontrada.')
  return r
}

/** EDITAR — muda a regra pra frente. ⛔ A tarefa já semeada (hoje inclusive) fica como nasceu. */
export async function editarRotina(
  input: DadosDaRotina & { companyId: string; rotinaId: string; userId: string; agora?: Date }, db: PrismaClient = defaultPrisma,
): Promise<{ semeadasHoje: number }> {
  await rotinaViva(input.companyId, input.rotinaId, db)
  const n = await normalizar(input.companyId, input, db)
  await db.$transaction([
    db.stockRotinaItem.deleteMany({ where: { rotinaId: input.rotinaId } }),
    db.stockRotina.update({
      where: { id: input.rotinaId },
      data: {
        nome: n.nome, regra: JSON.stringify(n.regra), limiteMin: n.limiteMin, colaboradorId: n.colaboradorId, atualizadoEm: new Date(),
        itens: { create: n.itens.map((texto, posicao) => ({ posicao, texto })) },
      },
    }),
  ])
  const s = await semearRotinasDoDia(input.companyId, diaEmSaoPaulo(input.agora ?? new Date()), db)
  return { semeadasHoje: s.criadas }
}

/** R29 — pausar para de semear; retomar volta (e semeia hoje se a regra cai hoje) */
export async function pausarRotina(
  input: { companyId: string; rotinaId: string; userId: string; pausar: boolean; agora?: Date }, db: PrismaClient = defaultPrisma,
): Promise<void> {
  const r = await rotinaViva(input.companyId, input.rotinaId, db)
  if (input.pausar === !!r.pausadaEm) return
  await db.stockRotina.update({
    where: { id: r.id },
    data: input.pausar ? { pausadaEm: new Date(), pausadaPorId: input.userId } : { pausadaEm: null, pausadaPorId: null },
  })
  if (!input.pausar) await semearRotinasDoDia(input.companyId, diaEmSaoPaulo(input.agora ?? new Date()), db)
}

export interface PreviaExclusaoRotina { semeadas: number; feitas: number; destino: 'apagar' | 'arquivar'; frase: string }

async function contarHistoria(companyId: string, rotinaId: string, db: Db): Promise<{ semeadas: number; feitas: number }> {
  const vs = await db.stockTarefaRotina.findMany({ where: { companyId, rotinaId }, select: { tarefaId: true } })
  if (!vs.length) return { semeadas: 0, feitas: 0 }
  const feitas = await db.stockOrdemEtapa.count({ where: { companyId, ordemId: { in: vs.map((v) => v.tarefaId) }, finalizadoEm: { not: null } } })
  return { semeadas: vs.length, feitas }
}

export async function previaExclusaoRotina(companyId: string, rotinaId: string, db: Db = defaultPrisma): Promise<PreviaExclusaoRotina> {
  const r = await rotinaViva(companyId, rotinaId, db)
  const h = await contarHistoria(companyId, rotinaId, db)
  return { ...h, destino: destinoExclusaoRotina(h.semeadas), frase: textoExcluirRotina(r.nome, h.semeadas, h.feitas) }
}

/** R29 — nunca semeou → apaga DE VEZ; com história → some das telas, as tarefas ficam intactas */
export async function excluirRotina(
  input: { companyId: string; rotinaId: string; userId: string }, db: PrismaClient = defaultPrisma,
): Promise<PreviaExclusaoRotina> {
  const p = await previaExclusaoRotina(input.companyId, input.rotinaId, db)
  if (p.destino === 'apagar') {
    // ⚠️ o FK RESTRICT do vínculo recusa no banco se uma semeadura correu no meio — nunca apaga história
    await db.stockRotina.delete({ where: { id: input.rotinaId } })
  } else {
    await db.stockRotina.update({ where: { id: input.rotinaId }, data: { excluidaEm: new Date(), excluidaPorId: input.userId } })
  }
  return p
}

// ─────────────────────────────────────────────────────────────────────────────
// R25 — A SEMEADURA (porta única)
// ─────────────────────────────────────────────────────────────────────────────

const ehUnicoViolado = (e: unknown) => (e as { code?: string })?.code === 'P2002'

/**
 * ⭐⭐ SEMEIA o dia `diaISO` (dia de Brasília) desta empresa: cria só as tarefas que ainda não
 * existem. Pausada e excluída não semeiam. Rodar 2× = 0 criadas na 2ª.
 */
export async function semearRotinasDoDia(
  companyId: string, diaISO: string, db: PrismaClient = defaultPrisma,
): Promise<{ criadas: number; jaExistiam: number; falhas: { rotinaId: string; motivo: string }[] }> {
  const dia = janelaDoDiaSP(diaISO, diaISO).de
  const rotinas = await db.stockRotina.findMany({
    where: { companyId, excluidaEm: null, pausadaEm: null },
    include: { itens: { orderBy: { posicao: 'asc' } } },
    orderBy: { criadoEm: 'asc' },
  })
  const doDia = rotinas.filter((r) => { const g = regraValida(safeJson(r.regra)); return g ? semeiaHoje(g, diaISO) : false })
  if (!doDia.length) return { criadas: 0, jaExistiam: 0, falhas: [] }
  const ja = await db.stockTarefaRotina.findMany({ where: { companyId, dia, rotinaId: { in: doDia.map((r) => r.id) } }, select: { rotinaId: true } })
  const faltam = semear(doDia.map((r) => r.id), ja.map((v) => v.rotinaId))
  let criadas = 0
  const falhas: { rotinaId: string; motivo: string }[] = []
  for (const id of faltam) {
    const r = doDia.find((x) => x.id === id)!
    if (!r.itens.length) { falhas.push({ rotinaId: id, motivo: 'sem itens' }); continue }
    try {
      await db.$transaction(async (tx) => {
        const umItem = r.itens.length === 1
        const instr = umItem && r.itens[0].texto.toUpperCase() !== r.nome ? r.itens[0].texto : null
        const { tarefaId } = await criarTarefa(
          { companyId, nome: r.nome, instrucao: instr, quem: r.colaboradorId ?? 'EQUIPE', dia: diaISO },
          tx,
        )
        await tx.stockTarefaRotina.create({ data: { companyId, tarefaId, rotinaId: r.id, dia, limiteMin: r.limiteMin } })
        if (!umItem) {
          await tx.stockTarefaItem.createMany({
            data: r.itens.map((i) => ({ companyId, tarefaId, posicao: i.posicao, texto: i.texto.toUpperCase() })),
          })
        }
      }, { timeout: 30_000, maxWait: 10_000 })
      criadas++
    } catch (e) {
      // ⭐ outro disparo semeou no meio: o índice único recusou e a transação voltou inteira
      if (ehUnicoViolado(e)) continue
      falhas.push({ rotinaId: id, motivo: e instanceof Error ? e.message.slice(0, 120) : 'erro' })
    }
  }
  return { criadas, jaExistiam: ja.length, falhas }
}

function safeJson(s: string): unknown { try { return JSON.parse(s) } catch { return null } }

/** ⭐ o disparo da LEITURA (R25): se o agendador da meia-noite falhou, a primeira leitura do dia semeia */
export async function garantirSemeaduraDeHoje(companyId: string, agora: Date = new Date(), db: PrismaClient = defaultPrisma): Promise<void> {
  try { await semearRotinasDoDia(companyId, diaEmSaoPaulo(agora), db) } catch { /* ⚠️ leitura nunca cai por causa da semeadura */ }
}

/** ⭐ o disparo do AGENDADOR (virar do dia): todas as empresas com rotina viva */
export async function semearHojeEmTodas(agora: Date = new Date(), db: PrismaClient = defaultPrisma): Promise<{ empresas: number; criadas: number }> {
  const dia = diaEmSaoPaulo(agora)
  const cs = await db.stockRotina.findMany({ where: { excluidaEm: null, pausadaEm: null }, select: { companyId: true }, distinct: ['companyId'] })
  let criadas = 0
  for (const c of cs) {
    try { criadas += (await semearRotinasDoDia(c.companyId, dia, db)).criadas } catch { /* uma empresa não derruba as outras */ }
  }
  return { empresas: cs.length, criadas }
}

// ─────────────────────────────────────────────────────────────────────────────
// O QUE AS TELAS LEEM
// ─────────────────────────────────────────────────────────────────────────────

export interface ItemDoGrupo { id: string; texto: string; feito: boolean; quem: string | null; hora: string | null }
export interface RotinaDaTarefa {
  rotinaId: string
  dia: string
  limite: string | null
  limiteMin: number | null
  /** itens do grupo (vazio = rotina de 1 item → cartão normal) */
  itens: ItemDoGrupo[]
}

/** ⭐ porta única: quais destas tarefas vieram de rotina, com limite e itens. Sem linha = avulsa. */
export async function rotinasDasTarefas(companyId: string, tarefaIds: readonly string[], db: Db = defaultPrisma): Promise<Map<string, RotinaDaTarefa>> {
  if (!tarefaIds.length) return new Map()
  const ids = [...new Set(tarefaIds)]
  const [vs, its] = await Promise.all([
    db.stockTarefaRotina.findMany({ where: { companyId, tarefaId: { in: ids } } }),
    db.stockTarefaItem.findMany({ where: { companyId, tarefaId: { in: ids } }, orderBy: { posicao: 'asc' } }),
  ])
  const quemIds = [...new Set(its.map((i) => i.feitoPorId).filter((x): x is string => !!x))]
  const pessoas = quemIds.length ? await db.stockColaborador.findMany({ where: { companyId, id: { in: quemIds } }, select: { id: true, nome: true } }) : []
  const nome = new Map(pessoas.map((p) => [p.id, p.nome]))
  const out = new Map<string, RotinaDaTarefa>()
  for (const v of vs) {
    out.set(v.tarefaId, {
      rotinaId: v.rotinaId, dia: diaEmSaoPaulo(v.dia), limiteMin: v.limiteMin, limite: v.limiteMin == null ? null : hhmm(v.limiteMin),
      itens: its.filter((i) => i.tarefaId === v.tarefaId).map((i) => ({
        id: i.id, texto: i.texto, feito: !!i.feitoEm,
        quem: i.feitoPorId ? nome.get(i.feitoPorId) ?? '—' : null, hora: i.feitoEm ? horaEmSaoPaulo(i.feitoEm) : null,
      })),
    })
  }
  return out
}

/** ⭐ R27 — a tarefa de rotina está atrasada AGORA? (só no dia dela; ontem é "não feita", nunca atraso herdado) */
export function rotinaAtrasada(r: RotinaDaTarefa, feita: boolean, agora: Date): boolean {
  if (r.dia !== diaEmSaoPaulo(agora)) return false
  const total = r.itens.length || 1
  const feitas = r.itens.length ? r.itens.filter((i) => i.feito).length : feita ? 1 : 0
  return atrasada(minutosAgora(agora), r.limiteMin, feita ? total : feitas, total)
}

export interface RotinaDaLista {
  id: string
  nome: string
  itens: string[]
  regra: RegraRotina
  repete: string
  ate: string | null
  colaboradorId: string | null
  quem: string
  pausada: boolean
  /** null = não cai hoje (ou pausada) */
  hoje: { feitas: number; total: number; fim: string | null; atrasada: boolean; cancelada: boolean } | null
  proxima: string | null
  /** a pessoa fixa saiu da equipe: a rotina não consegue semear */
  pessoaInativa: boolean
}

/** ⭐ R30 — a lista com a coluna HOJE viva */
export async function listarRotinas(companyId: string, agora: Date = new Date(), db: Db = defaultPrisma): Promise<RotinaDaLista[]> {
  const hoje = diaEmSaoPaulo(agora)
  const rs = await db.stockRotina.findMany({
    where: { companyId, excluidaEm: null }, include: { itens: { orderBy: { posicao: 'asc' } } }, orderBy: { criadoEm: 'asc' },
  })
  if (!rs.length) return []
  const diaDe = janelaDoDiaSP(hoje, hoje).de
  const vs = await db.stockTarefaRotina.findMany({ where: { companyId, dia: diaDe, rotinaId: { in: rs.map((r) => r.id) } } })
  const tIds = vs.map((v) => v.tarefaId)
  const [etapas, tarefas, rot, pessoas] = await Promise.all([
    db.stockOrdemEtapa.findMany({ where: { companyId, ordemId: { in: tIds } }, select: { ordemId: true, finalizadoEm: true } }),
    db.stockTarefa.findMany({ where: { companyId, id: { in: tIds } }, select: { id: true, canceladaEm: true } }),
    rotinasDasTarefas(companyId, tIds, db),
    db.stockColaborador.findMany({ where: { companyId, id: { in: rs.map((r) => r.colaboradorId).filter((x): x is string => !!x) } }, select: { id: true, nome: true, ativo: true } }),
  ])
  const fin = new Map(etapas.map((e) => [e.ordemId, e.finalizadoEm]))
  const canc = new Map(tarefas.map((t) => [t.id, !!t.canceladaEm]))
  const pessoa = new Map(pessoas.map((p) => [p.id, p]))
  return rs.map((r) => {
    const regra = regraValida(safeJson(r.regra)) ?? { tipo: 'diaria' as const }
    const v = vs.find((x) => x.rotinaId === r.id)
    let h: RotinaDaLista['hoje'] = null
    if (v) {
      const rt = rot.get(v.tarefaId)
      const f = fin.get(v.tarefaId) ?? null
      const total = rt?.itens.length || 1
      const feitas = f ? total : rt?.itens.length ? rt.itens.filter((i) => i.feito).length : 0
      h = {
        feitas, total, fim: f ? horaEmSaoPaulo(f) : null, cancelada: canc.get(v.tarefaId) ?? false,
        atrasada: !canc.get(v.tarefaId) && atrasada(minutosAgora(agora), v.limiteMin, feitas, total),
      }
    }
    const p = r.colaboradorId ? pessoa.get(r.colaboradorId) : null
    return {
      id: r.id, nome: r.nome, itens: r.itens.map((i) => i.texto), regra, repete: rotuloRegra(regra),
      ate: r.limiteMin == null ? null : hhmm(r.limiteMin), colaboradorId: r.colaboradorId,
      quem: r.colaboradorId ? p?.nome ?? '—' : 'livre', pausada: !!r.pausadaEm,
      hoje: r.pausadaEm && !v ? null : h,
      proxima: proxima(regra, hoje), pessoaInativa: !!r.colaboradorId && !p?.ativo,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// R26 — O TIQUE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐⭐ TICAR um item do grupo. `colaboradorId` vem SÓ do PIN da sessão (a rota resolve o PIN —
 * o tablet nunca manda id). Designada (R28) → só ela tica; livre → quem chegar.
 * ⭐ O ÚLTIMO TIQUE CONCLUI: a etapa ganha início = 1º tique, fim = agora, executor = quem fechou.
 * ⛔ Item não ticado nunca some; grupo nunca conclui com item aberto.
 */
export async function ticarItem(
  input: { companyId: string; colaboradorId: string; etapaId: string; itemId: string; agora?: Date }, db: DbOuTx = defaultPrisma,
): Promise<{ concluiu: boolean; progresso: string }> {
  if (!input.colaboradorId) throw new RotinaError('Digite o PIN pra ticar.')
  const agora = input.agora ?? new Date()
  return naTransacao(db, async (tx) => {
    const e = await tx.stockOrdemEtapa.findFirst({ where: { id: input.etapaId, companyId: input.companyId } })
    if (!e) throw new RotinaError('Tarefa não encontrada.')
    // ⭐ trava a linha da tarefa: dois tablets no último par de itens não deixam o grupo sem concluir
    await tx.$executeRaw`UPDATE "stock_tarefa" SET "nome" = "nome" WHERE "id" = ${e.ordemId}`
    const t = await tx.stockTarefa.findFirst({ where: { id: e.ordemId, companyId: input.companyId }, include: { rotina: true } })
    if (!t || !t.rotina) throw new RotinaError('Isso não é um grupo de rotina.')
    if (t.canceladaEm) throw new RotinaError('O escritório cancelou essa tarefa.')
    if (diaEmSaoPaulo(t.rotina.dia) !== diaEmSaoPaulo(agora)) throw new RotinaError('Essa rotina era de outro dia — hoje nasce limpa.')
    if (e.finalizadoEm) throw new RotinaError('Esse grupo já foi concluído.')
    // R28 — designada: só ela tica. Livre: a etapa está liberada pra equipe.
    if (e.colaboradorId && e.colaboradorId !== input.colaboradorId) throw new RotinaError('Essa rotina é de outra pessoa.')
    if (!e.colaboradorId) {
      const pl = await tx.stockEtapaPlano.findFirst({ where: { companyId: input.companyId, etapaId: e.id }, select: { liberadaParaEquipe: true } })
      if (!pl?.liberadaParaEquipe) throw new RotinaError('Essa rotina não está liberada pra equipe.')
    }
    const it = await tx.stockTarefaItem.findFirst({ where: { id: input.itemId, tarefaId: t.id, companyId: input.companyId } })
    if (!it) throw new RotinaError('Item não encontrado nesse grupo.')
    if (!it.feitoEm) {
      await tx.stockTarefaItem.update({ where: { id: it.id }, data: { feitoEm: agora, feitoPorId: input.colaboradorId } })
    }
    const itens = await tx.stockTarefaItem.findMany({ where: { tarefaId: t.id }, select: { feitoEm: true } })
    const feitas = itens.filter((i) => i.feitoEm).length
    const concluiu = itens.length > 0 && feitas === itens.length
    if (concluiu) {
      const primeiro = itens.reduce((m, i) => (i.feitoEm! < m ? i.feitoEm! : m), agora)
      await tx.stockOrdemEtapa.update({
        where: { id: e.id }, data: { iniciadoEm: primeiro, finalizadoEm: agora, executorId: input.colaboradorId },
      })
    }
    return { concluiu, progresso: `${feitas}/${itens.length}` }
  })
}

/** ⛔ o grupo NÃO se inicia/finaliza pelos botões de etapa — só pelos tiques (R26) */
export async function ehGrupoDeRotina(companyId: string, etapaId: string, db: Db = defaultPrisma): Promise<boolean> {
  const e = await db.stockOrdemEtapa.findFirst({ where: { id: etapaId, companyId }, select: { ordemId: true } })
  if (!e) return false
  return (await db.stockTarefaItem.count({ where: { companyId, tarefaId: e.ordemId } })) > 0
}
