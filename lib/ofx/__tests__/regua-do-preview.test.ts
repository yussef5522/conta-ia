// ⛔ O GESTO QUEBRADO EM DOIS (04/09) — o red-then-green da régua que chega depois.

import { describe, it, expect } from 'vitest'
import { pdfDaConferencia, podeReconferirInline } from '../regua-do-preview'

const ofx = { name: 'Extrato_20260904.ofx' } as unknown as File
const pdfA = { name: 'extrato-agosto.pdf' } as unknown as File
const pdfB = { name: 'extrato-setembro.pdf' } as unknown as File

describe('⭐⭐ qual PDF acompanha este preview', () => {
  it('⭐⭐ o RECÉM-ESCOLHIDO manda — era aqui que o selo sumia', () => {
    // ⚠️ o estado ainda está VAZIO no instante do onChange (React agenda o setState);
    // ler o estado devolveria null e o preview voltaria sem régua nenhuma.
    expect(pdfDaConferencia(pdfB, null)).toBe(pdfB)
    expect(pdfDaConferencia(pdfB, pdfA), 'trocar o PDF não pegou').toBe(pdfB)
  })

  it('⭐ ninguém escolheu agora → vale o que já estava anexado', () => {
    expect(pdfDaConferencia(undefined, pdfA)).toBe(pdfA)
    expect(pdfDaConferencia(undefined, null)).toBeNull()
  })

  it('⛔ REMOVER (null explícito) tem que valer — senão o PDF errado gruda no import', () => {
    expect(pdfDaConferencia(null, pdfA)).toBeNull()
  })
})

describe('⭐ reconferir sem pedir o OFX de novo', () => {
  it('⭐⭐ com o OFX na mão, reconfere INLINE — nada de voltar pro começo', () => {
    expect(podeReconferirInline(ofx)).toBe(true)
  })

  it('⚠️ sem OFX não há o que reconferir — pedir o arquivo aí é honesto', () => {
    expect(podeReconferirInline(null)).toBe(false)
  })
})
