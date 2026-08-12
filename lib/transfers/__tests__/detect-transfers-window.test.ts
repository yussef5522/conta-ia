// Sprint Teto-Órfãs (13/08) — a JANELA POR VALOR substitui o par O(D×C) e torna
// o teto de 3.000 desnecessário. REGRA 3: prova que a janela dá o MESMO resultado
// que o O(D×C) bruto (só pula os pares que o classify rejeitaria), e que pares
// "antigos" (espalhados no array) aparecem — o que o corte por quantidade matava.

import { describe, it, expect } from 'vitest'
import { detectTransfers, classifyTransferPair, type UnifiedTx } from '../unified-transfer-engine'
import type { OwnEntityRefs } from '../own-entity-signals'

const REFS: OwnEntityRefs = {
  cnpj: '29756732000198', names: ['cacula'], accountNames: ['banrisul', 'stone'],
  ownerCpfs: [], ownerNames: [],
}
const D = (day: number) => new Date(2026, 7, day, 12, 0, 0)

// referência BRUTA: classifica TODOS os pares D×C (sem janela), mesmo sort+greedy.
function bruteForce(txs: UnifiedTx[], opts: any) {
  const debits = txs.filter((t) => t.type === 'DEBIT')
  const credits = txs.filter((t) => t.type === 'CREDIT')
  const all: any[] = []
  for (const d of debits) for (const c of credits) {
    const r = classifyTransferPair(d, c, opts)
    if (r) all.push(r)
  }
  all.sort((a, b) =>
    Number(b.autoSuggest) - Number(a.autoSuggest) ||
    b.confidence - a.confidence ||
    a.deltaDays - b.deltaDays ||
    a.from.id.localeCompare(b.from.id) ||
    a.to.id.localeCompare(b.to.id))
  const used = new Set<string>(), suggestions: any[] = [], weak: any[] = []
  for (const p of all) {
    if (used.has(p.from.id) || used.has(p.to.id)) continue
    used.add(p.from.id); used.add(p.to.id)
    ;(p.autoSuggest ? suggestions : weak).push(p)
  }
  return { suggestions, weak }
}
const ids = (arr: any[]) => arr.map((p) => `${p.from.id}|${p.to.id}`).sort()

describe('detectTransfers — janela por valor == O(D×C) bruto', () => {
  it('par ANTIGO espalhado no array é encontrado (o que o teto de quantidade matava)', () => {
    const txs: UnifiedTx[] = []
    // 200 créditos "ruído" de valores únicos no começo (empurram o par pro fim)
    for (let i = 0; i < 200; i++) txs.push({ id: `n${i}`, bankAccountId: 'a', date: D(1), type: 'CREDIT', amount: 1000 + i, description: 'ruido' })
    // par antigo real no FIM: PIX 5000 entre contas próprias, mesmo dia
    txs.push({ id: 'dOld', bankAccountId: 'banrisul', date: D(2), type: 'DEBIT', amount: 5000, description: 'PIX ENVIADO 29756732000198' })
    txs.push({ id: 'cOld', bankAccountId: 'stone', date: D(2), type: 'CREDIT', amount: 5000, description: 'PIX RECEBIDO 29756732000198' })
    const r = detectTransfers(txs, { refs: REFS, valorComum: new Set(), matchOwnerName: true })
    const par = [...r.suggestions, ...r.weak].find((p) => p.from.id === 'dOld' && p.to.id === 'cOld')
    expect(par).toBeTruthy()
  })

  it('par de valor PRÓXIMO (dentro da tarifa) entra na janela (weak)', () => {
    const txs: UnifiedTx[] = [
      { id: 'd', bankAccountId: 'banrisul', date: D(3), type: 'DEBIT', amount: 5000, description: 'PIX ENVIADO 29756732000198' },
      { id: 'c', bankAccountId: 'stone', date: D(3), type: 'CREDIT', amount: 4990, description: 'PIX RECEBIDO 29756732000198' }, // tarifa 10
    ]
    const r = detectTransfers(txs, { refs: REFS, valorComum: new Set(), matchOwnerName: true })
    const brute = bruteForce(txs, { refs: REFS, valorComum: new Set(), matchOwnerName: true })
    // seja qual for a camada, tem que casar o bruto (a janela não pode perder)
    expect(ids([...r.suggestions, ...r.weak])).toEqual(ids([...brute.suggestions, ...brute.weak]))
  })

  it('conjunto randômico grande (600 tx): janela IDÊNTICA ao bruto', () => {
    const txs: UnifiedTx[] = []
    // determinístico (sem Math.random): valores e datas por índice.
    for (let i = 0; i < 600; i++) {
      const type = i % 2 === 0 ? 'DEBIT' : 'CREDIT'
      const amount = [100, 250, 5000, 999.99, 1234.56, 7000][i % 6] + (i % 7 === 0 ? 0 : i)
      txs.push({ id: `t${i}`, bankAccountId: i % 3 === 0 ? 'banrisul' : i % 3 === 1 ? 'stone' : 'sicredi', date: D((i % 5) + 1), type, amount, description: i % 4 === 0 ? 'PIX ENVIADO 29756732000198' : 'compra loja' })
    }
    const opts = { refs: REFS, valorComum: new Set<number>(), matchOwnerName: true }
    const w = detectTransfers(txs, opts)
    const b = bruteForce(txs, opts)
    expect(ids(w.suggestions)).toEqual(ids(b.suggestions))
    expect(ids(w.weak)).toEqual(ids(b.weak))
  })
})
