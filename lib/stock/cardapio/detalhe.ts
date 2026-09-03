// ESTOQUE — DETALHE DO PRODUTO no hub do cardápio (27/08). "Cliquei no Xis Completo".
//
// Responde o que o dono pergunta olhando um produto: quanto vendeu · quanto custa · qual a
// margem · a receita está completa? · e o que FALTA pra conseguir vender (insumo sem saldo,
// intermediário sem estoque produzido → botão [produzir agora]).
//
// O custo vem do hub (mesma explosão da baixa de venda). Aqui só acrescento, POR COMPONENTE,
// o que a tela precisa pra mostrar o caminho: tem saldo? é produzido? qual a ficha dele?
//
// SÓ LÊ.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { saldosDaEmpresa } from '../saldo'
import { hubCardapio, type LinhaCardapio } from './hub'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface ComponenteProduto {
  itemId: string
  nome: string
  unidade: string
  qtdPorUnidade: number // quanto sai do estoque por 1 unidade vendida
  custoMedio: number | null
  subtotal: number | null
  saldo: number
  /** o componente é PRODUZIDO (tem ficha) → dá pra "produzir agora" quando faltar */
  fichaIdComponente: string | null
  tipoComponente: 'INSUMO' | 'INTERMEDIARIO' | 'PRODUTO_FINAL'
  /** quantas unidades do produto dá pra fazer com o saldo atual deste componente */
  rendeAte: number | null
}

export interface DetalheProduto {
  linha: LinhaCardapio
  /** componentes da ficha (1º nível — o que a receita lista, não a explosão inteira) */
  componentes: ComponenteProduto[]
  /** limite de produção: o componente mais escasso manda */
  podeFazer: number | null
  gargalo: { nome: string; rendeAte: number } | null
  loteBase: number | null
  validadeDias: number | null
  versaoAtual: number | null
}

/** Chave do hub: `ficha:<id>` | `item:<id>` | `nome:<nomeSuitable>`. */
export function parseChave(chave: string): { tipo: 'ficha' | 'item' | 'nome'; valor: string } | null {
  const i = chave.indexOf(':')
  if (i < 0) return null
  const tipo = chave.slice(0, i)
  const valor = chave.slice(i + 1)
  if (tipo !== 'ficha' && tipo !== 'item' && tipo !== 'nome') return null
  return { tipo, valor }
}


/**
 * ⛔⛔ A CHAVE É UM LINK — E LINK NÃO PODE APODRECER (03/09/2026).
 *
 * CASO REAL: o dono montou a receita da **PIZZA FAMILIA 45CM** pela tela do produto. A
 * gravação deu certo (o produto voltou vinculado), mas no meio do caminho a tela abriu
 * **"Produto não encontrado no cardápio"**. Motivo: a chave do hub **MUDA quando o produto
 * ganha destino** — `nome:PIZZA FAMILIA 45CM` vira `ficha:<id>` — e a página recarregava
 * com a chave VELHA, que não casava mais em `l.chave === chave`.
 *
 * ⚠️ SUCESSO DISFARÇADO DE ERRO é irmão do "salvo" que mentia, e é pior de conviver:
 * *se toda gravação mostra um erro falso, a pessoa para de acreditar nos erros de verdade.*
 *
 * ⭐ A CURA É RESOLVER POR IDENTIDADE, NÃO POR IGUALDADE DE STRING: `nome:X` acha a linha
 * que atende X **seja qual for o destino dela hoje**. Isso conserta junto o link salvo nos
 * favoritos, o F5 depois de mapear uma bebida (`nome:` → `item:`) e qualquer outro caminho
 * em que o destino do produto mude entre uma visita e outra.
 */
export function acharLinhaPorChave<T extends { chave: string; nome: string; nomesSuitable: string[]; fichaId: string | null; itemId: string | null }>(
  linhas: T[], chave: string,
): T | undefined {
  const exata = linhas.find((l) => l.chave === chave)
  if (exata) return exata

  const alvo = parseChave(chave)
  if (!alvo) return undefined
  if (alvo.tipo === 'nome') {
    // ⚠️ compara com os nomes do PDV **e** com o nome exibido: a linha pode ter virado
    // `ficha:`/`item:` desde que o link foi criado.
    return linhas.find((l) => l.nomesSuitable.includes(alvo.valor) || l.nome === alvo.valor)
  }
  if (alvo.tipo === 'ficha') return linhas.find((l) => l.fichaId === alvo.valor)
  return linhas.find((l) => l.itemId === alvo.valor)
}

export async function detalheProduto(
  companyId: string,
  chave: string,
  db: PrismaClient = defaultPrisma,
): Promise<DetalheProduto | null> {
  const hub = await hubCardapio(companyId, {}, db)
  const linha = acharLinhaPorChave(hub.linhas, chave)
  if (!linha) return null

  if (linha.destinoTipo !== 'FICHA' || !linha.fichaId) {
    // revenda e "sem destino" não têm receita — a tela mostra o caminho de mapear/criar.
    return { linha, componentes: [], podeFazer: null, gargalo: null, loteBase: null, validadeDias: null, versaoAtual: null }
  }

  const ficha = await db.stockFicha.findFirst({ where: { id: linha.fichaId, companyId }, select: { id: true, versaoAtual: true } })
  if (!ficha) return { linha, componentes: [], podeFazer: null, gargalo: null, loteBase: null, validadeDias: null, versaoAtual: null }

  const versao = await db.stockFichaVersao.findFirst({ where: { companyId, fichaId: ficha.id, versao: ficha.versaoAtual } })
  const comps = versao
    ? await db.stockFichaComponente.findMany({ where: { companyId, versaoId: versao.id }, orderBy: { posicao: 'asc' } })
    : []

  const itemIds = comps.map((c) => c.itemId)
  const [itens, fichasComp, saldos] = await Promise.all([
    itemIds.length ? db.stockItem.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true, nome: true, unidadeControle: true, categoria: true } }) : Promise.resolve([]),
    itemIds.length ? db.stockFicha.findMany({ where: { companyId, ativo: true, itemProduzidoId: { in: itemIds } }, select: { id: true, itemProduzidoId: true, tipoProduto: true } }) : Promise.resolve([]),
    saldosDaEmpresa(db, companyId),
  ])
  const meta = new Map(itens.map((i) => [i.id, i]))
  const fichaDoItem = new Map(fichasComp.map((f) => [f.itemProduzidoId, f]))
  const saldoDe = new Map(saldos.map((s) => [s.itemId, s.saldo]))
  const custoDe = new Map(saldos.map((s) => [s.itemId, s.custoMedio]))

  // ⚠️ a ficha é escrita PRO LOTE BASE; o cardápio fala por UNIDADE VENDIDA. Quando o lote
  // base é 1 (o caso do xis/combo, montado na venda) os dois coincidem — que é como a
  // explosão da venda já trata. Divido pelo lote pra a tela não mentir em ficha de lote > 1.
  const lote = versao?.loteBase && versao.loteBase > 0 ? versao.loteBase : 1

  const componentes: ComponenteProduto[] = comps.map((c) => {
    const m = meta.get(c.itemId)
    const fc = fichaDoItem.get(c.itemId)
    const custoMedio = custoDe.get(c.itemId) ?? null
    const qtdPorUnidade = round2(c.qtdPlanejada / lote)
    const saldo = saldoDe.get(c.itemId) ?? 0
    return {
      itemId: c.itemId,
      nome: m?.nome ?? '(item removido)',
      unidade: c.unidade,
      qtdPorUnidade,
      custoMedio,
      subtotal: custoMedio != null ? round2(custoMedio * qtdPorUnidade) : null,
      saldo,
      fichaIdComponente: fc?.id ?? null,
      tipoComponente: fc ? (fc.tipoProduto === 'PRODUTO_FINAL' ? 'PRODUTO_FINAL' : 'INTERMEDIARIO') : 'INSUMO',
      rendeAte: qtdPorUnidade > 0 ? Math.floor(saldo / qtdPorUnidade) : null,
    }
  })

  // o gargalo: quantas unidades dá pra montar hoje. Null se a receita está vazia.
  let podeFazer: number | null = null
  let gargalo: { nome: string; rendeAte: number } | null = null
  for (const c of componentes) {
    if (c.rendeAte == null) continue
    if (podeFazer == null || c.rendeAte < podeFazer) { podeFazer = c.rendeAte; gargalo = { nome: c.nome, rendeAte: c.rendeAte } }
  }

  return { linha, componentes, podeFazer, gargalo, loteBase: versao?.loteBase ?? null, validadeDias: versao?.validadeDias ?? null, versaoAtual: ficha.versaoAtual }
}
