// ESTOQUE FASE 2 item 2.4 — SUGESTÃO de produção (min/max) + CARDÁPIO/MARGEM. A sugestão
// olha itens PRODUZIDOS (têm ficha) com saldo < mínimo e propõe "produzir ~N pra voltar ao
// máximo" (o "Sugestão de Produção" do Vuca). A margem é do PRODUTO_FINAL: valorVenda −
// custo, "a definir" quando falta (NUNCA 0,01). Custo = custoMedio real do produzido (do
// ledger) OU o teórico da ficha se ainda não produziu. Só LÊ.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { custoMedioPorItem, saldosDaEmpresa } from '../saldo'
import { calcularMargem } from './custo-teorico'
import { rendimentoMedioDaFicha } from './conclusao'

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface SugestaoProducao {
  fichaId: string
  itemProduzidoId: string
  nome: string
  unidade: string
  saldo: number
  estoqueMin: number
  estoqueMax: number | null
  faltam: number // (max ?? min) − saldo, em unidades do produto
  escalaSugerida: number | null // faltam / rendimentoMedio (null = a apurar → escala 1)
  rendimentoMedio: number | null
}

/** Itens produzidos (com ficha ATIVA) cujo saldo caiu abaixo do mínimo. */
export async function sugestoesDeProducao(companyId: string, db: PrismaClient = defaultPrisma): Promise<SugestaoProducao[]> {
  const fichas = await db.stockFicha.findMany({ where: { companyId, ativo: true }, select: { id: true, itemProduzidoId: true } })
  if (!fichas.length) return []
  const produzidoIds = fichas.map((f) => f.itemProduzidoId)
  const [itens, saldos] = await Promise.all([
    db.stockItem.findMany({ where: { companyId, id: { in: produzidoIds } }, select: { id: true, nome: true, unidadeControle: true, estoqueMin: true, estoqueMax: true } }),
    saldosDaEmpresa(db, companyId),
  ])
  const saldoDe = new Map(saldos.map((s) => [s.itemId, s.saldo]))
  const metaDe = new Map(itens.map((i) => [i.id, i]))

  const out: SugestaoProducao[] = []
  for (const f of fichas) {
    const it = metaDe.get(f.itemProduzidoId)
    if (!it || it.estoqueMin == null) continue // sem mínimo definido → sem sugestão
    const saldo = saldoDe.get(f.itemProduzidoId) ?? 0
    if (saldo >= it.estoqueMin) continue // acima do mínimo → ok
    const alvo = it.estoqueMax ?? it.estoqueMin
    const faltam = round2(alvo - saldo)
    if (faltam <= 0) continue
    const rendimentoMedio = await rendimentoMedioDaFicha(companyId, f.id, db)
    const escalaSugerida = rendimentoMedio && rendimentoMedio > 0 ? round2(faltam / rendimentoMedio) : null
    out.push({ fichaId: f.id, itemProduzidoId: f.itemProduzidoId, nome: it.nome, unidade: it.unidadeControle, saldo, estoqueMin: it.estoqueMin, estoqueMax: it.estoqueMax, faltam, escalaSugerida, rendimentoMedio })
  }
  return out.sort((a, b) => a.saldo / a.estoqueMin - b.saldo / b.estoqueMin) // mais crítico primeiro
}

export interface CardapioItem {
  fichaId: string
  itemProduzidoId: string
  nome: string
  unidade: string
  custoUnitario: number | null // custoMedio real do produzido (ledger) OU teórico da ficha
  custoOrigem: 'real' | 'teorico' | null
  valorVenda: number | null // null = a definir (NUNCA 0,01)
  margem: number | null
}

/** Cardápio: PRODUTO_FINAL com custo, preço e margem. "a definir" agrupado no topo (cobra). */
export async function cardapio(companyId: string, db: PrismaClient = defaultPrisma): Promise<CardapioItem[]> {
  const fichas = await db.stockFicha.findMany({ where: { companyId, tipoProduto: 'PRODUTO_FINAL' }, select: { id: true, itemProduzidoId: true, valorVenda: true, versaoAtual: true } })
  if (!fichas.length) return []
  const [itens, custoReal] = await Promise.all([
    db.stockItem.findMany({ where: { companyId, id: { in: fichas.map((f) => f.itemProduzidoId) } }, select: { id: true, nome: true, unidadeControle: true } }),
    custoMedioPorItem(db, companyId),
  ])
  const metaDe = new Map(itens.map((i) => [i.id, i]))

  const out: CardapioItem[] = []
  for (const f of fichas) {
    const it = metaDe.get(f.itemProduzidoId)
    if (!it) continue
    // custo: real (do ledger) se já produziu; senão teórico da ficha (Σ componente × qtd / rendimento — indisponível sem rendimento → null)
    const real = custoReal.get(f.itemProduzidoId) ?? null
    const custoUnitario = real
    const custoOrigem: CardapioItem['custoOrigem'] = real != null ? 'real' : null
    out.push({ fichaId: f.id, itemProduzidoId: f.itemProduzidoId, nome: it.nome, unidade: it.unidadeControle, custoUnitario, custoOrigem, valorVenda: f.valorVenda, margem: calcularMargem(f.valorVenda, custoUnitario) })
  }
  // "a definir" (sem preço) no topo, depois por menor margem
  return out.sort((a, b) => {
    if ((a.valorVenda == null) !== (b.valorVenda == null)) return a.valorVenda == null ? -1 : 1
    return (a.margem ?? 999) - (b.margem ?? 999)
  })
}

export function cardapioToCsv(itens: CardapioItem[]): string {
  const head = ['Produto', 'Custo unit.', 'Preço de venda', 'Margem %']
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`
  const dec = (n: number | null) => (n == null ? 'a definir' : n.toFixed(2).replace('.', ','))
  const rows = itens.map((i) => [i.nome, dec(i.custoUnitario), dec(i.valorVenda), i.margem != null ? `${Math.round(i.margem * 100)}` : 'a definir'].map(esc).join(';'))
  return [head.map(esc).join(';'), ...rows].join('\n')
}
