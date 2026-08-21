// ESTOQUE FASE 2 item 2.0 — custo teórico da ficha, AO VIVO (fonte única). custoTeorico =
// Σ(componente.custoMedio × qtd) / rendimentoMedio. NUNCA gravado fixo — recalcula quando a
// NF muda o custo do insumo. Se algum componente não tem custo → "a definir" (NUNCA 0,01).
// Sem rendimento (0 produções concluídas) → custo do lote existe, mas por-unidade "a apurar".

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

export interface ComponenteCusto { custoMedio: number | null; qtdPlanejada: number }

export interface CustoTeoricoResult {
  custoLote: number | null // Σ dos componentes no lote base; null se algum sem custo ("a definir")
  custoPorUnidade: number | null // custoLote / rendimentoMedio; null se falta custo OU rendimento
  custoADefinir: boolean // há componente sem custoMedio
  semRendimento: boolean // ainda não há rendimento médio (a apurar)
  componentesSemCusto: number
}

export function calcularCustoTeorico(componentes: ComponenteCusto[], rendimentoMedio: number | null): CustoTeoricoResult {
  const semCusto = componentes.filter((c) => c.custoMedio == null)
  const custoADefinir = semCusto.length > 0
  const custoLote = custoADefinir ? null : round2(componentes.reduce((s, c) => s + (c.custoMedio ?? 0) * c.qtdPlanejada, 0))

  const semRendimento = rendimentoMedio == null || rendimentoMedio <= 0
  const custoPorUnidade = custoLote != null && !semRendimento ? round2(custoLote / (rendimentoMedio as number)) : null

  return { custoLote, custoPorUnidade, custoADefinir, semRendimento, componentesSemCusto: semCusto.length }
}

/** Margem de PRODUTO_FINAL: (valorVenda − custoUnitario) / valorVenda. "a definir" quando falta. */
export function calcularMargem(valorVenda: number | null, custoPorUnidade: number | null): number | null {
  if (valorVenda == null || valorVenda <= 0 || custoPorUnidade == null) return null
  return round2((valorVenda - custoPorUnidade) / valorVenda)
}
