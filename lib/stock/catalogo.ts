// ESTOQUE PARTE B — CATÁLOGO de itens. Mostra TODOS (inclusive saldo zero, que a Posição
// esconde — ela só lista quem tem movimento). Item manual nasce SEM saldo e SEM custo ("a
// definir"); saldo só por nota/produção/contagem — o ledger é a única fonte. Só LÊ.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { custoMedioPorItem, saldosDaEmpresa } from './saldo'
import { idsMesclados } from './itens/mesclar'

const CAT_LABEL: Record<string, string> = { MATERIA_PRIMA: 'Matéria-prima', REVENDA: 'Revenda', EMBALAGEM: 'Embalagem', LIMPEZA: 'Limpeza', USO_INTERNO: 'Uso interno', INTERMEDIARIO: 'Intermediário', PRODUTO_FINAL: 'Produto final', SABOR: 'Sabor' }

export interface CatalogoItem {
  id: string
  nome: string
  unidadeControle: string
  categoria: string
  categoriaLabel: string
  produzido: boolean // INTERMEDIARIO|PRODUTO_FINAL (só via ficha, não editável aqui)
  ativo: boolean
  saldo: number
  custoMedio: number | null
  /**
   * ⭐⭐ ESTA LINHA É UMA RECEITA DE VENDA, NÃO UMA COISA NA PRATELEIRA (09/09/2026).
   *
   * **O dono:** *"o invólucro aparece como linha igual às outras, 'PRODUTO FINAL via ficha ·
   * 0 UN · a definir' — parece item duplicado/quebrado, e eu mesmo levei susto achando que a
   * mescla tinha dado errado."*
   *
   * ⛔ O comportamento já estava certo (Posição, contagem e busca escondem); era o CATÁLOGO
   * mostrando a linha do cardápio com a roupa de garrafa. **"0 UN · a definir" ali não é
   * informação — é ruído que assusta**, porque receita não se estoca.
   */
  ehReceita: boolean
  /** quando a receita é passa-direto de revenda: o item que ela baixa (a garrafa) */
  baixaEm: { itemId: string; nome: string } | null
  /** quando ela tem conteúdo próprio (xis, combo): quantos componentes */
  componentes: number
  fichaId: string | null
  estoqueMin: number | null
  estoqueMax: number | null
  criadoVia: string
}

export async function listCatalogo(companyId: string, db: PrismaClient = defaultPrisma): Promise<CatalogoItem[]> {
  const [itens, saldos, custoMap, mesclados] = await Promise.all([
    db.stockItem.findMany({ where: { companyId }, orderBy: [{ ativo: 'desc' }, { nome: 'asc' }], select: { id: true, nome: true, unidadeControle: true, categoria: true, ativo: true, estoqueMin: true, estoqueMax: true, criadoVia: true } }),
    saldosDaEmpresa(db, companyId),
    custoMedioPorItem(db, companyId),
    // ⭐⭐ ITEM MESCLADO NÃO É ITEM (30/08/2026) — some daqui TAMBÉM com "mostrar
    // inativos" ligado. Era o único vazamento da varredura: arquivado volta em
    // "mostrar arquivados"; mesclado virou parte de outro e não volta em lugar nenhum.
    // A auditoria "absorveu X" vive na ficha do SOBREVIVENTE, que é onde se procura.
    idsMesclados(companyId, db),
  ])
  const saldoDe = new Map(saldos.map((s) => [s.itemId, s.saldo]))
  const visiveis = itens.filter((i) => !mesclados.has(i.id))
  const receitas = await explicarReceitas(companyId, visiveis, db)
  const nomeDe = new Map(itens.map((i) => [i.id, i.nome]))
  return visiveis.map((i) => ({
    id: i.id, nome: i.nome, unidadeControle: i.unidadeControle, categoria: i.categoria,
    categoriaLabel: CAT_LABEL[i.categoria] ?? i.categoria,
    // ⭐ SABOR também nasce de ficha → não é item manual editável no catálogo
    produzido: i.categoria === 'INTERMEDIARIO' || i.categoria === 'PRODUTO_FINAL' || i.categoria === 'SABOR',
    ativo: i.ativo, saldo: saldoDe.get(i.id) ?? 0, custoMedio: custoMap.get(i.id) ?? null,
    ehReceita: receitas.has(i.id),
    baixaEm: (() => {
      const r = receitas.get(i.id)
      return r?.baixaEm ? { itemId: r.baixaEm, nome: nomeDe.get(r.baixaEm) ?? '(item)' } : null
    })(),
    componentes: receitas.get(i.id)?.componentes ?? 0,
    fichaId: receitas.get(i.id)?.fichaId ?? null,
    estoqueMin: i.estoqueMin, estoqueMax: i.estoqueMax, criadoVia: i.criadoVia,
  }))
}

/**
 * ⭐ O QUE CADA INVÓLUCRO DE FICHA REALMENTE É — a ficha dele e o que ela baixa.
 *
 * ⚠️ `baixaEm` só existe no PASSA-DIRETO (1 componente ×1): aí a receita é *"baixa aquela
 * garrafa"* e dá pra indentar sob ela. Com vários componentes (xis, combo) não há um item pra
 * pendurar — e inventar um ("o principal") seria escolher por conta própria.
 */
async function explicarReceitas(
  companyId: string,
  itens: { id: string; categoria: string }[],
  db: PrismaClient,
): Promise<Map<string, { fichaId: string; componentes: number; baixaEm: string | null }>> {
  const alvos = itens.filter((i) => i.categoria === 'PRODUTO_FINAL' || i.categoria === 'SABOR' || i.categoria === 'INTERMEDIARIO')
  if (!alvos.length) return new Map()
  const fichas = await db.stockFicha.findMany({
    where: { companyId, itemProduzidoId: { in: alvos.map((a) => a.id) } },
    select: { id: true, itemProduzidoId: true, versaoAtual: true },
  })
  if (!fichas.length) return new Map()
  const versoes = await db.stockFichaVersao.findMany({
    where: { fichaId: { in: fichas.map((f) => f.id) } }, select: { id: true, fichaId: true, versao: true },
  })
  const comps = versoes.length
    ? await db.stockFichaComponente.findMany({
        where: { versaoId: { in: versoes.map((v) => v.id) } }, select: { versaoId: true, itemId: true, qtdPlanejada: true },
      })
    : []
  const out = new Map<string, { fichaId: string; componentes: number; baixaEm: string | null }>()
  for (const f of fichas) {
    const v = versoes.find((x) => x.fichaId === f.id && x.versao === f.versaoAtual)
    const c = v ? comps.filter((x) => x.versaoId === v.id) : []
    out.set(f.itemProduzidoId, {
      fichaId: f.id,
      componentes: c.length,
      baixaEm: c.length === 1 && c[0].qtdPlanejada === 1 ? c[0].itemId : null,
    })
  }
  return out
}
