// ⭐ A RÉGUA PURA DO CATÁLOGO DE RECEITAS (R17–R19, 13/11/2026) — sem banco: a tela e o servidor
// importam a MESMA função pra contar e filtrar. O motor (com banco) mora em catalogo-de-receitas.ts.

import type { FichaView } from './fichas'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

export type FiltroDoCatalogo = 'TODAS' | 'SEM_VALIDADE' | 'CUSTO_INCOMPLETO' | 'NUNCA_PRODUZIDAS' | 'DESATIVADAS'

export interface IngredienteDaFicha { nome: string; qtd: number; unidade: string; custo: number | null }
export interface ReceitaDoCatalogo {
  fichaId: string
  nome: string
  un: string
  ativa: boolean
  ingredientes: IngredienteDaFicha[]
  /** a soma do que TEM preço, por unidade (ou por receita-base, se `porUnidade` = false) */
  custo: number | null
  completo: boolean
  faltam: number
  /** true = doses e custo são por 1 unidade; false = sem rendimento medido, por receita-base */
  porUnidade: boolean
  /** "receita-base" quando porUnidade=false: "5 KG" */
  base: string
  validadeDias: number | null
  /** "12/11" — última conclusão vigente; null = nunca produzida */
  ultimaProducao: string | null
  /** lotes (ordens) na história — decide o destino do excluir (R24) */
  lotes: number
}

export interface Catalogo {
  receitas: ReceitaDoCatalogo[]
  contadores: Record<FiltroDoCatalogo, number>
}

const r2 = (n: number) => Math.round(n * 100) / 100

/** a receita no formato do catálogo — PURA (testável sem banco) */
export function receitaDoCatalogo(f: FichaView, hist: { lotes: number; ultima: Date | null }): ReceitaDoCatalogo {
  const rend = f.rendimentoMedio != null && f.rendimentoMedio > 0 ? f.rendimentoMedio : null
  const div = rend ?? 1
  const ingredientes = f.componentes.map((c) => ({
    nome: c.nome, unidade: c.unidade, qtd: c.qtdPlanejada / div,
    custo: c.subtotal != null ? r2(c.subtotal / div) : null,
  }))
  const comPreco = ingredientes.filter((i) => i.custo != null)
  const somado = r2(comPreco.reduce((s, i) => s + (i.custo as number), 0))
  return {
    fichaId: f.id, nome: f.nomeProduzido, un: f.unidadeProduzido, ativa: f.ativo,
    ingredientes,
    custo: ingredientes.length && comPreco.length ? somado : null,
    completo: ingredientes.length > 0 && comPreco.length === ingredientes.length,
    faltam: ingredientes.length - comPreco.length,
    porUnidade: rend != null,
    base: `${String(f.loteBase).replace('.', ',')} ${f.unidadeLoteBase}`,
    validadeDias: f.validadeDias,
    ultimaProducao: hist.ultima ? `${diaEmSaoPaulo(hist.ultima).slice(8, 10)}/${diaEmSaoPaulo(hist.ultima).slice(5, 7)}` : null,
    lotes: hist.lotes,
  }
}

/** ⭐ o filtro de cada contador — a MESMA função conta e filtra (contador que mente é pior que nenhum) */
export function passaNoFiltro(r: ReceitaDoCatalogo, f: FiltroDoCatalogo): boolean {
  if (f === 'DESATIVADAS') return !r.ativa
  if (!r.ativa) return false
  if (f === 'SEM_VALIDADE') return r.validadeDias == null
  if (f === 'CUSTO_INCOMPLETO') return !r.completo
  if (f === 'NUNCA_PRODUZIDAS') return r.ultimaProducao == null
  return true
}

export const FILTROS_DO_CATALOGO: FiltroDoCatalogo[] = ['TODAS', 'SEM_VALIDADE', 'CUSTO_INCOMPLETO', 'NUNCA_PRODUZIDAS', 'DESATIVADAS']

