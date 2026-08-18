import { describe, it, expect } from 'vitest'
import { diffVendas, type StoredVenda, type ExpectedVenda } from '../vendas-invariants'

const D = (iso: string) => new Date(iso + 'T00:00:00Z')
const CO = 'cacula'
const venda = (dia: string, meio: string, valor: number, txs: string[]): StoredVenda & ExpectedVenda => ({
  id: `vd-${dia}-${meio}`, dataCompetencia: D(dia), dataCompetenciaFim: D(dia), meio, tipo: 'VENDA',
  valorLiquido: valor, origens: txs.map((t) => ({ transactionId: t })),
})

describe('diffVendas — invariantes V1/V2/V3 (puro)', () => {
  const expected = [venda('2026-08-12', 'PIX', 100, ['t1', 't2']), venda('2026-08-12', 'DINHEIRO', 50, ['t3'])]
  const txCompanyOk = new Map([['t1', CO], ['t2', CO], ['t3', CO]])

  it('SAUDÁVEL: stored == expected, links completos, mesma empresa → 0 falhas', () => {
    const stored = [venda('2026-08-12', 'PIX', 100, ['t1', 't2']), venda('2026-08-12', 'DINHEIRO', 50, ['t3'])]
    expect(diffVendas(CO, 'Caçula', stored, expected, txCompanyOk)).toHaveLength(0)
  })

  it('V1: VendaDiaria velha (valor diverge do recompute) → V1', () => {
    const stored = [venda('2026-08-12', 'PIX', 90, ['t1', 't2']), venda('2026-08-12', 'DINHEIRO', 50, ['t3'])] // 90 != 100
    const fails = diffVendas(CO, 'Caçula', stored, expected, txCompanyOk)
    expect(fails.some((f) => f.invariante === 'V1')).toBe(true)
  })

  it('V2: VendaDiaria sem origem → V2', () => {
    const stored = [venda('2026-08-12', 'PIX', 100, ['t1', 't2']), { ...venda('2026-08-12', 'DINHEIRO', 50, []), }]
    const fails = diffVendas(CO, 'Caçula', stored, expected, txCompanyOk)
    expect(fails.some((f) => f.invariante === 'V2' && /SEM origem/.test(f.detalhe))).toBe(true)
  })

  it('V2: venda-tx sem VendaDiaria (t3 não está em nenhum stored) → V2', () => {
    const stored = [venda('2026-08-12', 'PIX', 100, ['t1', 't2'])] // falta a DINHEIRO com t3
    const fails = diffVendas(CO, 'Caçula', stored, expected, txCompanyOk)
    expect(fails.some((f) => f.invariante === 'V2' && /t3/.test(f.detalhe))).toBe(true)
  })

  it('V3: tx de origem de outra empresa → V3 (vazamento multi-tenant)', () => {
    const stored = [venda('2026-08-12', 'PIX', 100, ['t1', 't2']), venda('2026-08-12', 'DINHEIRO', 50, ['t3'])]
    const txCompanyLeak = new Map([['t1', CO], ['t2', 'OUTRA_EMPRESA'], ['t3', CO]])
    const fails = diffVendas(CO, 'Caçula', stored, expected, txCompanyLeak)
    expect(fails.some((f) => f.invariante === 'V3' && /OUTRA_EMPRESA/.test(f.detalhe))).toBe(true)
  })
})
