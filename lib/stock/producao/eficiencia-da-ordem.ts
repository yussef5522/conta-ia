/**
 * ⭐⭐ A MEDIÇÃO VIROU ESPELHO — EFICIÊNCIA POR ORDEM, VISÍVEL (item 1, 03/10/2026).
 *
 * **Decisão do dono:** o rendimento saiu da conta da separação (ver `escala-da-ordem.ts`) e
 * passou a ser **relatório**: *"pedi 10 · produziu 9 → 90%, com o consumo real do lado
 * (plano × real por componente)"*.
 *
 * ⭐ **O que muda de fundo:** antes a medição era um PARÂMETRO (dividia o pedido e sumia
 * dentro da escala, invisível). Agora ela é um NÚMERO NA TELA, com nome, ao lado do que a
 * ficha prometia. **Desvio que aparece é desvio que alguém explica; desvio que vira
 * parâmetro é desvio que o sistema passa a cobrir.**
 *
 * ⚠️ E ele mede contra a **FICHA**, nunca contra a média histórica. Medir contra a média é
 * perguntar *"você produziu como costuma produzir?"* — pergunta que **sempre** responde sim,
 * porque a referência anda junto com o desvio. A pergunta que paga é *"você produziu o que a
 * receita prometia?"*.
 */

import { DESVIO_ALERTA } from './previsao-rendimento'

const round4 = (n: number) => Math.round((n + 1e-9) * 10000) / 10000

/**
 * ⭐ Os 85% que o dono pediu **são a faixa de ±15% que a casa já usa** (`DESVIO_ALERTA`, a
 * mesma do juiz P3 e do aviso de variação). Derivado, nunca digitado de novo: número solto
 * é a segunda régua no dia em que a faixa mudar.
 */
export const EFICIENCIA_MINIMA = round4(1 - DESVIO_ALERTA)

export type FaixaEficiencia = 'NORMAL' | 'ABAIXO' | 'ACIMA' | 'SEM_PEDIDO'

export interface ComponenteDaEficiencia {
  nome: string
  unidade: string
  /** o que a ficha pedia pro pedido inteiro (dose × escala) */
  plano: number
  /** o que a cozinha consumiu de verdade */
  real: number
  /** real − plano. Positivo = consumiu mais do que a receita manda. */
  gap: number
}

export interface EficienciaDaOrdem {
  /** quantas unidades a ordem pediu, **pela ficha** (escala × loteBase) */
  pedido: number | null
  /** quantas saíram de verdade */
  produzido: number
  /** produzido ÷ pedido. `null` quando não há pedido declarável. */
  pct: number | null
  faixa: FaixaEficiencia
  /**
   * ⛔ `true` SÓ no lado de baixo, e isso é escolha: render **acima** do prometido não é
   * prejuízo — é sinal de que a ficha está generosa, e isso se lê no relatório sem precisar
   * de alarme. *Alarme nos dois lados viraria alarme em todo lote, e aí ninguém lê nenhum.*
   */
  alerta: boolean
  componentes: ComponenteDaEficiencia[]
}

export interface EntradaDaEficiencia {
  escala: number
  loteBase: number
  qtdGerada: number
  componentes: { nome: string; unidade: string; dosePorLote: number; consumido: number }[]
}

/**
 * PURA. O espelho de uma ordem concluída: o que foi pedido, o que saiu, e o consumo real
 * componente a componente contra o que a receita mandava.
 *
 * ⚠️ `plano` é `dose × escala` — a MESMA conta que a separação usa (`insumoDoPedido`), não
 * uma segunda derivação: se divergissem, o relatório acusaria um gap que a separação nunca
 * produziu, e o dono iria procurar material que não faltou.
 */
export function eficienciaDaOrdem(e: EntradaDaEficiencia): EficienciaDaOrdem {
  const pedido = e.escala > 0 && e.loteBase > 0 ? round4(e.escala * e.loteBase) : null
  const pct = pedido != null && pedido > 0 ? round4(e.qtdGerada / pedido) : null

  const componentes = e.componentes.map((c) => {
    const plano = round4(c.dosePorLote * e.escala)
    return { nome: c.nome, unidade: c.unidade, plano, real: round4(c.consumido), gap: round4(c.consumido - plano) }
  })

  if (pct == null) return { pedido, produzido: e.qtdGerada, pct: null, faixa: 'SEM_PEDIDO', alerta: false, componentes }

  const faixa: FaixaEficiencia =
    pct < EFICIENCIA_MINIMA ? 'ABAIXO' : pct > 1 + DESVIO_ALERTA ? 'ACIMA' : 'NORMAL'
  return { pedido, produzido: e.qtdGerada, pct, faixa, alerta: faixa === 'ABAIXO', componentes }
}

/**
 * PURA. A frase do relatório/juiz. **DENUNCIA, não corrige** — palavras do dono.
 *
 * ⚠️ Ela nomeia o componente de maior desvio quando há um, porque *"a eficiência caiu"* sem
 * dizer onde manda o dono abrir oito ordens pra procurar. A régua de 16/09: mensagem que não
 * aponta o campo faz o dono caçar um erro que não existe.
 */
export function fraseDaEficiencia(ef: EficienciaDaOrdem, unidadeProduto: string): string | null {
  if (ef.pct == null || ef.pedido == null) return null
  const pct = Math.round(ef.pct * 100)
  const base = `pedido ${ef.pedido} ${unidadeProduto} · produziu ${ef.produzido} → ${pct}%`
  if (ef.faixa === 'NORMAL') return base
  const pior = ef.componentes
    .filter((c) => c.plano > 0)
    .reduce<ComponenteDaEficiencia | null>((m, c) => (!m || Math.abs(c.gap) > Math.abs(m.gap) ? c : m), null)
  const onde = pior && Math.abs(pior.gap) > 0.0001
    ? ` · ${pior.nome}: plano ${pior.plano} ${pior.unidade}, consumiu ${pior.real}`
    : ''
  return ef.faixa === 'ABAIXO'
    ? `${base} — saiu menos do que a receita promete${onde}`
    : `${base} — saiu mais do que a receita promete${onde}`
}
