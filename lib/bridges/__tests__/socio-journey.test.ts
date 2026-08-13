// Sprint Jornada-do-Dinheiro (12/08) — REGRA 3: executa as agregações puras da
// tela do sócio com dado no formato REAL das pontes da caçula (BridgeListItem).
// Cobre os invariantes que o Yussef pediu:
//   - destino soma == total das retiradas (bate com a lista detalhada)
//   - retirada sem A/B entra em "ficou comigo", não some
//   - ordena por valor desc, maior primeiro
//   - gastou + ficou == total (all-time)

import { describe, it, expect } from 'vitest'
import {
  aggregateDestinoPorCategoria,
  computeJornadaSplit,
} from '../socio-journey'
import type { BridgeListItem } from '../types'

// Fábrica no formato REAL do payload /aggregated (só os campos que a agregação lê).
function bridge(p: Partial<BridgeListItem>): BridgeListItem {
  return {
    id: p.id ?? 'b1',
    kind: 'DISTRIBUICAO',
    amount: p.amount ?? 0,
    date: p.date ?? new Date('2026-08-01'),
    createdVia: 'MANUAL',
    companyId: 'co1',
    companyName: 'Cacula',
    pjTransactionId: 'pj1',
    pjBankAccountName: 'Stone',
    profileId: 'prof1',
    profileName: 'Yussef PF',
    pfTransactionId: 'pf1',
    pfBankAccountName: 'Nubank PF',
    socioPFName: 'Yussef',
    spendTransactionId: p.spendTransactionId ?? null,
    spendCategoryName: p.spendCategoryName ?? null,
    spendCategoryColor: p.spendCategoryColor ?? null,
    spendAmount: p.spendAmount ?? null,
    ...p,
  } as BridgeListItem
}

// Cenário parecido com a caçula: retiradas, algumas gastas (A/B), outras paradas.
const bridges: BridgeListItem[] = [
  bridge({ id: '1', amount: 5000, spendTransactionId: 's1', spendCategoryName: 'Moradia', spendCategoryColor: '#16a34a' }),
  bridge({ id: '2', amount: 3000, spendTransactionId: 's2', spendCategoryName: 'Moradia', spendCategoryColor: '#16a34a' }),
  bridge({ id: '3', amount: 2000, spendTransactionId: 's3', spendCategoryName: 'Nura', spendCategoryColor: '#db2777' }),
  bridge({ id: '4', amount: 1000, spendTransactionId: null }), // ficou comigo
  bridge({ id: '5', amount: 500, spendTransactionId: null }), // ficou comigo
]

describe('aggregateDestinoPorCategoria (ponto 2)', () => {
  const rows = aggregateDestinoPorCategoria(bridges)

  it('soma por categoria e o total BATE com a soma das retiradas', () => {
    const totalRetiradas = bridges.reduce((s, b) => s + b.amount, 0) // 11.500
    const totalDestino = rows.reduce((s, r) => s + r.amount, 0)
    expect(totalDestino).toBe(totalRetiradas)
    expect(totalDestino).toBe(11500)
  })

  it('agrupa a MESMA categoria (Moradia = 5000 + 3000)', () => {
    const moradia = rows.find((r) => r.label === 'Moradia')
    expect(moradia).toBeDefined()
    expect(moradia!.amount).toBe(8000)
    expect(moradia!.count).toBe(2)
    expect(moradia!.color).toBe('#16a34a')
  })

  it('retirada SEM A/B entra em "ficou comigo" — não some', () => {
    const ficou = rows.find((r) => r.ficou)
    expect(ficou).toBeDefined()
    expect(ficou!.amount).toBe(1500) // 1000 + 500
    expect(ficou!.count).toBe(2)
    expect(ficou!.label).toMatch(/Ficou com você/)
  })

  it('ordena por valor, maior primeiro', () => {
    const amounts = rows.map((r) => r.amount)
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a))
    expect(rows[0].label).toBe('Moradia') // 8000 é o maior
  })

  it('lista vazia → sem linhas (não quebra)', () => {
    expect(aggregateDestinoPorCategoria([])).toEqual([])
  })
})

describe('computeJornadaSplit (ponto 4)', () => {
  it('separa gastou (A/B) de ficou no PF, e a soma bate com o total', () => {
    const split = computeJornadaSplit(bridges)
    expect(split.gastouCount).toBe(3)
    expect(split.gastouAmount).toBe(10000) // 5000+3000+2000
    expect(split.ficouCount).toBe(2)
    expect(split.ficouAmount).toBe(1500) // 1000+500
    // invariante: gastou + ficou == tudo que tirou
    expect(split.gastouAmount + split.ficouAmount).toBe(
      bridges.reduce((s, b) => s + b.amount, 0),
    )
    expect(split.gastouCount + split.ficouCount).toBe(bridges.length)
  })

  it('tudo parado no PF → gastou 0, ficou tudo', () => {
    const split = computeJornadaSplit([
      bridge({ id: 'x', amount: 700, spendTransactionId: null }),
    ])
    expect(split.gastouAmount).toBe(0)
    expect(split.ficouCount).toBe(1)
    expect(split.ficouAmount).toBe(700)
  })
})
