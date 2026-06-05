// Sprint UX-bulk-review — testes do detector de outliers no modal
// "Aprender e aplicar" da tela Pendentes.

import { describe, it, expect } from 'vitest'
import {
  descriptionShape,
  detectOutliers,
} from '@/lib/pendentes/detect-outliers'

describe('descriptionShape', () => {
  it('normaliza pra uppercase + dígitos em #', () => {
    expect(descriptionShape('Pix Maquininha 12345')).toBe(
      'PIX MAQUININHA #',
    )
  })

  it('colapsa espaços múltiplos', () => {
    expect(descriptionShape('PIX   ENVIADO  ')).toBe('PIX ENVIADO')
  })

  it('dígitos com letras viram # único + letras', () => {
    expect(descriptionShape('Recebimento 250605 PIX')).toBe(
      'RECEBIMENTO # PIX',
    )
  })

  it('shape preserva texto não-numérico (nomes diferentes = shapes diferentes)', () => {
    // Por design: shape colapsa só dígitos. Nomes diferentes geram shapes
    // diferentes — outliers vêm de variantes do TIPO de operação, não de
    // partes pessoais (CPF/cliente). Detector usa frequência pra compensar.
    expect(descriptionShape('JOAO SILVA 12345678901 Pix')).toBe('JOAO SILVA # PIX')
    expect(descriptionShape('MARIA SANTOS 98765432100 Pix')).toBe(
      'MARIA SANTOS # PIX',
    )
  })
})

describe('detectOutliers', () => {
  it('amostra pequena (<5) retorna vazio', () => {
    const items = [
      { id: '1', description: 'PIX MAQUININHA' },
      { id: '2', description: 'PIX MAQUININHA' },
      { id: '3', description: 'TED ESTRANHA' },
    ]
    expect(detectOutliers(items)).toEqual(new Set())
  })

  it('detecta 1 outlier no meio de 9 iguais', () => {
    const items = [
      ...Array.from({ length: 9 }, (_, i) => ({
        id: `pix-${i}`,
        description: 'Cliente Pix Maquininha 12345',
      })),
      { id: 'outlier', description: 'TED RECEBIDO TARIFA' },
    ]
    expect(detectOutliers(items)).toEqual(new Set(['outlier']))
  })

  it('top 2 shapes contam como dominante (não marca o 2º como outlier)', () => {
    const items = [
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `a-${i}`,
        description: 'PIX MAQUININHA #',
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `b-${i}`,
        description: 'PIX ENVIADO #',
      })),
      { id: 'outlier', description: 'IOF TARIFA' },
    ]
    const result = detectOutliers(items)
    expect(result.has('outlier')).toBe(true)
    expect(result.has('a-0')).toBe(false)
    expect(result.has('b-0')).toBe(false)
  })

  it('alta variância natural (top1 <60%) ignora detecção pra evitar falso positivo', () => {
    const items = [
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `a-${i}`,
        description: 'FORMA A',
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `b-${i}`,
        description: 'FORMA B',
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `c-${i}`,
        description: 'FORMA C',
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `d-${i}`,
        description: 'FORMA D',
      })),
    ]
    // top1 = 3/12 = 25% < 60% threshold → vazio
    expect(detectOutliers(items)).toEqual(new Set())
  })

  it('caso real: 117 vendas Pix maquininha + 1 TED estranha', () => {
    const items = [
      ...Array.from({ length: 117 }, (_, i) => ({
        id: `pix-${i}`,
        description: `Cliente ${i} - Pix | Maquininha`,
      })),
      { id: 'ted-estranha', description: 'TED RECEBIDA FORNECEDOR' },
    ]
    const outliers = detectOutliers(items)
    expect(outliers.size).toBe(1)
    expect(outliers.has('ted-estranha')).toBe(true)
  })
})
