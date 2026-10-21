/**
 * ⭐⭐ A RÉGUA DO CAIXA NA BARRA DA SELEÇÃO — *"saldo hoje R$ X → pagando fica R$ Y"*.
 *
 * ⛔⛔ **O QUE ESTE ARQUIVO MAIS PROTEGE É O `null`.** Falhar em ler o caixa é ausência de
 * MEDIÇÃO, não caixa vazio — e tratar como zero faria a barra pintar coral *"pagando fica
 * −R$ 2.000"* e dizer ao dono pra **não pagar uma conta que ele pode pagar**. É a família do
 * `?? 'CAIXA'` que sumiu com o CASPER (20/09) e do *"zero é uma afirmação"*.
 */
import { describe, it, expect } from 'vitest'
import { reguaDoCaixaNaSelecao } from '../regua-do-caixa-na-selecao'

describe('a régua do caixa na seleção', () => {
  it('COBRE quando o saldo dá — verde, com o depois calculado', () => {
    const r = reguaDoCaixaNaSelecao(3, 1_200, 8_300)
    expect(r.tom).toBe('cobre')
    expect(r.depois).toBe(7_100)
  })

  it('⚠️ a frase NÃO carrega moeda — quem formata é a tela, num lugar só', () => {
    // ⭐ asserção corrigida depois de o teste me pegar: eu esperava o número DENTRO da
    // frase, e a lib o deixa de fora **de propósito** — `formatBRL` em dois lugares daria
    // dois jeitos de escrever dinheiro na mesma barra. Aqui mora a REGRA, não a moeda.
    const r = reguaDoCaixaNaSelecao(3, 1_200, 8_300)
    expect(r.frase).not.toMatch(/\d/)
    // ⛔ e o tom distingue cobre × estoura na própria frase, pra leitor de tela também
    expect(reguaDoCaixaNaSelecao(1, 10_000, 8_300).frase).toContain('NEGATIVO')
  })

  it('ESTOURA quando a seleção passa do saldo — coral, com o quanto falta', () => {
    const r = reguaDoCaixaNaSelecao(2, 10_000, 8_300)
    expect(r.tom).toBe('estoura')
    expect(r.depois).toBe(-1_700)
  })

  it('⭐ pagar EXATAMENTE o saldo COBRE — zerar o caixa não é estourar', () => {
    // ⚠️ `>=` e não `>`: coral é pra "vai faltar", e aqui não falta nada.
    const r = reguaDoCaixaNaSelecao(1, 8_300, 8_300)
    expect(r.tom).toBe('cobre')
    expect(r.depois).toBe(0)
  })

  it('⛔⛔ saldo NÃO LIDO vira "a apurar", NUNCA zero', () => {
    const r = reguaDoCaixaNaSelecao(2, 2_000, null)
    expect(r.tom).toBe('a-apurar')
    expect(r.depois).toBeNull()
    // a frase DIZ que não leu — não afirma nada sobre o caixa
    expect(r.frase.toLowerCase()).toContain('apurar')
    // ⛔ contrafactual: com o `?? 0` que a régua proíbe, isto viria 'estoura' com
    // depois = -2000 — coral sobre um saldo que ninguém mediu
    expect(r.tom).not.toBe('estoura')
  })

  it('saldo não-finito também é "a apurar" (NaN/Infinity não são medição)', () => {
    expect(reguaDoCaixaNaSelecao(1, 100, Number.NaN).tom).toBe('a-apurar')
    expect(reguaDoCaixaNaSelecao(1, 100, Number.POSITIVE_INFINITY).tom).toBe('a-apurar')
  })

  it('arredonda em 2 casas — o depois é dinheiro, não float cru', () => {
    const r = reguaDoCaixaNaSelecao(2, 0.1 + 0.2, 1)
    expect(r.depois).toBe(0.7)
  })

  it('a contagem e o total atravessam intactos (a barra só desenha)', () => {
    const r = reguaDoCaixaNaSelecao(6, 2_886.37, 8_300)
    expect(r.contagem).toBe(6)
    expect(r.total).toBe(2_886.37)
    expect(r.saldoHoje).toBe(8_300)
  })
})
