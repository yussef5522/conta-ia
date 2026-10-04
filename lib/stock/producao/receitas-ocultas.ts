/**
 * ⭐⭐ "O QUE EU VEJO NO RELATÓRIO" — a escolha do dono, por USUÁRIO, em TABELA (04/10/2026).
 *
 * **Pedido:** *"Quero escolher quais receitas aparecem (esconder preparos miúdos: TOMATE PICADO,
 * ABRIR MILHO, ABRIR ERVILHA...). Escolha SALVA EM TABELA por usuário (a régua do Real×Teórico:
 * nunca localStorage) — volto amanhã e está como deixei."*
 *
 * ⛔ **NUNCA localStorage**, e o motivo é operacional: ele confere no celular E no notebook, e a
 * escolha feita num sumiria no outro — *"salva por usuário" só é verdade se for no banco* (a
 * decisão da Mesa, 29/09). Esta é a casa da pergunta: a rota é casca, a lib decide.
 *
 * ⛔ **E A CHAVE É `itemId`, NUNCA O NOME.** Esta casa renomeia item (11 renomeios em 09/09, com
 * apelido de busca pra a busca não perder o nome antigo). Guardar por nome faria a receita oculta
 * **reaparecer sozinha** no dia do rename — sem ninguém pedir e sem nada na tela dizendo.
 */

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

/** quantas receitas uma pessoa pode esconder — teto de sanidade, não régua de negócio */
const TETO = 500

/**
 * Os `itemId` que esta pessoa escondeu nesta empresa.
 *
 * ⚠️ **FALHA MACIA de propósito:** JSON torto ou coluna nova vazia devolve `[]` (= tudo
 * visível). Derrubar o relatório por causa de uma PREFERÊNCIA seria perder o relatório pra
 * salvar o filtro — e o default seguro é MOSTRAR: esconder por acidente é o erro que o dono não
 * tem como perceber.
 */
export async function lerOcultas(companyId: string, userId: string, db: Db): Promise<string[]> {
  const pref = await db.stockPorDiaPreferencia.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { ocultas: true },
  })
  return normalizar(pref?.ocultas)
}

export interface DeltaDeOcultas {
  ocultar?: string[]
  mostrar?: string[]
}

/**
 * ⭐⭐ Aplica o DELTA e devolve a lista nova.
 *
 * ⛔ **Delta, nunca substituição** — ver o comentário do `PUT` na rota: o painel só conhece as
 * receitas do período ABERTO, e mandar a lista inteira apagaria em silêncio o que ele escondeu
 * num período que não está na tela. *Só se decide sobre o que se vê.*
 *
 * ⚠️ `upsert` com a chave única `(companyId, userId)`: duas preferências pra mesma pessoa é
 * impossível no banco, não "checado" aqui.
 */
export async function aplicarDelta(
  companyId: string,
  userId: string,
  delta: DeltaDeOcultas,
  db: Db,
): Promise<string[]> {
  const atual = new Set(await lerOcultas(companyId, userId, db))
  for (const id of delta.mostrar ?? []) atual.delete(id)
  for (const id of delta.ocultar ?? []) atual.add(id)

  // ⚠️ ordenado: a coluna é texto e o diff do banco fica legível; e `mostrar` ganha de
  // `ocultar` pro mesmo id ser impossível de estar nos dois (o delete vem antes do add? não —
  // o add vem depois, então OCULTAR ganha; é a escolha explícita: o gesto mais recente manda).
  const lista = [...atual].sort().slice(0, TETO)
  const ocultas = JSON.stringify(lista)

  await db.stockPorDiaPreferencia.upsert({
    where: { companyId_userId: { companyId, userId } },
    create: { companyId, userId, ocultas },
    update: { ocultas },
  })
  return lista
}

/** PURA — lê a coluna com desconfiança (a lição do `metadata` do audit que vinha STRING) */
export function normalizar(bruto: string | null | undefined): string[] {
  if (!bruto) return []
  try {
    const v = JSON.parse(bruto)
    if (!Array.isArray(v)) return []
    return v.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, TETO)
  } catch {
    return []
  }
}
