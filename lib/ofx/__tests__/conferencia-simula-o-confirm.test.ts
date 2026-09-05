// ⛔⛔⛔ A CONFERÊNCIA ACUSAVA O PRÓPRIO CONTEÚDO DO IMPORT (05/09/2026).
//
// **O CASO REAL, ao centavo.** A tela disse *"01/09 não fecha: R$ 1.146,02 a mais"* — com os
// 3 encargos daquele dia **na lista "a importar" logo abaixo**. A conferência lia
// `lifecycle:'EFFECTED'` (só o que JÁ está no ledger) e rodava no PREVIEW, onde as linhas
// ainda não entraram. Por construção, **todo import acusava o que ele mesmo ia resolver**.
//
// A composição exata dos 1.146,02, medida contra os dois arquivos:
//
//     faltam no ledger (3 encargos de 01/09) ......  −1.741,70
//     sobram no ledger (2 CAPITALIZACAO RG) .......    +595,68   ← o banco re-datou pra 02/09
//                                                    ──────────
//                                                     +1.146,02
//
// ⭐ Nenhuma das duas causas sozinha dá esse número. As duas juntas dão, ao centavo.

import { describe, it, expect } from 'vitest'
import { conferirDiaADia, type LancamentoSistema } from '@/lib/bank-statement-pdf/conferencia-diaria'
import { fraseDoSelo } from '../selo-do-import'

// a régua do PDF: abertura + o SALDO NA DATA de cada dia
const REGUA = {
  saldoAnterior: { data: '2026-08-31', valor: -4925.96 },
  saldosDiarios: [
    // 31/08 −4.925,96 + movimento real de 01/09 (+2.981,68) = −1.944,28
    { data: '2026-09-01', valor: -1944.28 },
  ],
}

/** o que o ledger tinha na hora do preview: os 4 créditos + as 2 capitalizações */
const NO_LEDGER: LancamentoSistema[] = [
  { id: 'l1', data: '2026-09-01', valor: 4250.99, descricao: 'OP.CREDITO C/GARANTIA' },
  { id: 'l2', data: '2026-09-01', valor: 138.35, descricao: 'ANTECIP STONE' },
  { id: 'l3', data: '2026-09-01', valor: 73.68, descricao: 'ANTECIP STONE' },
  { id: 'l4', data: '2026-09-01', valor: 260.36, descricao: 'DEBITO STONE' },
  { id: 'l5', data: '2026-09-01', valor: -297.84, descricao: 'CAPITALIZACAO RG' },
  { id: 'l6', data: '2026-09-01', valor: -297.84, descricao: 'CAPITALIZACAO RG' },
]

/** os 3 encargos que estavam na lista "a importar" da MESMA tela */
const A_IMPORTAR: LancamentoSistema[] = [
  { id: 'a1', data: '2026-09-01', valor: -11.12, descricao: 'IOF' },
  { id: 'a2', data: '2026-09-01', valor: -71.68, descricao: 'IOF ADICIONAL' },
  { id: 'a3', data: '2026-09-01', valor: -1658.90, descricao: 'TRANSF. ENCARGOS CTA UNICA' },
]

/** as 2 capitalizações que o banco moveu pra 02/09 (a fronteira de dia) */
const MOVIDAS_PRO_DIA_2 = NO_LEDGER.filter((l) => l.descricao === 'CAPITALIZACAO RG')
const LEDGER_CORRIGIDO = NO_LEDGER.filter((l) => l.descricao !== 'CAPITALIZACAO RG')

describe('⛔ o que a tela dizia — e o número reproduzido', () => {
  it('⛔⛔ só com o ledger, 01/09 acusa exatamente R$ 1.146,02 a mais', () => {
    const r = conferirDiaADia(REGUA, NO_LEDGER)
    expect(r.todosFecham).toBe(false)
    expect(r.primeiroQueNaoFecha!.data).toBe('2026-09-01')
    expect(r.primeiroQueNaoFecha!.diferenca, 'o número que apareceu na tela do dono').toBeCloseTo(1146.02, 2)
  })

  it('⭐ e a composição: nenhuma das duas causas sozinha dá esse número', () => {
    // só o deslocamento das capitalizações explicaria 595,68…
    expect(Math.abs(MOVIDAS_PRO_DIA_2.reduce((s, l) => s + l.valor, 0))).toBeCloseTo(595.68, 2)
    // …e só os encargos faltando explicariam 1.741,70
    expect(Math.abs(A_IMPORTAR.reduce((s, l) => s + l.valor, 0))).toBeCloseTo(1741.70, 2)
    expect(1741.70 - 595.68).toBeCloseTo(1146.02, 2)
  })
})

describe('⭐⭐ a conferência SIMULA o confirmar', () => {
  it('⭐⭐ com as linhas do confirmar + as capitalizações no dia certo, 01/09 FECHA', () => {
    const r = conferirDiaADia(REGUA, [...LEDGER_CORRIGIDO, ...A_IMPORTAR])
    expect(r.todosFecham, 'o dia fecha quando o import entra e a data das capitalizações é a do PDF').toBe(true)
  })

  it('⭐⭐ e os DOIS desfechos são frases DIFERENTES na tela', () => {
    const fechaDepois = fraseDoSelo({
      diasConferidos: 1, diasQueFecham: 1, todosFecham: true, primeiroQueNaoFecha: null,
      bloqueado: null, saldoDisponivel: null, saldoContabil: -1944.28,
      linhasSimuladas: 3, fechaDepoisDeConfirmar: true,
    })
    expect(fechaDepois).toMatch(/DEPOIS de confirmar/)
    expect(fechaDepois).toMatch(/Nada a corrigir/)
    // ⚠️ e NÃO pode soar como alarme — é o susto fabricado que este sprint veio matar
    expect(fechaDepois).not.toMatch(/não fecha/)

    const nemDepois = fraseDoSelo({
      diasConferidos: 1, diasQueFecham: 0, todosFecham: false,
      primeiroQueNaoFecha: { data: '2026-09-01', diferenca: 1146.02, lancamentos: [] },
      bloqueado: null, saldoDisponivel: null, saldoContabil: null,
      linhasSimuladas: 3, fechaDepoisDeConfirmar: false,
    })
    expect(nemDepois, 'sem isto, os dois desfechos dizem a mesma coisa').toMatch(/nem depois de confirmar/)
    expect(nemDepois).toMatch(/1\.146,02/)
    expect(nemDepois).toMatch(/01\/09/)
  })

  it('⛔ sem nada pendente, a frase antiga continua igual — nada de "nem depois" fantasma', () => {
    const f = fraseDoSelo({
      diasConferidos: 22, diasQueFecham: 21, todosFecham: false,
      primeiroQueNaoFecha: { data: '2026-08-13', diferenca: -1463.71, lancamentos: [] },
      bloqueado: null, saldoDisponivel: null, saldoContabil: null,
      linhasSimuladas: 0, fechaDepoisDeConfirmar: false,
    })
    expect(f).not.toMatch(/nem depois/)
    expect(f).toMatch(/13\/08/)
  })

  it('⛔⛔ e o alarme LEGÍTIMO sobrevive: falta de verdade não vira "fecha depois"', () => {
    // some uma linha que o import NÃO traz → o dia não fecha nem simulando
    const r = conferirDiaADia(REGUA, [...LEDGER_CORRIGIDO, A_IMPORTAR[0], A_IMPORTAR[1]])
    expect(r.todosFecham).toBe(false)
    expect(r.primeiroQueNaoFecha!.diferenca, 'a TRANSF. ENCARGOS que ficou de fora').toBeCloseTo(1658.90, 2)
  })
})
