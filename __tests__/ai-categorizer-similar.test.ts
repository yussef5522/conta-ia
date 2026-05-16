// Similar — Fase 3 Etapa 1.

import { describe, it, expect } from 'vitest'
import {
  findSimilarTransactions,
  topPendingPatterns,
} from '@/lib/ai-categorizer/similar'
import type { TxSnapshot } from '@/lib/ai-categorizer/types'

function tx(
  id: string,
  description: string,
  amount = 100,
  categoryId: string | null = null,
): TxSnapshot {
  return {
    id,
    description,
    amount,
    type: 'CREDIT',
    bankAccountId: 'acc-1',
    status: 'PENDING',
    categoryId,
  }
}

describe('findSimilarTransactions — match por padrão', () => {
  it('NORMALIZED agrupa diferentes nomes próprios (caso Cacula Mix)', () => {
    const candidatas = [
      tx('t1', 'FABIO UECKER - Pix | Maquininha'),
      tx('t2', 'Marcyelle da Silva - Pix | Maquininha'),
      tx('t3', 'Jhonas Aryel - Pix | Maquininha'),
      tx('t4', 'ALUGUEL JANEIRO'),
    ]
    const result = findSimilarTransactions({
      baseDescription: 'ROBERTO VARGAS - Pix | Maquininha',
      tipoMatch: 'NORMALIZED',
      candidatas,
    })
    expect(result.map((r) => r.id).sort()).toEqual(['t1', 't2', 't3'])
  })

  it('EXACT só casa descrição literal idêntica', () => {
    const candidatas = [
      tx('t1', 'PAGAMENTO TITULO'),
      tx('t2', 'pagamento titulo'), // case diferente OK pra EXACT
      tx('t3', 'PAGAMENTO BOLETO'), // diferente
      tx('t4', 'FABIO - PAGAMENTO TITULO'), // tem prefixo → não casa EXACT
    ]
    const result = findSimilarTransactions({
      baseDescription: 'PAGAMENTO TITULO',
      tipoMatch: 'EXACT',
      candidatas,
    })
    expect(result.map((r) => r.id).sort()).toEqual(['t1', 't2'])
  })

  it('exclui baseTxId quando passado', () => {
    const candidatas = [
      tx('t1', 'X - Pix | Maquininha'),
      tx('t-base', 'BASE - Pix | Maquininha'),
    ]
    const result = findSimilarTransactions(
      {
        baseDescription: 'BASE - Pix | Maquininha',
        tipoMatch: 'NORMALIZED',
        candidatas,
      },
      't-base',
    )
    expect(result.map((r) => r.id)).toEqual(['t1'])
  })

  it('IGNORA candidatas já classificadas (categoryId != null)', () => {
    const candidatas = [
      tx('t1', 'X - Pix | Maquininha'),
      tx('t2', 'Y - Pix | Maquininha', 100, 'cat-X'), // já tem categoria
    ]
    const result = findSimilarTransactions({
      baseDescription: 'Z - Pix | Maquininha',
      tipoMatch: 'NORMALIZED',
      candidatas,
    })
    expect(result.map((r) => r.id)).toEqual(['t1'])
  })

  it('descrição vazia → resultado vazio', () => {
    const result = findSimilarTransactions({
      baseDescription: '',
      tipoMatch: 'NORMALIZED',
      candidatas: [tx('t1', 'X')],
    })
    expect(result).toEqual([])
  })
})

describe('topPendingPatterns — top N padrões mais frequentes', () => {
  it('agrupa por padrão normalizado + ordena por frequência', () => {
    const candidatas = [
      tx('1', 'A - Pix | Maquininha', 50),
      tx('2', 'B - Pix | Maquininha', 60),
      tx('3', 'C - Pix | Maquininha', 70),
      tx('4', 'PAGAMENTO TITULO', 1000),
      tx('5', 'PAGAMENTO TITULO', 1500),
    ]
    const top = topPendingPatterns(candidatas, 10)
    expect(top[0].padrao).toBe('pix | maquininha')
    expect(top[0].count).toBe(3)
    expect(top[0].totalAmount).toBe(180)
    expect(top[1].padrao).toBe('pagamento titulo')
    expect(top[1].count).toBe(2)
  })

  it('IGNORA já classificadas', () => {
    const candidatas = [
      tx('1', 'X - Pix | Maquininha'),
      tx('2', 'Y - Pix | Maquininha', 100, 'cat-X'),
    ]
    const top = topPendingPatterns(candidatas, 10)
    expect(top[0].count).toBe(1)
  })

  it('respeita limit', () => {
    const candidatas = Array.from({ length: 20 }, (_, i) =>
      tx(`t${i}`, `PADRAO_${i}`, 10),
    )
    expect(topPendingPatterns(candidatas, 5)).toHaveLength(5)
  })
})
