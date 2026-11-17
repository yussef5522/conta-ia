// ⭐⭐ A UNIFICAÇÃO MECÂNICA DOS GÊMEOS (16/11/2026) — só o que é IGUAL sob a régua, nunca o parecido.
//
// ⭐ O GRUPO: itens ATIVOS cujo nome dá a MESMA chave em `reguaDoNome`, na MESMA prateleira (mesma
// unidade e — categorias físicas juntas; receita de venda só com a mesma categoria). Nome igual em
// prateleiras diferentes NÃO é gêmeo: é desenho da casa (a receita PRODUTO_FINAL "COCA COLA 2L" que baixa
// a garrafa "COCA-COLA 2L"; o SABOR "BACON" que usa a matéria-prima "BACON" em KG).
// ⭐ MECÂNICO só o grupo FÍSICO (prateleira de verdade): receita de venda (PRODUTO_FINAL/SABOR) não se
// funde por item — o `mesclarItens` recusa (a cicatriz da coca, +154 de contagem no item errado) — e
// duas fichas ativas pro mesmo prato são decisão do dono (a receita pode diferir).
// ⭐ CANÔNICO: o de MAIS movimentos; desempate: saldo ≠ 0, depois o movimento mais recente.
// ⭐ A FUSÃO é a de sempre (`mesclarItens`): estorno + cópia no razão (o razão é imutável por trigger),
// mapas de nota/venda/ficha/nome aprendido repontados, o nome absorvido vira APELIDO do canônico.
// PROVA POR GRUPO: saldo somado antes = saldo do canônico depois; movimentos VIVOS preservados.
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { reguaDoNome } from '@/lib/nomes/regua-do-nome'
import { seContaFisicamente } from '../tipos-ficha'
import { saldoItem } from '../saldo'
import { mesclarItens } from './mesclar'

export interface MembroDoGrupo { id: string; nome: string; categoria: string; unidadeControle: string; movimentos: number; saldo: number; ultimo: Date | null }
export interface GrupoDeGemeos {
  chave: string
  membros: MembroDoGrupo[]
  canonico: MembroDoGrupo
  mecanico: boolean
  /** por que NÃO é mecânico (null quando é) */
  motivo: string | null
}
/** nome igual sob a régua, prateleiras diferentes — listado pra transparência, nunca tocado */
export interface NomeIgualOutraPrateleira { chave: string; membros: { nome: string; categoria: string; unidadeControle: string }[] }

const r3 = (n: number) => Math.round(n * 1000) / 1000
const prateleira = (categoria: string, unidade: string) => `${unidade}|${seContaFisicamente(categoria) ? 'FISICO' : categoria}`

/** ⭐ o canônico do grupo pela regra do dono */
export function escolherCanonico<T extends { movimentos: number; saldo: number; ultimo: Date | null }>(ms: readonly T[]): T {
  return [...ms].sort((a, b) =>
    b.movimentos - a.movimentos
    || Number(b.saldo !== 0) - Number(a.saldo !== 0)
    || (b.ultimo?.getTime() ?? 0) - (a.ultimo?.getTime() ?? 0))[0]
}

/** o saldo BRUTO do razão (todos os tipos, sem arredondar) — a régua estrita da prova */
async function saldoBruto(db: PrismaClient, companyId: string, itemId: string): Promise<number> {
  const a = await db.stockMovement.aggregate({ where: { companyId, itemId }, _sum: { quantidade: true } })
  return r3(a._sum.quantidade ?? 0)
}

/** movimentos VIVOS de um item: não-estorno e sem estorno apontando pra ele */
async function movimentosVivos(db: PrismaClient, companyId: string, itemId: string): Promise<number> {
  const ms = await db.stockMovement.findMany({ where: { companyId, itemId }, select: { id: true, tipo: true } })
  const estornados = new Set((await db.stockMovement.findMany({ where: { companyId, tipo: 'ESTORNO', estornoDeId: { in: ms.map((m) => m.id) } }, select: { estornoDeId: true } })).map((e) => e.estornoDeId))
  return ms.filter((m) => m.tipo !== 'ESTORNO' && !estornados.has(m.id)).length
}

export async function gruposDeGemeos(companyId: string, db: PrismaClient = defaultPrisma): Promise<{ grupos: GrupoDeGemeos[]; outrasPrateleiras: NomeIgualOutraPrateleira[] }> {
  const itens = await db.stockItem.findMany({ where: { companyId, ativo: true }, select: { id: true, nome: true, categoria: true, unidadeControle: true } })
  const porChave = new Map<string, typeof itens>()
  for (const i of itens) { const k = reguaDoNome(i.nome); porChave.set(k, [...(porChave.get(k) ?? []), i]) }
  const grupos: GrupoDeGemeos[] = []
  const outrasPrateleiras: NomeIgualOutraPrateleira[] = []
  for (const [chave, xs] of porChave) {
    if (xs.length < 2) continue
    const porPrat = new Map<string, typeof xs>()
    for (const x of xs) { const p = prateleira(x.categoria, x.unidadeControle); porPrat.set(p, [...(porPrat.get(p) ?? []), x]) }
    if ([...porPrat.values()].every((v) => v.length < 2)) {
      outrasPrateleiras.push({ chave, membros: xs.map((x) => ({ nome: x.nome, categoria: x.categoria, unidadeControle: x.unidadeControle })) })
      continue
    }
    for (const [p, v] of porPrat) {
      if (v.length < 2) continue
      const membros: MembroDoGrupo[] = []
      for (const m of v) {
        const [s, agg] = await Promise.all([
          saldoItem(db, companyId, m.id),
          db.stockMovement.aggregate({ where: { companyId, itemId: m.id }, _count: true, _max: { dataMovimento: true } }),
        ])
        membros.push({ ...m, movimentos: agg._count, saldo: s.saldo, ultimo: agg._max.dataMovimento })
      }
      const fisico = p.endsWith('|FISICO')
      grupos.push({
        chave, membros, canonico: escolherCanonico(membros), mecanico: fisico,
        motivo: fisico ? null : 'receita de venda com o mesmo nome — unir as fichas é decisão do dono (a receita pode diferir)',
      })
    }
  }
  grupos.sort((a, b) => a.chave.localeCompare(b.chave))
  return { grupos, outrasPrateleiras }
}

export interface ProvaDoGrupo {
  chave: string
  canonico: string
  absorvidos: string[]
  saldoAntes: number
  saldoDepois: number
  vivosAntes: number
  vivosDepois: number
  bate: boolean
}

/** ⭐ unifica UM grupo mecânico, com a prova. ⛔ Recusa grupo não mecânico. */
export async function unificarGrupo(companyId: string, g: GrupoDeGemeos, userId: string | null, db: PrismaClient = defaultPrisma): Promise<ProvaDoGrupo> {
  if (!g.mecanico) throw new Error(`grupo ${g.chave} não é mecânico: ${g.motivo}`)
  const chaves = new Set(g.membros.map((m) => reguaDoNome(m.nome)))
  // ⛔ a régua é o ÚNICO critério: nome que não dá a mesma chave nunca entra na fusão mecânica
  if (chaves.size !== 1) throw new Error(`grupo ${g.chave} mistura nomes diferentes sob a régua — fusão mecânica recusada`)
  const unidades = new Set(g.membros.map((m) => m.unidadeControle))
  if (unidades.size !== 1) throw new Error(`grupo ${g.chave} mistura unidades — somar inventaria número`)
  let saldoAntes = 0, vivosAntes = 0
  for (const m of g.membros) { saldoAntes += await saldoBruto(db, companyId, m.id); vivosAntes += await movimentosVivos(db, companyId, m.id) }
  saldoAntes = r3(saldoAntes)
  const absorvidos = g.membros.filter((m) => m.id !== g.canonico.id)
  for (const a of absorvidos) await mesclarItens({ companyId, sobreviventeId: g.canonico.id, absorvidoId: a.id, userId }, db)
  const saldoDepois = await saldoBruto(db, companyId, g.canonico.id)
  const vivosDepois = await movimentosVivos(db, companyId, g.canonico.id)
  return {
    chave: g.chave, canonico: g.canonico.nome, absorvidos: absorvidos.map((a) => a.nome),
    saldoAntes, saldoDepois, vivosAntes, vivosDepois, bate: saldoAntes === saldoDepois && vivosAntes === vivosDepois,
  }
}
