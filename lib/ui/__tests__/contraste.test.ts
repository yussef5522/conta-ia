/**
 * ⭐ O MEDIDOR DE CONTRASTE — e o que importa aqui é o AUTO-TESTE dele.
 *
 * ⚠️ Um medidor de acessibilidade errado é pior que nenhum: ele dá **selo verde** pra texto
 * ilegível. Então antes de ele julgar token nenhum, ele é julgado contra valores que o WCAG
 * define por construção (preto/branco = 21:1, cor com ela mesma = 1:1) e contra os números que
 * a casa já mediu e escreveu no CLAUDE.md em 10/10.
 */
import { describe, it, expect } from 'vitest'
import {
  carregaTextoBranco,
  luminancia,
  PISO_TEXTO_NORMAL,
  razao,
  razaoBR,
} from '@/lib/ui/contraste'

describe('⭐ as âncoras que o WCAG define por construção', () => {
  it('⭐ preto sobre branco é 21:1 (o máximo possível)', () => {
    expect(razao('#000000', '#ffffff')).toBeCloseTo(21, 1)
  })

  it('⭐ cor com ela mesma é 1:1 — nada é legível sobre si', () => {
    expect(razao('#4F46E5', '#4F46E5')).toBeCloseTo(1, 5)
  })

  it('⭐ a razão é SIMÉTRICA — quem chama não pode errar a ordem', () => {
    expect(razao('#0A0F1E', '#ffffff')).toBeCloseTo(razao('#ffffff', '#0A0F1E'), 10)
  })

  it('⭐ branco e preto nas pontas da luminância', () => {
    expect(luminancia('#ffffff')).toBeCloseTo(1, 5)
    expect(luminancia('#000000')).toBeCloseTo(0, 5)
  })

  it('⭐ aceita #RGB, #RRGGBB e sem o #, em qualquer caixa', () => {
    expect(luminancia('#fff')).toBeCloseTo(luminancia('#FFFFFF'), 10)
    expect(luminancia('ffffff')).toBeCloseTo(luminancia('#ffffff'), 10)
    expect(luminancia('#4f46e5')).toBeCloseTo(luminancia('#4F46E5'), 10)
  })

  /**
   * ⛔⛔ O QUE ESTE TESTE IMPEDE: um token malformado (vazio, `rgb(...)`, `var(--x)`) virando
   * `NaN` e o `NaN >= 4.5` dando `false`… ou, pior, entrando numa comparação invertida e dando
   * **verde**. Medidor de acessibilidade que engole lixo é selo verde de graça.
   */
  it('⛔⛔ lixo ESTOURA em vez de virar NaN silencioso', () => {
    for (const ruim of ['', '#12', '#1234567', 'rgb(0,0,0)', 'var(--prod-bg)', 'azul']) {
      expect(() => luminancia(ruim), `"${ruim}" tinha que estourar`).toThrow()
    }
  })
})

describe('⭐⭐ os números que a CASA já mediu — o medidor tem que reproduzi-los', () => {
  /** ⭐ 10/10: *"branco sobre #92400e = 7,09:1"* (o chão âmbar dos custos fixos) */
  it('⭐ o chão âmbar da casa: branco = 7,09:1', () => {
    expect(razao('#ffffff', '#92400e')).toBeCloseTo(7.09, 1)
  })

  /** ⛔ 10/10: o `-mid` cru REPROVA — foi a medição que mudou o desenho dos 4 cartões */
  it('⛔⛔ os tons médios de 10/10 seguem REPROVANDO com branco', () => {
    for (const [nome, mid] of [
      ['verde', '#0f9d58'],
      ['coral', '#e5484d'],
    ] as const) {
      const r = razao('#ffffff', mid)
      expect(r, `${nome} ${r.toFixed(2)}:1 tinha que reprovar`).toBeLessThan(PISO_TEXTO_NORMAL)
      expect(carregaTextoBranco(mid), `${nome} não carrega branco`).toBe(false)
    }
  })
})

describe('⭐ L7 virada função — "sólido só com chão"', () => {
  it('⭐ chão 700+ carrega branco; tom médio não', () => {
    // os chãos da referência nova
    expect(carregaTextoBranco('#07654A')).toBe(true) // verde-chão
    expect(carregaTextoBranco('#9F2D25')).toBe(true) // coral-chão
    // os tons médios da MESMA família
    expect(carregaTextoBranco('#0E9F6E')).toBe(false) // verde
    expect(carregaTextoBranco('#E2544A')).toBe(false) // coral
    expect(carregaTextoBranco('#D97706')).toBe(false) // âmbar
  })
})

describe('⭐ a língua do dono', () => {
  it('⭐ pt-BR com vírgula e o sufixo :1', () => {
    expect(razaoBR('#000000', '#ffffff')).toBe('21,00:1')
    expect(razaoBR('#A7ACD9', '#14173A')).toMatch(/^\d,\d\d:1$|^\d\d,\d\d:1$/)
  })
})
