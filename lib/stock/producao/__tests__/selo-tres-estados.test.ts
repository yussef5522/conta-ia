// ⭐⭐ O SELO DO LOTE — ERAM TRÊS ESTADOS, VIRARAM DOIS (01/09/2026 → 03/10/2026).
//
// **O mundo de 01/09**, que este arquivo guardava:
//   MEDIDA   (≥2 lotes) → % COLORIDO.  **Cor é JULGAMENTO** — só a régua medida julga.
//   TEORICO  (0-1 lote) → "≈N% do teórico" em CINZA. Referência, não julgamento.
//   SEM_DADO (fóssil)   → NADA.
//
// ⛔⛔⛔ **A DECISÃO DO DONO EM 03/10 APAGOU A FRONTEIRA ENTRE OS DOIS PRIMEIROS:**
// *"receita é lei, rendimento é só relatório"*. O `MEDIDA` julgava o lote **contra a própria
// média da ficha** — pergunta que sempre responde SIM, porque a referência anda junto com o
// desvio. O que o selo diz agora é **eficiência contra a RECEITA**, e a receita é régua desde
// o PRIMEIRO lote: não existe mais "ainda não tenho régua pra julgar".
//
//   FICHA    (tem desvio congelado) → % contra o que a receita promete. É julgamento.
//   SEM_DADO (fóssil)               → NADA.
//
// ⚠️ **As asserções foram INVERTIDAS, não apagadas** — cada uma abaixo diz o que exigia antes.
//
// ⭐⭐ **E A CONDIÇÃO QUE MAIS IMPORTA NÃO MUDOU UMA LINHA:** o fóssil continua sem selo.
// Recalcular um lote antigo com a régua de hoje produz FICÇÃO — o lote de 21/08 ("porção de
// carne") é de outra FAMÍLIA de receita (componentes de **1 KG** com `loteBase` 1, ou seja a
// quantidade escrita é a do LOTE INTEIRO) e daria **2500%**. O julgamento fica congelado em
// `stock_producao_desvio` no instante da conclusão; quem não tem linha lá, não tem selo.

import { describe, it, expect } from 'vitest'
import { estadoDoSelo } from '../painel-producao'
import { MIN_LOTES_PARA_MEDIA } from '../previsao-rendimento'

describe('⭐⭐ os dois estados do selo', () => {
  it('⛔⛔ FICHA — basta o desvio congelado, SEM exigir 2 lotes (era MEDIDA/TEORICO)', () => {
    /**
     * ⚠️ Antes: `{pctTeorico: 0.98, pctMedia: 0.92, lotesNaMedia: 4}` → `MEDIDA`, e com
     * `lotesNaMedia: 0` → `TEORICO` (cinza, sem julgamento). **Os dois viram FICHA**, porque
     * o que julga é a receita e ela não precisa de histórico.
     */
    expect(estadoDoSelo({ pctTeorico: 0.98, pctMedia: 0.92, lotesNaMedia: 4 })).toBe('FICHA')
    expect(estadoDoSelo({ pctTeorico: 1.01, pctMedia: null, lotesNaMedia: 0 })).toBe('FICHA')
    expect(estadoDoSelo({ pctTeorico: 0.72, pctMedia: 0.72, lotesNaMedia: 1 })).toBe('FICHA')
  })

  it('⛔⛔ SEM_DADO — lote sem desvio gravado NÃO ganha selo nenhum (INTOCADO)', () => {
    // é o fóssil de 21/08. Recalcular por cima daria 2500%.
    expect(estadoDoSelo(null)).toBe('SEM_DADO')
  })

  it('⛔ e desvio gravado SEM pctTeorico também não vira selo (não inventa)', () => {
    expect(estadoDoSelo({ pctTeorico: null, pctMedia: null, lotesNaMedia: 0 })).toBe('SEM_DADO')
  })
})

describe('⛔⛔ o que NÃO mudou: a ausência continua sendo a resposta', () => {
  it('⛔⛔ SEM_DADO nunca vira FICHA por recálculo — a régua olha SÓ o congelado', () => {
    expect(estadoDoSelo(null)).toBe('SEM_DADO')
    expect(estadoDoSelo(null)).not.toBe('FICHA')
  })

  it('⛔⛔ e `pctMedia` deixou de ter QUALQUER poder sobre o selo', () => {
    /**
     * ⭐ A prova de que a média saiu do caminho: com `pctTeorico` fixo, mexer em `pctMedia` e
     * em `lotesNaMedia` não muda o selo. Era exatamente o contrário — eles decidiam.
     */
    const base = { pctTeorico: 0.9 }
    expect(estadoDoSelo({ ...base, pctMedia: null, lotesNaMedia: 0 })).toBe('FICHA')
    expect(estadoDoSelo({ ...base, pctMedia: 0.9, lotesNaMedia: 1 })).toBe('FICHA')
    expect(estadoDoSelo({ ...base, pctMedia: 0.9, lotesNaMedia: 99 })).toBe('FICHA')
  })

  it('⛔ a fronteira de MIN_LOTES_PARA_MEDIA não governa mais o SELO (só o espelho)', () => {
    /**
     * ⚠️ A constante CONTINUA viva e com o mesmo valor — ela é o que impede um lote único de
     * ser chamado de "a sua média" no **espelho** (`eficienciaMedia`). O que ela perdeu foi o
     * poder de decidir se o lote é julgado ou não.
     */
    expect(MIN_LOTES_PARA_MEDIA).toBe(2)
    expect(estadoDoSelo({ pctTeorico: 1, pctMedia: 1, lotesNaMedia: MIN_LOTES_PARA_MEDIA - 1 })).toBe('FICHA')
    expect(estadoDoSelo({ pctTeorico: 1, pctMedia: 1, lotesNaMedia: MIN_LOTES_PARA_MEDIA })).toBe('FICHA')
  })
})

describe('⚠️ o caso real que motivou a condição do fóssil', () => {
  it('⚠️ o fóssil de 21/08 daria 2500% se fosse recalculado — e por isso não é', () => {
    // "porção de carne 100g": componentes de 1 KG cada (o LOTE inteiro), loteBase 1.
    // escala consumida 1 → esperado pela ficha 1 → saíram 25.
    const recalculoIngenuo = 25 / (1 * 1)
    expect(recalculoIngenuo).toBe(25) // 2500%
    // ⭐ mas ele não tem linha em stock_producao_desvio → SEM_DADO, e nada é mostrado.
    expect(estadoDoSelo(null)).toBe('SEM_DADO')
  })

  it('⭐ e os lotes de 01/09 (família proporcional) ganham selo desde o 1º — isso é o ganho', () => {
    /**
     * ⭐⭐ **Aqui a inversão vale dinheiro.** Estes 7 eram a 1ª produção de cada receita e
     * ficavam em CINZA, *"referência, não julgamento"* — inclusive o de **72%**, que é
     * exatamente o tipo de lote que o dono quer ver denunciado. Com a receita como régua, o
     * 72% acusa no dia em que acontece, e não no 3º lote.
     */
    for (const pct of [1.01, 0.72, 1.35, 1.04, 1.3, 0.91, 0.93]) {
      expect(estadoDoSelo({ pctTeorico: pct, pctMedia: null, lotesNaMedia: 0 })).toBe('FICHA')
      expect(Math.round(pct * 100)).toBeGreaterThan(50)
      expect(Math.round(pct * 100)).toBeLessThan(200)
    }
  })
})
