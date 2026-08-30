// ⭐ ARQUIVAR / EXCLUIR ITEM (29/08/2026) — a peça da câmara fria.
//
// PEDIDO DO DONO: *"itens comprados UMA vez (manutenção, equipamento) poluem a Posição
// pra sempre"*. Duas regras, e a diferença entre elas é o LEDGER:
//
//   · item SEM movimento nenhum (criado por engano) → **EXCLUIR de verdade**
//   · item COM histórico                            → **ARQUIVAR** (some das listas;
//     movimentos e histórico preservados — o ledger é imutável e não perde linha)
//
// ⚠️ POR QUE NÃO EXCLUIR O QUE TEM HISTÓRICO: aquela compra ACONTECEU, entrou no custo do
// mês e está amarrada a uma nota. Apagar reescreveria o passado — a mesma disciplina do
// "mês fechado não se reescreve" e do "correção = estorno + novo".
//
// ⚠️ E ARQUIVAR NÃO É ZERAR: o saldo continua lá. Se o item tem 3 unidades na prateleira e
// some da Posição, o valor em estoque cai sem ninguém ter dado baixa — por isso o item com
// saldo ≠ 0 exige confirmação explícita, e a mensagem diz o valor que vai sumir da vista.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { saldoItem } from '../saldo'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export class ArquivarError extends Error {}

export interface SituacaoItem {
  itemId: string
  nome: string
  movimentos: number
  saldo: number
  valor: number
  /** dá pra EXCLUIR de verdade? (nunca teve movimento e ninguém aponta pra ele) */
  podeExcluir: boolean
  /** onde o item está sendo usado — o dono precisa saber ANTES */
  fichas: { fichaId: string; nome: string; ativa: boolean }[]
  mapasDeNota: number
  mapasDeVenda: number
  avisos: string[]
}

export async function situacaoDoItem(
  companyId: string, itemId: string, db: PrismaClient = defaultPrisma,
): Promise<SituacaoItem> {
  const item = await db.stockItem.findFirst({ where: { id: itemId, companyId }, select: { id: true, nome: true } })
  if (!item) throw new ArquivarError('Item não encontrado nesta empresa.')

  const [movimentos, s, comps, mapasDeNota, mapasDeVenda] = await Promise.all([
    db.stockMovement.count({ where: { companyId, itemId } }),
    saldoItem(db, companyId, itemId),
    db.stockFichaComponente.findMany({ where: { companyId, itemId }, select: { versaoId: true } }),
    db.stockSupplierProduct.count({ where: { companyId, itemId } }),
    db.stockVendaProdutoMap.count({ where: { companyId, itemId } }),
  ])

  const fichas: SituacaoItem['fichas'] = []
  if (comps.length) {
    const versoes = await db.stockFichaVersao.findMany({
      where: { id: { in: [...new Set(comps.map((c) => c.versaoId))] } }, select: { fichaId: true },
    })
    const fs = await db.stockFicha.findMany({
      where: { id: { in: [...new Set(versoes.map((v) => v.fichaId))] } },
      select: { id: true, ativo: true, itemProduzidoId: true },
    })
    const nomes = new Map(
      (await db.stockItem.findMany({ where: { id: { in: fs.map((f) => f.itemProduzidoId) } }, select: { id: true, nome: true } }))
        .map((i) => [i.id, i.nome]),
    )
    fichas.push(...fs.map((f) => ({ fichaId: f.id, nome: nomes.get(f.itemProduzidoId) ?? '(ficha)', ativa: f.ativo })))
  }

  const avisos: string[] = []
  const fichasAtivas = fichas.filter((f) => f.ativa)
  if (fichasAtivas.length) {
    avisos.push(
      `Este item é ingrediente de ${fichasAtivas.length} ficha(s) ATIVA(S): ${fichasAtivas.map((f) => f.nome).join(', ')}. ` +
        `Arquivar tira ele da busca de ingredientes, mas as receitas continuam apontando pra ele.`,
    )
  }
  if (s.saldo !== 0) {
    avisos.push(`O item tem saldo de ${s.saldo} (${brl(s.valor)}) — arquivar tira ele da Posição, mas o estoque continua existindo.`)
  }

  return {
    itemId, nome: item.nome, movimentos, saldo: s.saldo, valor: s.valor,
    podeExcluir: movimentos === 0 && comps.length === 0 && mapasDeNota === 0 && mapasDeVenda === 0,
    fichas, mapasDeNota, mapasDeVenda, avisos,
  }
}

export async function arquivarItem(
  input: { companyId: string; itemId: string; arquivar: boolean; confirmado?: boolean },
  db: PrismaClient = defaultPrisma,
): Promise<{ itemId: string; ativo: boolean; avisos: string[] }> {
  const sit = await situacaoDoItem(input.companyId, input.itemId, db)
  // ⚠️ AVISO EXIGE CONFIRMAÇÃO — não trava, mas não deixa passar em silêncio (ficha ativa
  // ou saldo ≠ 0 são coisas que o dono tem que ver ANTES, não descobrir depois).
  if (input.arquivar && sit.avisos.length > 0 && !input.confirmado) {
    throw new ArquivarError(sit.avisos.join(' '))
  }
  await db.stockItem.update({ where: { id: input.itemId }, data: { ativo: !input.arquivar } })
  return { itemId: input.itemId, ativo: !input.arquivar, avisos: sit.avisos }
}

/**
 * EXCLUSÃO DE VERDADE — só pra item que nunca existiu de fato.
 * ⚠️ Um único movimento já impede: o ledger não perde linha, e linha órfã seria pior que
 * item poluindo lista.
 */
export async function excluirItem(
  input: { companyId: string; itemId: string },
  db: PrismaClient = defaultPrisma,
): Promise<{ excluido: true; nome: string }> {
  const sit = await situacaoDoItem(input.companyId, input.itemId, db)
  if (!sit.podeExcluir) {
    const motivos = [
      sit.movimentos > 0 ? `${sit.movimentos} movimento(s) no ledger` : null,
      sit.fichas.length ? `${sit.fichas.length} ficha(s) usam` : null,
      sit.mapasDeNota ? `${sit.mapasDeNota} mapeamento(s) de nota` : null,
      sit.mapasDeVenda ? `${sit.mapasDeVenda} mapeamento(s) de venda` : null,
    ].filter(Boolean).join(' · ')
    throw new ArquivarError(
      `"${sit.nome}" não pode ser excluído porque tem histórico (${motivos}). ` +
        `Use ARQUIVAR: ele some das listas e o histórico fica — apagar reescreveria o passado.`,
    )
  }
  await db.stockItem.delete({ where: { id: input.itemId } })
  return { excluido: true, nome: sit.nome }
}
