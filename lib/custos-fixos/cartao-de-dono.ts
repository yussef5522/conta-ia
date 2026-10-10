/**
 * ⭐⭐⭐ A RÉGUA DO CARTÃO FORTE — 3 linhas, número redondo, honestidade numa linha (10/10/2026).
 *
 * **Pedido do dono (opção A):** *"cor sólida cheia, número branco — cores de vida"*, cada cartão
 * em **3 linhas**: etiqueta · NÚMERO **arredondado ao real** · UMA sub de **≤5 palavras**. E
 * *"TODOS os parágrafos dos cartões MORREM e viram UMA linha miúda sob os 4"*, com o resto
 * atrás de um ⓘ — *"honestidade guardada, não gritada"*.
 *
 * ⛔⛔ **POR QUE ESTA RÉGUA MORA AQUI E NÃO NO JSX:** o projeto roda em `environment: node`,
 * sem jsdom — *regra que mora num `value={...}` é regra que ninguém prova* (a lição do prefill
 * do cardápio, que quebrou duas vezes antes de virar função). Aqui a sub tem contagem de
 * palavra conferida, o número tem o "sem centavos" EXECUTADO, e o texto do ⓘ é dado.
 *
 * ⛔ **ZERO CONTA DE DINHEIRO.** O valor vem pronto do `cartoesDoTopo`; este arquivo só
 * FORMATA e monta frase. O arredondamento é de **EXIBIÇÃO** — os centavos continuam vivos no
 * `cheio`, que vai pro tooltip (a mesma régua do pão em 27/08: *o ledger guarda precisão
 * cheia, quem arredonda é a leitura*).
 */

import { pctBR as pctBRLocal } from '@/lib/format/percentual'

const BRL_REDONDO = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})
const BRL_CHEIO = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** ⭐ as 4 famílias que têm cartão — o par `solid`/`on`/`on-soft` existe só pra elas */
export type FamiliaDoCartao = 'indigo' | 'azul' | 'verde' | 'coral'
export type QualCartao = 'conta' | 'porDia' | 'equilibrio' | 'afundar'

export interface ValorDoCartao {
  /** o que o cartão IMPRIME: `R$ 193.083` — sem centavos */
  curto: string
  /** o que o tooltip guarda: `R$ 193.082,50` — o centavo não se perde, só sai da frente */
  cheio: string
}

/**
 * ⭐ O NÚMERO REDONDO, e o centavo guardado.
 *
 * ⚠️ `Math.round` ANTES do formatador: sem isso o `Intl` com `maximumFractionDigits: 0`
 * arredondaria ele mesmo, e o `curto` passaria a depender da régua interna do `Intl` em vez
 * da nossa — o teste trava o `.50` subindo pro real de cima.
 */
export function valorDoCartao(valor: number | null): ValorDoCartao | null {
  if (valor == null || !Number.isFinite(valor)) return null
  return { curto: BRL_REDONDO.format(Math.round(valor)), cheio: BRL_CHEIO.format(valor) }
}

/**
 * ⭐ AS SUBS — ≤5 palavras, no tom claro da família.
 *
 * ⚠️ Três delas são as palavras do dono; a do **porDia** é derivada da sub que a tela já
 * mostrava (*"quanto isso come por dia, parado"*) encurtada pra caber na régua — ele deu três
 * exemplos pros quatro cartões, e inventar tom novo aqui seria escrever por ele.
 */
export const SUB_DO_CARTAO: Record<QualCartao, string> = {
  conta: 'a casa come isso parada',
  porDia: 'isso por dia, parado',
  equilibrio: 'venda/dia que paga o mês',
  afundar: 'acima disso, sobra de verdade',
}

/** ⚠️ o teto que o guard cobra — 5 palavras, as palavras do dono */
export const MAX_PALAVRAS_DA_SUB = 5

/**
 * ⚠️ `pctBR` MUDOU DE CASA em 10/10 (pra `lib/format/percentual.ts`) e é RE-EXPORTADO daqui:
 * a pergunta *"como se escreve percentual"* é do PROJETO, não deste módulo — a tela de Margem
 * precisou da MESMA régua no mesmo dia, e a 4ª cópia nasceria lá. Os importadores de sempre
 * seguem funcionando sem saber que ela mudou de lugar (o padrão do `ehSaborDeVerdade`).
 */
export { pctBR } from '@/lib/format/percentual'

export function palavrasDaSub(sub: string): number {
  return sub.trim().split(/\s+/).filter(Boolean).length
}

/** ⭐ a família de cada cartão — num lugar só, pra a tela não escolher cor na mão */
export const FAMILIA_DO_CARTAO: Record<QualCartao, FamiliaDoCartao> = {
  conta: 'indigo',
  porDia: 'azul',
  equilibrio: 'verde',
  afundar: 'coral',
}

/**
 * ⭐⭐ A LINHA MIÚDA SOB OS 4 — o que era 4 parágrafos.
 *
 * *"margem 47,7% (CMV por compra) · 31 dias corridos · como eu conto ⓘ"*
 *
 * ⚠️ Margem **`null` não vira 0%** — vira *"margem a apurar"*, e o porquê vai pro ⓘ. A régua
 * do *"a apurar"* vale aqui igual ao resto da casa: percentual inventado numa tela de preço é
 * decisão errada tomada com cara de número.
 */
export function linhaDeHonestidade(e: {
  margemPct: number | null
  dias: number
}): string {
  const margem =
    e.margemPct == null
      ? 'margem a apurar'
      : `margem ${pctBRLocal(e.margemPct)} (CMV por compra)`
  return `${margem} · ${e.dias} dias corridos`
}

export interface ExplicacaoDoPopover {
  titulo: string
  texto: string
}

/**
 * ⭐⭐ O QUE O ⓘ ABRE — as explicações completas que saíram dos cartões.
 *
 * ⛔ **Nada se perde: cada parágrafo que morreu na frente do dono está aqui.** *"Honestidade
 * guardada, não gritada"* é guardar, não jogar fora — e por isso o guard confere que o texto
 * do CMV e o do calendário continuam existindo em algum lugar da tela.
 */
export function explicacoesDoPopover(e: {
  margemPct: number | null
  margemPorque: string | null
  margemRessalva: string
  margemConta: string | null
  dias: number
  diasRotulo: string
  contaDosChips: string | null
  foraDaConta: string | null
  porqueDoAfundar: string | null
}): ExplicacaoDoPopover[] {
  const out: ExplicacaoDoPopover[] = []

  out.push({
    titulo: 'a margem',
    texto:
      e.margemPct == null
        ? `margem a apurar — ${e.margemPorque ?? 'sem dado suficiente na janela'}`
        : `${e.margemConta ?? ''} · ${e.margemRessalva}`.trim(),
  })

  out.push({ titulo: 'o calendário', texto: e.diasRotulo })

  if (e.contaDosChips) out.push({ titulo: 'a composição', texto: e.contaDosChips })
  if (e.foraDaConta) out.push({ titulo: 'o que ficou fora', texto: e.foraDaConta })
  if (e.porqueDoAfundar) out.push({ titulo: 'pra não afundar', texto: e.porqueDoAfundar })

  return out
}
