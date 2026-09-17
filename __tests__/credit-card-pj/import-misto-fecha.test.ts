// ⛔⛔⛔ IMPORT MISTO — O VALIDADOR APRENDE A PARTIÇÃO (17/09/2026)
//
// **O dono, na fatura Sicredi:** *"40 linhas, 8 já no sistema (R$ 828,50, em leitura sem
// checkbox — como a tela de ontem manda), 32 novas marcadas (R$ 2.365,85). Confirmar →
// 'a soma das linhas 2.365,85 não fecha com o total 3.194,35, diferença 828,50' — a diferença
// é EXATAMENTE as 8 que a própria tela impediu de marcar."*
//
// ⛔⛔ **A TELA APRENDEU E O VALIDADOR FICOU PRA TRÁS.** O preview já dizia a frase certa
// (*"você marcou 32 de 40, por isso o total é outro"*); o `confirm` continuava exigindo que
// as ENVIADAS fechassem sozinhas. **Duas réguas, agora entre preview e confirm** — a dupla
// que já custou o import de OFX inteiro.
//
// ⛔ E A DEFESA NÃO AFROUXA: fatura 100% nova não tem nada gravado, `jaNoSistema` é 0, e o
// fechamento continua exigindo a soma cheia. *Ela não ficou permissiva — aprendeu que a
// fatura pode chegar em duas partes.*

import { describe, it, expect } from 'vitest'
import { fecharImport } from '@/lib/credit-card-pj/fechamento-do-import'

const novas = (n: number, valor: number) =>
  Array.from({ length: n }, (_, i) => ({ kind: 'COMPRA_AVISTA' as const, amount: valor, contentHash: `novo-${i}` }))
const gravadas = (n: number, valor: number, tipo = 'DEBIT') =>
  Array.from({ length: n }, (_, i) => ({ type: tipo, amount: valor, contentHash: `velho-${i}`, isCardPayment: false }))

describe('⭐⭐ o caso REAL do dono: 32 novas + 8 já no sistema', () => {
  // 32 × 73,9328125 = 2.365,85 · 8 × 103,5625 = 828,50
  const ENVIADAS = novas(32, 2365.85 / 32)
  const GRAVADAS = gravadas(8, 828.5 / 8)

  it('⭐⭐ fecha por Σ(novas) + Σ(já no sistema) = 3.194,35', () => {
    const f = fecharImport(ENVIADAS, GRAVADAS)
    expect(f.novas).toBe(2365.85)
    expect(f.jaNoSistema).toBe(828.5)
    expect(f.net, 'a diferença acusada era exatamente as 8 que a tela impediu de marcar').toBe(3194.35)
  })

  it('⛔ a régua ANTIGA (só as enviadas) daria 2.365,85 — a diferença de 828,50 do erro', () => {
    const f = fecharImport(ENVIADAS, [])
    expect(f.net).toBe(2365.85)
    expect(Math.round((3194.35 - f.net) * 100) / 100).toBe(828.5)
  })
})

describe('⛔ a defesa continua inteira onde não há partição', () => {
  it('⭐ fatura 100% nova: nada gravado, fechamento cheio', () => {
    const f = fecharImport(novas(10, 10), [])
    expect(f.jaNoSistema).toBe(0)
    expect(f.net).toBe(100)
  })

  it('⛔ linha faltando continua NÃO fechando', () => {
    const f = fecharImport(novas(9, 10), [])
    expect(f.net).toBe(90) // contra um total de 100 → o confirm recusa
  })
})

describe('⭐ as bordas que fariam a conta dobrar ou torcer', () => {
  /** ⚠️ reenviar a fatura inteira: a linha enviada que JÁ existe conta UMA vez */
  it('⭐ linha enviada que já está gravada não conta duas vezes', () => {
    const enviada = [{ kind: 'COMPRA_AVISTA' as const, amount: 100, contentHash: 'h1' }]
    const jaTem = [{ type: 'DEBIT', amount: 100, contentHash: 'h1', isCardPayment: false }]
    const f = fecharImport(enviada, jaTem)
    expect(f.net, 'a mesma linha foi contada nos dois lados').toBe(100)
    expect(f.enviadasDuplicadas).toBe(1)
  })

  /** ⛔ estorno JÁ GRAVADO subtrai — senão o misto com crédito nunca fecharia */
  it('⭐ estorno já no sistema entra com sinal', () => {
    const f = fecharImport(novas(1, 100), [
      { type: 'CREDIT', amount: 18, contentHash: 'c1', isCardPayment: false },
    ])
    expect(f.jaNoSistema).toBe(-18)
    expect(f.net).toBe(82)
  })

  /** ⛔ pagamento da fatura não é lançamento dela */
  it('⭐ pagamento de fatura gravado fica FORA da conta', () => {
    const f = fecharImport(novas(1, 100), [
      { type: 'CREDIT', amount: 5000, contentHash: 'pg', isCardPayment: true },
    ])
    expect(f.jaNoSistema).toBe(0)
    expect(f.net).toBe(100)
  })
})
