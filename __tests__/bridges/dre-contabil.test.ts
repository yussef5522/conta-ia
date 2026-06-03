// Sprint PF Fatia 4 — Testes contábeis:
// - PRO_LABORE em categoria DESPESAS_PESSOAL afeta DRE (linha "(-) Despesas com Pessoal")
// - DISTRIBUICAO em categoria DISTRIBUICAO_LUCROS NÃO afeta DRE (vai em nonDreGroups)
//
// Esses testes validam que o MAPEAMENTO contábil da Fatia 4 (kind-defaults)
// está alinhado com o engine DRE existente — sem mudar o engine.

import { describe, expect, test } from 'vitest'
import { calculateDRE } from '@/lib/dre/calculator'
import { getKindDefaults } from '@/lib/bridges/kind-defaults'
import type { TransactionForDRE, CategoryForDRE } from '@/lib/dre/types'

const categoryDespesaPessoal: CategoryForDRE = {
  id: 'cat-pro-labore',
  name: 'Pró-labore Sócios',
  code: null,
  dreGroup: 'DESPESAS_PESSOAL',
  parentId: null,
  isActive: true,
  type: 'DEBIT',
}
const categoryDistribuicao: CategoryForDRE = {
  id: 'cat-distrib',
  name: 'Distribuição de Lucros',
  code: null,
  dreGroup: 'DISTRIBUICAO_LUCROS',
  parentId: null,
  isActive: true,
  type: 'DEBIT',
}
const categoryReceita: CategoryForDRE = {
  id: 'cat-receita',
  name: 'Receita',
  code: null,
  dreGroup: 'RECEITA_BRUTA',
  parentId: null,
  isActive: true,
  type: 'CREDIT',
}

const period = {
  startDate: new Date('2026-05-01'),
  endDate: new Date('2026-05-31'),
  regime: 'cash' as const,
}

function txDebit(categoryId: string, amount: number, id = 'tx-' + Math.random()): TransactionForDRE {
  return {
    id,
    type: 'DEBIT',
    amount,
    date: new Date('2026-05-15'),
    competenceDate: null,
    paymentDate: new Date('2026-05-15'),
    categoryId,
  }
}
function txCredit(categoryId: string, amount: number, id = 'tx-' + Math.random()): TransactionForDRE {
  return {
    id,
    type: 'CREDIT',
    amount,
    date: new Date('2026-05-15'),
    competenceDate: null,
    paymentDate: new Date('2026-05-15'),
    categoryId,
  }
}

describe('Mapeamento contábil — kind-defaults vs DRE engine', () => {
  test('PRO_LABORE → DESPESAS_PESSOAL aparece na linha de despesas (afeta resultado)', () => {
    const txs: TransactionForDRE[] = [
      txCredit(categoryReceita.id, 10000),
      txDebit(categoryDespesaPessoal.id, 5000),
    ]
    const result = calculateDRE(
      txs,
      [categoryReceita, categoryDespesaPessoal],
      { period },
    )

    const despesasPessoal = result.totals.totalDespesasPessoal
    expect(despesasPessoal).toBe(5000)
    // Resultado operacional = Receita - Despesas (incluindo pessoal)
    expect(result.totals.lucroLiquido).toBeLessThan(10000)

    // PRO_LABORE não vai em nonDreGroups
    // DESPESAS_PESSOAL é DRE Group (não non-DRE), então nunca aparece em nonDreGroups
    expect(result.nonDreGroups.find((g) => (g.group as string) === 'DESPESAS_PESSOAL')).toBeUndefined()
  })

  test('DISTRIBUICAO → DISTRIBUICAO_LUCROS aparece em nonDreGroups (NÃO afeta resultado)', () => {
    const txs: TransactionForDRE[] = [
      txCredit(categoryReceita.id, 10000),
      txDebit(categoryDistribuicao.id, 5000),
    ]
    const result = calculateDRE(
      txs,
      [categoryReceita, categoryDistribuicao],
      { period },
    )

    // RECEITA mantém R$ 10k
    expect(result.totals.receitaBruta).toBe(10000)
    // Lucro líquido = receita bruta (sem despesa pessoal nem outras)
    expect(result.totals.lucroLiquido).toBe(10000)

    // Distribuição aparece em nonDreGroups separadamente
    const distribuicaoNonDre = result.nonDreGroups.find(
      (g) => g.group === 'DISTRIBUICAO_LUCROS',
    )
    expect(distribuicaoNonDre).toBeDefined()
    expect(distribuicaoNonDre!.total).toBe(5000)
  })

  test('Defaults dos 5 kinds da Fatia 4 estão coerentes com DRE engine', () => {
    // PRO_LABORE afeta DRE
    expect(getKindDefaults('PRO_LABORE').suggestedPjDreGroup).toBe('DESPESAS_PESSOAL')
    expect(getKindDefaults('PRO_LABORE').affectsDre).toBe(true)
    // DISTRIBUICAO + ADIANTAMENTO + RETIRADA → DISTRIBUICAO_LUCROS (non-DRE)
    for (const k of ['DISTRIBUICAO', 'ADIANTAMENTO', 'RETIRADA_SOCIOS'] as const) {
      expect(getKindDefaults(k).suggestedPjDreGroup).toBe('DISTRIBUICAO_LUCROS')
      expect(getKindDefaults(k).affectsDre).toBe(false)
    }
    // REEMBOLSO null (força escolha)
    expect(getKindDefaults('REEMBOLSO').suggestedPjDreGroup).toBeNull()
  })
})

describe('Sanity — TRANSFER e bridge não interferem', () => {
  test('Engine DRE NÃO processa TRANSFER (mesma proteção da Sprint 0.5)', () => {
    const txs: TransactionForDRE[] = [
      {
        id: 'transfer-1',
        type: 'TRANSFER',
        amount: 1000,
        date: new Date('2026-05-15'),
        competenceDate: null,
        paymentDate: new Date('2026-05-15'),
        categoryId: null,
      },
    ]
    const result = calculateDRE(txs, [], { period })
    expect(result.totals.receitaBruta).toBe(0)
    expect(result.totals.lucroLiquido).toBe(0)
  })
})
