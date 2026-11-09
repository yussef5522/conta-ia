/**
 * ⭐⭐ 09/11/2026 — O MIOLO DAS FICHAS GÊMEAS: onde está a diferença, CALCULADA.
 *
 * Pedido do dono no caso real (Xis Completo: XIS COMPLETO R$ 8,39 × XIS - COMPLETO R$ 7,66,
 * as duas com 9 ingredientes): *"ver O QUE tem dentro de cada uma e ONDE está a diferença"*.
 *
 * Módulo PURO (a tela e a porta usam a mesma régua). As linhas se alinham por ITEM; igual
 * fica quieto, dose divergente mostra as duas, ingrediente de uma só ganha "só nesta".
 *
 * ⛔⛔ O INVARIANTE: Σ(diferença das linhas) == custoLote A − custoLote B, AO CENTAVO.
 * O custo do lote é `round2(Σ custoMedio × dose)` (custo-teorico.ts) — sem arredondar linha a
 * linha. Então cada diferença de linha nasce do valor EXATO e o centavo que o arredondamento
 * por linha perde vira uma linha própria, `arredondamento`, à vista — nunca some calado.
 * Se a sobra passar de meio centavo por linha, a conta NÃO fecha e `fecha` diz `false`.
 */
import { formatBRL } from '@/lib/format/money'

const round2 = (n: number) => Math.round((n + Math.sign(n) * 1e-9) * 100) / 100

export interface ComponenteDaFicha {
  itemId: string
  nome: string
  qtdPlanejada: number
  unidade: string
  /** custo médio do item (por unidade de controle); `null` = a definir */
  custoMedio: number | null
}

export interface FichaParaDiff {
  fichaId: string
  nome: string
  componentes: ComponenteDaFicha[]
  custoLote: number | null
}

export type TipoDaLinha = 'IGUAL' | 'DOSE' | 'SO_A' | 'SO_B'

export interface LadoDaLinha { qtd: number; unidade: string; custo: number | null }

export interface LinhaDoMiolo {
  itemId: string
  nome: string
  a: LadoDaLinha | null
  b: LadoDaLinha | null
  tipo: TipoDaLinha
  /** custo A − custo B desta linha (R$, 2 casas); `null` quando o item não tem custo */
  diferenca: number | null
}

export interface DiffDeFichas {
  a: { fichaId: string; nome: string }
  b: { fichaId: string; nome: string }
  linhas: LinhaDoMiolo[]
  /** custoLote A − custoLote B; `null` se alguma tem custo a definir */
  diferencaLote: number | null
  /** o centavo que o arredondamento por linha deixou (0 na maioria das vezes) */
  arredondamento: number
  /** ⛔ Σ linhas + arredondamento == diferencaLote, e a sobra é só arredondamento */
  fecha: boolean
}

/** soma as doses de um mesmo item (ficha pode repetir o item em etapas diferentes) */
function porItem(f: FichaParaDiff) {
  const m = new Map<string, { nome: string; qtd: number; unidade: string; custoMedio: number | null }>()
  for (const c of f.componentes) {
    const j = m.get(c.itemId)
    if (j) j.qtd += c.qtdPlanejada
    else m.set(c.itemId, { nome: c.nome, qtd: c.qtdPlanejada, unidade: c.unidade, custoMedio: c.custoMedio })
  }
  return m
}

export function diffDeFichas(A: FichaParaDiff, B: FichaParaDiff): DiffDeFichas {
  const ma = porItem(A)
  const mb = porItem(B)
  const ids = [...new Set([...ma.keys(), ...mb.keys()])]
  const exato: number[] = []
  const linhas: LinhaDoMiolo[] = ids.map((itemId) => {
    const x = ma.get(itemId)
    const y = mb.get(itemId)
    const custo = (z: typeof x) => (z && z.custoMedio != null ? z.custoMedio * z.qtd : null)
    const ca = custo(x)
    const cb = custo(y)
    const tipo: TipoDaLinha = !y ? 'SO_A' : !x ? 'SO_B' : Math.abs(x.qtd - y.qtd) > 1e-9 ? 'DOSE' : 'IGUAL'
    const semCusto = (x && x.custoMedio == null) || (y && y.custoMedio == null)
    const d = semCusto ? null : (ca ?? 0) - (cb ?? 0)
    if (d != null) exato.push(d)
    return {
      itemId,
      nome: (x ?? y)!.nome,
      a: x ? { qtd: x.qtd, unidade: x.unidade, custo: ca == null ? null : round2(ca) } : null,
      b: y ? { qtd: y.qtd, unidade: y.unidade, custo: cb == null ? null : round2(cb) } : null,
      tipo,
      diferenca: d == null ? null : round2(d),
    }
  })
  // ⭐ ordem: o que mais pesa na diferença primeiro; iguais por último, por nome
  linhas.sort((p, q) => (p.tipo === 'IGUAL' ? 1 : 0) - (q.tipo === 'IGUAL' ? 1 : 0)
    || Math.abs(q.diferenca ?? 0) - Math.abs(p.diferenca ?? 0) || p.nome.localeCompare(q.nome))

  const diferencaLote = A.custoLote == null || B.custoLote == null ? null : round2(A.custoLote - B.custoLote)
  const somaLinhas = round2(linhas.reduce((s, l) => s + (l.diferenca ?? 0), 0))
  const arredondamento = diferencaLote == null ? 0 : round2(diferencaLote - somaLinhas)
  const limite = 0.005 * Math.max(1, linhas.length) + 0.005
  const fecha = diferencaLote != null && Math.abs(arredondamento) <= limite
    && Math.abs(round2(somaLinhas + arredondamento) - diferencaLote) < 0.001
  return { a: { fichaId: A.fichaId, nome: A.nome }, b: { fichaId: B.fichaId, nome: B.nome }, linhas, diferencaLote, arredondamento, fecha }
}

/** ⭐ moeda pelo formatador da casa; o sinal fica de fora (o "+"/"−" é a leitura do diff) */
const brl = (n: number) => formatBRL(Math.abs(n))
const sinal = (n: number) => (n >= 0 ? '+' : '−')
const dose = (l: LadoDaLinha) => `${Number(l.qtd.toFixed(4)).toLocaleString('pt-BR')} ${l.unidade}`

/**
 * ⭐ O RESUMO DO TOPO — montado das LINHAS (não é prosa solta): "a diferença de R$ X vem de:
 * <item> (dose A × dose B) · <item> só na <ficha>". Linha com diferença zero não entra.
 */
export function resumoDoDiff(d: DiffDeFichas): string {
  if (d.diferencaLote == null) return 'uma das fichas tem custo a definir — a diferença não fecha em reais'
  const partes = d.linhas.filter((l) => l.tipo !== 'IGUAL').map((l) => {
    const v = l.diferenca == null ? 'sem custo' : `${sinal(l.diferenca)}${brl(l.diferenca)}`
    if (l.tipo === 'DOSE') return `${l.nome} (${dose(l.a!)} × ${dose(l.b!)}) ${v}`
    return `${l.nome} só na ${l.tipo === 'SO_A' ? d.a.nome : d.b.nome} ${v}`
  })
  if (Math.abs(d.arredondamento) >= 0.005) partes.push(`arredondamento ${sinal(d.arredondamento)}${brl(d.arredondamento)}`)
  const cab = `${d.a.nome} − ${d.b.nome} = ${d.diferencaLote >= 0 ? '' : '−'}${brl(d.diferencaLote)}`
  if (!partes.length) return `${cab}: mesmos ingredientes e mesmas doses`
  return `${cab} — vem de: ${partes.join(' · ')}`
}
