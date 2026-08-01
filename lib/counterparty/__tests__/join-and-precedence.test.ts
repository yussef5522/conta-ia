import { describe, it, expect } from 'vitest'
import { joinPdfStatement, type JoinTxInput } from '../join-pdf-statement'
import { canApplyCounterparty } from '../precedence'
import { normalizeCounterparty, counterpartyMatches } from '../normalize'
import type { BankStatementLine } from '@/lib/bank-statement-pdf/types'

function pdf(documento: string, amount: number, counterpartyName: string | null, day = 1): BankStatementLine {
  return { day, historico: 'PIX', documento, amount, signed: -amount, counterpartyName }
}
function tx(id: string, externalId: string | null, amount: number, over: Partial<JoinTxInput> = {}): JoinTxInput {
  return { id, externalId, amount, description: 'PIX ENVIADO', counterpartySource: null, ...over }
}

describe('joinPdfStatement', () => {
  it('EXACT: 1 nome pra chave (documento+valor) → atribui', () => {
    const r = joinPdfStatement([pdf('198074', 1215, 'MARCOS ADRIEL LEAL KERNBAUM')], [tx('t1', '198074', 1215)])
    expect(r.exact).toHaveLength(1)
    expect(r.exact[0]).toMatchObject({ txId: 't1', counterpartyName: 'MARCOS ADRIEL LEAL KERNBAUM' })
    expect(r.stats.exactCount).toBe(1)
  })

  it('AMBIGUOUS: documento 000000 + mesmo valor com nomes divergentes → NÃO atribui', () => {
    const lines = [
      pdf('000000', 139.9, 'GRUBERT E BRAGA COMERCIO DE COLCHOES LT', 9),
      pdf('000000', 139.9, 'OUTRO PAGADOR TOTALMENTE DIFERENTE LTDA', 10),
    ]
    const txs = [tx('a', '000000', 139.9), tx('b', '000000', 139.9)]
    const r = joinPdfStatement(lines, txs)
    expect(r.exact).toHaveLength(0) // NENHUM nome automático
    expect(r.ambiguous).toHaveLength(1)
    expect(r.ambiguous[0].candidateNames).toHaveLength(2)
    expect(r.ambiguous[0].txIds.sort()).toEqual(['a', 'b'])
    expect(r.stats.ambiguousKeys).toBe(1)
    expect(r.stats.ambiguousTxCount).toBe(2)
  })

  it('mesmo nome repetido pra mesma chave NÃO é ambíguo (é EXACT)', () => {
    const lines = [pdf('000000', 50, 'FORNECEDOR X', 1), pdf('000000', 50, 'FORNECEDOR X', 2)]
    const r = joinPdfStatement(lines, [tx('a', '000000', 50), tx('b', '000000', 50)])
    expect(r.ambiguous).toHaveLength(0)
    expect(r.exact).toHaveLength(2)
  })

  it('NO_MATCH: linha do PDF sem nome → nada atribuído', () => {
    const r = joinPdfStatement([pdf('779867', 108.92, null)], [tx('t1', '779867', 108.92)])
    expect(r.exact).toHaveLength(0)
    expect(r.noMatchTxIds).toEqual(['t1'])
    expect(r.stats.noMatchCount).toBe(1)
  })

  it('NUNCA sobrescreve nome MANUAL', () => {
    const r = joinPdfStatement(
      [pdf('198074', 1215, 'MARCOS ADRIEL')],
      [tx('t1', '198074', 1215, { counterpartySource: 'MANUAL' })],
    )
    expect(r.exact).toHaveLength(0)
    expect(r.stats.manualProtected).toBe(1)
  })

  it('casa por valor absoluto (sinal irrelevante)', () => {
    const r = joinPdfStatement([pdf('198074', 1215, 'MARCOS')], [tx('t1', '198074', 1215, { amount: -1215 })])
    // amount no tx é armazenado positivo, mas garante robustez a sinal
    expect(r.exact).toHaveLength(1)
  })
})

describe('precedence — canApplyCounterparty', () => {
  it('vazio → qualquer fonte grava', () => {
    expect(canApplyCounterparty(null, 'PDF_STATEMENT')).toBe(true)
  })
  it('MANUAL existente → PDF/OFX NÃO sobrescrevem', () => {
    expect(canApplyCounterparty('MANUAL', 'PDF_STATEMENT')).toBe(false)
    expect(canApplyCounterparty('MANUAL', 'OFX')).toBe(false)
    expect(canApplyCounterparty('MANUAL', 'OPEN_FINANCE')).toBe(false)
  })
  it('OFX ganha de PDF; PDF não ganha de OFX', () => {
    expect(canApplyCounterparty('PDF_STATEMENT', 'OFX')).toBe(true)
    expect(canApplyCounterparty('OFX', 'PDF_STATEMENT')).toBe(false)
  })
  it('mesma fonte pode reprocessar', () => {
    expect(canApplyCounterparty('PDF_STATEMENT', 'PDF_STATEMENT')).toBe(true)
  })
})

describe('normalizeCounterparty / counterpartyMatches', () => {
  it('normaliza acento, caixa e espaço', () => {
    expect(normalizeCounterparty('João  Francisco ')).toBe('JOAO FRANCISCO')
  })
  it('casa nome truncado pelo banco (prefixo)', () => {
    expect(
      counterpartyMatches('GRUBERT E BRAGA COMERCIO DE COLCHOES LT', 'Grubert e Braga Comercio de Colchoes LTDA'),
    ).toBe(true)
  })
  it('não casa nomes curtos diferentes', () => {
    expect(counterpartyMatches('ANA', 'ANTONIO')).toBe(false)
  })
})
