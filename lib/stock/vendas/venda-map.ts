// ESTOQUE FASE 3 — mapa que aprende (nome Suitable → ficha|revenda) + preview do import.
// Resolve cada linha do relatório: já mapeada (ficha/revenda) ou pendente (o dono escolhe).
// Só LÊ (o preview) + upsert do mapa. A baixa (BAIXA_VENDA) é o próximo passo.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
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

export async function upsertVendaMap(companyId: string, nomeSuitable: string, alvo: { tipo: 'FICHA'; fichaId: string } | { tipo: 'REVENDA'; itemId: string }, userId?: string, db: PrismaClient = defaultPrisma) {
  // GUARD dos 3 níveis (na FONTE, não só na tela): venda só casa com PRODUTO_FINAL (ficha)
  // ou item REVENDA. Matéria-prima/intermediário NUNCA — senão cada venda baixaria insumo cru.
  if (alvo.tipo === 'FICHA') {
    const f = await db.stockFicha.findFirst({ where: { id: alvo.fichaId, companyId }, select: { tipoProduto: true } })
    if (!f) throw new VendaMapError('Ficha não encontrada.')
    if (f.tipoProduto !== 'PRODUTO_FINAL') throw new VendaMapError('Venda só mapeia pra ficha de PRODUTO FINAL. Intermediário é consumido pela ficha, não vendido direto.')
  } else {
    const it = await db.stockItem.findFirst({ where: { id: alvo.itemId, companyId }, select: { categoria: true } })
    if (!it) throw new VendaMapError('Item não encontrado.')
    if (it.categoria !== 'REVENDA') throw new VendaMapError('Venda só mapeia pra item de REVENDA (bebida etc.). Matéria-prima/insumo não é vendável direto.')
  }
  const data = alvo.tipo === 'FICHA'
    ? { alvoTipo: 'FICHA', fichaId: alvo.fichaId, itemId: null }
    : { alvoTipo: 'REVENDA', itemId: alvo.itemId, fichaId: null }
  return db.stockVendaProdutoMap.upsert({
    where: { companyId_nomeSuitable: { companyId, nomeSuitable } },
    create: { companyId, nomeSuitable, ...data, criadoPorId: userId ?? null },
    update: data,
    select: { id: true },
  })
}

export async function removerVendaMap(companyId: string, nomeSuitable: string, db: PrismaClient = defaultPrisma) {
  await db.stockVendaProdutoMap.deleteMany({ where: { companyId, nomeSuitable } })
}
