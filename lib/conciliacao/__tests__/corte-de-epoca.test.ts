// ⭐⭐⭐ CORTE DE ÉPOCA — A FILA PARA DE OFERECER O QUE O DONO DECIDIU NÃO FAZER (11/09/2026)
//
// **O dono:** *"Comecei a usar a conciliação em setembro; agosto fica pra trás POR DECISÃO —
// as linhas de agosto já estão categorizadas como despesa, completas no DRE."*
//
// ⛔⛔ **O CORTE É DA VITRINE, NUNCA DO DADO.** A linha de agosto continua nas Movimentações,
// continua no DRE e o Find & Match ainda a acha quando ele procura.

import { describe, it, expect } from 'vitest'
import { comCorte } from '../corte-de-epoca'

const CORTE = new Date('2026-09-01T00:00:00Z')

describe('⭐ comCorte junta o corte com a janela sem perder nenhum dos dois', () => {
  it('⭐ sem corte, a consulta passa intacta (empresa que não configurou enxerga tudo)', () => {
    const w = { date: { gte: new Date('2026-08-01'), lte: new Date('2026-09-30') }, origin: 'OFX' }
    expect(comCorte(w, null)).toBe(w)
  })

  it('⭐⭐ o corte vence quando é MAIS restritivo que a janela', () => {
    const r = comCorte({ date: { gte: new Date('2026-08-01T00:00:00Z'), lte: new Date('2026-09-30T00:00:00Z') } }, CORTE)
    expect(r.date!.gte).toEqual(CORTE)
    expect(r.date!.lte).toEqual(new Date('2026-09-30T00:00:00Z'))   // ⭐ o teto da janela sobrevive
  })

  it('⛔⛔ a JANELA vence quando ela é mais restritiva — o corte não pode AFROUXAR', () => {
    // a janela de ±N dias existe pra não casar pagamento com conta de três meses atrás;
    // se o corte a substituísse, a fila passaria a oferecer par que ela já rejeitava.
    const janela = new Date('2026-09-20T00:00:00Z')
    const r = comCorte({ date: { gte: janela, lte: new Date('2026-09-30T00:00:00Z') } }, CORTE)
    expect(r.date!.gte).toEqual(janela)
  })

  it('⭐ consulta sem janela nenhuma ganha o corte', () => {
    const r = comCorte({ origin: 'OFX' } as { origin: string; date?: { gte?: Date; lte?: Date } }, CORTE)
    expect(r.date!.gte).toEqual(CORTE)
  })

  it('⛔ e a consulta original NÃO é mutada — o objeto é reusado entre as 4 queries da fila', () => {
    const w = { date: { gte: new Date('2026-08-01T00:00:00Z') } }
    comCorte(w, CORTE)
    expect(w.date.gte).toEqual(new Date('2026-08-01T00:00:00Z'))
  })
})
