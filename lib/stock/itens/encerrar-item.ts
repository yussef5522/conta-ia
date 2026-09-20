// ⭐⭐⭐ ITEM ENCERRADO — "pra operação, ele NÃO EXISTE mais" (19/09/2026).
//
// **A ordem do dono, sobre a CUBA MAIONESE:** *"sai DE TUDO que é vivo (…) nenhum lugar
// oferece ela pra nada. O passado fica legível: as ordens e movimentos antigos continuam
// mostrando o nome dela — apagar isso reescreveria custos de poções já vendidas."*
//
// ⛔⛔ **POR QUE NÃO É SÓ `ativo = false`.** Desativado é *"parei de usar, posso voltar"* —
// e o Catálogo mostra os inativos num toggle, de propósito. **Encerrado é decisão final**,
// e a diferença precisa estar escrita: sem isso, daqui a três meses ninguém sabe se o item
// sumiu por engano, por faxina ou porque o dono aposentou a receita.
//
// ⭐ É a mesma distinção que esta casa já fez duas vezes: **mesclado ≠ arquivado** (30/08 —
// *"virou parte de outro"* contra *"saiu de uso"*) e **`ENCERRADA_SEM_FINALIZAR` ≠ FEITA**
// (07/09). O estado tem nome próprio porque significa coisa diferente.
//
// ⛔ **E O PASSADO NÃO SE REESCREVE** (a régua desde 16/09). O ledger é imutável e os
// movimentos antigos continuam citando o nome: as poções produzidas com esta cuba já foram
// vendidas, e mexer no custo delas reescreveria margem de venda que já aconteceu. O que o
// encerramento acrescenta ao histórico é o **SELO** — *"item encerrado em DD/MM"* — pra
// quem ler saber que aquele nome não volta.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { saldoItem } from '../saldo'
import { avaliarResiduo } from '../residuo-de-centavos'
import { criarMovimento } from '../movement'

type Db = PrismaClient | Prisma.TransactionClient

export class EncerrarItemError extends Error {}

export interface EncerramentoDeItem {
  companyId: string
  itemId: string
  motivo: string
  userId?: string | null
}

/**
 * ⭐⭐ ENCERRA — some de tudo que é vivo, o passado fica.
 *
 * ⛔ **RECUSA com saldo diferente de zero**, e isso é o coração do gesto: encerrar um item
 * com estoque dentro **esconderia o dinheiro** em vez de resolvê-lo. O valor não evapora
 * por sumir da tela — ele continuaria no ledger, invisível, contaminando o total do
 * estoque e o Real vs Teórico. *A saída é contar (ou dar saída) primeiro; o encerramento é
 * o último passo, nunca o atalho.*
 */
export async function encerrarItem(e: EncerramentoDeItem, db: Db = defaultPrisma) {
  if (!e.motivo?.trim()) throw new EncerrarItemError('Diga por que ele está sendo encerrado — sem o motivo, em três meses ninguém sabe se foi engano ou decisão.')
  const item = await db.stockItem.findFirst({ where: { id: e.itemId, companyId: e.companyId }, select: { id: true, nome: true, unidadeControle: true } })
  if (!item) throw new EncerrarItemError('Item não encontrado nesta empresa.')

  /**
   * ⛔⛔ O SALDO VEM DA PORTA ÚNICA (`saldoItem`) — e isto foi erro meu, pego na hora.
   *
   * A 1ª versão montou um `aggregate` próprio com `tipo: { not: 'PRODUCAO_CONSUMO' }` e
   * **repetiu o defeito dos estornos internos que eu tinha acabado de corrigir** em
   * `saldo.ts`: acusou **36,25 KG / R$ 1,51** num item já zerado pela contagem — a soma
   * exata dos estornos de consumo.
   *
   * ⭐ *Segunda derivação da mesma pergunta diverge no primeiro caso de borda* — a lição
   * do B1, e ela vale inclusive quando quem escreve a segunda acabou de consertar a
   * primeira.
   */
  const s = await saldoItem(db, e.companyId, e.itemId)
  const saldo = s.saldo
  const valor = s.valor
  if (Math.abs(saldo) > 0.001) {
    throw new EncerrarItemError(
      `«${item.nome}» ainda tem ${saldo} ${item.unidadeControle} valendo R$ ${valor.toFixed(2)} no estoque. ` +
      'Encerrar agora esconderia esse dinheiro em vez de resolver — conte o item (ou dê saída) primeiro, ' +
      'e então ele pode ser encerrado.',
    )
  }

  /**
   * ⭐⭐ QUANTIDADE ZERADA COM CENTAVOS SOBRANDO — a régua do dono, de 19/09 de manhã:
   * ***zerar quantidade zera valor, SEMPRE***.
   *
   * ⚠️ O caso real: a CUBA foi contada a zero e sobraram **R$ 0,07** — resíduo do custo
   * médio arredondado ao longo de ~36 kg movimentados. Recusar por 7 centavos deixaria o
   * item preso pra sempre, e o dono num beco.
   *
   * ⛔ Mas o teto é o MESMO limite matemático do arredondamento (`residuo-de-centavos.ts`,
   * a régua do E16), proporcional ao que **passou** pelo item — não um número a dedo.
   * Acima dele não é centavo: é dado torto, e aí a recusa continua.
   */
  if (Math.abs(valor) > 0.01) {
    const giro = await db.stockMovement.aggregate({
      where: { companyId: e.companyId, itemId: e.itemId, quantidade: { gt: 0 } }, _sum: { quantidade: true },
    })
    const v = avaliarResiduo({ saldoAntes: 0, valorAntes: valor, qtdDaBaixa: giro._sum.quantidade ?? 0, valorDaBaixa: 0 })
    if (Math.abs(valor) > v.teto) {
      throw new EncerrarItemError(
        `«${item.nome}» tem 0 ${item.unidadeControle} mas ainda R$ ${valor.toFixed(2)} de valor — ` +
        `isso passa do resíduo esperado de arredondamento (R$ ${v.teto.toFixed(2)}). ` +
        'Não é centavo sobrando: é entrada ou saída que falta. Resolva o histórico antes de encerrar.',
      )
    }
    // ⭐ o resíduo vai junto, como AJUSTE registrado — nunca some em silêncio
    /**
     * ⚠️ A quantidade não pode ser ZERO (o CHECK do ledger recusa), então vai o menor
     * passo que o módulo reconhece — **0,001**, que o `round2` do saldo absorve: o item
     * fica em 0,00 e o valor, em 0,00.
     *
     * ⛔ E o unitário é DERIVADO do total (`custoTotal / quantidade`): montá-lo na mão
     * errava o sinal e o banco recusava por 14 centavos — pego no primeiro teste.
     */
    const q = -0.001
    await criarMovimento(db, {
      companyId: e.companyId, itemId: e.itemId, tipo: 'AJUSTE_CONTAGEM',
      quantidade: q, custoUnitario: -valor / q, custoTotal: -valor,
      origem: 'MANUAL', criadoPorId: e.userId ?? null,
    })
  }

  // ⚠️ o item deixa de existir pra OPERAÇÃO, e a ficha dele vai junto: ficha ativa de um
  // item encerrado continuaria oferecendo o gesto "produzir" num produto aposentado.
  await db.stockItem.update({ where: { id: item.id }, data: { ativo: false } })
  await db.stockFicha.updateMany({ where: { companyId: e.companyId, itemProduzidoId: item.id }, data: { ativo: false } })

  return db.stockItemEncerrado.upsert({
    where: { itemId: item.id },
    create: { companyId: e.companyId, itemId: item.id, motivo: e.motivo.trim(), criadoPorId: e.userId ?? null },
    update: {},
  })
}

export interface SeloDeEncerrado { itemId: string; encerradoEm: Date; motivo: string }

/**
 * ⭐ O SELO pro histórico — *"item encerrado em DD/MM"*.
 *
 * ⚠️ É uma consulta em LOTE de propósito: toda tela de histórico (extrato, ficha do item,
 * relatório de produção) lista muitos itens de uma vez, e uma consulta por linha viraria
 * N+1 numa tela que já é pesada.
 */
export async function selosDeEncerrado(companyId: string, itemIds: string[], db: Db = defaultPrisma): Promise<Map<string, SeloDeEncerrado>> {
  if (!itemIds.length) return new Map()
  const rows = await db.stockItemEncerrado.findMany({
    where: { companyId, itemId: { in: itemIds } },
    select: { itemId: true, criadoEm: true, motivo: true },
  })
  return new Map(rows.map((r) => [r.itemId, { itemId: r.itemId, encerradoEm: r.criadoEm, motivo: r.motivo }]))
}

/** ⭐ a frase que o histórico mostra — num lugar só, pra as telas não divergirem */
export function fraseDoSelo(s: SeloDeEncerrado): string {
  const d = s.encerradoEm.toISOString().slice(0, 10).split('-').reverse().join('/')
  return `item encerrado em ${d} — ${s.motivo}`
}
