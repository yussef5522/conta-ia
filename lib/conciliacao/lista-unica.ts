/**
 * ⭐⭐⭐ UMA LISTA SÓ — A ARQUITETURA FINAL DA CONCILIAÇÃO (23/09/2026).
 *
 * **A decisão do dono:** *"toda linha do banco mora na CAIXA. O caso dela — palpite 1↔1,
 * lote 1×N, ambíguo, N:M — renderiza DENTRO do cartão ≍ da própria linha. As seções
 * PRONTOS PRA CONFIRMAR e PRA TUA MÃO deixam de ser seções com cartões próprios."*
 *
 * ⛔ O que isto mata é a última forma da doença de 20/09: *"mesma pergunta em duas casas =
 * 2 modelos pra mim"*. Lá o problema era o mesmo PAR em duas superfícies; aqui é a mesma
 * PERGUNTA (*"o que esta linha do banco é?"*) em duas listas.
 *
 * ⚠️⚠️ **E A LISTA É MAIS LARGA QUE A CAIXA DE HOJE — isto foi MEDIDO, não suposto.** Os
 * **14 cards** de *"pra tua mão"* em prod têm a linha **fora** da caixa: elas já estão
 * **categorizadas** (`Matéria-Prima - Alimentos`), então `estacaoDaLinha` as manda pro
 * ARQUIVO. ⭐ É a régua de 07/09 — ***"ter categoria não quita conta nenhuma"*** — e é
 * justamente por isso que aquela seção existia. **Colapsar sem carregá-las perderia R$
 * 2.120,81 · 2.275,05 · 3.510,78 … de trabalho real**, que é o desfecho proibido:
 * *duplicar é feio; sumir é perder trabalho*.
 *
 * ⭐ Então a régua da lista é: **está na CAIXA, ou tem CASO ABERTO**. A linha que entra só
 * pelo caso vem **marcada** (`soPeloCaso`), pro dono saber por que ela está ali.
 */
import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { lerCaixa, paraLei, type LinhaCrua } from './leitura-da-caixa'
import { estacaoDaLinha } from './caixa-de-entrada'

/** o que decide QUAL painel renderiza dentro do cartão ≍ da linha */
export type TipoDoCaso = 'PALPITE' | 'LOTE' | 'ESCOLHA' | 'AMBIGUO'

export interface CasoNaLinha {
  tipo: TipoDoCaso
  /** ⭐ só a linha ANFITRIÃ desenha o painel; as outras apontam pra ela */
  hospeda: boolean
  /** o nome do caso, pro "parte do caso «X» acima ↑" */
  nome?: string
  /** a âncora (#id) da linha anfitriã, pro ponteiro ser um CAMINHO e não uma ordem */
  ancora?: string
}

export interface LinhaDaLista {
  id: string
  /**
   * ⚠️ a linha entrou **só** por ter caso aberto (a estação dela é ARQUIVO).
   * ⛔ Sem este campo a tela não teria como dizer *por quê* ela está na lista, e uma linha
   * já categorizada aparecendo do nada parece defeito.
   */
  soPeloCaso: boolean
  caso: CasoNaLinha | null
}

/**
 * ⭐⭐ OS FILTROS DO TOPO — e eles são a MESMA lista, recortada.
 *
 * ⛔ *"O contador e a lista LEEM DA MESMA FONTE"* (ordem do dono). Um contador com consulta
 * própria é como o badge do menu passou meses dizendo um número e a tela outro (10/09).
 */
export type FiltroDaLista = 'TUDO' | 'PRONTOS' | 'MAO'

/**
 * ⭐ PRONTO = o sistema já sabe o que propor (palpite 1↔1 ou lote fechado).
 * ⭐ MÃO = precisa da escolha do dono (N:M que não fecha, ambíguo).
 *
 * ⚠️ Linha SEM caso nenhum não entra em nenhum dos dois — ela aparece só em TUDO. Forçá-la
 * num balde faria o contador prometer trabalho pronto que não existe.
 */
export function passaNoFiltro(l: Pick<LinhaDaLista, 'caso'>, f: FiltroDaLista): boolean {
  if (f === 'TUDO') return true
  if (!l.caso) return false
  // ⛔ só a ANFITRIÃ conta: a 2ª linha do caso é um ponteiro, não um trabalho a mais
  if (!l.caso.hospeda) return false
  return f === 'PRONTOS'
    ? l.caso.tipo === 'PALPITE' || l.caso.tipo === 'LOTE'
    : l.caso.tipo === 'ESCOLHA' || l.caso.tipo === 'AMBIGUO'
}

/** ⭐ os contadores saem da MESMA lista que a tela desenha — nunca de uma 2ª consulta */
export function contadoresDaLista(linhas: readonly Pick<LinhaDaLista, 'caso'>[]) {
  return {
    tudo: linhas.length,
    prontos: linhas.filter((l) => passaNoFiltro(l, 'PRONTOS')).length,
    mao: linhas.filter((l) => passaNoFiltro(l, 'MAO')).length,
  }
}

/**
 * ⭐⭐ QUAIS LINHAS A TELA MOSTRA — a régua, pura e testável.
 *
 * @param naCaixa ids cuja estação é CAIXA
 * @param casos  por linha: o caso dela (de qualquer família)
 */
export function linhasDaLista(
  todas: readonly { id: string }[],
  naCaixa: ReadonlySet<string>,
  casos: ReadonlyMap<string, CasoNaLinha>,
): LinhaDaLista[] {
  const out: LinhaDaLista[] = []
  for (const r of todas) {
    const caso = casos.get(r.id) ?? null
    const dentro = naCaixa.has(r.id)
    // ⛔ fora da caixa E sem caso = arquivo de verdade; entrar aqui seria ressuscitar 358
    // linhas já resolvidas e afogar o trabalho que sobrou
    if (!dentro && !caso) continue
    out.push({ id: r.id, soPeloCaso: !dentro, caso })
  }
  return out
}

/** ⚠️ só leitura — quem monta o payload é a rota da caixa (uma porta) */
export async function idsNaCaixa(
  companyId: string, db: PrismaClient = defaultPrisma,
): Promise<{ rows: LinhaCrua[]; naCaixa: Set<string> }> {
  const { rows } = await lerCaixa(companyId, db)
  return { rows, naCaixa: new Set(rows.filter((r) => estacaoDaLinha(paraLei(r)) === 'CAIXA').map((r) => r.id)) }
}
