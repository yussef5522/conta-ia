/**
 * ⭐⭐⭐ RETALHO DE MASSA (rework) — 09/10/2026, ordem do dono.
 *
 * **O processo real:** *"bolinhas feitas de tarde; de noite o serviço corta e sobra retalho; no
 * dia seguinte o retalho entra na massa nova — pedir 200 e sair 246 é NORMAL e hoje o fiscal
 * acusa à toa."*
 *
 * ⛔⛔⛔ **O QUE O RETALHO **NÃO** FAZ, e isto é a metade mais importante do arquivo:**
 *   · **não muda a SEPARAÇÃO** — ela segue `ficha × pedido` pela porta única (a lei de 03/10:
 *     *"a separação é SEMPRE ficha × pedido, sem rendimento no meio"*). O material que sai da
 *     câmara é o do pedido; o retalho **já estava na cozinha**;
 *   · **não é ITEM** — zero movimento no ledger, zero toque em `explodirReceita`, zero efeito
 *     em P1-P8 (Fase 1, ordem do dono; virar item é Fase 2 e só com a palavra dele);
 *   · **não mexe no `pct` da eficiência nem no P8** — o denominador deles continua sendo o que
 *     a FICHA promete. O retalho entra **só no FISCAL** (*"o declarado cabe no material?"*),
 *     que é a pergunta que ele de fato responde.
 *
 * ⭐ O que ele faz é UMA coisa: **soma no rendimento ESPERADO**, porque a massa de ontem virou
 * massa de hoje. `+1 kg de retalho ÷ 200 g por metade = +5 metades`.
 *
 * ⚠️⚠️ **E O ESPERADO COM RETALHO É COLA DE PROVA** (a lei de 05/10): ele viaja **só** no
 * payload de gerência (`stock.manage`, o mesmo gate do fiscal). Quem DECLARA segue cego — o
 * guard `conclusao-nao-da-cola` não é tocado.
 */
import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { fmtPedido } from './pedido-na-tela'

type Db = PrismaClient | Prisma.TransactionClient

/**
 * ⭐ O peso que o dono declarou em 09/10: a **metade** crua pesa 200 g (a bolinha inteira, 400).
 *
 * ⚠️ É SEMENTE, não régua: ele vive no banco (`stock_ficha_retalho.pesoUnidadeG`) e é editável
 * com rastro. Cravar o 200 em código faria a conta do bônus deixar de obedecer o dono no dia
 * em que a bolinha mudar de tamanho.
 */
export const PESO_DA_METADE_G = 200

/**
 * ⭐ O degrau da sanidade (ordem do dono): acima de 20 kg de retalho o sininho **avisa**.
 *
 * ⚠️ AVISA, não trava — um dia o número grande vai ser verdade (véspera de feriado), e travar
 * empurraria a cozinha a declarar menos do que entrou, que é o oposto do que o campo existe
 * pra medir.
 */
export const RETALHO_ALTO_KG = 20

export interface ConfigDeRetalho {
  fichaId: string
  aceita: boolean
  pesoUnidadeG: number
  definidoEm: Date
}

export interface RetalhoDaOrdem {
  ordemId: string
  kg: number
  declaradoEm: Date
}

/**
 * ⭐ PURA. Quantas unidades o retalho acrescenta ao esperado.
 *
 * ⛔⛔ **SEM ARREDONDAR AQUI.** O bônus entra na soma em precisão cheia e **quem arredonda é a
 * leitura** (`fmtPedido`) — é a régua da casa desde a reunitização do pão (2,3125) e desde o
 * custo por unidade da conclusão. Arredondar no meio daria um esperado diferente do que a tela
 * mostra, e o fiscal passaria a medir contra um número que ninguém vê.
 *
 * ⚠️ `null` quando não há o que calcular (sem kg, sem peso, peso ≤ 0) — e **nunca ZERO**:
 * zero é uma afirmação (*"o retalho não rendeu nada"*), ausência é outra coisa.
 */
export function unidadesDoRetalho(
  kg: number | null | undefined,
  pesoUnidadeG: number | null | undefined,
): number | null {
  if (kg == null || !Number.isFinite(kg) || kg <= 0) return null
  if (pesoUnidadeG == null || !Number.isFinite(pesoUnidadeG) || pesoUnidadeG <= 0) return null
  return (kg * 1000) / pesoUnidadeG
}

/**
 * ⭐ PURA. O esperado TOTAL: o pedido mais o que o retalho rende.
 *
 * ⛔ Pedido `null` devolve `null`: sem denominador não existe esperado, e somar o bônus a nada
 * daria *"esperado 46"* numa ordem que não pediu nada — a régua do *"a apurar"*, nunca zero.
 */
export function esperadoComRetalho(pedido: number | null | undefined, bonus: number | null): number | null {
  if (pedido == null || !Number.isFinite(pedido) || pedido <= 0) return null
  return bonus == null ? pedido : pedido + bonus
}

/**
 * ⭐⭐ A FRASE CURTA da criação da ordem — *"vai sair ~205 UN no total"* (pedido literal do dono).
 *
 * ⚠️ O `~` é honesto: o retalho é pesado na balança e o peso da metade é uma média — o total é
 * **estimativa**, não promessa. Escrever o número seco faria o dono tratar um arredondamento
 * como fato (a mesma razão do `~` do fiscal).
 *
 * ⛔ `null` quando não há retalho: a tela **não diz nada** em vez de dizer *"vai sair ~200"*,
 * que é o pedido repetido com cara de novidade.
 */
export function fraseDoRetalho(e: {
  pedido: number | null
  kg: number | null
  pesoUnidadeG: number | null
  unidade: string
}): string | null {
  const bonus = unidadesDoRetalho(e.kg, e.pesoUnidadeG)
  if (bonus == null) return null
  const total = esperadoComRetalho(e.pedido, bonus)
  const txt = fmtPedido(total, e.unidade)
  if (txt == null) return null
  return `vai sair ~${txt} ${e.unidade} no total`
}

/** ⭐ A config das receitas pedidas, em UMA consulta (a lição dos 4.909 ms de 28/09). */
export async function configDeRetalho(
  companyId: string,
  fichaIds: string[],
  db: Db = defaultPrisma,
): Promise<Map<string, ConfigDeRetalho>> {
  const out = new Map<string, ConfigDeRetalho>()
  const ids = [...new Set(fichaIds.filter(Boolean))]
  if (!ids.length) return out
  const rows = await db.stockFichaRetalho.findMany({
    where: { companyId, fichaId: { in: ids } },
    select: { fichaId: true, aceitaRetalho: true, pesoUnidadeG: true, definidoEm: true },
  })
  for (const r of rows) {
    out.set(r.fichaId, {
      fichaId: r.fichaId,
      aceita: r.aceitaRetalho,
      pesoUnidadeG: r.pesoUnidadeG,
      definidoEm: r.definidoEm,
    })
  }
  return out
}

/** ⭐ O retalho declarado nas ordens pedidas, em UMA consulta. */
export async function retalhoDasOrdens(
  companyId: string,
  ordemIds: string[],
  db: Db = defaultPrisma,
): Promise<Map<string, RetalhoDaOrdem>> {
  const out = new Map<string, RetalhoDaOrdem>()
  const ids = [...new Set(ordemIds.filter(Boolean))]
  if (!ids.length) return out
  const rows = await db.stockOrdemRetalho.findMany({
    where: { companyId, ordemId: { in: ids } },
    select: { ordemId: true, kg: true, declaradoEm: true },
  })
  for (const r of rows) out.set(r.ordemId, { ordemId: r.ordemId, kg: r.kg, declaradoEm: r.declaradoEm })
  return out
}

/**
 * ⭐ O LEMBRETE *"da última vez: X kg"* — discreto, e **nunca pré-preenchido** (ordem do dono).
 *
 * ⚠️ A diferença não é estética: campo pré-preenchido é campo confirmado sem ninguém pesar, e o
 * retalho é medido TODO DIA. O lembrete serve pra o dono reconhecer uma ordem de grandeza
 * absurda (digitar 92 onde costuma ser 9,2), não pra poupar a digitação.
 */
export async function ultimoRetalhoDaFicha(
  companyId: string,
  fichaId: string,
  db: Db = defaultPrisma,
): Promise<{ kg: number; declaradoEm: Date } | null> {
  const ordens = await db.stockProductionOrder.findMany({
    where: { companyId, fichaId },
    select: { id: true },
    orderBy: { criadoEm: 'desc' },
    take: 50,
  })
  if (!ordens.length) return null
  const r = await db.stockOrdemRetalho.findFirst({
    where: { companyId, ordemId: { in: ordens.map((o) => o.id) } },
    select: { kg: true, declaradoEm: true },
    orderBy: { declaradoEm: 'desc' },
  })
  return r ?? null
}
