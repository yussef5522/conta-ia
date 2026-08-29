// ⭐⭐ O COMBINADO ≠ A NOTA — caso real BOX PAPER (29/08/2026).
//
// A NF-e traz 3 duplicatas de R$ 3.466,89 (total 10.400,66). O dono falou com o
// fornecedor: os 3 boletos foram CANCELADOS e vieram 4 novos. A nota não muda; o
// combinado mudou. Estes testes travam a REGRA — a prova end-to-end contra o banco está
// em `renegociacao.integration.test.ts`.

import { describe, it, expect } from 'vitest'
import { validarCombinado, numeroRenegociado } from '../combinado'

// ── o caso real ──
const TOTAL_NOTA = 10400.66
const XML = [
  { numero: '001', valor: 3466.89, dVenc: '2026-09-10' },
  { numero: '002', valor: 3466.89, dVenc: '2026-10-10' },
  { numero: '003', valor: 3466.88, dVenc: '2026-11-10' }, // o centavo mora na última
]
/** o que o fornecedor passou: 4 parcelas iguais que somam a mesma coisa */
const RENEGOCIADO = [
  { numero: 'R01', valor: 2600.17, dVenc: '2026-09-15' },
  { numero: 'R02', valor: 2600.17, dVenc: '2026-10-15' },
  { numero: 'R03', valor: 2600.16, dVenc: '2026-11-15' },
  { numero: 'R04', valor: 2600.16, dVenc: '2026-12-15' },
]
const HOJE = new Date('2026-08-29T12:00:00.000Z')

describe('⭐⭐ BOX PAPER — 3 duplicatas do XML viram 4 parcelas combinadas', () => {
  it('as 3 do XML fecham com a nota (é o ponto de partida)', () => {
    const v = validarCombinado({ parcelas: XML, totalNota: TOTAL_NOTA, hoje: HOJE })
    expect(v.soma).toBe(10400.66)
    expect(v.fechaComANota).toBe(true)
    expect(v.podeGravar).toBe(true)
  })

  it('⭐⭐ as 4 renegociadas somam o MESMO total → grava sem exigir motivo', () => {
    const v = validarCombinado({ parcelas: RENEGOCIADO, totalNota: TOTAL_NOTA, hoje: HOJE })
    expect(v.soma).toBe(10400.66)
    expect(v.diferenca).toBe(0)
    expect(v.fechaComANota).toBe(true)
    expect(v.exigeMotivo).toBe(false)
    expect(v.podeGravar).toBe(true)
    expect(v.erros).toEqual([])
  })

  it('a numeração das renegociadas NÃO colide com a do XML', () => {
    // é o que mantém o UNIQUE do stock_payable_link funcionando quando a nota já mandou
    // '001'..'003' antes e agora manda 'R01'..'R04'.
    const novos = RENEGOCIADO.map((_, i) => numeroRenegociado(i))
    expect(novos).toEqual(['R01', 'R02', 'R03', 'R04'])
    expect(novos.some((n) => XML.some((x) => x.numero === n))).toBe(false)
  })
})

describe('⭐ soma que NÃO fecha: avisa e pede motivo — nunca trava', () => {
  // desconto de R$ 400,66 numa renegociação à vista-ish: 4× 2.500
  const COM_DESCONTO = RENEGOCIADO.map((p) => ({ ...p, valor: 2500 }))

  it('⭐⭐ sem motivo NÃO grava (o porquê tem que ficar escrito)', () => {
    const v = validarCombinado({ parcelas: COM_DESCONTO, totalNota: TOTAL_NOTA, hoje: HOJE })
    expect(v.fechaComANota).toBe(false)
    expect(v.diferenca).toBe(-400.66)
    expect(v.exigeMotivo).toBe(true)
    expect(v.podeGravar).toBe(false)
    expect(v.avisos.join(' ')).toMatch(/renegociação/i)
  })

  it('⭐⭐ COM motivo grava — desconto e juros são a realidade, não erro de digitação', () => {
    const v = validarCombinado({ parcelas: COM_DESCONTO, totalNota: TOTAL_NOTA, motivo: 'desconto negociado', hoje: HOJE })
    expect(v.podeGravar).toBe(true)
    expect(v.erros).toEqual([])
    // ⚠️ e o AVISO continua aparecendo: gravar não apaga o fato de que não fecha
    expect(v.avisos.length).toBeGreaterThan(0)
  })

  it('para MAIS que a nota (juros) também passa com motivo', () => {
    const comJuros = RENEGOCIADO.map((p) => ({ ...p, valor: 2700 }))
    const v = validarCombinado({ parcelas: comJuros, totalNota: TOTAL_NOTA, motivo: 'juros da renegociação', hoje: HOJE })
    expect(v.diferenca).toBe(399.34)
    expect(v.avisos.join(' ')).toMatch(/passa/)
    expect(v.podeGravar).toBe(true)
  })
})

describe('⛔ o que TRAVA (sem isso a conta a pagar não existiria)', () => {
  it('lista vazia', () => {
    const v = validarCombinado({ parcelas: [], totalNota: TOTAL_NOTA })
    expect(v.podeGravar).toBe(false)
    expect(v.erros.join(' ')).toMatch(/vazia/)
  })
  it('parcela sem vencimento — o Contas a Pagar precisa da data', () => {
    const v = validarCombinado({ parcelas: [{ numero: 'R01', valor: 100, dVenc: '' }], totalNota: 100 })
    expect(v.podeGravar).toBe(false)
    expect(v.erros.join(' ')).toMatch(/sem vencimento/)
  })
  it('parcela com valor zero ou negativo', () => {
    expect(validarCombinado({ parcelas: [{ numero: 'R01', valor: 0, dVenc: '2026-09-10' }], totalNota: 100 }).podeGravar).toBe(false)
    expect(validarCombinado({ parcelas: [{ numero: 'R01', valor: -5, dVenc: '2026-09-10' }], totalNota: 100 }).podeGravar).toBe(false)
  })
  it('número repetido (viraria uma conta a pagar só)', () => {
    const v = validarCombinado({
      parcelas: [
        { numero: 'R01', valor: 50, dVenc: '2026-09-10' },
        { numero: 'R01', valor: 50, dVenc: '2026-10-10' },
      ],
      totalNota: 100,
    })
    expect(v.podeGravar).toBe(false)
    expect(v.erros.join(' ')).toMatch(/repetido/)
  })
})

describe('⚠️ vencimento no passado AVISA, não trava', () => {
  it('renegociação de boleto atrasado é o caso mais urgente que existe', () => {
    const v = validarCombinado({
      parcelas: [{ numero: 'R01', valor: TOTAL_NOTA, dVenc: '2026-08-01' }],
      totalNota: TOTAL_NOTA,
      hoje: HOJE,
    })
    expect(v.podeGravar).toBe(true) // ⚠️ travar aqui impediria justamente quem está regularizando
    expect(v.avisos.join(' ')).toMatch(/já passou/)
  })
})

describe('a régua do centavo', () => {
  it('1 centavo de diferença ainda FECHA (arredondamento de divisão por 3)', () => {
    const v = validarCombinado({ parcelas: [{ numero: 'R01', valor: 10400.67, dVenc: '2026-09-10' }], totalNota: TOTAL_NOTA })
    expect(v.fechaComANota).toBe(true)
    expect(v.exigeMotivo).toBe(false)
  })
  it('2 centavos já pedem motivo', () => {
    const v = validarCombinado({ parcelas: [{ numero: 'R01', valor: 10400.68, dVenc: '2026-09-10' }], totalNota: TOTAL_NOTA })
    expect(v.fechaComANota).toBe(false)
    expect(v.exigeMotivo).toBe(true)
  })
})
