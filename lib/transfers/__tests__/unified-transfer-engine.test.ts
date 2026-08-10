// Sprint Motor-Único-Transferência (10/08/2026) — REGRA 3: executa o motor com
// DADOS REAIS (puxados do banco da caçula), não grep. Cobre os 4 casos que mais
// importam (6.2–6.5):
//   6.2 par de 5.000 (Banrisul→Sicredi, CNPJ próprio, mesmo dia) → camada 1
//   6.3 os falsos de valor redondo → NÃO sugeridos (weak ou rejeitados)
//   6.4 par com tarifa (valor próximo) → só busca manual, nunca sugerido
//   6.5 par com uma perna RECONCILED → detectado (a regra "2× PENDING" do B saiu)

import { describe, it, expect } from 'vitest'
import {
  classifyTransferPair,
  detectTransfers,
  type UnifiedTx,
} from '../unified-transfer-engine'
import type { OwnEntityRefs } from '../own-entity-signals'

// refs REAIS da caçula (CNPJ público, já no CLAUDE.md; CPF do dono anonimizado)
const REFS: OwnEntityRefs = {
  cnpj: '29756732000198',
  names: ['cacula mix', 'cacula'],
  accountNames: ['banrisul', 'sicredi', 'stone', 'caixa loja/cofre', 'banco caixa'],
  ownerCpfs: [],
  ownerNames: ['YUSSEF ABU ZAHRY MUSA', 'YUSSEF'],
}
const D = (s: string) => new Date(`${s}T12:00:00Z`)
const tx = (o: Partial<UnifiedTx> & Pick<UnifiedTx, 'id' | 'bankAccountId' | 'type' | 'amount' | 'description' | 'date'>): UnifiedTx => o

// ── FIXTURE REAL: par de 5.000 (21/07) ──
const banrisul5000 = tx({ id: 'r-out', bankAccountId: 'banrisul', type: 'DEBIT', amount: 5000, date: D('2026-07-21'), description: 'PIX ENVIADO' })
const sicredi5000 = tx({ id: 'r-in', bankAccountId: 'sicredi', type: 'CREDIT', amount: 5000, date: D('2026-07-21'), description: 'RECEBIMENTO PIX-PIX_CRED  29756732000198 YUSSEF ABU ZAHRY MUSA' })

describe('motor único — camada 1 (determinística) — par de 5.000 REAL', () => {
  it('6.2 CNPJ próprio + mesmo dia + valor exato → camada 1, 0.99, sugere', () => {
    const r = classifyTransferPair(banrisul5000, sicredi5000, { refs: REFS })
    expect(r).not.toBeNull()
    expect(r!.layer).toBe('DETERMINISTIC')
    expect(r!.confidence).toBe(0.99)
    expect(r!.autoSuggest).toBe(true)
    expect(r!.signals.ownEntity).toBe(true)
    expect(r!.signals.thirdPartyName).toBe(false) // YUSSEF na perna COM CNPJ próprio = titular
    expect(r!.evidences[0]).toMatch(/Camada 1/)
  })

  it('6.5 mesma detecção com a perna de entrada RECONCILED (regra 2× PENDING não volta)', () => {
    const inReconciled = { ...sicredi5000, status: 'RECONCILED' }
    const outReconciled = { ...banrisul5000, status: 'RECONCILED' }
    const r = classifyTransferPair(outReconciled, inReconciled, { refs: REFS })
    expect(r?.layer).toBe('DETERMINISTIC') // status é ignorado — detecta igual
  })
})

describe('motor único — camada 3 / rejeição — os falsos de valor redondo', () => {
  const valorComum = new Set([100, 1000, 99.99])

  it('6.3a NURA (distribuição) × OP. CREDITO (empréstimo, 1.000) → REJEITADO (blacklist)', () => {
    const nura = tx({ id: 'f1', bankAccountId: 'caixa loja/cofre', type: 'DEBIT', amount: 1000, date: D('2026-07-31'), description: 'NURA' })
    const opCredito = tx({ id: 'f2', bankAccountId: 'banrisul', type: 'CREDIT', amount: 1000, date: D('2026-07-31'), description: 'OP. CREDITO C/GARANTIA' })
    const r = classifyTransferPair(nura, opCredito, { refs: REFS, valorComum })
    expect(r).toBeNull() // nem candidato — nunca liga retirada a saque de crédito
  })

  it('6.3b chat gpt (100) × RECEBIMENTO PIX (100) → weak, NUNCA sugerido', () => {
    const chatgpt = tx({ id: 'f3', bankAccountId: 'caixa loja/cofre', type: 'DEBIT', amount: 100, date: D('2026-07-06'), description: 'chat gpt' })
    const pixIn = tx({ id: 'f4', bankAccountId: 'sicredi', type: 'CREDIT', amount: 100, date: D('2026-07-06'), description: 'RECEBIMENTO PIX-PIX_CRED' })
    const r = classifyTransferPair(chatgpt, pixIn, { refs: REFS, valorComum })
    // valor comum + sem sinal próprio → no MÁXIMO weak (autoSuggest=false)
    expect(r?.autoSuggest ?? false).toBe(false)
  })
})

describe('motor único — camada 3 — tarifa (valor próximo)', () => {
  it('6.4 5.000 sai / 4.990 entra (tarifa) → weak, só busca manual', () => {
    const out = tx({ id: 't1', bankAccountId: 'banrisul', type: 'DEBIT', amount: 5000, date: D('2026-07-21'), description: 'PIX ENVIADO TRANSFERENCIA' })
    const inn = tx({ id: 't2', bankAccountId: 'sicredi', type: 'CREDIT', amount: 4990, date: D('2026-07-21'), description: 'PIX RECEBIDO TRANSFERENCIA' })
    const r = classifyTransferPair(out, inn, { refs: REFS })
    expect(r).not.toBeNull()
    expect(r!.signals.exactValue).toBe(false)
    expect(r!.autoSuggest).toBe(false) // nunca sugerido; aparece só na busca manual
    expect(r!.evidences[0]).toMatch(/tarifa/i)
  })
})

describe('motor único — detectTransfers (lote) separa sugestão de fraca', () => {
  it('o par de 5.000 vira SUGESTÃO; os falsos NÃO entram em suggestions', () => {
    const chatgpt = tx({ id: 'f3', bankAccountId: 'caixa loja/cofre', type: 'DEBIT', amount: 100, date: D('2026-07-06'), description: 'chat gpt' })
    const pixIn = tx({ id: 'f4', bankAccountId: 'sicredi', type: 'CREDIT', amount: 100, date: D('2026-07-06'), description: 'RECEBIMENTO PIX-PIX_CRED' })
    const nura = tx({ id: 'f1', bankAccountId: 'caixa loja/cofre', type: 'DEBIT', amount: 1000, date: D('2026-07-31'), description: 'NURA' })
    const opCredito = tx({ id: 'f2', bankAccountId: 'banrisul', type: 'CREDIT', amount: 1000, date: D('2026-07-31'), description: 'OP. CREDITO C/GARANTIA' })
    const res = detectTransfers([banrisul5000, sicredi5000, chatgpt, pixIn, nura, opCredito], {
      refs: REFS,
      valorComum: new Set([100, 1000]),
    })
    // suggestions = só o par de 5.000
    expect(res.suggestions.map((s) => [s.from.id, s.to.id])).toEqual([['r-out', 'r-in']])
    // nenhuma suggestion tem NURA/OP.CREDITO
    expect(res.suggestions.every((s) => s.from.id !== 'f1' && s.to.id !== 'f2')).toBe(true)
    // chat gpt × pix pode estar em weak (manual), nunca em suggestions
    expect(res.weak.every((w) => w.autoSuggest === false)).toBe(true)
  })
})
