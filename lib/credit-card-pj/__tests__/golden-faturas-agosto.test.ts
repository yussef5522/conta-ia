import { describe, it, expect } from 'vitest'
import { faturaNetTotal } from '../fatura-net-total'
import { FATURAS_AGOSTO, itens } from './fixtures/faturas-agosto-cacula'

// GOLDEN do MÓDULO (18/08) — faturaNetTotal + status pago das 3 faturas de agosto,
// travado ao centavo contra o dado real anonimizado. (O parser Sicredi tem o golden
// dele em deterministic/__tests__; aqui é o total do módulo.) Se um refactor mudar 1
// centavo, grita — e a regra é INVESTIGAR, não ajustar o esperado.

const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

// "PAID" no PJ é derivado: existe pagamento cujo valor == net (±0,01).
const estaPago = (net: number, pagamento: number | null) => pagamento != null && Math.abs(round2(net) - pagamento) <= 0.02

describe('GOLDEN faturas agosto Cacula (travado ao centavo)', () => {
  for (const f of FATURAS_AGOSTO) {
    describe(f.banco, () => {
      const net = faturaNetTotal(itens(f.linhas))
      it(`net = ${f.netEsperado.toFixed(2)} (compras ${f.comprasEsperado} − estornos ${f.estornosEsperado})`, () => {
        expect(net.compras).toBe(f.comprasEsperado)
        expect(net.estornos).toBe(f.estornosEsperado)
        expect(net.net).toBe(f.netEsperado)
      })
      it(`status = ${f.pagamento ? 'PAID' : 'OPEN'}`, () => {
        expect(estaPago(net.net, f.pagamento)).toBe(f.pagamento != null)
      })
    })
  }

  it('Sicredi: o estorno de 99,23 SUBTRAI (não soma) — 7.995,55 − 99,23 = 7.896,32', () => {
    const sic = FATURAS_AGOSTO.find((f) => f.banco === 'Sicredi')!
    const net = faturaNetTotal(itens(sic.linhas))
    expect(net.compras - net.estornos).toBeCloseTo(7896.32, 2)
    // prova o sinal: se o estorno somasse, daria 8094,78
    expect(net.net).not.toBe(round2(net.compras + net.estornos))
  })

  it('total das 3 faturas de agosto = 28.968,02 (soma dos nets)', () => {
    const soma = round2(FATURAS_AGOSTO.reduce((s, f) => s + faturaNetTotal(itens(f.linhas)).net, 0))
    expect(soma).toBe(round2(7896.32 + 13779.73 + 7292.97))
  })
})
