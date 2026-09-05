// ⛔⛔ O BANCO REESCREVE O PASSADO — e isso não pode entrar em silêncio (05/09/2026).
//
// **CASO REAL, dos dois PDFs:** o de 01/09 declarava `SALDO ANT EM 31/08 = −7.353,66`
// (e agosto fechava 22/22); o de 05/09 declara **−8.130,19**. São **R$ 776,53** que o
// Banrisul postou em agosto DEPOIS do fato. Setembro bate ao centavo — o furo é todo em agosto.

import { describe, it, expect } from 'vitest'
import { reescritaDoBanco } from '../ancora-abertura'
import { conferirDiaADia } from '@/lib/bank-statement-pdf/conferencia-diaria'

describe('⭐ a frase da reescrita', () => {
  const aviso = reescritaDoBanco([{ data: '2026-08-31', de: -7353.66, para: -8130.19, diferenca: -776.53 }])

  it('⭐⭐ diz o mês, o valor e O QUE FAZER — nunca um vermelho sem saída', () => {
    expect(aviso).toBeTruthy()
    expect(aviso!).toMatch(/agosto/)
    expect(aviso!).toMatch(/776,53/)
    expect(aviso!, 'o dono precisa saber como resolver').toMatch(/extrato de AGOSTO/)
    expect(aviso!).toMatch(/7\.353,66/)
    expect(aviso!).toMatch(/8\.130,19/)
  })

  it('⭐ sem reescrita, nenhum aviso (nada de alarme fantasma)', () => {
    expect(reescritaDoBanco([])).toBeNull()
  })
})

describe('⛔⛔ o furo de agosto NÃO contamina setembro', () => {
  // ⭐ cada dia declarado é uma equação independente: a conferência segue do saldo do
  // BANCO, não do nosso. Sem isso, 776,53 de agosto pintariam TODO setembro de vermelho e
  // esconderiam onde o problema começou.
  const regua = {
    saldoAnterior: { data: '2026-08-28', valor: -4567.03 },
    saldosDiarios: [
      { data: '2026-08-31', valor: -8130.19 }, // o banco reescreveu (era −7.353,66)
      { data: '2026-09-01', valor: -5148.51 },
      { data: '2026-09-02', valor: -4841.10 },
    ],
  }
  // o nosso ledger: agosto como estava (fecha em −7.353,66) e setembro correto
  const lancamentos = [
    { id: 'ago', data: '2026-08-31', valor: -2786.63, descricao: 'movimento de agosto' }, // −4567,03 → −7353,66
    { id: 's1', data: '2026-09-01', valor: 2981.68, descricao: 'movimento de 01/09' },
    { id: 's2', data: '2026-09-02', valor: 307.41, descricao: 'movimento de 02/09' },
  ]

  it('⛔⛔ 31/08 acusa exatamente os 776,53; 01/09 e 02/09 FECHAM', () => {
    const r = conferirDiaADia(regua, lancamentos)
    const por = new Map(r.dias.map((d) => [d.data, d]))
    expect(por.get('2026-08-31')!.fecha, 'o furo de agosto tem que aparecer').toBe(false)
    expect(por.get('2026-08-31')!.diferenca).toBeCloseTo(776.53, 2)
    expect(por.get('2026-09-01')!.fecha, 'setembro herdou o furo de agosto').toBe(true)
    expect(por.get('2026-09-02')!.fecha).toBe(true)
    expect(r.primeiroQueNaoFecha!.data, 'o dia em que o descolamento COMEÇOU').toBe('2026-08-31')
  })
})

describe('⛔⛔ REESCRITA × EXPORT DE MEIO-DIA — o que separa os dois é a HORA', () => {
  // ⛔ Na 1ª rodada em prod o aviso somou o 01/09 ao 31/08 e anunciou R$ 2.699,08 de
  // "reescrita". Mas a declaração anterior de 01/09 fora emitida às 14:01 DO PRÓPRIO DIA —
  // um parcial, não um fechamento. O número que o dono mediu é 776,53, só o 31/08.
  it('⭐⭐ a frase fala do MÊS certo e do valor certo', () => {
    const aviso = reescritaDoBanco([{ data: '2026-08-31', de: -7353.66, para: -8130.19, diferenca: -776.53 }])!
    expect(aviso).toMatch(/agosto/)
    expect(aviso).toMatch(/776,53/)
    expect(aviso, 'inflou com um parcial de setembro').not.toMatch(/2\.699,08/)
    expect(aviso, 'mês abreviado errado ("set" no lugar de setembro)').not.toMatch(/ set /)
  })
})
