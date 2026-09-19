// ⭐⭐ O DEEP-LINK LEVA O ALVO — E A BUSCA CHEGA SEMEADA (17/09/2026)
//
// Duas réguas puras que fecham as bordas do conserto da caixa de entrada:
//  · `pernaDoDeepLink` — o `/parear` passou a CONSUMIR o `?abrir=`;
//  · `nomeDaBusca` — o painel abre já procurando o nome que a linha do banco traz.

import { describe, it, expect } from 'vitest'
import { pernaDoDeepLink } from '@/lib/transfers/perna-do-deep-link'
import { nomeDaBusca } from '@/lib/conciliacao/nome-da-busca'

const DEB = [{ id: 'tx-saida' }, { id: 'tx-outra' }]
const CRE = [{ id: 'tx-entrada' }]

describe('⭐ a perna que o dono tocou já vem marcada, do lado certo', () => {
  it('⭐ saída → marca o DÉBITO e deixa o crédito em branco', () => {
    expect(pernaDoDeepLink('tx-saida', DEB, CRE)).toEqual({ debitId: 'tx-saida', creditId: '', achou: 'DEBITO' })
  })

  it('⭐ entrada → marca o CRÉDITO', () => {
    expect(pernaDoDeepLink('tx-entrada', DEB, CRE)).toEqual({ debitId: '', creditId: 'tx-entrada', achou: 'CREDITO' })
  })

  it('⛔⛔ NUNCA chuta a outra perna — casar transferência errada move dinheiro na conta errada', () => {
    const r = pernaDoDeepLink('tx-saida', DEB, CRE)
    expect(r.creditId, 'pré-marcou um par que ninguém avaliou').toBe('')
  })

  it('⛔ linha que não está entre as órfãs não marca nada (e a tela avisa)', () => {
    expect(pernaDoDeepLink('tx-ja-pareada', DEB, CRE)).toEqual({ debitId: '', creditId: '', achou: null })
  })

  it('⛔ sem parâmetro, a tela abre como sempre', () => {
    expect(pernaDoDeepLink(null, DEB, CRE).achou).toBeNull()
    expect(pernaDoDeepLink(undefined, DEB, CRE).debitId).toBe('')
  })
})

describe('⭐ a busca do painel nasce com o nome da linha — sem procurar numa lista de 100', () => {
  it('⭐ o caso real do dono: BAMBERG', () => {
    expect(nomeDaBusca('BAMBERG COMERCIO E REPRES LTDA - Pagamento')).toBe('BAMBERG COMERCIO E REPRES LTDA')
  })

  it('⭐ corta a cauda do banco em todas as grafias que o extrato usa', () => {
    expect(nomeDaBusca('CIA DA FRUTA COMERCIO LTDA - Transferência | Pix')).toBe('CIA DA FRUTA COMERCIO LTDA')
    expect(nomeDaBusca('MARIA LUIZA COELHO - Pix')).toBe('MARIA LUIZA COELHO')
  })

  it('⛔ preserva MAIÚSCULA e acento — o `contains` do Postgres é case-sensitive (28/08)', () => {
    const r = nomeDaBusca('Cerâmica São João LTDA - Pagamento')
    expect(r).toBe('Cerâmica São João LTDA')
    expect(r).not.toBe(r.toLowerCase())
  })

  it('⛔⛔ linha que NÃO nomeia ninguém devolve vazio — semear com lixo acharia "nenhuma conta"', () => {
    expect(nomeDaBusca('DEB.CTA.FATURA-030129693')).toBe('')
    expect(nomeDaBusca('')).toBe('')
    expect(nomeDaBusca(null)).toBe('')
  })

  it('⭐ nome sem cauda nenhuma passa inteiro', () => {
    expect(nomeDaBusca('FRIGORIFICO SILVA INDUSTRIA E COMERCIO')).toBe('FRIGORIFICO SILVA INDUSTRIA E COMERCIO')
  })
})

describe('⛔ o que distingue nome de CÓDIGO DE BANCO é a forma, não o tamanho da palavra', () => {
  /**
   * ⚠️ A 1ª régua era *"tem palavra de 3+ letras"* — e o TESTE me pegou: o
   * `DEB.CTA.FATURA-030129693` tem "FATURA" e passava, semeando a busca com um código.
   * O que separa é rubrica vir **grudada e com dígito**; nome vem com espaço.
   */
  it('⭐ rubrica grudada com dígito → vazio', () => {
    expect(nomeDaBusca('DEB.CTA.FATURA-030129693')).toBe('')
    expect(nomeDaBusca('PIX_CRED43098655000157')).toBe('')
  })

  it('⛔ mas fornecedor de UMA palavra continua servindo de busca', () => {
    expect(nomeDaBusca('CASPER - Pagamento')).toBe('CASPER')
  })

  it('⛔ e nome com número no meio NÃO é descartado (tem espaço)', () => {
    expect(nomeDaBusca('POSTO 24 HORAS LTDA - Pagamento')).toBe('POSTO 24 HORAS LTDA')
  })
})
