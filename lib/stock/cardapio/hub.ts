// ESTOQUE — HUB DO CARDÁPIO (27/08). A casa do DONO: a lista do que SE VENDE.
//
// Estudo dos líderes (MarketMan/Apicbase): são MENU-FIRST. O hub não é a lista de fichas —
// é a lista dos PRODUTOS VENDIDOS, e a ficha é um ATRIBUTO de cada um ("tem receita?").
// Por isso a linha nasce da VENDA (o que o PDV registrou), não do cadastro: produto que
// vendeu 57× e não tem ficha PRECISA aparecer — é justamente o que falta fazer.
//
// ⭐ DECISÃO CENTRAL (REGRA 4) — O CUSTO SAI DA MESMA EXPLOSÃO QUE A VENDA USA PRA BAIXAR.
// `explodir` (de baixa-venda.ts) é reusado com qtd=1: dá exatamente os insumos que saem do
// estoque quando 1 unidade é vendida. Somar o custo médio dessas folhas é o custo do
// produto — por construção igual ao que o ledger vai baixar. Uma fórmula própria aqui
// divergiria no 1º caso de borda (componente que é outro produto final, intermediário que
// baixa o pack) e a tela mostraria margem sobre um custo que não acontece.
//
// ⚠️ POR QUE NÃO USO `calcularCustoTeorico` PRO PRODUTO FINAL: aquele divide pelo
// rendimento MEDIDO, que só existe depois de uma produção em lote. Produto montado na
// venda (xis, combo) NUNCA é produzido em lote — ficaria "a apurar" pra sempre, justamente
// nos produtos que interessam. O intermediário (beef, gessado) continua no mundo da
// produção, com rendimento medido, intocado.
//
// SÓ LÊ. Zero movimento, zero write.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { custoMedioPorItem } from '../saldo'
import { explodir, montarCtx, type Ctx } from '../vendas/baixa-venda'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export type StatusCardapio =
  | 'SEM_DESTINO' // vendeu e ninguém disse o que é (vermelho — a fila do onboarding)
  | 'SEM_FICHA' // aponta pra ficha que sumiu/desativou
  | 'REVENDA' // bebida etc: não precisa de receita, o custo vem da nota
  | 'FICHA_INCOMPLETA' // tem receita, mas algum insumo sem custo → "a definir"
  | 'FICHA_OK'

export interface LinhaCardapio {
  chave: string // ficha:<id> | item:<id> | nome:<nomeSuitable>
  nome: string
  nomesSuitable: string[] // apelidos do PDV que caem neste produto
  destinoTipo: 'FICHA' | 'REVENDA' | null
  fichaId: string | null
  itemId: string | null
  status: StatusCardapio
  vendasQtd: number
  vendasValor: number
  custoUnitario: number | null
  componentesSemCusto: number
  /** preço de cardápio: o que o dono cadastrou na ficha (revenda não tem onde guardar). */
  precoCardapio: number | null
  /** preço praticado: Σ valor ÷ Σ qtd do próprio relatório do PDV no período. */
  precoPraticado: number | null
  precoUsado: number | null
  precoOrigem: 'praticado' | 'cardapio' | null
  margem: number | null
}

export interface HubCardapio {
  linhas: LinhaCardapio[]
  periodo: { desde: string | null; ate: string | null; dias: number | null }
  /** o campeão de vendas ainda sem destino — o banner de onboarding. */
  campeaoSemFicha: { nome: string; vendasQtd: number } | null
  totais: { produtos: number; vendasQtd: number; vendasValor: number; semDestino: number; semCusto: number; prontos: number }
}

/** Custo de 1 unidade vendida = Σ (qtd que sai do estoque × custo médio do insumo).
 *  Null se QUALQUER folha ainda não tem custo — "a definir" nunca vira 0,01. */
export function custoDeUmaUnidade(
  alvo: { tipo: 'REVENDA'; itemId: string } | { tipo: 'FICHA'; fichaId: string },
  ctx: Ctx,
  custoDe: Map<string, number | null>,
): { custo: number | null; semCusto: number } {
  const folhas = new Map<string, number>()
  explodir(alvo, 1, ctx, folhas)
  let total = 0
  let semCusto = 0
  for (const [itemId, qtd] of folhas) {
    const c = custoDe.get(itemId) ?? null
    if (c == null) semCusto++
    else total += c * qtd
  }
  // ficha vazia (sem componente) não é custo zero — é ficha por fazer.
  if (folhas.size === 0) return { custo: null, semCusto: 0 }
  return { custo: semCusto > 0 ? null : round2(total), semCusto }
}

function margemDe(preco: number | null, custo: number | null): number | null {
  if (preco == null || preco <= 0 || custo == null) return null
  return round2((preco - custo) / preco)
}

export async function hubCardapio(
  companyId: string,
  opts: { dias?: number | null } = {},
  db: PrismaClient = defaultPrisma,
): Promise<HubCardapio> {
  const dias = opts.dias ?? null
  const desde = dias != null ? new Date(Date.now() - dias * 86400000) : null

  const [linhasVenda, mapa, fichas, itens, ctx, custoDe] = await Promise.all([
    db.stockVendaLinha.findMany({
      where: { companyId, ...(desde ? { data: { gte: desde } } : {}) },
      select: { nomeSuitable: true, quantidade: true, valorTotal: true, data: true },
    }),
    db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true, itemId: true } }),
    db.stockFicha.findMany({ where: { companyId, tipoProduto: 'PRODUTO_FINAL' }, select: { id: true, itemProduzidoId: true, valorVenda: true, ativo: true } }),
    db.stockItem.findMany({ where: { companyId }, select: { id: true, nome: true, categoria: true } }),
    montarCtx(companyId, db),
    custoMedioPorItem(db, companyId),
  ])

  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const fichaPorId = new Map(fichas.map((f) => [f.id, f]))
  const mapaPorNome = new Map(mapa.map((m) => [m.nomeSuitable, m]))

  // ⭐ A linha é por DESTINO, não por nome do PDV: "XIS COMPLETO" e "XIS - COMPLETO" são o
  // mesmo produto e as vendas SOMAM assim que os dois apontam pro mesmo lugar. Enquanto não
  // apontam, ficam separados — casar por semelhança de nome seria adivinhar.
  const agrup = new Map<string, LinhaCardapio>()
  const pegar = (chave: string, base: () => LinhaCardapio): LinhaCardapio => {
    const j = agrup.get(chave)
    if (j) return j
    const novo = base()
    agrup.set(chave, novo)
    return novo
  }

  for (const l of linhasVenda) {
    const m = mapaPorNome.get(l.nomeSuitable)
    let linha: LinhaCardapio
    if (!m) {
      linha = pegar(`nome:${l.nomeSuitable}`, () => ({
        chave: `nome:${l.nomeSuitable}`, nome: l.nomeSuitable, nomesSuitable: [], destinoTipo: null,
        fichaId: null, itemId: null, status: 'SEM_DESTINO', vendasQtd: 0, vendasValor: 0,
        custoUnitario: null, componentesSemCusto: 0, precoCardapio: null, precoPraticado: null,
        precoUsado: null, precoOrigem: null, margem: null,
      }))
    } else if (m.alvoTipo === 'FICHA' && m.fichaId) {
      const f = fichaPorId.get(m.fichaId)
      linha = pegar(`ficha:${m.fichaId}`, () => ({
        chave: `ficha:${m.fichaId}`, nome: f ? nomeItem.get(f.itemProduzidoId) ?? '(produto)' : '(ficha removida)',
        nomesSuitable: [], destinoTipo: 'FICHA', fichaId: m.fichaId, itemId: f?.itemProduzidoId ?? null,
        status: f ? 'FICHA_OK' : 'SEM_FICHA', vendasQtd: 0, vendasValor: 0, custoUnitario: null,
        componentesSemCusto: 0, precoCardapio: f?.valorVenda ?? null, precoPraticado: null,
        precoUsado: null, precoOrigem: null, margem: null,
      }))
    } else if (m.alvoTipo === 'REVENDA' && m.itemId) {
      linha = pegar(`item:${m.itemId}`, () => ({
        chave: `item:${m.itemId}`, nome: nomeItem.get(m.itemId!) ?? '(item removido)', nomesSuitable: [],
        destinoTipo: 'REVENDA', fichaId: null, itemId: m.itemId, status: 'REVENDA', vendasQtd: 0,
        vendasValor: 0, custoUnitario: null, componentesSemCusto: 0, precoCardapio: null,
        precoPraticado: null, precoUsado: null, precoOrigem: null, margem: null,
      }))
    } else {
      continue
    }
    linha.vendasQtd += l.quantidade
    linha.vendasValor = round2(linha.vendasValor + l.valorTotal)
    if (!linha.nomesSuitable.includes(l.nomeSuitable)) linha.nomesSuitable.push(l.nomeSuitable)
  }

  // Produto final cadastrado que ainda não vendeu (ou não está vinculado ao PDV) também é
  // cardápio — some da tela seria esconder trabalho já feito.
  for (const f of fichas) {
    if (!f.ativo) continue
    pegar(`ficha:${f.id}`, () => ({
      chave: `ficha:${f.id}`, nome: nomeItem.get(f.itemProduzidoId) ?? '(produto)', nomesSuitable: [],
      destinoTipo: 'FICHA', fichaId: f.id, itemId: f.itemProduzidoId, status: 'FICHA_OK', vendasQtd: 0,
      vendasValor: 0, custoUnitario: null, componentesSemCusto: 0, precoCardapio: f.valorVenda,
      precoPraticado: null, precoUsado: null, precoOrigem: null, margem: null,
    }))
  }

  // custo + preço + margem
  for (const linha of agrup.values()) {
    if (linha.destinoTipo === 'FICHA' && linha.fichaId && fichaPorId.has(linha.fichaId)) {
      const r = custoDeUmaUnidade({ tipo: 'FICHA', fichaId: linha.fichaId }, ctx, custoDe)
      linha.custoUnitario = r.custo
      linha.componentesSemCusto = r.semCusto
      if (r.custo == null) linha.status = 'FICHA_INCOMPLETA'
    } else if (linha.destinoTipo === 'REVENDA' && linha.itemId) {
      linha.custoUnitario = custoDe.get(linha.itemId) ?? null
      if (linha.custoUnitario == null) linha.componentesSemCusto = 1
    }
    // preço PRATICADO vem do próprio relatório do PDV — é o que o cliente pagou de fato.
    // Mesma regra do resto do sistema: quando o arquivo TRAZ o dado, usa o dado.
    linha.precoPraticado = linha.vendasQtd > 0 ? round2(linha.vendasValor / linha.vendasQtd) : null
    linha.precoUsado = linha.precoPraticado ?? linha.precoCardapio
    linha.precoOrigem = linha.precoPraticado != null ? 'praticado' : linha.precoCardapio != null ? 'cardapio' : null
    linha.margem = margemDe(linha.precoUsado, linha.custoUnitario)
  }

  const linhas = [...agrup.values()].sort((a, b) => b.vendasQtd - a.vendasQtd || a.nome.localeCompare(b.nome, 'pt-BR'))
  const semDestino = linhas.filter((l) => l.status === 'SEM_DESTINO')
  const datas = linhasVenda.map((l) => l.data.toISOString().slice(0, 10)).sort()

  return {
    linhas,
    periodo: { desde: datas[0] ?? null, ate: datas[datas.length - 1] ?? null, dias },
    campeaoSemFicha: semDestino.length ? { nome: semDestino[0].nome, vendasQtd: semDestino[0].vendasQtd } : null,
    totais: {
      produtos: linhas.length,
      vendasQtd: linhas.reduce((s, l) => s + l.vendasQtd, 0),
      vendasValor: round2(linhas.reduce((s, l) => s + l.vendasValor, 0)),
      semDestino: semDestino.length,
      semCusto: linhas.filter((l) => l.custoUnitario == null).length,
      prontos: linhas.filter(ehProntoNoCardapio).length,
    },
  }
}

/**
 * ⭐⭐ PRONTO = tem destino **E** tem custo. Uma régua só, consumida pelo CARD e pelo FILTRO
 * da tela (REGRA 4) — se cada um tivesse a sua, o card diria um número e a lista mostraria
 * outro.
 *
 * ⛔ BUG QUE ISTO MATA (02/09, o dono viu "PRONTOS −72"): a tela calculava
 * `produtos − semDestino − semCusto`. Produto sem ficha é **as duas coisas** — sem destino e
 * sem custo — então ele era subtraído DUAS VEZES: 80 − 76 − 76 = −72. Contagem de conjuntos
 * que se sobrepõem NÃO se faz por subtração; conta-se quem cumpre a condição.
 */
export function ehProntoNoCardapio(l: Pick<LinhaCardapio, 'status' | 'custoUnitario'>): boolean {
  return (l.status === 'FICHA_OK' || l.status === 'REVENDA') && l.custoUnitario != null
}

export function hubToCsv(linhas: LinhaCardapio[]): string {
  const head = ['Produto', 'Nomes no PDV', 'Situação', 'Vendas (un)', 'Vendas (R$)', 'Custo unit.', 'Preço', 'Origem do preço', 'Margem %']
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`
  const dec = (n: number | null) => (n == null ? 'a definir' : n.toFixed(2).replace('.', ','))
  const rows = linhas.map((l) => [
    l.nome, l.nomesSuitable.join(' | '), ROTULO[l.status], l.vendasQtd, dec(l.vendasValor),
    dec(l.custoUnitario), dec(l.precoUsado), l.precoOrigem ?? '—',
    l.margem != null ? String(Math.round(l.margem * 100)) : 'a definir',
  ].map(esc).join(';'))
  return [head.map(esc).join(';'), ...rows].join('\n')
}

export const ROTULO: Record<StatusCardapio, string> = {
  SEM_DESTINO: 'sem ficha',
  SEM_FICHA: 'ficha removida',
  REVENDA: 'revenda',
  FICHA_INCOMPLETA: 'ficha incompleta',
  FICHA_OK: 'ficha completa',
}
