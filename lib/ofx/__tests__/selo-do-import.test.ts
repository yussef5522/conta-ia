// ⛔⛔ A TELA DE IMPORT PARA DE FABRICAR SUSTO (04/09/2026).
//
// O dono, olhando a tela: *"ela ainda compara contra o LEDGERBAL e me devolve 'não
// identifiquei a causa R$ 2.476,53' + o aviso fóssil do descolamento 11–13/08 — os dois já
// foram explicados e mortos em 01/09"*.
//
// ⭐ O QUE FOI PROVADO EM 01/09: o LEDGERBAL do Banrisul é o saldo **DISPONÍVEL** (desconta o
// bloqueio de 24h), e a conferência dia-a-dia contra o PDF fechou **22 de 22 dias**.
// ⚠️ E a ficha do banco já dizia `ledgerBalReliable: false` desde 29/08 — o import nunca leu.

import { describe, it, expect } from 'vitest'
import { decidirSelo, fraseDoSelo } from '../selo-do-import'
import { resolveBankProfile } from '@/lib/bank-profiles/registry'

const banrisul = resolveBankProfile('041')
const sicredi = resolveBankProfile('748')

describe('⛔⛔ Banrisul sem PDF: nada de caixa vermelha', () => {
  it('⛔⛔ NÃO compara contra o LEDGERBAL — comparar com número que mente é fabricar susto', () => {
    const d = decidirSelo(banrisul, false)
    expect(d.mostraGateLedgerBal, 'a caixa de "saldo não bate" voltou').toBe(false)
    expect(d.modo).toBe('SEM_CONFERENCIA')
  })

  it('⛔⛔ e NÃO roda o diagnóstico fóssil (ele se apoia no LEDGERBAL)', () => {
    // era ele que produzia "o descolamento começou entre 11/08 e 13/08"
    expect(decidirSelo(banrisul, false).rodaDiagnosticoLedgerBal).toBe(false)
  })

  it('⭐ a frase é honesta e ENSINA a saída: anexe o PDF', () => {
    const d = decidirSelo(banrisul, false)
    expect(d.aviso).toMatch(/DISPONÍVEL/)
    expect(d.aviso).toMatch(/bloqueio/)
    expect(d.aviso).toMatch(/PDF/)
    expect(d.pedePdf).toBe(true)
    // ⚠️ e diz que as linhas ENTRAM: não conferir o saldo não é motivo pra travar o import
    expect(d.aviso).toMatch(/entram normalmente/)
  })
})

describe('⭐⭐ com o PDF, a régua é o SALDO NA DATA', () => {
  it('⭐⭐ modo PDF_DIARIO, sem gate de LEDGERBAL', () => {
    const d = decidirSelo(banrisul, true)
    expect(d.modo).toBe('PDF_DIARIO')
    expect(d.mostraGateLedgerBal).toBe(false)
    expect(d.rodaDiagnosticoLedgerBal).toBe(false)
    expect(d.aviso).toBeNull()
  })

  it('⭐⭐ 22/22 dias fecham, com o bloqueio como INFORMAÇÃO', () => {
    const f = fraseDoSelo({
      diasConferidos: 22, diasQueFecham: 22, todosFecham: true, primeiroQueNaoFecha: null,
      bloqueado: 1700, saldoDisponivel: -4925.96, saldoContabil: -3225.96,
    })
    expect(f).toMatch(/22\/22 dias fecham/)
    // ⭐ os números de 01/09, do PDF real
    expect(f).toMatch(/contábil/)
    expect(f).toMatch(/disponível/)
    expect(f).toMatch(/bloqueio/)
  })

  it('⛔⛔ e quando NÃO fecha, diz QUAL dia e QUANTO — nunca "não identifiquei"', () => {
    const f = fraseDoSelo({
      diasConferidos: 22, diasQueFecham: 21, todosFecham: false,
      primeiroQueNaoFecha: { data: '2026-08-13', diferenca: -1463.71, lancamentos: [{ data: '2026-08-13', valor: -1463.71, descricao: 'PIX ENVIADO' }] },
      bloqueado: null, saldoDisponivel: null, saldoContabil: null,
    })
    expect(f).toMatch(/13\/08/)
    expect(f).toMatch(/1\.463,71/)
    expect(f).not.toMatch(/não identifiquei/i)
  })
})

describe('⭐ os outros bancos não mudam', () => {
  it('⭐ Sicredi segue com o gate de LEDGERBAL', () => {
    const d = decidirSelo(sicredi, false)
    expect(d.modo).toBe('LEDGERBAL')
    expect(d.mostraGateLedgerBal).toBe(true)
    expect(d.rodaDiagnosticoLedgerBal).toBe(true)
    expect(d.aviso).toBeNull()
  })

  it('⚠️ banco DESCONHECIDO não afirma nada — e diz que é por falta de ficha', () => {
    const d = decidirSelo(null, false)
    expect(d.mostraGateLedgerBal).toBe(false)
    expect(d.aviso).toMatch(/não reconhecido/)
    expect(d.pedePdf, 'pedir PDF a banco desconhecido seria chutar a mania dele').toBe(false)
  })
})
