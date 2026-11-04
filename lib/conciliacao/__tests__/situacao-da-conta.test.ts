/**
 * ⭐⭐⭐ O CARD PARA DE MENTIR — A RÉGUA DOS QUATRO DESTINOS (04/11/2026)
 *
 * O caso que gerou o sprint, medido em prod: conta `cmw107zq21v6oljf8u71otgyc`, E.M.S.,
 * **R$ 408,65**, paga **em dinheiro** no `caixa loja/cofre` (`accountType='CASH'`,
 * `cashKind='MAIN'`, **0** tx de extrato em 495). O dono categorizou (`Matéria-Prima -
 * Alimentos`, 04/11 17:06) **e o card seguiu gritando "dupla contagem"** — porque a régua
 * velha era `lifecycle === 'EFFECTED' ? 'DUPLA_CONTAGEM' : 'EM_ABERTO'` e não olhava nem a
 * conta nem a categoria.
 *
 * ⚠️ Este arquivo trava a régua PURA. Ele **não** prova que a fila lê `accountType` do
 * banco — essa é a parte que o select incompleto escondia, e ela se prova contra banco em
 * `fila-paga-por-fora.integration.test.ts`. *Régua certa com select incompleto fica verde
 * aqui e mente na tela.*
 */
import { describe, it, expect } from 'vitest'
import {
  situacaoDaConta, pedeGesto, TIPO_DE_CONTA_DINHEIRO,
  type FatosDaSituacao,
} from '../situacao-da-conta'

/** ⭐ o CASO REAL, com os campos PREENCHIDOS (valor, tipo de conta e categoria de verdade) */
const CACULA_408: FatosDaSituacao = {
  lifecycle: 'EFFECTED',
  accountType: 'CASH',
  categoryId: 'cmq18categoria_materia_prima',
}

/** a régua VELHA, copiada aqui pro contrafactual do caso (d) */
const reguaVelha = (f: FatosDaSituacao) => (f.lifecycle === 'EFFECTED' ? 'DUPLA_CONTAGEM' : 'EM_ABERTO')

describe('situacaoDaConta — paga em dinheiro não é dupla contagem', () => {
  it('(a) O CASO REAL: 408,65 paga em dinheiro e JÁ CATEGORIZADA → resolvida, zero alarme', () => {
    const s = situacaoDaConta(CACULA_408)
    expect(s).toBe('PAGA_POR_FORA_RESOLVIDA')
    expect(pedeGesto(s), 'nada a fazer: não há par a costurar nem campo a preencher').toBe(false)
  })

  it('(b) o MESMO caso sem categoria → PAGA_POR_FORA (pede classificação, não costura)', () => {
    const s = situacaoDaConta({ ...CACULA_408, categoryId: null })
    expect(s).toBe('PAGA_POR_FORA')
    expect(pedeGesto(s), 'aparece na fila — é trabalho real do dono').toBe(true)
  })

  it('(c) paga numa conta COM extrato (CHECKING) → segue DUPLA_CONTAGEM, com ou sem categoria', () => {
    for (const categoryId of ['cmq18alguma_categoria', null]) {
      const s = situacaoDaConta({ ...CACULA_408, accountType: 'CHECKING', categoryId })
      expect(s, `categoria ${categoryId ?? 'nula'} não absolve a dupla contagem`).toBe('DUPLA_CONTAGEM')
      expect(pedeGesto(s)).toBe(true)
    }
  })

  /**
   * ⛔⛔ O CONTRAFACTUAL — sem ele eu só teria uma afirmação sobre o mundo bom. A régua
   * velha gritava `DUPLA_CONTAGEM` no caso (a), que é exatamente a tela que o dono viu.
   */
  it('(d) a régua VELHA gritava DUPLA_CONTAGEM no caso (a) — a nova não', () => {
    expect(reguaVelha(CACULA_408)).toBe('DUPLA_CONTAGEM')
    expect(situacaoDaConta(CACULA_408)).not.toBe('DUPLA_CONTAGEM')
  })

  it('conta a pagar ainda NÃO paga segue EM_ABERTO — casar ali liquida', () => {
    for (const lifecycle of ['PAYABLE', 'RECEIVABLE']) {
      expect(situacaoDaConta({ ...CACULA_408, lifecycle })).toBe('EM_ABERTO')
    }
  })

  /**
   * ⛔ *ausência ≠ zero*, e isto foi MEDIDO: no prod há 2 contas `CHECKING` sem nenhuma tx
   * de extrato (cadastradas, ainda sem import). Se o discriminador fosse a CONTAGEM de
   * extrato, elas virariam "paga por fora" e a dupla contagem real ficaria escondida até o
   * primeiro import. O lado conservador é o certo aqui.
   */
  it('⛔ conta CHECKING sem extrato nenhum NÃO vira paga-por-fora (o declarado decide)', () => {
    expect(situacaoDaConta({ ...CACULA_408, accountType: 'CHECKING' })).toBe('DUPLA_CONTAGEM')
  })

  it('conta sem banco (accountType null) não é tratada como dinheiro', () => {
    expect(situacaoDaConta({ ...CACULA_408, accountType: null })).toBe('DUPLA_CONTAGEM')
  })

  /** ⚠️ o valor é LIDO do schema, não um sinônimo escolhido por mim */
  it('o tipo que marca dinheiro é exatamente o do schema: CASH', () => {
    expect(TIPO_DE_CONTA_DINHEIRO).toBe('CASH')
  })
})
