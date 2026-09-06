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
  // ── PENDÊNCIA: impede, porque inativar deixaria trabalho órfão no meio ──
  etapasEmAndamento: number
  designadasAbertas: number
  // ── HISTÓRICO: NÃO impede — o rastro fica, e é justamente por isso que se inativa ──
  /** já finalizadas */
  etapasFeitas: number
  /**
   * ⚠️ CONCLUSÕES SÃO HISTÓRICO, NÃO PENDÊNCIA — corrigido na 1ª rodada contra o dado real.
   *
   * A 1ª versão as tratava como impedimento e **barrou o Cristian por 24 conclusões**, que
   * são lotes que ele JÁ produziu (2.196 unidades, 22/08 a 04/09). Barrar ali contradiz a
   * própria régua deste arquivo ("distingue pendente de histórico") e, pior, daria a
   * entender que inativar apagaria aquilo — não apaga.
   *
   * ⭐ Elas continuam sendo MOSTRADAS, e em destaque: quem decide precisa saber que o nome
   * está em 24 lotes. O guard barra pendência; o número informa a decisão.
   */
  conclusoes: number
  /** unidades produzidas por ele — o tamanho do que está no nome dele */
  unidadesProduzidas: number
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
  const [etapasEmAndamento, designadasAbertas, feitas, etapasFeitas] = await Promise.all([
    db.stockOrdemEtapa.count({ where: { companyId, executorId: colaboradorId, iniciadoEm: { not: null }, finalizadoEm: null } }),
    db.stockOrdemEtapa.count({ where: { companyId, colaboradorId, finalizadoEm: null } }),
    db.stockProducaoConclusao.findMany({ where: { companyId, colaboradorId }, select: { qtdGerada: true } }),
    db.stockOrdemEtapa.count({ where: { companyId, executorId: colaboradorId, finalizadoEm: { not: null } } }),
  ])
  return {
    etapasEmAndamento, designadasAbertas, etapasFeitas,
    conclusoes: feitas.length,
    unidadesProduzidas: Math.round(feitas.reduce((s, x) => s + x.qtdGerada, 0) * 100) / 100,
  }
}

/** a frase que explica por que NÃO dá pra inativar — `null` quando dá */
export function motivoParaNaoInativar(t: TrabalhoPendurado, nome: string): string | null {
  const impede: string[] = []
  if (t.etapasEmAndamento) impede.push(`${t.etapasEmAndamento} etapa(s) em andamento`)
  if (t.designadasAbertas) impede.push(`${t.designadasAbertas} tarefa(s) designada(s) e não finalizada(s)`)
  if (!impede.length) return null
  return `${nome} tem ${impede.join(', ')}. Resolva a produção antes de tirar da equipe.`
}

/**
 * ⭐ O QUE O NOME DELE CARREGA — a frase que a tela mostra ANTES de perguntar. `null` quando
 * não há histórico nenhum (aí inativar é trivial e não precisa de aviso).
 *
 * ⚠️ Existe porque o guard, na 1ª rodada, barrou o Cristian dizendo "24 conclusões" como se
 * fosse impedimento. O número é RELEVANTE — só não é uma trava: é o que o dono precisa saber
 * pra decidir, não um motivo pra o sistema decidir por ele.
 */
export function historicoAAvisar(t: TrabalhoPendurado, nome: string): string | null {
  if (!t.conclusoes && !t.etapasFeitas) return null
  const partes: string[] = []
  if (t.conclusoes) partes.push(`${t.conclusoes} lote(s) concluído(s)${t.unidadesProduzidas ? ` (${t.unidadesProduzidas} un)` : ''}`)
  if (t.etapasFeitas) partes.push(`${t.etapasFeitas} etapa(s) feita(s)`)
  return `${nome} tem ${partes.join(' e ')} no nome. Isso FICA — inativar só tira do tablet e da lista do dia a dia.`
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
