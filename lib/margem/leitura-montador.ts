/**
 * ⭐⭐ A LEITURA DO MONTADOR — o catálogo que a bancada precisa (v2, 07/10/2026).
 *
 * ⛔⛔ ZERO CONTA NOVA: o custo da base e o de cada sabor saem de **`explodir`**, a porta única
 * ficha→consumo, com `custoMedioPorItem` do ledger — as MESMAS duas fontes que a baixa de venda
 * usa pra descontar o estoque. ⚠️ É isso que faz a conta do montador ser conferível na mão
 * contra `explodirReceita`, que é o red-then-green que o dono pediu.
 *
 * ⛔ E ESTA FUNÇÃO SÓ LÊ. O seed de canais/regras é GESTO do dono (rota própria, com rastro) —
 * semear dentro de um GET é escrita em caminho de leitura, e a casa já decidiu em 08/09 que
 * *"o GET não grava nada"*.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { montarCtx, explodir } from '@/lib/stock/vendas/baixa-venda'
import { custoMedioPorItem } from '@/lib/stock/saldo'
import { caraDaReceita } from '@/lib/stock/producao/cara-da-receita'
import { montarTamanhos, type RegraDeSabores, type TamanhoDePizza } from './tamanhos'
import { ordenarSabores, type SaborDisponivel } from './montador'
import { ordenarCanais, type CanalDeVenda } from './canais'
import { ehSaborDeVerdade } from './leitura'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface CatalogoDoMontador {
  tamanhos: TamanhoDePizza[]
  sabores: SaborDisponivel[]
  canais: CanalDeVenda[]
  /** ⚠️ o que falta pra bancada ficar pronta, NOMEADO — nunca uma tela vazia sem motivo */
  faltando: { oQue: string; frase: string }[]
}

/**
 * ⭐ O custo de UMA unidade de uma ficha, pela porta única.
 *
 * ⛔ `null` quando QUALQUER folha não tem custo médio — nunca o parcial como se fosse o total
 * (a régua do `custoUnitario` do hub do cardápio, que este módulo inteiro obedece).
 */
export function custoDeUmaFicha(
  fichaId: string,
  ctx: Awaited<ReturnType<typeof montarCtx>>,
  custoDe: Map<string, number | null>,
): number | null {
  const acc = new Map<string, number>()
  explodir({ tipo: 'FICHA', fichaId }, 1, ctx, acc)
  if (acc.size === 0) return null
  let t = 0
  for (const [itemId, qtd] of acc) {
    const c = custoDe.get(itemId)
    if (c == null) return null
    t += c * qtd
  }
  return round2(t)
}

export async function lerMontador(
  companyId: string,
  db: PrismaClient = defaultPrisma,
): Promise<CatalogoDoMontador> {
  const [ctx, custoDe, regrasRaw, basesRaw, canaisRaw, fichas, mapComp] = await Promise.all([
    montarCtx(companyId, db),
    custoMedioPorItem(db, companyId),
    db.stockRegraSaboresTamanho.findMany({ where: { companyId } }),
    db.stockBaseDoTamanho.findMany({ where: { companyId } }),
    db.stockCanalVenda.findMany({ where: { companyId, ativo: true } }),
    db.stockFicha.findMany({ where: { companyId, ativo: true } }),
    db.stockVendaComplementoMap.findMany({ where: { companyId } }),
  ])

  const itens = await db.stockItem.findMany({
    where: { companyId, id: { in: fichas.map((f) => f.itemProduzidoId) } },
    select: { id: true, nome: true },
  })
  const nomeDoItem = new Map(itens.map((i) => [i.id, i.nome]))
  const nomeDaFicha = (fichaId: string) => {
    const f = fichas.find((x) => x.id === fichaId)
    return f ? (nomeDoItem.get(f.itemProduzidoId) ?? '(sem item)') : '(ficha não encontrada)'
  }

  // ─────────── os TAMANHOS: regra de sabores + a base apontada pelo dono ───────────
  const regras: RegraDeSabores[] = regrasRaw.map((r) => ({ tamanho: r.tamanho, sabores: r.sabores }))
  const bases = basesRaw.map((b) => ({
    tamanho: b.tamanho,
    fichaId: b.fichaId,
    nome: nomeDaFicha(b.fichaId),
    // ⚠️ ficha apagada depois de apontada: o custo vem `null` e a tela diz, em vez de somar 0
    custo: fichas.some((f) => f.id === b.fichaId) ? custoDeUmaFicha(b.fichaId, ctx, custoDe) : null,
  }))
  const tamanhos = montarTamanhos({ regras, bases })

  // ─────────── os SABORES: as fichas SABOR + os nomes do PDV que ainda não têm ───────────
  const sabores: SaborDisponivel[] = []
  for (const f of fichas) {
    if (f.tipoProduto !== 'SABOR') continue
    const nome = nomeDoItem.get(f.itemProduzidoId) ?? '(sem item)'
    const cara = caraDaReceita(nome)
    sabores.push({
      fichaId: f.id,
      nome,
      custo: custoDeUmaFicha(f.id, ctx, custoDe),
      familia: cara.familia,
      icone: cara.icone,
      temFicha: true,
    })
  }
  /**
   * ⭐⭐ O SABOR SEM FICHA ENTRA NA LISTA, com selo âmbar — e isto não é enfeite: tocar nele é
   * o atalho pra criar a ficha, que é **o trabalho que sobe a cobertura de 55% pra 80%** e
   * destrava o placar do dia D. ⛔ Esconder faria a bancada mentir sobre o cardápio e tirar
   * da frente do dono justamente a fila que ele precisa atacar.
   */
  const jaTem = new Set(sabores.map((s) => s.nome.trim().toUpperCase()))
  for (const m of mapComp) {
    if (m.fichaId) continue
    if (!ehSaborDeVerdade(m.nomeSuitable)) continue
    const k = m.nomeSuitable.trim().toUpperCase()
    if (jaTem.has(k)) continue
    jaTem.add(k)
    const cara = caraDaReceita(m.nomeSuitable)
    sabores.push({
      fichaId: '',
      nome: m.nomeSuitable,
      custo: null,
      familia: cara.familia,
      icone: cara.icone,
      temFicha: false,
    })
  }

  const canais: CanalDeVenda[] = ordenarCanais(
    canaisRaw.map((c) => ({ id: c.id, nome: c.nome, taxaPct: c.taxaPct, ativo: c.ativo })),
  )

  // ⚠️ o que falta, NOMEADO: bancada vazia sem motivo é indistinguível de bancada quebrada
  const faltando: CatalogoDoMontador['faltando'] = []
  if (canais.length === 0) {
    faltando.push({
      oQue: 'canais',
      frase: 'nenhum canal de venda cadastrado — sem eles não dá pra dizer quanto sobra no iFood',
    })
  }
  if (regras.length === 0) {
    faltando.push({
      oQue: 'sabores-por-tamanho',
      frase: 'quantos sabores cada tamanho obriga? sem isso eu não desenho as fatias',
    })
  }
  const semBase = tamanhos.filter((t) => t.base == null)
  if (semBase.length > 0) {
    faltando.push({
      oQue: 'base',
      frase: `${semBase.length} tamanho(s) sem base apontada: ${semBase.map((t) => t.tamanho).join(', ')}`,
    })
  }

  return { tamanhos, sabores: ordenarSabores(sabores), canais, faltando }
}
