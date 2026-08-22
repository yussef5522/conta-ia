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

export async function previewImportSuitable(companyId: string, html: string, db: PrismaClient = defaultPrisma): Promise<PreviewImport> {
  const parsed = parseSuitable(html)
  const [mapa, fichas, itens] = await Promise.all([
    db.stockVendaProdutoMap.findMany({ where: { companyId }, select: { nomeSuitable: true, alvoTipo: true, fichaId: true, itemId: true } }),
    db.stockFicha.findMany({ where: { companyId, ativo: true }, select: { id: true, itemProduzidoId: true, tipoProduto: true } }),
    db.stockItem.findMany({ where: { companyId, ativo: true }, select: { id: true, nome: true } }),
  ])
  const nomeItem = new Map(itens.map((i) => [i.id, i.nome]))
  const fichaNome = new Map(fichas.map((f) => [f.id, nomeItem.get(f.itemProduzidoId) ?? '(produto)']))
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
