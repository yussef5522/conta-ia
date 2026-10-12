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
import { formatarQtd } from '@/lib/stock/quantidade'

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

/**
 * ⭐⭐⭐ A LINHA DO RETALHO NO BLOCO DO PEDIDO (12/10) — *"hoje ele é invisível"*.
 *
 * **Defeito do dono:** ele criou a ordem de 10 UN declarando 10 KG de retalho, a página mostrou
 * *"deve sair ~12 UN (pela sua média)"* e **nenhum sinal do retalho**. A pergunta dele foi
 * *"não era certo mudar a quantidade que eu pedi?"* — e a resposta da casa é **NÃO** (o pedido
 * comanda a separação; o retalho não gasta material). **Mas o retalho tem que APARECER.**
 *
 * ⭐ **TRÊS SAÍDAS, e a do meio é a que fecha a dúvida:**
 *   · receita que **NÃO aceita** → `null`, a tela não diz nada (como hoje);
 *   · receita que aceita **COM** retalho declarado → *"retalho de ontem: 10 KG → +50 UN"*;
 *   · receita que aceita **SEM** retalho → *"sem retalho declarado"*, discreto.
 *
 * ⛔⛔ **A terceira saída é a que importa:** sem ela, ausência de linha significaria duas coisas
 * (*"não declarei"* e *"a receita não aceita"*) e o dono ficaria na dúvida justamente no caso em
 * que ele esqueceu de declarar. ***Ausência nunca pode ser indistinguível de "não se aplica"***
 * — é a mesma régua do *"sem contagem"* do estoque e do *"nunca conferida"* das contas.
 *
 * ⚠️⚠️ **E ELA NÃO É COLA DE PROVA** (a lei de 05/10), e a diferença é de ORIGEM: o bônus é a
 * conversão do kg que **o próprio dono pesou** pela régua que **ele declarou** na ficha (200 g),
 * não o que a ficha PROMETE nem a média histórica. O que a lei proíbe é o sistema soprar o
 * número esperado; aqui ele só devolve a aritmética da declaração dele. A modal de conclusão
 * segue intocada.
 *
 * ⚠️ **"+50 UN", não "+50 metades"** — o dono escreveu *"metades"* porque é o produto DESTE caso.
 * A frase usa a **unidade do item produzido**, que continua verdadeira no dia em que outra
 * receita aceitar retalho; cravar "metades" faria a tela chamar de metade o que não é.
 */
export function linhaDoRetalho(e: {
  aceita: boolean
  kg: number | null | undefined
  pesoUnidadeG: number | null | undefined
  unidade: string
}): { texto: string; declarado: boolean; bonus: number | null } | null {
  if (!e.aceita) return null
  const bonus = unidadesDoRetalho(e.kg, e.pesoUnidadeG)
  if (bonus == null) return { texto: 'sem retalho declarado', declarado: false, bonus: null }
  const txt = fmtPedido(bonus, e.unidade)
  if (txt == null) return { texto: 'sem retalho declarado', declarado: false, bonus: null }
  return {
    texto: `retalho de ontem: ${formatarQtd(e.kg!, 'KG')} → +${txt} ${e.unidade}`,
    declarado: true,
    bonus,
  }
}

/**
 * ⭐⭐⭐ O ESPELHO DA SEPARAÇÃO PASSOU A DIZER O **TOTAL** (12/10, ordem do dono).
 *
 * *"A frase vira o TOTAL, curta: «deve sair ~62 UN no total (~12 da massa nova + 50 do
 * retalho)»"* — porque dizer só *"~12"* numa ordem que vai render 62 é a tela escondendo a
 * metade do lote, e foi exatamente isso que fez o dono desconfiar do pedido.
 *
 * ⛔⛔ **A CONTA MORA AQUI, NÃO NO JSX.** A tela não soma `massa nova + bônus`: somar ali seria
 * a 2ª derivação do mesmo total (a lição do B1 e dos 7 detectores de par), e ela divergiria do
 * fiscal — que usa `permitido = material + retalho ÷ 200 g` — no primeiro ajuste de régua.
 *
 * ⚠️ A régua usada continua NOMEADA no fim (*"pela sua média"* × *"pelo que a receita promete"*):
 * espelho sem nome faz o dono comparar dois números sem saber de onde vieram.
 *
 * ⛔ `null` sem massa nova: sem o número da separação não existe total, e somar o bônus a nada
 * daria *"deve sair ~50"* numa ordem que não separou nada.
 */
export function fraseDaSeparacao(e: {
  daMassaNova: number | null | undefined
  porMedia: boolean
  bonusDoRetalho: number | null
  unidade: string
}): string | null {
  if (e.daMassaNova == null || !Number.isFinite(e.daMassaNova)) return null
  const regua = e.porMedia ? 'pela sua média' : 'pelo que a receita promete'
  const nova = fmtPedido(e.daMassaNova, e.unidade)
  if (nova == null) return null
  if (e.bonusDoRetalho == null) {
    return `Com isso deve sair ~${nova} ${e.unidade} (${regua})`
  }
  const total = fmtPedido(e.daMassaNova + e.bonusDoRetalho, e.unidade)
  const bonus = fmtPedido(e.bonusDoRetalho, e.unidade)
  if (total == null || bonus == null) return null
  return `Com isso deve sair ~${total} ${e.unidade} no total (~${nova} da massa nova + ${bonus} do retalho) · ${regua}`
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
