// ⭐⭐⭐ CORTE DE ÉPOCA DA CONCILIAÇÃO (11/09/2026) — decisão do dono.
//
// **Ele:** *"Comecei a usar a conciliação em setembro; agosto fica pra trás POR DECISÃO —
// as linhas de agosto já estão categorizadas como despesa, completas no DRE; não vou caçar
// par de conta velha."*
//
// ⛔⛔ **O CORTE É DO QUE A TELA OFERECE, NUNCA DO QUE EXISTE.** A linha anterior continua
// viva nas Movimentações como despesa categorizada, continua no DRE, e o **Find & Match
// manual ainda a acha** quando o dono procura. O que muda é a fila parar de empurrar
// trabalho que ele decidiu não fazer. ⚠️ Esconder do BUSCADOR seria a família do "erro
// disfarçado de vazio" — aqui só a FILA encolhe.
//
// ⭐ **É CONFIG DA EMPRESA, não constante** — `Company.conciliarAPartirDe`. Empresa nova
// define a dela no onboarding; empresa sem corte definido enxerga tudo, como sempre.
// É a mesma disciplina do "AGOSTO É O PISO" das vendas, com uma diferença que importa: lá
// o piso era do MOTOR (dado pré-corte nem existe), aqui é só da VITRINE.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

type Db = PrismaClient | Prisma.TransactionClient

/** o corte da empresa — `null` = sem corte, a fila enxerga tudo (o padrão de quem não configurou) */
export async function corteDaEmpresa(db: Db, companyId: string): Promise<Date | null> {
  const c = await db.company.findUnique({ where: { id: companyId }, select: { conciliarAPartirDe: true } })
  return c?.conciliarAPartirDe ?? null
}

/**
 * ⭐ Junta o corte com a janela de data que a consulta já tinha, **sem perder nenhuma das
 * duas**: o `gte` que vale é o MAIS RESTRITIVO.
 *
 * ⚠️ Isto existe como função porque a janela e o corte são duas perguntas diferentes que
 * caem no mesmo campo — escrever `date: { gte: corte }` por cima de uma janela existente
 * apagaria a janela em silêncio, e o bug apareceria como "a fila mostra linha velha demais"
 * num lugar e "a fila esqueceu de olhar" noutro.
 */
export function comCorte<T extends { date?: { gte?: Date; lte?: Date } }>(
  where: T, corte: Date | null,
): T {
  if (!corte) return where
  const atual = where.date?.gte
  return { ...where, date: { ...where.date, gte: atual && atual > corte ? atual : corte } }
}
