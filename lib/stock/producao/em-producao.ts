// ⭐⭐ O ARMAZÉM VIRTUAL "EM-PRODUÇÃO" — uma expressão só (01/09/2026).
//
// O que está em produção é DERIVADO do ledger, nunca uma tabela de saldo:
//     em-produção = Σ|SEPARACAO_SAIDA| − Σ|PRODUCAO_CONSUMO| − Σ|DEVOLUCAO_PRODUCAO|
// (o insumo sai da prateleira na separação, e sai da produção quando é consumido ou volta).
//
// ⛔ POR QUE ESTE ARQUIVO NASCEU: a conta estava escrita em DOIS lugares —
//   · `separadoPorItem()` em `ordens.ts`, usada por `explodirSeparacao` e `concluir`;
//   · **inline dentro do P4** do juiz (`emProd = sep − con − dev`).
// Duas expressões da mesma decisão é a doença que este projeto mais paga (7 detectores de
// par, 3 réguas de "o bloco atravessa o corte"). Ao construir o card "Em produção" do painel
// eu ia escrever a **terceira** — e o dono pediu explicitamente que o card usasse "a mesma
// soma que o juiz usa".
//
// ⚠️ E a premissa do dono tinha um furo que a medição pegou: **o P2 não soma dinheiro** —
// ele só conta horas paradas. Não havia soma nenhuma pra reusar. Então em vez de somar uma
// cópia, esta extração REDUZ de duas expressões pra uma: o P4 passa a ler daqui.

import type { PrismaClient, Prisma } from '@prisma/client'

type Db = PrismaClient | Prisma.TransactionClient

export const TIPOS_EM_PRODUCAO = ['SEPARACAO_SAIDA', 'PRODUCAO_CONSUMO', 'DEVOLUCAO_PRODUCAO'] as const

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface MovimentoEmProducao {
  receiptId: string | null
  itemId: string
  tipo: string
  quantidade: number
}

/** por ordem → por item → quanto está EM PRODUÇÃO agora. PURA (recebe os movimentos). */
export function emProducaoPorOrdem(
  movs: readonly MovimentoEmProducao[],
): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  for (const m of movs) {
    if (!m.receiptId) continue
    const porItem = out.get(m.receiptId) ?? new Map<string, number>()
    const abs = Math.abs(m.quantidade)
    // ⚠️ separou ENTRA na produção; consumiu ou devolveu SAI dela. O sinal do movimento
    // no ledger não serve aqui (SEPARACAO é negativo porque sai da PRATELEIRA).
    const delta = m.tipo === 'SEPARACAO_SAIDA' ? abs : -abs
    porItem.set(m.itemId, round2((porItem.get(m.itemId) ?? 0) + delta))
    out.set(m.receiptId, porItem)
  }
  return out
}

/** Lê os movimentos das ordens e devolve o mapa. Uma query, um lugar. */
export async function lerEmProducao(
  companyId: string,
  db: Db,
  ordemIds?: string[],
): Promise<Map<string, Map<string, number>>> {
  const movs = await db.stockMovement.findMany({
    where: {
      companyId,
      tipo: { in: [...TIPOS_EM_PRODUCAO] },
      ...(ordemIds ? { receiptId: { in: ordemIds } } : {}),
    },
    select: { receiptId: true, itemId: true, tipo: true, quantidade: true },
  })
  return emProducaoPorOrdem(movs)
}

/**
 * PURA. Quanto DINHEIRO está parado em produção, dado o mapa e o custo médio por item.
 *
 * ⚠️ O custo vem de `custoMedioPorItem` — a MESMA fonte da Posição. Um segundo jeito de
 * valorar faria o card dizer um número e a Posição outro sobre o mesmo insumo.
 * ⚠️ Sobra NEGATIVA (consumiu mais do que separou) não vira crédito: é sintoma de erro e
 * quem acusa é o P1, não este total. Aqui ela é ignorada pra não maquiar o valor parado.
 */
export function valorEmProducao(
  mapa: Map<string, Map<string, number>>,
  // ⚠️ `number | null`: item sem nota nunca teve custo — vale 0 no total, e é o honesto
  // ("a definir" não é zero, mas somar null quebraria a conta; quem cobra o custo é o P6).
  custoMedio: Map<string, number | null>,
): number {
  let total = 0
  for (const porItem of mapa.values()) {
    for (const [itemId, qtd] of porItem) {
      if (qtd <= 0.001) continue
      total += qtd * (custoMedio.get(itemId) ?? 0)
    }
  }
  return round2(total)
}
