// ⭐⭐ TRÊS ESTADOS, TRÊS APARÊNCIAS — sem promoção silenciosa de um pro outro (01/09/2026).
//
// Regra do dono, e cada metade tem motivo:
//   MEDIDA   (≥2 lotes) → % COLORIDO.  **Cor é JULGAMENTO** — só a régua medida julga.
//   TEORICO  (0-1 lote) → "≈N% do teórico" em CINZA. Referência, não julgamento.
//   SEM_DADO (fóssil)   → NADA.
//
// ⚠️ POR QUE O FÓSSIL FICA DE FORA, e é a condição que mais importa: recalcular um lote
// antigo com a régua de hoje produz FICÇÃO. O lote de 21/08 ("porção de carne") é de outra
// FAMÍLIA de receita — componentes de **1 KG** com `loteBase` 1, ou seja, a quantidade
// escrita é a do LOTE INTEIRO, não a de uma porção. Recalculado hoje ele dá **2500%**, não
// porque rendeu 25×, mas porque a ficha dele é de antes do padrão "por unidade".
//
// ⭐ E o mecanismo não precisou de coluna nova: `stock_producao_desvio` já congela
// `pctTeorico`/`pctMedia`/`lotesNaMedia` **no instante da conclusão**. Quem não tem linha
// lá é anterior ao sprint — e não ganha selo. O corte cai sozinho no lugar certo.

import { describe, it, expect } from 'vitest'
import { estadoDoSelo } from '../painel-producao'
import { MIN_LOTES_PARA_MEDIA } from '../previsao-rendimento'

describe('⭐⭐ os três estados do selo', () => {
  it('⭐ MEDIDA — com 2+ lotes e pctMedia, o selo ganha COR (é julgamento)', () => {
    expect(estadoDoSelo({ pctTeorico: 0.98, pctMedia: 0.92, lotesNaMedia: 4 })).toBe('MEDIDA')
    expect(estadoDoSelo({ pctTeorico: 0.98, pctMedia: 0.92, lotesNaMedia: MIN_LOTES_PARA_MEDIA })).toBe('MEDIDA')
  })

  it('⚪ TEORICO — com 0 ou 1 lote, é CINZA: referência, não julgamento', () => {
    // ⚠️ os 7 lotes de 01/09 caem todos aqui — primeira produção de cada receita.
    expect(estadoDoSelo({ pctTeorico: 1.01, pctMedia: null, lotesNaMedia: 0 })).toBe('TEORICO')
    expect(estadoDoSelo({ pctTeorico: 0.72, pctMedia: 0.72, lotesNaMedia: 1 })).toBe('TEORICO')
  })

  it('⛔⛔ SEM_DADO — lote sem desvio gravado NÃO ganha selo nenhum', () => {
    // é o fóssil de 21/08. Recalcular por cima daria 2500%.
    expect(estadoDoSelo(null)).toBe('SEM_DADO')
  })

  it('⛔ e desvio gravado SEM pctTeorico também não vira selo (não inventa)', () => {
    expect(estadoDoSelo({ pctTeorico: null, pctMedia: null, lotesNaMedia: 0 })).toBe('SEM_DADO')
  })
})

describe('⛔⛔ nenhuma promoção silenciosa entre os estados', () => {
  it('⛔⛔ 1 lote NÃO vira MEDIDA só porque tem pctMedia preenchido', () => {
    // ⚠️ o `pctMedia` existe com 1 lote (o `avaliarVariacao` calcula), mas 1 medição não é
    // média. Sem esta trava, o 2º lote de cada receita já apareceria colorido — julgando
    // contra uma "média" de uma amostra só.
    expect(estadoDoSelo({ pctTeorico: 0.9, pctMedia: 0.9, lotesNaMedia: 1 })).toBe('TEORICO')
  })

  it('⛔⛔ SEM_DADO nunca vira TEORICO por recálculo — a ausência é a resposta', () => {
    // a régua olha SÓ o congelado. Não há caminho de `null` pra outro estado.
    expect(estadoDoSelo(null)).toBe('SEM_DADO')
    expect(estadoDoSelo(null)).not.toBe('TEORICO')
  })

  it('⭐ a fronteira é exatamente MIN_LOTES_PARA_MEDIA, não um número solto', () => {
    expect(estadoDoSelo({ pctTeorico: 1, pctMedia: 1, lotesNaMedia: MIN_LOTES_PARA_MEDIA - 1 })).toBe('TEORICO')
    expect(estadoDoSelo({ pctTeorico: 1, pctMedia: 1, lotesNaMedia: MIN_LOTES_PARA_MEDIA })).toBe('MEDIDA')
  })
})

describe('⚠️ o caso real que motivou a condição 2', () => {
  it('⚠️ o fóssil de 21/08 daria 2500% se fosse recalculado — e por isso não é', () => {
    // "porção de carne 100g": componentes de 1 KG cada (o LOTE inteiro), loteBase 1.
    // escala consumida 1 → esperado teórico 1 → saíram 25.
    const recalculoIngenuo = 25 / (1 * 1)
    expect(recalculoIngenuo).toBe(25) // 2500%
    // ⭐ mas ele não tem linha em stock_producao_desvio → SEM_DADO, e nada é mostrado.
    expect(estadoDoSelo(null)).toBe('SEM_DADO')
  })

  it('⭐ enquanto os lotes de 01/09 (família proporcional) dão números sãos', () => {
    // medidos em prod: 101%, 72%, 135%, 104%, 130%, 91%, 93%
    for (const pct of [1.01, 0.72, 1.35, 1.04, 1.3, 0.91, 0.93]) {
      expect(estadoDoSelo({ pctTeorico: pct, pctMedia: null, lotesNaMedia: 0 })).toBe('TEORICO')
      expect(Math.round(pct * 100)).toBeGreaterThan(50)
      expect(Math.round(pct * 100)).toBeLessThan(200)
    }
  })
})
