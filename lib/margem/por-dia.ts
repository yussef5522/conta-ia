/**
 * ⭐⭐ A SOBRA POR DIA — o que alimenta a linha de chegada e o PLACAR do dia D (07/10/2026).
 *
 * ⛔⛔ **POR QUE NÃO RODO O HUB UMA VEZ POR DIA:** `hubCardapio` faz várias consultas (vendas,
 * mapa, ignorados, fichas, itens, ctx, custo médio) e montar o ctx já percorre TODAS as
 * fichas. Um mês = 31 execuções disso numa tela que o dono abre todo dia — é literalmente a
 * doença dos **4.909 ms / 1.786 consultas** de 28/09 (o `for (…) await versaoView(…)`).
 *
 * ⭐ A sobra/un do PERÍODO × as unidades DAQUELE dia dá a sobra do dia, com **UMA** execução
 * do hub. ⚠️ E isso tem uma consequência que fica declarada: preço e custo são a média do
 * PERÍODO, não do dia. É o honesto possível — o custo médio do insumo é, ele próprio,
 * derivado do ledger inteiro, então não existe "o custo daquele dia" pra buscar.
 *
 * ⚠️ Função PURA.
 */
import type { ProdutoComSobra } from './sobra'

export interface LinhaDeVendaDoDia {
  /** YYYY-MM-DD */
  dia: string
  nomeSuitable: string
  quantidade: number
}

export interface SobraDeUmDia {
  dia: string
  sobra: number
  unidades: number
  /** unidades vendidas no dia que estão FORA da obra (sem custo) — a cobertura do dia */
  unidadesFora: number
}

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

/**
 * ⭐ `nomesPorChave` vem do hub (`linha.nomesSuitable`): um produto tem N apelidos do PDV, e
 * **é por isso que o mapa é nome → chave, nunca chave → nome** — o `XIS COMPLETO` e o
 * `XIS - COMPLETO` caem no mesmo tijolo.
 */
export function sobraPorDia(
  linhas: readonly LinhaDeVendaDoDia[],
  dentro: readonly ProdutoComSobra[],
  nomesPorChave: ReadonlyMap<string, readonly string[]>,
): SobraDeUmDia[] {
  const sobraUnPorNome = new Map<string, number>()
  for (const p of dentro) {
    for (const n of nomesPorChave.get(p.chave) ?? []) sobraUnPorNome.set(n, p.sobraUn)
  }

  const porDia = new Map<string, { sobra: number; un: number; fora: number }>()
  for (const l of linhas) {
    const acc = porDia.get(l.dia) ?? { sobra: 0, un: 0, fora: 0 }
    const s = sobraUnPorNome.get(l.nomeSuitable)
    if (s == null) {
      // ⛔ produto fora da obra NÃO entra na sobra do dia — entra na cobertura, nomeado.
      // Contá-lo como zero diria "este produto não deixou nada", que é uma afirmação falsa.
      acc.fora += l.quantidade
    } else {
      acc.sobra += s * l.quantidade
      acc.un += l.quantidade
    }
    porDia.set(l.dia, acc)
  }

  return [...porDia]
    .map(([dia, a]) => ({ dia, sobra: round2(a.sobra), unidades: a.un, unidadesFora: a.fora }))
    .sort((a, b) => a.dia.localeCompare(b.dia))
}

/**
 * ⭐⭐ O CUSTO DE COMPLEMENTO POR DIA — e esta atribuição é HONESTA porque é TEMPORAL.
 *
 * ⛔ O relatório de complementos **não diz a qual produto** cada ocorrência pertenceu (sem
 * campo de tamanho nem de produto-pai) — por isso o custo não vira tijolo. **Mas ele diz o
 * DIA**, e o dia é o que o placar precisa. Ratear por data é ler um campo que existe; ratear
 * por produto seria inventar um que não existe.
 *
 * ⚠️ Ocorrência sem ficha entra em `semCusto`, nunca como zero — o custo do dia é um PISO.
 */
export function custoComplementoPorDia(
  linhas: readonly { dia: string; nomeSuitable: string; ocorrencias: number }[],
  custoPorNome: ReadonlyMap<string, number | null>,
): Map<string, { custo: number; comCusto: number; semCusto: number }> {
  const m = new Map<string, { custo: number; comCusto: number; semCusto: number }>()
  for (const l of linhas) {
    const a = m.get(l.dia) ?? { custo: 0, comCusto: 0, semCusto: 0 }
    const c = custoPorNome.get(l.nomeSuitable)
    if (c == null) a.semCusto += l.ocorrencias
    else {
      a.custo = round2(a.custo + c * l.ocorrencias)
      a.comCusto += l.ocorrencias
    }
    m.set(l.dia, a)
  }
  return m
}

/**
 * ⭐ O acumulado que o placar percorre pra achar o 1º dia em que a casa se pagou.
 *
 * ⛔⛔ **É O LÍQUIDO** (sobra do dia − complemento do dia). Com o bruto o placar acenderia
 * cedo: medido em prod, o transbordo bruto (R$ 26.823,28) é MENOR que o custo de complemento
 * do período (R$ 35.700,53) — ou seja, a casa que parecia paga **não está**.
 */
export function acumular(
  dias: readonly SobraDeUmDia[],
  complementoPorDia?: ReadonlyMap<string, { custo: number }>,
): { dia: string; acumulado: number }[] {
  let acc = 0
  return [...dias]
    .sort((a, b) => a.dia.localeCompare(b.dia))
    .map((d) => {
      acc = round2(acc + d.sobra - (complementoPorDia?.get(d.dia)?.custo ?? 0))
      return { dia: d.dia, acumulado: acc }
    })
}
