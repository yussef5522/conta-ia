// ⭐⭐ RECEITAS — o catálogo que se vigia (leis R17–R19 + R24 de docs/producao-receitas-referencia.html, 13/11/2026).
//
// R17: cada receita mostra ingredientes, custo/un, validade e última produção; o que falta se declara
//      na linha. Os filtros são CONTADORES VIVOS (Todas · Sem validade · Custo incompleto · Nunca
//      produzidas · Desativadas).
// R18: a ficha diz o que 1 unidade usa: ingrediente sem preço ganha ⚠ e NÃO trava a soma dos outros.
// R19: custo por UN ou por KG conforme a receita rende — nunca mistura.
// R24: EXCLUÍDA (com história) some de tudo, inclusive deste catálogo e do filtro Desativadas.
//
// ⭐ "1 UN usa" = dose da ficha ÷ rendimento MEDIDO (as últimas conclusões — a mesma régua do
//    `custoPorUnidade` da `FichaView`). Sem rendimento medido não existe "por unidade": a ficha
//    mostra a dose por receita-base e diz por quê (nunca inventa um divisor).
// LEVE: `listFichas` monta todas as views com consultas FIXAS (sem N+1) + 2 consultas de história.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { listFichas } from './fichas'
import { ehReceitaDeProducao, TIPO_RECEITA_PRODUCAO } from './tipo-receita'
import { conclusoesVigentes } from './conclusoes-vigentes'

export * from './catalogo-regua'
import { receitaDoCatalogo, passaNoFiltro, FILTROS_DO_CATALOGO, type Catalogo, type FiltroDoCatalogo } from './catalogo-regua'

export async function catalogoDeReceitas(companyId: string, db: PrismaClient = defaultPrisma): Promise<Catalogo> {
  const [views, excluidas] = await Promise.all([
    listFichas(companyId, db, { incluirInativas: true }),
    db.stockFichaExcluida.findMany({ where: { companyId }, select: { fichaId: true } }),
  ])
  const fora = new Set(excluidas.map((e) => e.fichaId))
  // ⚠️ produção = INTERMEDIARIO; a régua `ehReceitaDeProducao` some com as inativas, então o tipo é lido aqui
  const daProducao = views.filter((v) => v.tipoProduto === TIPO_RECEITA_PRODUCAO && !fora.has(v.id))
  void ehReceitaDeProducao
  const ids = daProducao.map((v) => v.id)
  const ordens = ids.length
    ? await db.stockProductionOrder.findMany({ where: { companyId, fichaId: { in: ids } }, select: { id: true, fichaId: true } })
    : []
  const conclusoes = ordens.length ? await conclusoesVigentes(companyId, { ordemIds: ordens.map((o) => o.id) }, db) : []
  const fichaDaOrdem = new Map(ordens.map((o) => [o.id, o.fichaId]))
  const lotes = new Map<string, number>(), ultima = new Map<string, Date>()
  for (const o of ordens) lotes.set(o.fichaId, (lotes.get(o.fichaId) ?? 0) + 1)
  for (const c of conclusoes) {
    const f = fichaDaOrdem.get(c.ordemId)
    if (f && (!ultima.has(f) || c.criadoEm > ultima.get(f)!)) ultima.set(f, c.criadoEm)
  }
  const receitas = daProducao
    .map((v) => receitaDoCatalogo(v, { lotes: lotes.get(v.id) ?? 0, ultima: ultima.get(v.id) ?? null }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  const contadores = Object.fromEntries(FILTROS_DO_CATALOGO.map((f) => [f, receitas.filter((r) => passaNoFiltro(r, f)).length])) as Record<FiltroDoCatalogo, number>
  return { receitas, contadores }
}
