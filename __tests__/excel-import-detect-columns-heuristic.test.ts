// Sprint 5.0.2.0 — heuristicFallback (puro, sem Claude/DB).

import { describe, it, expect } from 'vitest'
import { heuristicFallback } from '@/lib/excel-import/detect-columns'

describe('heuristicFallback — planilha ASSECONT padrão BR', () => {
  it('mapeia colunas do extrato Cacula Mix', () => {
    const r = heuristicFallback([
      'Favorecido',
      'Beneficiário',
      'Descrição',
      'Centro de custo',
      'Lançamento',
      'Competência',
      'Vencimento',
      'Pagamento',
      'Valor',
      'Valor baixa',
      'Nota',
      'Status',
    ])
    expect(r.fields.favorecido).toBe('Favorecido')
    // Beneficiário pode ser usado como favorecido OU beneficiario_tipo;
    // heurística respeita ordem de hints (favorecido vence primeiro com 'beneficiario'?
    // Hint de favorecido é 'beneficiario' (sem acento) tb mas 'Beneficiário' contém 'beneficiário'
    // que casa com hint de beneficiario_tipo. Como `favorecido` rodou antes,
    // já tinha 'Favorecido', então 'Beneficiário' fica disponível pra beneficiario_tipo.
    expect(r.fields.beneficiario_tipo).toBe('Beneficiário')
    expect(r.fields.descricao).toBe('Descrição')
    expect(r.fields.centro_custo).toBe('Centro de custo')
    expect(r.fields.vencimento).toBe('Vencimento')
    expect(r.fields.pagamento).toBe('Pagamento')
    expect(r.fields.valor).toBe('Valor')
    expect(r.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('confidence alta quando essenciais identificados', () => {
    const r = heuristicFallback(['Favorecido', 'Valor', 'Vencimento'])
    expect(r.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('confidence média quando 2 de 3 essenciais', () => {
    const r = heuristicFallback(['Favorecido', 'Valor'])
    expect(r.confidence).toBeGreaterThanOrEqual(0.5)
    expect(r.confidence).toBeLessThanOrEqual(0.75)
  })

  it('confidence baixa quando só 1 essencial', () => {
    const r = heuristicFallback(['Favorecido', 'Notas Diversas'])
    expect(r.confidence).toBeLessThan(0.5)
  })
})

describe('heuristicFallback — variações de nomenclatura', () => {
  it('aceita "Fornecedor" e "R$" e "Venc"', () => {
    const r = heuristicFallback(['Fornecedor', 'Descrição', 'Venc', 'R$ Total'])
    expect(r.fields.favorecido).toBe('Fornecedor')
    expect(r.fields.vencimento).toBe('Venc')
    expect(r.fields.valor).toBe('R$ Total')
  })

  it('aceita variantes sem acento', () => {
    const r = heuristicFallback([
      'Favorecido',
      'Descricao',
      'Vencimento',
      'Valor',
    ])
    expect(r.fields.descricao).toBe('Descricao')
  })

  it('coluna não reconhecida → null', () => {
    const r = heuristicFallback(['Favorecido', 'Aliquota IRPJ', 'Valor'])
    expect(r.fields.descricao).toBeNull()
  })
})

describe('heuristicFallback — anti-reuso (1 header não vira 2 campos)', () => {
  it('Favorecido + Beneficiário NÃO duplica (Favorecido vence)', () => {
    const r = heuristicFallback([
      'Favorecido',
      'Beneficiário', // tipo do favorecido
      'Valor',
    ])
    expect(r.fields.favorecido).toBe('Favorecido')
    expect(r.fields.beneficiario_tipo).toBe('Beneficiário')
    // Confirma: cada header usado UMA vez
    const used = Object.values(r.fields).filter((v) => v !== null)
    expect(new Set(used).size).toBe(used.length)
  })
})
