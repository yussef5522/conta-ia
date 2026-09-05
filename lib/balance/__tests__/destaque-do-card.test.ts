// ⭐⭐ O NÚMERO GRANDE DO CARD (05/09/2026) — com os números reais do Banrisul de hoje.
//
// Decisão do dono: o destaque passa a ser o **SALDO DEVEDOR**, o mesmo que o app do banco
// mostra. *"Sistema mostrando outro número em destaque parece errado mesmo estando certo."*
//
// ⛔ E a fronteira: **só apresentação**. Ledger, conferência, selo e âncora seguem no
// CONTÁBIL — o devedor dança com o bloqueio sem lançamento nenhum.

import { describe, it, expect } from 'vitest'
import { destaqueDoCard, totalDasContas } from '../destaque-do-card'

/** o Banrisul da Caçula em 05/09, medido em prod */
const BANRISUL = {
  contabil: -6647.67,
  declarado: -8347.67,
  declaradoEm: new Date('2026-09-04T00:00:00Z'),
  bloqueio: 1700,
  bloqueioEm: new Date('2026-09-05T00:00:00Z'),
  declaradoEhRegua: false,          // ficha: ledgerBalReliable false
  selo: { fecham: 26, conferidos: 26 },
}

describe('⭐⭐ conta cujo declarado embute bloqueio (Banrisul)', () => {
  const d = destaqueDoCard(BANRISUL)

  it('⭐⭐ o número GRANDE é o devedor — o que o dono compara todo dia', () => {
    expect(d.valor).toBeCloseTo(-8347.67, 2)
    expect(d.rotulo).toBe('DEVEDOR')
  })

  it('⭐⭐ e vem DATADO — dado velho tem que se denunciar sozinho', () => {
    expect(d.em, 'sem data, um número de ontem passa por atual').not.toBeNull()
    expect(d.em!.toISOString().slice(0, 10)).toBe('2026-09-04')
  })

  it('⭐⭐ a linha de apoio: bloqueio explicado · contábil visível · selo junto', () => {
    expect(d.apoio).toMatch(/1\.700,00 bloqueado \(\+24h\)/)
    expect(d.apoio).toMatch(/contábil.*6\.647,67/)
    expect(d.apoio).toMatch(/conferido 26\/26 dias/)
  })

  it('⚠️ o bloqueio vai com a data DELE — ele muda todo dia', () => {
    expect(d.apoio).toMatch(/em 05\/09/)
  })

  it('⛔ sem bloqueio medido, não se inventa um', () => {
    const semBloqueio = destaqueDoCard({ ...BANRISUL, bloqueio: null, bloqueioEm: null })
    expect(semBloqueio.apoio).not.toMatch(/bloqueado/)
    expect(semBloqueio.valor, 'o destaque não depende do bloqueio').toBeCloseTo(-8347.67, 2)
  })

  it('⛔ e se o banco não declarou saldo nenhum, o destaque volta ao contábil', () => {
    const semDeclarado = destaqueDoCard({ ...BANRISUL, declarado: null, declaradoEm: null })
    expect(semDeclarado.rotulo).toBe('CONTABIL')
    expect(semDeclarado.valor).toBeCloseTo(-6647.67, 2)
  })
})

describe('⛔⛔ é a FICHA que manda, nunca um if do Banrisul', () => {
  it('⭐⭐ banco cujo declarado É régua (Sicredi/Stone): o destaque segue o CONTÁBIL', () => {
    const sicredi = destaqueDoCard({
      contabil: -49956.9, declarado: -49956.9, declaradoEm: new Date('2026-09-03T00:00:00Z'),
      bloqueio: null, bloqueioEm: null, declaradoEhRegua: true, selo: null,
    })
    expect(sicredi.rotulo).toBe('CONTABIL')
    expect(sicredi.valor).toBeCloseTo(-49956.9, 2)
    expect(sicredi.em, 'contábil é sempre "agora" — datar sugeriria que envelhece').toBeNull()
    // ⚠️ e nem mostra "contábil X" na linha de apoio: seria repetir o número grande
    expect(sicredi.apoio).not.toMatch(/contábil/)
  })

  it('⭐ o dia em que o Banrisul consertar o LEDGERBAL, o card acerta sozinho', () => {
    expect(destaqueDoCard({ ...BANRISUL, declaradoEhRegua: true }).rotulo).toBe('CONTABIL')
  })
})

describe('⛔⛔ o que NÃO muda: o total é sempre o contábil', () => {
  it('⛔⛔ somar o devedor faria o total dançar com o bloqueio de cada banco', () => {
    const contas = [
      { contabil: -6647.67, declarado: -8347.67 },  // banrisul: 1.700 de bloqueio
      { contabil: -49956.9, declarado: -49956.9 },
      { contabil: 636.63, declarado: 636.63 },
    ]
    expect(totalDasContas(contas)).toBeCloseTo(-55967.94, 2)
    // o total pelo declarado seria 1.700 menor — sem lançamento nenhum por trás
    const peloDeclarado = contas.reduce((s, c) => s + c.declarado, 0)
    expect(Math.abs(peloDeclarado - totalDasContas(contas))).toBeCloseTo(1700, 2)
  })
})
