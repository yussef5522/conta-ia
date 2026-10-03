// ESTOQUE FASE 2 item 2.2 — CONCLUSÃO da ordem ("quantos saíram?"). O fluxo do dono,
// travado: confirma o que foi REALMENTE consumido (pré = em-produção; sobra volta) → diz
// quantos saíram → PRODUCAO_CONSUMO (baixa da produção) + PRODUCAO_GERACAO (produto entra
// com CUSTO REAL do lote) → rendimento MEDIDO contra o consumo real (nunca a escala) →
// compara com a média (±15%) → registra. Parcial: várias conclusões na mesma ordem. Só stock_.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarMovimento } from '../movement'
import { custoMedioPorItem, recomputeSaldoCache } from '../saldo'
import { separadoPorItem, TIPO_CONSUMO, TIPO_DEVOLUCAO, TIPO_GERACAO, OrdemError } from './ordens'
import { escalaDoConsumo, avaliarVariacao, type Variacao } from './previsao-rendimento'
import { avaliarPlausibilidade, type VeredictoDaPlausibilidade } from './plausibilidade'
import { idsDeConclusoesEstornadas } from './conclusao-estornada'
import { encerrarEtapasAbertas } from './encerrar-etapas-abertas'

/** ⛔ a recusa por GRANDEZA carrega o veredicto — sem ele a tela não consegue sugerir nada */
export class GrandezaImplausivelError extends Error {
  readonly veredicto: VeredictoDaPlausibilidade
  constructor(v: VeredictoDaPlausibilidade) { super(v.mensagem ?? 'Número implausível.'); this.name = 'GrandezaImplausivelError'; this.veredicto = v }
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
const round4 = (n: number) => Math.round((n + 1e-9) * 10000) / 10000
const RENDIMENTO_DESVIO = 0.15 // ±15% dispara alerta (config futura)

export interface ConsumoInput { itemId: string; qtdConsumida: number }
export interface ConcluirInput {
  companyId: string
  ordemId: string
  consumo: ConsumoInput[]
  qtdGerada: number
  colaboradorId?: string | null
  /** o que o dono escreveu quando o rendimento destoou — opcional, nunca cobrado */
  motivoDesvio?: string | null
  parcial?: boolean
  userId?: string
  /** ⭐ o dono olhou o aviso de grandeza e disse que é isso mesmo (pergunta, nunca recusa cega) */
  confirmouGrandeza?: boolean
}
export interface ConcluirResult {
  conclusaoId: string
  qtdGerada: number
  rendimento: number
  escalaConsumida: number
  custoLoteReal: number
  custoUnitarioReal: number | null
  validadeAte: string | null
  rendimentoMedioAnterior: number | null // média das conclusões anteriores da ficha
  desvio: number | null // (rendimento − média) / média
  foraDaFaixa: boolean // |desvio| > 15%
  variacao: Variacao // ⭐ o MESMO julgamento que a tela mostrou antes de confirmar
  estado: string
}

/** Média móvel das últimas 5 conclusões da MESMA ficha + QUANTAS a compõem.
 *
 * ⭐ O `lotes` existe porque *"uma produção só não é média"* (dono, 01/09): a previsão e o
 * aviso só adotam a medida a partir de 2 lotes (`MIN_LOTES_PARA_MEDIA`), e a tela precisa
 * dizer de quantos lotes ela vem. ⚠️ O CUSTO continua usando desde o 1º — são perguntas
 * diferentes: *"custo é 'quanto custou', previsão é 'quanto vai sair'"*.
 */
export async function rendimentoMedidoDaFicha(companyId: string, fichaId: string, db: PrismaClient = defaultPrisma, exceptConclusaoId?: string): Promise<{ media: number | null; lotes: number }> {
  const m = await rendimentoMedidoDeFichas(companyId, [fichaId], db, exceptConclusaoId)
  return m.get(fichaId) ?? { media: null, lotes: 0 }
}

/** quantas conclusões compõem a média móvel — o mesmo teto pra uma ficha ou pra 189 */
export const LOTES_NA_MEDIA = 5

/**
 * ⭐⭐ A MÉDIA DE N FICHAS NUMA CONSULTA (28/09/2026) — e ela é o DONO da pergunta.
 *
 * ⛔ **O N+1 que isto mata era o mais caro da tela de receitas:** a versão de uma só ficha
 * faz 3 idas ao banco (ordens, estornadas, conclusões) e era chamada **189 vezes** dentro
 * do laço do `listFichas` — 567 round-trips pra responder o que cabe em 3.
 *
 * ⚠️ **O `take: 5` é POR FICHA, nunca global.** Buscar as 5 mais recentes do conjunto
 * inteiro daria a média da ficha mais produzida a todas as outras — o tipo de erro que a
 * tela não denuncia, porque o número sai plausível. Aqui a consulta traz tudo ordenado e o
 * corte é feito **por ficha**, em memória.
 *
 * ⛔ A régua do estornado (19/09) continua valendo igual: lote estornado NUNCA entra.
 */
export async function rendimentoMedidoDeFichas(
  companyId: string, fichaIds: string[], db: PrismaClient = defaultPrisma, exceptConclusaoId?: string,
): Promise<Map<string, { media: number | null; lotes: number }>> {
  const out = new Map<string, { media: number | null; lotes: number }>()
  for (const id of fichaIds) out.set(id, { media: null, lotes: 0 })
  if (!fichaIds.length) return out

  const ordens = await db.stockProductionOrder.findMany({
    where: { companyId, fichaId: { in: fichaIds } }, select: { id: true, fichaId: true },
  })
  if (!ordens.length) return out
  const fichaDaOrdem = new Map(ordens.map((o) => [o.id, o.fichaId]))

  // ⛔⛔ LOTE ESTORNADO NUNCA ENTRA NA MÉDIA (19/09). Sem isto o rendimento podre de 2858
  // continuaria sendo "o histórico" da maionese e envenenaria toda conclusão seguinte —
  // inclusive o guard de plausibilidade, que passaria a aprovar o erro por ele ser a norma.
  const estornadas = await idsDeConclusoesEstornadas(companyId, db)
  const fora = [...estornadas, ...(exceptConclusaoId ? [exceptConclusaoId] : [])]
  const cs = await db.stockProducaoConclusao.findMany({
    where: { companyId, ordemId: { in: [...fichaDaOrdem.keys()] }, ...(fora.length ? { id: { notIn: fora } } : {}) },
    orderBy: { criadoEm: 'desc' }, select: { ordemId: true, rendimento: true },
  })

  const porFicha = new Map<string, number[]>()
  for (const c of cs) {
    const fichaId = fichaDaOrdem.get(c.ordemId)
    if (!fichaId) continue
    const lista = porFicha.get(fichaId) ?? []
    if (lista.length >= LOTES_NA_MEDIA) continue // ⚠️ o corte é POR FICHA
    lista.push(c.rendimento)
    porFicha.set(fichaId, lista)
  }
  for (const [fichaId, rends] of porFicha) {
    if (!rends.length) continue
    out.set(fichaId, { media: medianaDosRendimentos(rends), lotes: rends.length })
  }
  return out
}

/**
 * ⛔⛔⛔ MEDIANA, NÃO MÉDIA — e isto é a raiz do caso do `beef de xis` (03/10/2026).
 *
 * **O caso vivo:** ordem de **10 beef de xis** propondo separar material pra **~6,7**. A conta
 * é `escala = pedido ÷ rendimento`, e o rendimento desta ficha estava em **1,4749**. Os cinco
 * lotes que formavam essa média:
 *
 * ```
 * 1,0400 · 1,0598 · 1,2532 · 1,8803 · 2,1411   →  MÉDIA 1,4749  ·  MEDIANA 1,2532
 * ```
 *
 * ⚠️ Os dois últimos são **outliers de conclusão** (27/09 declarou 173 un com consumo pra 92;
 * 29/09 declarou 94 com consumo pra 44). **Dois lotes em 27 envenenaram o plano de todas as
 * ordens seguintes** — e a média é o que deixou isso acontecer: *ela se move pro outlier*.
 *
 * ⭐⭐ **E O LAÇO É O QUE TORNA ISSO GRAVE, não o erro de um dia:** separa menos → a cozinha faz
 * os 10 de verdade → o consumo real fica acima do plano → o rendimento medido **SOBE** → a
 * próxima ordem separa **ainda menos**. É realimentação positiva, e é exatamente o
 * **Σ −24,91 KG de acém "além do plano"** que a perícia do caso B mediu em 02/10 sem saber a
 * causa. ⭐ **O caso B não era operação: era esta raiz.**
 *
 * ⭐ A mediana não se move quando um lote foge — é a MESMA lição que o M2 me ensinou um dia
 * antes (02/10), ali na comparação entre componentes irmãos. Com 5 valores, dois outliers no
 * mesmo lado ainda deslocam a mediana (1,2532), e é por isso que ela **não vem sozinha**: a
 * faixa de concordância de `reguaDoRendimento` é a segunda camada.
 *
 * ⚠️ `LOTES_NA_MEDIA` é 5 e o nome do campo segue `media` — renomear tocaria ~10 leitores e o
 * que importa aqui é a CONTA, não a palavra. O que a função devolve é a **tendência central
 * robusta** dos últimos lotes.
 */
export function medianaDosRendimentos(rends: number[]): number | null {
  if (!rends.length) return null
  const o = [...rends].sort((a, b) => a - b)
  const meio = Math.floor(o.length / 2)
  return round4(o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2)
}

/** casca fina histórica — só a média, pros callers que não precisam da contagem. */
export async function rendimentoMedioDaFicha(companyId: string, fichaId: string, db: PrismaClient = defaultPrisma, exceptConclusaoId?: string): Promise<number | null> {
  return (await rendimentoMedidoDaFicha(companyId, fichaId, db, exceptConclusaoId)).media
}

export async function concluir(input: ConcluirInput, db: PrismaClient = defaultPrisma): Promise<ConcluirResult> {
  if (!(input.qtdGerada > 0)) throw new OrdemError('Informe quantos saíram (maior que zero).')
  const ordem = await db.stockProductionOrder.findFirst({ where: { id: input.ordemId, companyId: input.companyId } })
  if (!ordem) throw new OrdemError('Ordem não encontrada.')
  if (ordem.estado !== 'SEPARADA' && ordem.estado !== 'EM_PRODUCAO') throw new OrdemError('Só conclui uma ordem separada ou em produção.')

  const consumoPos = input.consumo.filter((c) => c.qtdConsumida > 0)
  if (!consumoPos.length) throw new OrdemError('Informe o que foi consumido (ao menos um item).')

  const [emProd, custoMap, versao] = await Promise.all([
    separadoPorItem(input.companyId, input.ordemId, db),
    custoMedioPorItem(db, input.companyId),
    db.stockFichaVersao.findFirst({ where: { companyId: input.companyId, fichaId: ordem.fichaId, versao: ordem.versaoFicha } }),
  ])
  // não dá pra consumir mais do que está em produção
  for (const c of consumoPos) {
    const disp = emProd.get(c.itemId) ?? 0
    if (c.qtdConsumida > disp + 0.001) throw new OrdemError(`Não dá pra consumir ${c.qtdConsumida} — só ${round2(disp)} desse item está em produção.`)
  }

  // componentes da versão (qtd por lote base) → escala consumida = média de (consumido / porLote)
  const comps = versao ? await db.stockFichaComponente.findMany({ where: { companyId: input.companyId, versaoId: versao.id }, select: { itemId: true, qtdPlanejada: true } }) : []
  const porLote = new Map(comps.map((c) => [c.itemId, c.qtdPlanejada]))
  // ⭐ FONTE ÚNICA (01/09): esta média de razões É a régua que a tela de separar usa pra
  // prever. Enquanto vivia aqui solta, a tela tinha uma 2ª cópia dela (o "~154× a receita")
  // e a previsão podia divergir do rendimento que este mesmo método grava.
  const escalaDaLib = escalaDoConsumo(consumoPos.map((c) => ({ qtd: c.qtdConsumida, porLote: porLote.get(c.itemId) ?? 0 })))
  const escalaConsumida = escalaDaLib ?? 1

  const custoLoteReal = round2(consumoPos.reduce((s, c) => s + c.qtdConsumida * (custoMap.get(c.itemId) ?? 0), 0))
  const custoUnitarioReal = input.qtdGerada > 0 ? round2(custoLoteReal / input.qtdGerada) : null
  const rendimento = round4(input.qtdGerada / (escalaConsumida || 1))
  const validadeAte = versao?.validadeDias ? new Date(ordem.dataProducao.getTime() + versao.validadeDias * 86_400_000) : null

  const medidoAnterior = await rendimentoMedidoDaFicha(input.companyId, ordem.fichaId, db)
  const rendimentoMedioAnterior = medidoAnterior.media
  // ⭐ FONTE ÚNICA DO JULGAMENTO: é a mesma função que a tela chamou pra mostrar
  // "78% do teórico · sua média é 92%" ANTES de confirmar. Se aqui fosse outra conta, o
  // aviso da tela e o desvio gravado poderiam discordar sobre a mesma produção.
  const variacao = avaliarVariacao(input.qtdGerada, escalaConsumida, {
    teorico: versao?.loteBase ?? 1, medido: medidoAnterior.media, lotes: medidoAnterior.lotes,
  })
  /**
   * ⛔⛔ O GUARD DE PLAUSIBILIDADE (19/09) — e ele mora AQUI, no motor, não na tela.
   *
   * A régua de ±15% acima é de VARIAÇÃO (rendeu menos hoje); esta é de GRANDEZA (o número
   * não é deste mundo). Misturar as duas faria o aviso de 22864 sair com a mesma cara do
   * aviso de "rendeu 12% menos" — e aviso de rotina é o que se aprende a ignorar.
   *
   * ⭐ Pergunta, nunca recusa cega: com `confirmouGrandeza` o dono passa, e a decisão dele
   * fica gravada no `motivoDesvio` — a régua do `confirmouSanidade` do import.
   */
  // ⚠️ o nome e a unidade vêm do ITEM, não da ordem: a mensagem precisa dizer "22864 KG",
  // senão o dono lê um número solto e não tem como perceber a grandeza trocada.
  const itemProduzido = await db.stockItem.findUnique({ where: { id: ordem.itemProduzidoId }, select: { nome: true, unidadeControle: true } })
  const plaus = avaliarPlausibilidade({
    qtdGerada: input.qtdGerada, rendimento, rendimentoMedio: medidoAnterior.media,
    lotesNaMedia: medidoAnterior.lotes, unidade: itemProduzido?.unidadeControle ?? '',
    nomeDoProduto: itemProduzido?.nome ?? 'este produto',
  })
  if (plaus.decisao !== 'OK' && !input.confirmouGrandeza) throw new GrandezaImplausivelError(plaus)

  const desvio = rendimentoMedioAnterior && rendimentoMedioAnterior > 0 ? round4((rendimento - rendimentoMedioAnterior) / rendimentoMedioAnterior) : null
  const foraDaFaixa = desvio != null && Math.abs(desvio) > RENDIMENTO_DESVIO

  const conclusaoId = await db.$transaction(async (tx) => {
    // PRODUCAO_CONSUMO por item (baixa da produção; NÃO mexe na prateleira — já saiu no SEPARACAO)
    for (const c of consumoPos) {
      const custo = custoMap.get(c.itemId) ?? 0
      await criarMovimento(tx, { companyId: input.companyId, itemId: c.itemId, tipo: TIPO_CONSUMO, quantidade: -c.qtdConsumida, custoUnitario: custo, custoTotal: round2(-c.qtdConsumida * custo), receiptId: input.ordemId, origem: 'MANUAL', criadoPorId: input.userId ?? null })
    }
    // se FINAL (não parcial): sobra em-produção volta pro estoque (DEVOLUCAO)
    if (!input.parcial) {
      for (const [itemId, disp] of emProd) {
        const consumido = consumoPos.find((c) => c.itemId === itemId)?.qtdConsumida ?? 0
        const sobra = round2(disp - consumido)
        if (sobra > 0.001) {
          const custo = custoMap.get(itemId) ?? 0
          await criarMovimento(tx, { companyId: input.companyId, itemId, tipo: TIPO_DEVOLUCAO, quantidade: sobra, custoUnitario: custo, custoTotal: round2(sobra * custo), receiptId: input.ordemId, origem: 'MANUAL', criadoPorId: input.userId ?? null })
        }
      }
    }
    // PRODUCAO_GERACAO: o produto ENTRA no estoque com o custo REAL do lote. O custo
    // unitário vai em PRECISÃO CHEIA (não arredondado) pra qtd×custoUnit == custoLoteReal
    // exato (senão o CHECK do ledger recusa por arredondamento). O custoMedio derivado
    // arredonda na leitura (montar/round2). custoLoteReal 0 → custoUnit 0 (a definir).
    const custoUnitProduto = input.qtdGerada > 0 ? custoLoteReal / input.qtdGerada : 0
    await criarMovimento(tx, { companyId: input.companyId, itemId: ordem.itemProduzidoId, tipo: TIPO_GERACAO, quantidade: input.qtdGerada, custoUnitario: custoUnitProduto, custoTotal: custoLoteReal, receiptId: input.ordemId, origem: 'MANUAL', criadoPorId: input.userId ?? null })

    const conc = await tx.stockProducaoConclusao.create({
      data: { companyId: input.companyId, ordemId: input.ordemId, qtdGerada: input.qtdGerada, colaboradorId: input.colaboradorId ?? null, escalaConsumida, custoLoteReal, custoUnitarioReal, rendimento, validadeAte, parcial: !!input.parcial, criadoPorId: input.userId ?? null },
    })
    // ⚠️ O DESVIO É GRAVADO SEMPRE, o motivo só se o dono escreveu. Guardar só quando
    // destoa perderia a linha de base — sem os lotes normais não dá pra dizer o que é
    // "normal" depois. E o motivo fica ao lado do número: número sem porquê vira mistério.
    await tx.stockProducaoDesvio.create({
      data: {
        companyId: input.companyId, conclusaoId: conc.id, ordemId: input.ordemId,
        pctTeorico: variacao.pctTeorico ?? 0, pctMedia: variacao.pctMedia,
        lotesNaMedia: medidoAnterior.lotes,
        motivo: input.motivoDesvio?.trim() ? input.motivoDesvio.trim() : null,
        criadoPorId: input.userId ?? null,
      },
    })
    // ⛔⛔ A ORDEM LEVA AS ETAPAS ABERTAS JUNTO (06/09) — só quando ela ENCERRA de verdade.
    //
    // Era a fresta entre os dois caminhos: quem conclui pela tela de Produção não passa pelo
    // tablet, e a etapa iniciada ficava aberta **sem gesto nenhum que a resolvesse** (o
    // tablet recusa ordem encerrada, a Produção não tinha botão). O caso real ficou 7h05 em
    // aberto e aparecia no "HOJE ao vivo" como *"fazendo há 7h05"*.
    //
    // ⚠️ PARCIAL NÃO ENCERRA: a ordem segue EM_PRODUCAO e o trabalho continua — encerrar ali
    // mataria a etapa de quem ainda está com a mão na massa.
    if (!input.parcial) {
      await encerrarEtapasAbertas({ companyId: input.companyId, ordemId: input.ordemId, motivo: 'ORDEM_CONCLUIDA', userId: input.userId }, tx)
    }
    await tx.stockProductionOrder.update({ where: { id: input.ordemId }, data: { estado: input.parcial ? 'EM_PRODUCAO' : 'CONCLUIDA' } })
    return conc.id
  })

  await recomputeSaldoCache(db, input.companyId) // o cache segue os movimentos (juiz E1)
  return { conclusaoId, qtdGerada: input.qtdGerada, rendimento, escalaConsumida, custoLoteReal, custoUnitarioReal, validadeAte: validadeAte?.toISOString() ?? null, rendimentoMedioAnterior, desvio, foraDaFaixa, variacao, estado: input.parcial ? 'EM_PRODUCAO' : 'CONCLUIDA' }
}

export interface ConclusaoView {
  id: string
  qtdGerada: number
  colaboradorId: string | null
  colaboradorNome: string | null
  escalaConsumida: number
  custoLoteReal: number
  custoUnitarioReal: number | null
  rendimento: number
  validadeAte: string | null
  parcial: boolean
  criadoEm: string
}

/**
 * As conclusões de um PERÍODO (o painel), com a MESMA projeção do `listConclusoes`.
 *
 * ⚠️ EXTRAÇÃO, não conta nova: `listConclusoes` respondia só "as conclusões desta ORDEM".
 * O painel precisa de "as do período" — mesmo select, mesmo mapeamento, só o `where` muda.
 * Escrever uma segunda projeção faria a lista da ordem e a do painel divergirem no primeiro
 * campo novo.
 */
export async function conclusoesNoPeriodo(companyId: string, de: Date, ate: Date, db: PrismaClient = defaultPrisma): Promise<(ConclusaoView & { ordemId: string })[]> {
  const cs = await db.stockProducaoConclusao.findMany({
    where: { companyId, criadoEm: { gte: de, lte: ate } },
    orderBy: { criadoEm: 'desc' },
  })
  return projetarConclusoes(companyId, cs, db)
}

/** a projeção COMPARTILHADA (o corpo que era do listConclusoes) */
async function projetarConclusoes(companyId: string, cs: { id: string; ordemId: string; qtdGerada: number; colaboradorId: string | null; escalaConsumida: number; custoLoteReal: number; custoUnitarioReal: number | null; rendimento: number; validadeAte: Date | null; parcial: boolean; criadoEm: Date }[], db: PrismaClient) {
  const colabIds = [...new Set(cs.map((c) => c.colaboradorId).filter((x): x is string => !!x))]
  const colabs = colabIds.length ? await db.stockColaborador.findMany({ where: { companyId, id: { in: colabIds } }, select: { id: true, nome: true } }) : []
  const nome = new Map(colabs.map((c) => [c.id, c.nome]))
  return cs.map((c) => ({
    id: c.id, ordemId: c.ordemId, qtdGerada: c.qtdGerada, colaboradorId: c.colaboradorId,
    colaboradorNome: c.colaboradorId ? nome.get(c.colaboradorId) ?? null : null,
    escalaConsumida: c.escalaConsumida, custoLoteReal: c.custoLoteReal, custoUnitarioReal: c.custoUnitarioReal,
    rendimento: c.rendimento, validadeAte: c.validadeAte?.toISOString() ?? null,
    parcial: c.parcial, criadoEm: c.criadoEm.toISOString(),
  }))
}

export async function listConclusoes(companyId: string, ordemId: string, db: PrismaClient = defaultPrisma): Promise<ConclusaoView[]> {
  const cs = await db.stockProducaoConclusao.findMany({ where: { companyId, ordemId }, orderBy: { criadoEm: 'asc' } })
  return projetarConclusoes(companyId, cs, db)
}
