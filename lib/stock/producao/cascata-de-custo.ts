// ⭐⭐⭐ A CASCATA DO CUSTO (19/09/2026) — reconstruir o ledger de um item a partir do ponto
// em que ele apodreceu, mantendo tudo que estava certo.
//
// **A ordem do dono:** *"Estorno na OPÇÃO 2 (as 2 gerações + os consumos — CMV de setembro
// exato)."*
//
// ⛔⛔ **POR QUE CORRIGIR SÓ A GERAÇÃO NÃO BASTA — medido:** com a geração de 22864 kg
// desfeita, a CUBA fica com **36,494 kg** valendo **R$ 801,48**, ou seja **R$ 21,96/kg**
// contra os **~10,87** dos lotes bons. A diferença é o que as SEPARAÇÕES seguintes
// deixaram de tirar: elas saíram a **R$ 0,04/kg** porque o custo médio estava poluído pela
// própria geração podre. *O erro de custo não fica parado — ele escorre pelos movimentos
// seguintes, e é por isso que a correção tem que descer junto.*
//
// ⭐ **O MÉTODO: estornar do ponto podre em diante (ordem inversa) e recriar em ordem
// cronológica, recalculando o custo médio a cada passo** — exatamente como o ledger teria
// nascido se o número certo tivesse sido digitado.
//
// ⛔ **O LEDGER CONTINUA IMUTÁVEL**: nada de UPDATE. Cada correção é **estorno + novo**, e
// a história inteira fica legível — inclusive o erro (a régua de 21/08 e 27/08).
//
// ⚠️ **O QUE ESTA LIB NÃO FAZ: seguir a cascata para FORA do item.** O custo baixo também
// entrou nas porções geradas com aquele insumo; corrigi-las é o degrau seguinte, e ele
// mexe em produto que já foi vendido. *O escopo é o que o dono delimitou; o resíduo é
// reportado com número, nunca assumido em silêncio.*

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarMovimento, estornarMovimento } from '../movement'
import { recomputeSaldoCache } from '../saldo'
import { TIPOS_FORA_DA_PRATELEIRA } from '../saldo'
import { OrdemError } from './ordens'

const r2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface CorrecaoDeGeracao {
  /** o movimento PRODUCAO_GERACAO com a quantidade torta */
  movimentoId: string
  qtdCerta: number
}

export interface LinhaDaCascata {
  movimentoId: string
  tipo: string
  data: string
  quantidade: number
  custoAntes: number
  custoDepois: number
  valorAntes: number
  valorDepois: number
  mudou: boolean
}

export interface PreviewDaCascata {
  itemId: string
  nome: string
  unidade: string
  linhas: LinhaDaCascata[]
  saldoAntes: number
  saldoDepois: number
  valorAntes: number
  valorDepois: number
  custoMedioAntes: number | null
  custoMedioDepois: number | null
  /**
   * ⭐ o custo a mais que sai da PRATELEIRA (as separações) — muda o valor do estoque
   *
   * ⚠️ É diferente do Δ do CMV: a separação tira do estoque, o consumo entra no produto.
   * Somar os dois (como a 1ª versão fazia) conta o mesmo dinheiro duas vezes.
   */
  deltaDaPrateleira: number
  /** ⭐ o custo a mais que entra nos PRODUTOS gerados — o Δ que vai pro CMV do mês */
  deltaDoCmv: number
}

/** ⭐ o custo unitário que um movimento de SAÍDA deve usar: o médio do instante, cheio */
function custoMedioNoInstante(qtd: number, valor: number): number {
  return qtd > 0 ? valor / qtd : 0
}

/**
 * ⭐⭐ O PREVIEW — reconstrói em memória, **sem gravar nada**.
 *
 * ⚠️ O corte é o movimento mais ANTIGO entre as gerações a corrigir: tudo antes dele já
 * estava certo e **não se toca**. Reconstruir o item inteiro reescreveria história boa.
 */
export async function preverCascata(
  companyId: string, itemId: string, correcoes: CorrecaoDeGeracao[], db: PrismaClient = defaultPrisma,
): Promise<PreviewDaCascata> {
  const item = await db.stockItem.findFirst({ where: { id: itemId, companyId }, select: { nome: true, unidadeControle: true } })
  if (!item) throw new OrdemError('Item não encontrado.')
  const todos = await db.stockMovement.findMany({
    where: { companyId, itemId }, orderBy: [{ dataMovimento: 'asc' }, { id: 'asc' }],
    select: { id: true, tipo: true, quantidade: true, custoUnitario: true, custoTotal: true, dataMovimento: true, receiptId: true, estornoDeId: true, origem: true, nfeChave: true, nItem: true },
  })
  const alvos = new Map(correcoes.map((c) => [c.movimentoId, c.qtdCerta]))
  const iCorte = todos.findIndex((m) => alvos.has(m.id))
  if (iCorte < 0) throw new OrdemError('Nenhuma das gerações a corrigir existe neste item.')

  const naPrateleira = (t: string) => !(TIPOS_FORA_DA_PRATELEIRA as readonly string[]).includes(t)

  // estado ANTES do corte — a história boa, intocada
  let qtd = 0, valor = 0
  for (const m of todos.slice(0, iCorte)) if (naPrateleira(m.tipo)) { qtd += m.quantidade; valor += m.custoTotal }

  const linhas: LinhaDaCascata[] = []
  let deltaDaPrateleira = 0, deltaDoCmv = 0
  for (const m of todos.slice(iCorte)) {
    const ehGeracaoCorrigida = alvos.has(m.id)
    const saida = m.quantidade < 0
    let q = m.quantidade, cu = m.custoUnitario, ct = m.custoTotal

    if (ehGeracaoCorrigida) {
      // ⭐ o custo TOTAL do lote não muda — é a prova de que a correção é de grandeza
      q = alvos.get(m.id)!
      cu = m.custoTotal / q
      ct = m.custoTotal
    } else if (saida) {
      // ⛔ toda SAÍDA passa a usar o custo médio do instante reconstruído, em precisão cheia
      cu = custoMedioNoInstante(qtd, valor)
      ct = r2(m.quantidade * cu)
      const aMais = Math.abs(ct) - Math.abs(m.custoTotal)
      // ⚠️ a separação tira do ESTOQUE; o consumo entra no PRODUTO. Contas diferentes.
      if (m.tipo === 'PRODUCAO_CONSUMO') deltaDoCmv += aMais
      else deltaDaPrateleira += aMais
    }

    linhas.push({
      movimentoId: m.id, tipo: m.tipo, data: m.dataMovimento.toISOString().slice(0, 16).replace('T', ' '),
      quantidade: q, custoAntes: m.custoUnitario, custoDepois: cu,
      valorAntes: m.custoTotal, valorDepois: ct,
      mudou: q !== m.quantidade || Math.abs(ct - m.custoTotal) > 0.005,
    })
    if (naPrateleira(m.tipo)) { qtd += q; valor += ct }
  }

  const antes = { q: 0, v: 0 }
  for (const m of todos) if (naPrateleira(m.tipo)) { antes.q += m.quantidade; antes.v += m.custoTotal }

  return {
    itemId, nome: item.nome, unidade: item.unidadeControle,
    linhas,
    saldoAntes: r2(antes.q), valorAntes: r2(antes.v),
    saldoDepois: r2(qtd), valorDepois: r2(valor),
    custoMedioAntes: antes.q > 0 ? r2(antes.v / antes.q) : null,
    custoMedioDepois: qtd > 0 ? r2(valor / qtd) : null,
    deltaDaPrateleira: r2(deltaDaPrateleira), deltaDoCmv: r2(deltaDoCmv),
  }
}

/**
 * ⭐⭐ APLICA — estorna do ponto podre em diante e recria com os custos certos.
 *
 * ⛔ Tudo numa transação só: em duas, uma falha no meio deixaria o item com metade do
 * ledger estornado e nada no lugar — o produto sumiria do estoque.
 *
 * ⚠️ A ordem importa: **estorna do mais NOVO pro mais velho** (o saldo desce pelo caminho
 * por onde subiu) e **recria do mais velho pro mais novo**. Fazer ao contrário faria o
 * guard do estado impossível recusar num estado intermediário que nunca existiu de fato.
 */
export async function aplicarCascata(
  input: { companyId: string; itemId: string; correcoes: CorrecaoDeGeracao[]; motivo: string; userId?: string },
  db: PrismaClient = defaultPrisma,
): Promise<{ preview: PreviewDaCascata; estornados: number; recriados: number }> {
  if (!input.motivo?.trim()) throw new OrdemError('Diga o motivo — correção sem porquê vira mistério em três meses.')
  const preview = await preverCascata(input.companyId, input.itemId, input.correcoes, db)

  const r = await db.$transaction(async (tx) => {
    const cliente = tx as unknown as PrismaClient
    const originais = await cliente.stockMovement.findMany({
      where: { id: { in: preview.linhas.map((l) => l.movimentoId) } },
      select: { id: true, tipo: true, receiptId: true, origem: true, nfeChave: true, nItem: true, dataMovimento: true },
    })
    const meta = new Map(originais.map((o) => [o.id, o]))

    let estornados = 0
    for (const l of [...preview.linhas].reverse()) {
      await estornarMovimento(cliente, l.movimentoId, { criadoPorId: input.userId ?? null })
      estornados++
    }
    let recriados = 0
    for (const l of preview.linhas) {
      const o = meta.get(l.movimentoId)!
      await criarMovimento(cliente, {
        companyId: input.companyId, itemId: input.itemId, tipo: o.tipo,
        quantidade: l.quantidade,
        custoUnitario: l.custoDepois, // ⛔ precisão cheia — o CHECK do ledger recusa o arredondado
        custoTotal: l.valorDepois,
        receiptId: o.receiptId, nfeChave: o.nfeChave, nItem: o.nItem,
        origem: o.origem, criadoPorId: input.userId ?? null,
        dataMovimento: o.dataMovimento, // ⭐ a data do FATO, não a do conserto
      })
      recriados++
    }
    return { estornados, recriados }
  }, { timeout: 60_000 })

  await recomputeSaldoCache(db, input.companyId)
  return { preview, ...r }
}
