// ⭐⭐ EQUIPE — conta e PIN, nada mais (leis R20–R23 de docs/producao-equipe-referencia.html, 13/11/2026).
//
// R20: criar conta, papel (cozinha · escritório · aparelho), trocar PIN, excluir. O papel daqui é o
//      que alimenta o "fora da comparação" do DESEMPENHO (porta única: papel-da-conta.ts).
// R21: PIN NUNCA aparece — nem na tela, nem em resposta de API: só `temPin: boolean`.
// R22: "Nova conta" é cartão fixo (tela).
// R23: EXCLUIR em toda conta. Sem história → apaga DE VEZ. Com história → some de tudo (teclado de
//      PIN, listas de designação, esta tela); o nome vive só nos relatórios antigos. "Desativar" não
//      existe aqui: conta inativa (`ativo=false`) É a conta excluída com história.
// ⛔ O SERVIDOR decide o destino DENTRO da transação (a história pode nascer entre o confirm e o clique).

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { cadastrarPessoa, CadastroError } from './cadastrar-pessoa'
import { criarColaborador } from './cadastros'
import { definirPin, colaboradoresComPin, PinError } from './pin'
import { papeisDasContas, definirPapel } from './papel-da-conta'
import { inativarColaborador, ColaboradorEmUsoError } from '@/lib/equipe/inativar-colaborador'
import { destinoExclusaoConta, textoExcluir, validaPin, type PapelDaConta } from './leis-r'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'
import { conclusoesComHistoria } from './conclusoes-vigentes'

export class EquipeError extends Error {}

/** ⛔ o tipo NÃO tem campo de PIN: a tela não tem como desenhar um PIN (R21 — impossível, não lembrado) */
export interface ContaDaEquipe {
  colaboradorId: string
  nome: string
  papel: PapelDaConta
  temPin: boolean
  /** "12/11" — a última etapa que a pessoa finalizou; null = nunca */
  ultimoLote: string | null
}

export async function contasDaEquipe(companyId: string, db: PrismaClient = defaultPrisma): Promise<ContaDaEquipe[]> {
  const contas = await db.stockColaborador.findMany({ where: { companyId, ativo: true }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } })
  const ids = contas.map((c) => c.id)
  const [papel, comPin, ultimas] = await Promise.all([
    papeisDasContas(companyId, ids, db),
    colaboradoresComPin(companyId, db),
    ids.length
      ? db.stockOrdemEtapa.groupBy({ by: ['executorId'], where: { companyId, executorId: { in: ids }, finalizadoEm: { not: null } }, _max: { finalizadoEm: true } })
      : Promise.resolve([]),
  ])
  const ultima = new Map(ultimas.map((u) => [u.executorId as string, u._max.finalizadoEm]))
  return contas.map((c) => {
    const u = ultima.get(c.id)
    return {
      colaboradorId: c.id, nome: c.nome, papel: papel.get(c.id) ?? 'cozinha', temPin: comPin.has(c.id),
      ultimoLote: u ? `${diaEmSaoPaulo(u).slice(8, 10)}/${diaEmSaoPaulo(u).slice(5, 7)}` : null,
    }
  })
}

/** ⭐ R23 — a história da conta: lotes (ordens de produção) e tarefas em que o nome está */
export async function historiaDaConta(companyId: string, colaboradorId: string, db: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0] = defaultPrisma): Promise<{ lotes: number; tarefas: number }> {
  const [etapas, participacoes, conclusoes, ordens] = await Promise.all([
    db.stockOrdemEtapa.findMany({ where: { companyId, OR: [{ executorId: colaboradorId }, { colaboradorId }] }, select: { id: true, ordemId: true } }),
    db.stockOrdemEtapaParticipante.findMany({ where: { companyId, colaboradorId }, select: { etapaId: true } }),
    // ⭐ porta única das conclusões; a ESTORNADA também é história (o nome está nela)
    conclusoesComHistoria(companyId, {}, db).then((cs) => cs.filter((c) => c.colaboradorId === colaboradorId)),
    db.stockProductionOrder.findMany({ where: { companyId, colaboradorId }, select: { id: true } }),
  ])
  const extras = participacoes.length
    ? await db.stockOrdemEtapa.findMany({ where: { companyId, id: { in: participacoes.map((p) => p.etapaId) } }, select: { id: true, ordemId: true } })
    : []
  const ordemIds = new Set([...etapas, ...extras].map((e) => e.ordemId))
  for (const c of conclusoes) ordemIds.add(c.ordemId)
  for (const o of ordens) ordemIds.add(o.id)
  const tarefas = ordemIds.size ? await db.stockTarefa.findMany({ where: { companyId, id: { in: [...ordemIds] } }, select: { id: true } }) : []
  const ehTarefa = new Set(tarefas.map((t) => t.id))
  return { lotes: [...ordemIds].filter((id) => !ehTarefa.has(id)).length, tarefas: ehTarefa.size }
}

export interface PreviaDaExclusao { destino: 'apaga' | 'some-das-telas'; lotes: number; tarefas: number; frase: string }

export async function previaDaExclusao(companyId: string, colaboradorId: string, db: PrismaClient = defaultPrisma): Promise<PreviaDaExclusao> {
  const c = await db.stockColaborador.findFirst({ where: { id: colaboradorId, companyId, ativo: true }, select: { nome: true } })
  if (!c) throw new EquipeError('Essa conta não existe nesta empresa.')
  const h = await historiaDaConta(companyId, colaboradorId, db)
  const destino = destinoExclusaoConta(h.lotes, h.tarefas)
  return {
    destino, ...h,
    frase: destino === 'apaga'
      ? `${c.nome} não tem nenhum lote nem tarefa — a conta é apagada de vez.`
      : textoExcluir(h),
  }
}

/** o GESTO — re-avalia a história na hora (nunca confia no que a tela prometeu) */
export async function excluirConta(companyId: string, colaboradorId: string, db: PrismaClient = defaultPrisma): Promise<{ destino: 'apaga' | 'some-das-telas'; lotes: number; tarefas: number }> {
  const c = await db.stockColaborador.findFirst({ where: { id: colaboradorId, companyId, ativo: true }, select: { id: true } })
  if (!c) throw new EquipeError('Essa conta não existe nesta empresa.')
  const apagou = await db.$transaction(async (tx) => {
    const h = await historiaDaConta(companyId, colaboradorId, tx)
    if (destinoExclusaoConta(h.lotes, h.tarefas) !== 'apaga') return null
    await tx.stockColaboradorPin.deleteMany({ where: { companyId, colaboradorId } })
    await tx.stockColaboradorPapel.deleteMany({ where: { companyId, colaboradorId } })
    await tx.stockColaborador.delete({ where: { id: colaboradorId } })
    return h
  })
  if (apagou) return { destino: 'apaga', ...apagou }
  // ⭐ com história: some de tudo — PIN revogado + inativa (a trava de trabalho pendurado é a de sempre)
  try {
    await inativarColaborador(companyId, colaboradorId, db)
  } catch (e) {
    if (e instanceof ColaboradorEmUsoError) throw new EquipeError(e.message)
    throw e
  }
  return { destino: 'some-das-telas', ...(await historiaDaConta(companyId, colaboradorId, db)) }
}

export async function criarConta(
  input: { companyId: string; nome: string; papel: PapelDaConta; pin?: string; userId?: string | null }, db: PrismaClient = defaultPrisma,
): Promise<{ colaboradorId: string }> {
  const nome = input.nome.trim()
  if (!nome) throw new EquipeError('Diga o nome da conta.')
  try {
    let colaboradorId: string
    if (input.papel === 'aparelho') {
      // ⭐ "aparelho" é a conta do tablet, não de uma pessoa: não assina trabalho, não tem PIN
      const jaTem = await db.stockColaborador.findFirst({ where: { companyId: input.companyId, nome, ativo: true }, select: { id: true } })
      if (jaTem) throw new EquipeError(`Já existe uma conta chamada “${nome}”.`)
      colaboradorId = (await criarColaborador(input.companyId, nome, db)).id
    } else {
      if (!input.pin || !validaPin(input.pin)) throw new EquipeError('O PIN tem 4 dígitos, só números.')
      const r = await cadastrarPessoa({ companyId: input.companyId, nome, funcao: 'COZINHA', pin: input.pin, userId: input.userId ?? undefined }, db)
      colaboradorId = r.colaboradorId!
    }
    if (input.papel !== 'cozinha') await definirPapel({ companyId: input.companyId, colaboradorId, papel: input.papel, userId: input.userId }, db)
    return { colaboradorId }
  } catch (e) {
    if (e instanceof CadastroError || e instanceof PinError) throw new EquipeError(e.message)
    throw e
  }
}

export async function trocarPin(input: { companyId: string; colaboradorId: string; pin: string; userId?: string | null }, db: PrismaClient = defaultPrisma): Promise<void> {
  if (!validaPin(input.pin)) throw new EquipeError('O PIN tem 4 dígitos, só números.')
  const c = await db.stockColaborador.findFirst({ where: { id: input.colaboradorId, companyId: input.companyId, ativo: true }, select: { id: true } })
  if (!c) throw new EquipeError('Essa conta não existe nesta empresa.')
  try {
    await definirPin({ companyId: input.companyId, colaboradorId: input.colaboradorId, pin: input.pin, userId: input.userId ?? undefined }, db)
  } catch (e) {
    if (e instanceof PinError) throw new EquipeError(e.message)
    throw e
  }
}
