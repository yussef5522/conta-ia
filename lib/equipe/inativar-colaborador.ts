// ⭐⭐ TIRAR ALGUÉM DA PRODUÇÃO — E PODER TRAZER DE VOLTA (06/09/2026).
//
// **O CASO:** o "Cristian" colaborador (cadastrado em 21/08, sem PIN) existe porque naquele
// dia o cadastro de gente era uma lista solta de nomes. Hoje ele **só gerencia** — tem login
// de `GERENTE_ESTOQUE` e não põe a mão na produção. Um colaborador sem PIN e sem dono aparece
// pra sempre na Equipe como pendência ("sem PIN — não consegue entrar"), e **pendência falsa
// é como o dono aprende a ignorar a lista**.
//
// ⛔⛔ INATIVAR, NUNCA APAGAR: o colaborador é o que **ASSINA** etapa de produção. Apagar
// deixaria etapas antigas apontando pro nada, e o relatório do mês perderia o nome de quem
// fez. Inativar mantém o rastro e é reversível — a mesma disciplina do fornecedor duplicado
// (desativa com a nota, não some) e do dia dispensado (reverter carimba, não apaga).
//
// ⭐ A DECISÃO MORA AQUI, e a rota E o script chamam (REGRA 4): duas cópias do guard
// divergiriam na primeira regra nova, e a divergente seria justamente a que apaga.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

export class ColaboradorEmUsoError extends Error {}

export interface TrabalhoPendurado {
  etapasEmAndamento: number
  designadasAbertas: number
  conclusoes: number
  /** já finalizadas — NÃO impedem (o rastro fica, e inativar não o apaga) */
  etapasFeitas: number
}

/**
 * ⭐ O QUE ESTÁ PENDURADO NELE. Separado de propósito do ato de inativar: a tela mostra isto
 * ANTES de perguntar, e o script imprime no preview.
 *
 * ⚠️ A régua distingue **pendente** de **histórico**: etapa em andamento e designação aberta
 * impedem (inativar deixaria trabalho órfão no meio); etapa **já finalizada** não impede — o
 * nome dela continua no relatório, e é justamente por isso que se inativa em vez de apagar.
 */
export async function trabalhoPendurado(
  companyId: string, colaboradorId: string, db: PrismaClient = defaultPrisma,
): Promise<TrabalhoPendurado> {
  const [etapasEmAndamento, designadasAbertas, conclusoes, etapasFeitas] = await Promise.all([
    db.stockOrdemEtapa.count({ where: { companyId, executorId: colaboradorId, iniciadoEm: { not: null }, finalizadoEm: null } }),
    db.stockOrdemEtapa.count({ where: { companyId, colaboradorId, finalizadoEm: null } }),
    db.stockProducaoConclusao.count({ where: { companyId, colaboradorId } }),
    db.stockOrdemEtapa.count({ where: { companyId, executorId: colaboradorId, finalizadoEm: { not: null } } }),
  ])
  return { etapasEmAndamento, designadasAbertas, conclusoes, etapasFeitas }
}

/** a frase que explica por que NÃO dá pra inativar — `null` quando dá */
export function motivoParaNaoInativar(t: TrabalhoPendurado, nome: string): string | null {
  const impede: string[] = []
  if (t.etapasEmAndamento) impede.push(`${t.etapasEmAndamento} etapa(s) em andamento`)
  if (t.designadasAbertas) impede.push(`${t.designadasAbertas} tarefa(s) designada(s) e não finalizada(s)`)
  if (t.conclusoes) impede.push(`${t.conclusoes} conclusão(ões) de produção`)
  if (!impede.length) return null
  return `${nome} tem ${impede.join(', ')}. Resolva a produção antes de tirar da equipe.`
}

export async function inativarColaborador(
  companyId: string, colaboradorId: string, db: PrismaClient = defaultPrisma,
): Promise<void> {
  // ⛔ REGRA 8: resolvido DENTRO da empresa — um id da tela nunca governa sozinho
  const c = await db.stockColaborador.findFirst({ where: { id: colaboradorId, companyId }, select: { id: true, nome: true, ativo: true } })
  if (!c) throw new ColaboradorEmUsoError('Esse colaborador não é desta empresa.')
  if (!c.ativo) return // já inativo — idempotente

  const motivo = motivoParaNaoInativar(await trabalhoPendurado(companyId, c.id, db), c.nome)
  if (motivo) throw new ColaboradorEmUsoError(motivo)

  await db.$transaction(async (tx) => {
    // ⚠️ o PIN ativo é REVOGADO junto: inativo com PIN vivo continuaria entrando no tablet, e
    // "inativo" tem que significar "não entra". Reativar pede PIN novo — de propósito: quem
    // volta depois de meses não deveria voltar com o segredo antigo.
    await tx.stockColaboradorPin.updateMany({ where: { companyId, colaboradorId: c.id, revogadoEm: null }, data: { revogadoEm: new Date() } })
    await tx.stockColaborador.update({ where: { id: c.id }, data: { ativo: false } })
  })
}

/** ⭐ o caminho de VOLTA — sem ele, inativar seria porta sem maçaneta */
export async function reativarColaborador(
  companyId: string, colaboradorId: string, db: PrismaClient = defaultPrisma,
): Promise<void> {
  const c = await db.stockColaborador.findFirst({ where: { id: colaboradorId, companyId }, select: { id: true } })
  if (!c) throw new ColaboradorEmUsoError('Esse colaborador não é desta empresa.')
  // ⚠️ volta SEM PIN: o segredo antigo foi revogado ao sair, e o dono define um novo pela
  // tela. A lista mostra "sem PIN", que é a pendência honesta de quem acabou de voltar.
  await db.stockColaborador.update({ where: { id: c.id }, data: { ativo: true } })
}
