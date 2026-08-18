import { describe, it, expect } from 'vitest'
import { faturaNetTotal, signedFaturaAmount, type FaturaItem } from '../fatura-net-total'

// FASE 2 — PROPRIEDADES (P1, P3). Sem fast-check (não instalado); gerador
// determinístico (LCG semente fixa) = 500 casos reproduzíveis. As props DB-state
// (P2 pagamento único, P5 NON_LEARNABLE, P7 companyId) vão pro juiz na FASE 3 (K).

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x7fffffff }
}
function gerarFatura(rng: () => number): FaturaItem[] {
  const n = 1 + Math.floor(rng() * 20)
  const items: FaturaItem[] = []
  for (let i = 0; i < n; i++) {
    const r = rng()
    const amount = round2(rng() * 2000 + 0.5)
    if (r < 0.15) items.push({ type: 'CREDIT', amount }) // estorno
    else if (r < 0.25) items.push({ type: 'DEBIT', amount, isCardPayment: true }) // pagamento (ignora)
    else items.push({ type: 'DEBIT', amount }) // compra
  }
  return items
}

describe('P1 — faturaNetTotal == Σ(DEBIT) − Σ(CREDIT), pagamento ignorado', () => {
  it('500 faturas geradas: net = compras − estornos, sempre', () => {
    const rng = makeRng(20260818)
    for (let k = 0; k < 500; k++) {
      const itens = gerarFatura(rng)
      const compras = round2(itens.filter((i) => !i.isCardPayment && i.type !== 'CREDIT').reduce((s, i) => s + i.amount, 0))
      const estornos = round2(itens.filter((i) => !i.isCardPayment && i.type === 'CREDIT').reduce((s, i) => s + i.amount, 0))
      const net = faturaNetTotal(itens)
      expect(net.compras).toBe(compras)
      expect(net.estornos).toBe(estornos)
      expect(net.net).toBe(round2(compras - estornos))
    }
  })
})

describe('P3 — CREDIT nunca somado como débito em NENHUM Σ (REGRA 6)', () => {
  it('signedFaturaAmount: CREDIT < 0, DEBIT > 0', () => {
    expect(signedFaturaAmount({ type: 'CREDIT', amount: 99.23 })).toBe(-99.23)
    expect(signedFaturaAmount({ type: 'DEBIT', amount: 100 })).toBe(100)
  })

  it('adicionar um estorno de v SEMPRE reduz o net em v (nunca aumenta)', () => {
    const rng = makeRng(42)
    for (let k = 0; k < 500; k++) {
      const base = gerarFatura(rng)
      const netBase = faturaNetTotal(base).net
      const v = round2(rng() * 500 + 0.5)
      const netComEstorno = faturaNetTotal([...base, { type: 'CREDIT', amount: v }]).net
      expect(netComEstorno).toBe(round2(netBase - v))
      expect(netComEstorno).toBeLessThanOrEqual(netBase)
    }
  })

  it('SWEEP: os Σ do módulo concordam — net == Σ signedFaturaAmount (não-pagamento)', () => {
    // faturaNetTotal, signedFaturaAmount e review-queue usam a MESMA regra de sinal.
    // Se um 7º lugar somar CREDIT positivo, este invariante quebra.
    const rng = makeRng(7)
    for (let k = 0; k < 500; k++) {
      const itens = gerarFatura(rng)
      const viaSigned = round2(itens.filter((i) => !i.isCardPayment).reduce((s, i) => s + signedFaturaAmount(i), 0))
      expect(faturaNetTotal(itens).net).toBe(viaSigned)
    }
  })
})
