/**
 * ⭐⭐ O TRILHO DE STATUS DA ORDEM — virou barra de progresso (05/10/2026).
 *
 * **Ordem do dono (v4):** *"TRILHO DE STATUS vira barra de progresso: 4 segmentos (Planejada ·
 * Separada · Em produção · Concluída), pintados de índigo até o estado atual com ✓ nos passados,
 * apagados nos futuros."*
 *
 * ⛔⛔ **POR QUE É LIB E NÃO UM `map` NO JSX:** *"qual é o passo atual?"* é a MESMA pergunta que
 * a página já respondia num `indexOf` solto, e o **CANCELADA** é a borda que quebra qualquer
 * versão ingênua — ela não é "o 5º passo", ela é a ordem **saindo do trilho**. Com a decisão
 * numa função pura, o estado novo (se houver) entra aqui e as telas herdam; com ela no JSX, a
 * próxima tela escreve a 2ª régua e uma delas pinta errado.
 */

/** ⚠️ a ordem É a sequência — ela não se reordena por conveniência de layout */
export const PASSOS_DA_ORDEM = ['PLANEJADA', 'SEPARADA', 'EM_PRODUCAO', 'CONCLUIDA'] as const
export type PassoDaOrdem = (typeof PASSOS_DA_ORDEM)[number]

export const ROTULO_DO_PASSO: Record<PassoDaOrdem, string> = {
  PLANEJADA: 'Planejada',
  SEPARADA: 'Separada',
  EM_PRODUCAO: 'Em produção',
  CONCLUIDA: 'Concluída',
}

export interface SegmentoDoTrilho {
  passo: PassoDaOrdem
  rotulo: string
  /** ⭐ já passou: pintado + ✓ */
  feito: boolean
  /** ⭐ é o estado de agora: pintado, sem ✓ (o ✓ diria que acabou) */
  atual: boolean
  /** ⚠️ futuro: apagado — e NUNCA com ✓ (seria prometer o que não aconteceu) */
  futuro: boolean
}

export interface TrilhoDaOrdem {
  /** ⛔ `false` quando a ordem saiu do trilho (CANCELADA) — a tela não desenha barra nenhuma */
  mostrar: boolean
  segmentos: SegmentoDoTrilho[]
  /** quantos dos 4 já estão pintados (feitos + o atual) — pro `aria-valuenow` */
  pintados: number
}

/**
 * PURA. O trilho de um estado.
 *
 * ⛔⛔ **CANCELADA NÃO É UM PASSO.** Ela é a ordem saindo do trilho, e pintar 1 de 4 segmentos
 * nela diria *"está no começo"* pra uma ordem que acabou. A tela mostra o selo "Cancelada" e
 * **nenhuma barra** — é o mesmo tratamento que o stepper antigo já dava, agora com dono.
 *
 * ⚠️ Estado DESCONHECIDO (um estado novo no banco que a tela ainda não conhece) também não
 * inventa posição: devolve o trilho inteiro apagado em vez de chutar o 1º passo. *Chutar aqui
 * faria a barra afirmar um progresso que ninguém mediu.*
 */
export function trilhoDaOrdem(estado: string): TrilhoDaOrdem {
  const i = (PASSOS_DA_ORDEM as readonly string[]).indexOf(estado)
  if (estado === 'CANCELADA' || i < 0) {
    return {
      mostrar: false,
      segmentos: PASSOS_DA_ORDEM.map((passo) => ({
        passo, rotulo: ROTULO_DO_PASSO[passo], feito: false, atual: false, futuro: true,
      })),
      pintados: 0,
    }
  }
  return {
    mostrar: true,
    segmentos: PASSOS_DA_ORDEM.map((passo, k) => ({
      passo,
      rotulo: ROTULO_DO_PASSO[passo],
      feito: k < i,
      atual: k === i,
      futuro: k > i,
    })),
    pintados: i + 1,
  }
}
