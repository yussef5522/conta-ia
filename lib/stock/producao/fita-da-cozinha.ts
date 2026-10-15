/**
 * ⭐⭐ A FITA DA COZINHA — o bloco 4 da mesa ② (15/10/2026).
 *
 * **Irmã de `lib/balance/fita-do-dia.ts`** (a fita do dashboard): MÓDULO PURO, zero banco, zero
 * relógio. Ela TRADUZ os eventos que o `diaAoVivo` já leu — ⛔ **evento que não existe na porta
 * é proibido**: a união de tipos (`INICIOU` · `FINALIZOU` · `DESIGNOU`) é a do `diaAoVivo`, e
 * inventar um quarto aqui não compila.
 *
 * ⛔⛔ **O RELÓGIO É INJETADO** (`hora`), nunca lido aqui. ⚠️ Módulo puro que chama `new Date()`
 * passa a dar respostas diferentes em instantes diferentes e nenhum teste consegue travá-lo —
 * e, pior, na virada do dia ele discordaria da própria mesa sobre que dia é hoje.
 */

import type { EventoDoDia } from './dia-ao-vivo'

export interface EventoDaFitaDaCozinha {
  id: string
  /** ⛔ número morto é proibido: a linha leva pra a ordem; sem ordem, pra a lista do dia */
  href: string
  hora: string
  texto: string
}

/** ⭐ a frase do vazio — *"a cozinha ainda não registrou nada hoje"*, nunca uma fita em branco */
export const fraseDaFitaDaCozinhaVazia = 'a cozinha ainda não registrou nada hoje'

const qtd = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

export function fitaDaCozinha(i: {
  empresaId: string
  eventos: EventoDoDia[]
  /** ⚠️ INJETADO: quem sabe formatar hora no fuso do Brasil é quem tem o relógio */
  hora: (d: Date) => string
}): EventoDaFitaDaCozinha[] {
  return i.eventos.map((e, idx) => ({
    /**
     * ⚠️ A CHAVE INCLUI O ÍNDICE porque o `EventoDoDia` não tem id próprio — ele é derivado
     * (iniciou/finalizou/designou da MESMA etapa viram eventos distintos). Chave só por
     * `ordemId + tipo` colidiria em produção PARCIAL, e o React reusaria a linha errada.
     */
    id: `${idx}:${e.tipo}:${e.ordemId ?? '-'}`,
    href: e.ordemId
      ? `/empresas/${i.empresaId}/estoque/producao/${e.ordemId}`
      : `/empresas/${i.empresaId}/estoque/producao`,
    hora: i.hora(e.quando),
    texto: textoDoEvento(e, qtd),
  }))
}

/**
 * ⭐ O TEXTO DIZ O DESFECHO, não só o verbo — a referência escreve *"porção calabresa ✓✓
 * corrigida · 107 → 127 UN · lucas"*.
 *
 * ⛔⛔ E o **"✓✓ corrigida"** só aparece quando o dado diz que houve correção: o `rotulo` vem do
 * resolvedor único de estado da etapa (`estado-da-etapa.ts`), nunca de uma régua nova aqui —
 * era a tela derivando o próprio estado que fazia *"na fila"* sobreviver numa ordem concluída.
 */
function textoDoEvento(e: EventoDoDia, fmt: (n: number) => string): string {
  const lote = e.loteFechado
    ? ` · ${fmt(e.loteFechado.qtdGerada)} ${e.loteFechado.unidade}`
    : ''
  const quem = e.quem ? ` · ${e.quem}` : ''
  if (e.tipo === 'FINALIZOU') return `${e.texto} ✓✓${lote}${quem}`
  if (e.tipo === 'INICIOU') return `${e.texto} começou${quem}`
  return `${e.texto}${quem}`
}
