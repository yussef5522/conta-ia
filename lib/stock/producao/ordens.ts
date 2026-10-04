// ESTOQUE FASE 2 item 2.1 — ORDENS de produção + SEPARAÇÃO. A separação é PRÉ-PREENCHIDA
// da ficha (componentes × escala) e o dono ajusta o que REALMENTE tirou da câmara → gera
// SEPARACAO_SAIDA no ledger (insumo sai do estoque geral e entra no armazém virtual
// "em-produção"). Sobra volta com DEVOLUCAO_PRODUCAO. O armazém em-produção é DERIVADO dos
// movimentos (receiptId = id da ordem), nunca uma tabela de saldo à parte. Só stock_.

import type { PrismaClient, Prisma } from '@prisma/client'
import { ESTADOS_ABERTOS } from './data-da-ordem'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { explodirReceita } from '../explodir-receita'
import { saldoItem, custoMedioPorItem, recomputeSaldoCache } from '../saldo'
import { materializarEtapasDaOrdem } from './etapas'
import { encerrarEtapasAbertas } from './encerrar-etapas-abertas'

type Db = PrismaClient | Prisma.TransactionClient

export class OrdemError extends Error {}

const round4 = (n: number) => Math.round((n + 1e-9) * 10000) / 10000
/**
 * ⭐⭐ 6 CASAS NA QUANTIDADE (29/09/2026) — o mesmo teto da digitação (`MAX_CASAS`).
 *
 * ⛔ **Aqui havia `round4` no planejado e `round2` no separado, e os dois cortavam dose
 * pequena ANTES de a tela poder escolher como mostrar.** Com a dose real do fermento
 * (0,0003 KG), `round4` a escala 1 devolvia **0,0003** — mas a 1 mg (0,000001) devolvia
 * **ZERO**, e `round2` no separado transformava 0,008 KG em 0,01. É a mesma lição de 01/09,
 * quando o `round2` do `porLote` fazia a porção de 0,135 virar 0,14: *"em 1 porção é nada;
 * em 370 porções é 1,85 kg de diferença"*.
 *
 * ⚠️ O arredondamento continua existindo pra matar lixo de ponto flutuante
 * (`0.30000000000000004`); o que muda é o degrau — 1 mg em vez de 100 mg.
 */
const round6 = (n: number) => Math.round((n + 1e-9) * 1_000_000) / 1_000_000
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export const TIPO_SEPARACAO = 'SEPARACAO_SAIDA'
export const TIPO_DEVOLUCAO = 'DEVOLUCAO_PRODUCAO'
export const TIPO_CONSUMO = 'PRODUCAO_CONSUMO'
export const TIPO_GERACAO = 'PRODUCAO_GERACAO'

// ---- criar ----

export interface CriarOrdemInput {
  companyId: string
  fichaId: string
  escalaReceitas: number
  dataProducao: Date
  setorId?: string | null
  colaboradorId?: string | null
  origem?: 'MANUAL' | 'SUGESTAO'
  observacao?: string | null
  userId?: string
  /**
   * ⭐⭐ O PEDIDO EM UNIDADES DO PRODUTO — *"quero produzir: 80 UN"* (item 2 do dono, 04/10).
   *
   * ⛔⛔ **É ELE que faltava ser GRAVADO.** `stock_ordem_meta` existe desde 13/09 com DOIS
   * leitores e **zero writers** — 0 linhas em 471 ordens —, então o *"pedido 130 → entregue 137
   * (105%)"* do relatório por tarefa nunca tinha um pedido pra comparar. *Campo que ninguém
   * escreve é promessa que a tela não cumpre.*
   *
   * ⚠️ OPCIONAL de propósito: `escalaReceitas` continua sendo o que a ordem grava e o que a
   * separação usa. O pedido é o que o DONO disse — e nem todo caminho tem um (a sugestão de
   * min/máx calcula a escala, ela não "pede" nada). Sem ele, quem responde é o DERIVADO de
   * `pedidoDaOrdem`, marcado como tal.
   */
  pedidoUnidades?: number | null
}

export async function criarOrdem(input: CriarOrdemInput, db: Db = defaultPrisma): Promise<{ ordemId: string }> {
  if (!(input.escalaReceitas > 0)) throw new OrdemError('Diga quanto você quer produzir (maior que zero).')
  const ficha = await db.stockFicha.findFirst({ where: { id: input.fichaId, companyId: input.companyId }, select: { id: true, itemProduzidoId: true, versaoAtual: true, ativo: true } })
  if (!ficha) throw new OrdemError('Ficha não encontrada.')
  if (!ficha.ativo) throw new OrdemError('Essa ficha está inativa.')
  const ordem = await db.stockProductionOrder.create({
    data: {
      companyId: input.companyId, fichaId: ficha.id, versaoFicha: ficha.versaoAtual, itemProduzidoId: ficha.itemProduzidoId,
      setorId: input.setorId ?? null, colaboradorId: input.colaboradorId ?? null, dataProducao: input.dataProducao,
      escalaReceitas: input.escalaReceitas, origem: input.origem ?? 'MANUAL', observacao: input.observacao ?? null,
      estado: 'PLANEJADA', criadoPorId: input.userId ?? null,
    },
  })
  /**
   * ⭐⭐ O PEDIDO VIRA LINHA AQUI — o writer que a tabela esperava desde 13/09.
   *
   * ⚠️ Grava **logo depois da ordem e antes das etapas**: se falhasse, a ordem existiria sem
   * meta — que é exatamente o estado das 471 de hoje, e o `pedidoDaOrdem` cobre com o DERIVADO.
   * Degrada, não quebra. ⛔ E é `create` simples, não upsert: o `@@unique(companyId, ordemId)`
   * torna a meta duplicada **impossível**, e a ordem acabou de nascer — não há o que atualizar.
   */
  if (input.pedidoUnidades != null && input.pedidoUnidades > 0) {
    await db.stockOrdemMeta.create({
      data: {
        companyId: input.companyId,
        ordemId: ordem.id,
        unidades: input.pedidoUnidades,
        registradoPorId: input.userId ?? null,
      },
    })
  }
  // ⭐ as etapas nascem COM a ordem (snapshot do método da versão). Receita sem etapa
  // declarada vira UMA etapa "produção" — a régua mora em `resolverEtapas`, num lugar só.
  const versao = await db.stockFichaVersao.findFirst({
    where: { companyId: input.companyId, fichaId: ficha.id, versao: ficha.versaoAtual }, select: { id: true },
  })
  await materializarEtapasDaOrdem(input.companyId, ordem.id, versao?.id ?? null, db)
  return { ordemId: ordem.id }
}

// ---- separação pré-preenchida (explode a ficha × escala) ----

export interface SeparacaoLinha {
  itemId: string
  nome: string
  unidade: string
  unidadeControle: string
  porLote: number // ⭐ o que a FICHA pede por 1× a receita (0,135 KG) — é a régua que a
  //                  tela usa pra converter "quero fazer N" ↔ "preciso tirar X". Sem ele a
  //                  tela teria que dividir qtdPlanejada pela escala e reinventar a conta.
  qtdPlanejada: number // ficha × escala
  qtdSeparada: number // em-produção (Σ SEPARACAO − DEVOLUCAO − CONSUMO), 0 antes de separar
  /** ⭐ o que a panela comeu (Σ|PRODUCAO_CONSUMO|) — é o "real" da eficiência por componente */
  qtdConsumida: number
  saldoDisponivel: number // saldo atual no estoque geral
  custoMedio: number | null
  fichaIdComponente: string | null // se o componente é PRODUZIDO (tem ficha) → dá pra "produzir antes"
}

async function componentesDaVersao(companyId: string, fichaId: string, versao: number, db: Db) {
  const v = await db.stockFichaVersao.findFirst({ where: { companyId, fichaId, versao }, select: { id: true } })
  if (!v) return []
  return db.stockFichaComponente.findMany({ where: { companyId, versaoId: v.id }, orderBy: { posicao: 'asc' } })
}

/** em-produção por item DESTA ordem = Σ|SEPARACAO| − Σ DEVOLUCAO − Σ CONSUMO (receiptId=ordemId). */
export async function separadoPorItem(companyId: string, ordemId: string, db: Db): Promise<Map<string, number>> {
  const movs = await db.stockMovement.findMany({ where: { companyId, receiptId: ordemId, tipo: { in: [TIPO_SEPARACAO, TIPO_DEVOLUCAO, TIPO_CONSUMO] } }, select: { itemId: true, tipo: true, quantidade: true } })
  const m = new Map<string, number>()
  for (const mv of movs) {
    const abs = Math.abs(mv.quantidade)
    const delta = mv.tipo === TIPO_SEPARACAO ? abs : -abs // separou entra; devolveu/consumiu sai
    m.set(mv.itemId, round6((m.get(mv.itemId) ?? 0) + delta))
  }
  return m
}

/**
 * ⭐ CONSUMO REAL por item desta ordem (Σ|PRODUCAO_CONSUMO|).
 *
 * ⚠️ **NÃO é o `separadoPorItem`**, e confundir os dois foi o que me fez quase desenhar a
 * eficiência com o número errado: aquele é **em-produção** (SEP − DEV − CON) e numa ordem
 * CONCLUÍDA ele é ~ZERO por construção (é o que o P4 vigia). O que a eficiência precisa é o
 * que a panela comeu.
 */
export async function consumidoPorItem(companyId: string, ordemId: string, db: Db): Promise<Map<string, number>> {
  const movs = await db.stockMovement.findMany({ where: { companyId, receiptId: ordemId, tipo: TIPO_CONSUMO }, select: { itemId: true, quantidade: true } })
  const m = new Map<string, number>()
  for (const mv of movs) m.set(mv.itemId, round6((m.get(mv.itemId) ?? 0) + Math.abs(mv.quantidade)))
  return m
}

export async function explodirSeparacao(companyId: string, ordemId: string, db: Db = defaultPrisma): Promise<{ ordem: OrdemView; linhas: SeparacaoLinha[] }> {
  const ordem = await getOrdem(companyId, ordemId, db)
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  const comps = await componentesDaVersao(companyId, ordem.fichaId, ordem.versaoFicha, db)
  const [custoMap, separado, consumido] = await Promise.all([custoMedioPorItem(db, companyId), separadoPorItem(companyId, ordemId, db), consumidoPorItem(companyId, ordemId, db)])
  const itemIds = comps.map((c) => c.itemId)
  const [its, fichasComp] = await Promise.all([
    itemIds.length ? db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true, unidadeControle: true } }) : Promise.resolve([]),
    // componente que é PRODUZIDO (tem ficha ativa) → dá pra "produzir antes" quando faltar
    itemIds.length ? db.stockFicha.findMany({ where: { companyId, ativo: true, itemProduzidoId: { in: itemIds } }, select: { id: true, itemProduzidoId: true } }) : Promise.resolve([]),
  ])
  const meta = new Map(its.map((i) => [i.id, i]))
  const fichaDoItem = new Map(fichasComp.map((f) => [f.itemProduzidoId, f.id]))

  /**
   * ⭐⭐ A PORTA ÚNICA, no modo `SEPARACAO` (02/10/2026).
   *
   * ⛔ **`SEPARACAO` não desce nenhum componente, e isso é DECLARAÇÃO, não omissão:** o gesto
   * aqui é FÍSICO — alguém vai à câmara buscar o que a ficha lista. Descer mandaria a pessoa
   * pegar farinha quando a ficha pede massa pronta (e a massa já saiu na ordem dela — descer
   * seria baixa DUPLA). Antes isso era um `for` com `c.qtdPlanejada * escala` solto aqui.
   */
  const planejado = new Map(
    explodirReceita(
      { fichaId: ordem.fichaId },
      ordem.escalaReceitas,
      { componentesByFicha: new Map([[ordem.fichaId, comps]]), fichaByItemProduzido: new Map() },
      'SEPARACAO',
    ).consumos.map((c) => [c.itemId, c.qtd] as const),
  )

  const linhas: SeparacaoLinha[] = []
  for (const c of comps) {
    const saldo = await saldoItem(db, companyId, c.itemId)
    linhas.push({
      itemId: c.itemId,
      nome: meta.get(c.itemId)?.nome ?? '(item removido)',
      unidade: c.unidade,
      unidadeControle: meta.get(c.itemId)?.unidadeControle ?? '—',
      // ⛔ NÃO ARREDONDAR (01/09): aqui havia `round2`, e a porção de 0,135 KG virava
      // **0,14** na tela. O dono: *"em 1 porção é nada; em 370 porções é 1,85 kg de
      // diferença"*. Era perda de dado no SERVIDOR, antes de a tela poder escolher como
      // mostrar. Conferido que não contamina gravação: `confirmarSeparacao` grava o que a
      // pessoa digitou (`qtdSeparada`), nunca este planejado. Quem formata é a tela, com a
      // precisão da ficha.
      porLote: c.qtdPlanejada,
      /**
       * ⭐ A MULTIPLICAÇÃO SAIU DAQUI (02/10/2026) — quem faz dose × escala é a porta única
       * `explodirReceita`, no modo `SEPARACAO` (nada desce: a cozinha tira da câmara o que a
       * ficha lista). ⚠️ O `round6` continua porque **esta é a borda de exibição**: o número
       * vai pra tela e pro campo pré-preenchido, não pro ledger (quem grava é o
       * `confirmarSeparacao`, com o que a pessoa digitou).
       */
      qtdPlanejada: round6(planejado.get(c.itemId) ?? 0),
      qtdSeparada: round6(separado.get(c.itemId) ?? 0),
      qtdConsumida: round6(consumido.get(c.itemId) ?? 0),
      saldoDisponivel: saldo.saldo,
      custoMedio: custoMap.get(c.itemId) ?? null,
      fichaIdComponente: fichaDoItem.get(c.itemId) ?? null,
    })
  }
  return { ordem, linhas }
}

// ---- confirmar separação (gera SEPARACAO_SAIDA) ----

export interface SepararInput { itemId: string; qtdSeparada: number }

export async function confirmarSeparacao(companyId: string, ordemId: string, itens: SepararInput[], db: PrismaClient = defaultPrisma, userId?: string): Promise<{ movimentos: number }> {
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado !== 'PLANEJADA') throw new OrdemError('Essa ordem já foi separada (ou está em outro estado).')
  const positivos = itens.filter((i) => i.qtdSeparada > 0)
  if (!positivos.length) throw new OrdemError('Separe ao menos um item (quantidade maior que zero).')

  const custoMap = await custoMedioPorItem(db, companyId)
  await db.$transaction(async (tx) => {
    for (const it of positivos) {
      const custo = custoMap.get(it.itemId) ?? 0
      // SEPARACAO_SAIDA: sai do estoque geral (quantidade NEGATIVA)
      await criarMovimento(tx, { companyId, itemId: it.itemId, tipo: TIPO_SEPARACAO, quantidade: -it.qtdSeparada, custoUnitario: custo, custoTotal: round2(-it.qtdSeparada * custo), receiptId: ordemId, origem: 'MANUAL', criadoPorId: userId ?? null })
    }
    await tx.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'SEPARADA' } })
  })
  await recomputeSaldoCache(db, companyId) // o cache segue os movimentos (juiz E1)
  return { movimentos: positivos.length }
}

export async function iniciarProducao(companyId: string, ordemId: string, db: Db = defaultPrisma): Promise<void> {
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId }, select: { estado: true } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado !== 'SEPARADA') throw new OrdemError('Só entra em produção depois de separar.')
  await db.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'EM_PRODUCAO' } })
}

/** Devolve sobra pro estoque geral (DEVOLUCAO_PRODUCAO). */
export async function devolverInsumo(companyId: string, ordemId: string, itemId: string, qtd: number, db: PrismaClient = defaultPrisma, userId?: string): Promise<void> {
  if (!(qtd > 0)) throw new OrdemError('Quantidade a devolver tem que ser maior que zero.')
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId }, select: { estado: true } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado !== 'SEPARADA' && ordem.estado !== 'EM_PRODUCAO') throw new OrdemError('Só dá pra devolver de uma ordem separada ou em produção.')
  const separado = await separadoPorItem(companyId, ordemId, db)
  const emProd = separado.get(itemId) ?? 0
  if (qtd > emProd + 0.001) throw new OrdemError(`Não dá pra devolver ${qtd} — só ${round2(emProd)} desse item está em produção.`)
  const custo = (await custoMedioPorItem(db, companyId)).get(itemId) ?? 0
  await criarMovimento(db, { companyId, itemId, tipo: TIPO_DEVOLUCAO, quantidade: qtd, custoUnitario: custo, custoTotal: round2(qtd * custo), receiptId: ordemId, origem: 'MANUAL', criadoPorId: userId ?? null })
  await recomputeSaldoCache(db, companyId)
}

/** Cancela: devolve TUDO que está em produção pro estoque geral e marca CANCELADA. */
export async function cancelarOrdem(companyId: string, ordemId: string, db: PrismaClient = defaultPrisma, userId?: string): Promise<void> {
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId }, select: { estado: true } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado === 'CONCLUIDA' || ordem.estado === 'CANCELADA') throw new OrdemError('Essa ordem já foi encerrada.')
  const separado = await separadoPorItem(companyId, ordemId, db)
  const custoMap = await custoMedioPorItem(db, companyId)
  await db.$transaction(async (tx) => {
    for (const [itemId, emProd] of separado) {
      if (emProd > 0.001) {
        const custo = custoMap.get(itemId) ?? 0
        await criarMovimento(tx, { companyId, itemId, tipo: TIPO_DEVOLUCAO, quantidade: round2(emProd), custoUnitario: custo, custoTotal: round2(emProd * custo), receiptId: ordemId, origem: 'MANUAL', criadoPorId: userId ?? null })
      }
    }
    // ⛔ cancelar também LEVA a etapa aberta junto, e pelo mesmo motivo: depois de cancelada
    // não existe gesto que a resolva.
    await encerrarEtapasAbertas({ companyId, ordemId, motivo: 'ORDEM_CANCELADA', userId }, tx)
    await tx.stockProductionOrder.update({ where: { id: ordemId }, data: { estado: 'CANCELADA' } })
  })
  await recomputeSaldoCache(db, companyId)
}

// ---- leitura ----

export interface OrdemView {
  id: string
  fichaId: string
  versaoFicha: number
  itemProduzidoId: string
  nomeProduzido: string
  unidadeProduzido: string
  setorId: string | null
  setorNome: string | null
  dataProducao: string
  escalaReceitas: number // ⚠️ fica no MOTOR e no banco; a TELA fala em unidades, nunca em "×"
  loteBase: number // ⭐ o rendimento TEÓRICO da ficha: quantas unidades por 1× a receita
  estado: string
  origem: string
  observacao: string | null
}

export async function getOrdem(companyId: string, ordemId: string, db: Db = defaultPrisma): Promise<OrdemView | null> {
  const o = await db.stockProductionOrder.findFirst({ where: { id: ordemId, companyId } })
  if (!o) return null
  const [prod, setor, versao] = await Promise.all([
    db.stockItem.findFirst({ where: { companyId, id: o.itemProduzidoId }, select: { nome: true, unidadeControle: true } }),
    o.setorId ? db.stockSetor.findFirst({ where: { companyId, id: o.setorId }, select: { nome: true } }) : Promise.resolve(null),
    // a versão TRAVADA na ordem — o teórico tem que ser o da época, não o da ficha de hoje
    db.stockFichaVersao.findFirst({ where: { companyId, fichaId: o.fichaId, versao: o.versaoFicha }, select: { loteBase: true } }),
  ])
  return {
    id: o.id, fichaId: o.fichaId, versaoFicha: o.versaoFicha, itemProduzidoId: o.itemProduzidoId,
    nomeProduzido: prod?.nome ?? '(item removido)', unidadeProduzido: prod?.unidadeControle ?? '—',
    setorId: o.setorId, setorNome: setor?.nome ?? null, dataProducao: o.dataProducao.toISOString(),
    escalaReceitas: o.escalaReceitas, loteBase: versao?.loteBase ?? 1, estado: o.estado, origem: o.origem, observacao: o.observacao,
  }
}

export async function listOrdens(companyId: string, db: Db = defaultPrisma): Promise<OrdemView[]> {
  /**
   * ⛔⛔ A ORDEM ABERTA NUNCA DEPENDE DO TETO (19/09).
   *
   * Antes era um `findMany` só, `dataProducao desc` com `take: 200`. A ordem da calabresa
   * ralada nasceu com a data no **ano 202** (ver `data-da-ordem.ts`), foi pro fim da
   * ordenação — **posição 238 de 238** — e caiu fora das 200. Resultado medido: **1 ordem
   * aberta no banco, 0 visíveis em qualquer tela**, com R$ 42,18 de insumo preso nela.
   *
   * ⭐ Trabalho pendente não é histórico: ele é a razão da tela existir. O teto continua
   * valendo pras ENCERRADAS (que são a massa e envelhecem), e as abertas vêm inteiras —
   * a mesma cura do `take: 50` que escondia o fermento da busca (16/09).
   */
  const [naFila, encerradas] = await Promise.all([
    db.stockProductionOrder.findMany({
      where: { companyId, estado: { in: [...ESTADOS_ABERTOS] } },
      orderBy: [{ dataProducao: 'desc' }, { criadoEm: 'desc' }],
    }),
    db.stockProductionOrder.findMany({
      where: { companyId, estado: { notIn: [...ESTADOS_ABERTOS] } },
      orderBy: [{ dataProducao: 'desc' }, { criadoEm: 'desc' }], take: 200,
    }),
  ])
  const os = [...naFila, ...encerradas]
  const out: OrdemView[] = []
  for (const o of os) {
    const v = await getOrdem(companyId, o.id, db)
    if (v) out.push(v)
  }
  return out
}
