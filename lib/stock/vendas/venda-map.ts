// ESTOQUE FASE 3 — mapa que aprende (nome Suitable → ficha|revenda) + preview do import.
// Resolve cada linha do relatório: já mapeada (ficha/revenda) ou pendente (o dono escolhe).
// Só LÊ (o preview) + upsert do mapa. A baixa (BAIXA_VENDA) é o próximo passo.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { criarFicha, fichaAtivaComNome } from '@/lib/stock/producao/fichas'
import { parseSuitable, type VendaLinhaSuitable } from './parse-suitable'

export interface LinhaResolvida extends VendaLinhaSuitable {
  mapeado: boolean
  alvoTipo: 'FICHA' | 'REVENDA' | null
  alvoId: string | null
  alvoNome: string | null
}
export interface PreviewImport {
  linhas: LinhaResolvida[]
  totalUnidades: number
  totalProdutos: number
  naoMapeados: number
  opcoes: { fichas: { id: string; nome: string; tipo: string }[]; itens: { id: string; nome: string }[] }
}

export class VendaMapError extends Error {}

export async function previewImportSuitable(companyId: string, html: string, db: PrismaClient = defaultPrisma): Promise<PreviewImport> {
  const parsed = parseSuitable(html)
  // DESTINO PERMITIDO só respeita os 3 níveis: PRODUTO_FINAL (ficha) ou REVENDA (item).
  // Matéria-prima NUNCA é destino de venda; intermediário é consumido VIA ficha, não vendido direto.
  const [mapa, fichasFinais, itensRevenda, todasFichas] = await Promise.all([
    db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true, itemId: true } }),
    db.stockFicha.findMany({ where: { companyId, ativo: true, tipoProduto: 'PRODUTO_FINAL' }, select: { id: true, itemProduzidoId: true, tipoProduto: true } }),
    db.stockItem.findMany({ where: { companyId, ativo: true, categoria: 'REVENDA' }, select: { id: true, nome: true } }),
    db.stockFicha.findMany({ where: { companyId }, select: { id: true, itemProduzidoId: true } }),
  ])
  // nomes: pra resolver o alvo de mapeamentos já existentes (mesmo se o alvo não estiver mais nas opções)
  const produzidoIds = todasFichas.map((f) => f.itemProduzidoId)
  const nomesItens = await db.stockItem.findMany({ where: { companyId, id: { in: [...new Set([...produzidoIds, ...itensRevenda.map((i) => i.id)])] } }, select: { id: true, nome: true } })
  const nomeItem = new Map(nomesItens.map((i) => [i.id, i.nome]))
  const fichaNome = new Map(todasFichas.map((f) => [f.id, nomeItem.get(f.itemProduzidoId) ?? '(produto)']))
  const fichas = fichasFinais
  const itens = itensRevenda
  const mapaPorNome = new Map(mapa.map((m) => [m.nomeSuitable, m]))

  const linhas: LinhaResolvida[] = parsed.linhas.map((l) => {
    const m = mapaPorNome.get(l.produto)
    if (!m) return { ...l, mapeado: false, alvoTipo: null, alvoId: null, alvoNome: null }
    const alvoId = m.alvoTipo === 'FICHA' ? m.fichaId : m.itemId
    const alvoNome = m.alvoTipo === 'FICHA' ? fichaNome.get(m.fichaId ?? '') ?? '(ficha removida)' : nomeItem.get(m.itemId ?? '') ?? '(item removido)'
    return { ...l, mapeado: true, alvoTipo: m.alvoTipo as 'FICHA' | 'REVENDA', alvoId: alvoId ?? null, alvoNome }
  })

  return {
    linhas,
    totalUnidades: parsed.totalUnidades,
    totalProdutos: parsed.totalProdutos,
    naoMapeados: linhas.filter((l) => !l.mapeado).length,
    opcoes: {
      fichas: fichas.map((f) => ({ id: f.id, nome: fichaNome.get(f.id) ?? '(produto)', tipo: f.tipoProduto })),
      itens: itens.map((i) => ({ id: i.id, nome: i.nome })),
    },
  }
}

/**
 * ⭐⭐⭐ UM CAMINHO SÓ: VENDA → FICHA → COMPONENTE(S) (09/09/2026) — decisão do dono.
 *
 * *"Produto vendido baixa estoque por UM mecanismo, não três. Revenda é só o caso particular
 * de ficha com 1 componente ×1. É o caminho que já cobre o caso complexo (xis, pizza, combo),
 * então os simples cabem nele — o contrário não."*
 *
 * ⛔⛔ **O `alvo REVENDA` NÃO É MAIS UM DESTINO — é um ATALHO.** Quem pede "vincula esta
 * bebida" continua com **o mesmo gesto de 1 clique**; por baixo nasce a ficha de 1 componente
 * e o mapa aponta **nela**. A experiência não muda; o caminho por dentro passa a ser um só.
 *
 * ⭐ **ESTE É O CHOKE-POINT (REGRA 5):** os três lugares que mapeavam revenda — o dropdown do
 * hub, a tela do Suitable e o lançamento manual — chamam esta função. Fechar a porta aqui
 * fecha as três de uma vez, e não há uma quarta pra alguém esquecer.
 *
 * ⚠️ `criarFicha` abre transação própria; conferido que nenhum caller chama esta função de
 * dentro de uma `$transaction` (o `lancamento-manual` usa o client de topo).
 */
export async function upsertVendaMap(companyId: string, nomeSuitable: string, alvo: { tipo: 'FICHA'; fichaId: string } | { tipo: 'REVENDA'; itemId: string }, userId?: string, db: PrismaClient = defaultPrisma) {
  // GUARD dos 3 níveis (na FONTE, não só na tela): venda só casa com PRODUTO_FINAL (ficha)
  // ou item REVENDA. Matéria-prima/intermediário NUNCA — senão cada venda baixaria insumo cru.
  //
  // ⛔⛔ NÃO UNIFIQUE COM O GUARD DE `complemento-map.ts` (02/09). Lá INTERMEDIARIO é
  // ACEITO, e não é inconsistência: complemento aponta pra ficha de SABOR (intermediário
  // por natureza, consumido pela pizza, nunca vendido solto), e a baixa de intermediário
  // consome o PACK PRONTO — não explode a receita. Aqui, aceitar intermediário faria cada
  // xis baixar carne CRUA em vez do beef pronto (o bug real de 22/08).
  // Mesma pergunta, respostas legitimamente diferentes. Unificar quebra um dos dois.
  if (alvo.tipo === 'FICHA') {
    const f = await db.stockFicha.findFirst({ where: { id: alvo.fichaId, companyId }, select: { tipoProduto: true } })
    if (!f) throw new VendaMapError('Ficha não encontrada.')
    if (f.tipoProduto !== 'PRODUTO_FINAL') throw new VendaMapError('Venda só mapeia pra ficha de PRODUTO FINAL. Intermediário é consumido pela ficha, não vendido direto.')
  } else {
    const it = await db.stockItem.findFirst({ where: { id: alvo.itemId, companyId }, select: { categoria: true } })
    if (!it) throw new VendaMapError('Item não encontrado.')
    if (it.categoria !== 'REVENDA') throw new VendaMapError('Venda só mapeia pra item de REVENDA (bebida etc.). Matéria-prima/insumo não é vendável direto.')
  }
  // ⭐⭐ REVENDA VIRA FICHA DE 1 COMPONENTE — o caminho único (09/09). Reusa a ficha que já
  // atende este nome; só cria quando não existe.
  let fichaAlvo = alvo.tipo === 'FICHA' ? alvo.fichaId : null
  if (alvo.tipo === 'REVENDA') {
    // ⛔⛔ REUSAR FICHA SÓ PELO NOME É PERIGOSO — um teste pegou isto antes de ir pra prod:
    // uma ficha homônima que baixa OUTRA COISA seria reusada, e o produto passaria a baixar
    // o item errado em silêncio (no fixture degenerado virou explosão infinita).
    // ⭐ Só reusa quando ela É o passa-direto DESTE item: 1 componente, ×1, o mesmo id.
    const ja = await fichaAtivaComNome(companyId, nomeSuitable, db)
    if (ja && !(await ehPassaDiretoDoItem(companyId, ja.fichaId, alvo.itemId, db))) {
      throw new VendaMapError(
        `Já existe uma ficha chamada “${ja.nome}” que baixa outra coisa. ` +
        'Aponte o produto nela pela tela do cardápio, ou dê outro nome — ' +
        'reusar por semelhança de nome faria a venda baixar o item errado.',
      )
    }
    fichaAlvo = ja?.fichaId ?? (await criarFicha({
      companyId, userId, nomeProduzido: nomeSuitable, unidadeProduzido: 'UN',
      tipoProduto: 'PRODUTO_FINAL', loteBase: 1, unidadeLoteBase: 'UN',
      componentes: [{ itemId: alvo.itemId, qtdPlanejada: 1, unidade: 'UN', posicao: 0 }],
      // ⚠️ aqui o nome do PDV PODE ser igual ao do item ("FANTA LARANJA 2L"), e isso é o
      // esperado neste caminho — o guard de 09/09 existe pra o dono não duplicar SEM QUERER,
      // e aqui a duplicação é a própria linha do cardápio, criada de propósito.
      permitirItemNovoComNomeDeEstoque: true,
    }, db)).fichaId
  }
  const data = { alvoTipo: 'FICHA', fichaId: fichaAlvo!, itemId: null }
  return db.stockVendaProdutoMap.upsert({
    where: { companyId_nomeSuitable: { companyId, nomeSuitable } },
    create: { companyId, nomeSuitable, ...data, criadoPorId: userId ?? null },
    update: data,
    select: { id: true },
  })
}

/** ⭐ a ficha é exatamente "aquele item ×1"? É o que autoriza reusá-la. */
async function ehPassaDiretoDoItem(companyId: string, fichaId: string, itemId: string, db: PrismaClient): Promise<boolean> {
  const f = await db.stockFicha.findFirst({ where: { id: fichaId, companyId }, select: { versaoAtual: true } })
  if (!f) return false
  const v = await db.stockFichaVersao.findFirst({ where: { fichaId, versao: f.versaoAtual }, select: { id: true } })
  if (!v) return false
  const c = await db.stockFichaComponente.findMany({ where: { versaoId: v.id }, select: { itemId: true, qtdPlanejada: true } })
  return c.length === 1 && c[0].qtdPlanejada === 1 && c[0].itemId === itemId
}

export async function removerVendaMap(companyId: string, nomeSuitable: string, db: PrismaClient = defaultPrisma) {
  await db.stockVendaProdutoMap.deleteMany({ where: { companyId, nomeSuitable } })
}
