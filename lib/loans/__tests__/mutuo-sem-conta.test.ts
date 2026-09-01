// ⛔⛔ "NULL NÃO PODE VIRAR FILTRO QUE CASA COM TUDO" (dono, 01/09/2026).
//
// Ao autorizar a migration que tornou `loans.bankAccountId` nullable, o dono nomeou a classe
// de bug a vigiar: *"é a mesma classe do `includes('')`"*. Este arquivo trava as três formas
// dela no módulo de empréstimos.
//
// ⭐ A RÉGUA CONCEITUAL, antes da técnica: **mútuo que não transita por conta NÃO TEM
// transação bancária pra casar.** A resposta certa pra "quais lançamentos do extrato são
// deste contrato" é "nenhum, por construção" — então o caminho certo é RECUSAR CEDO, não
// rodar uma query que finge procurar.

import { describe, it, expect } from 'vitest'
import { exigeContaDoEmprestimo, temContaBancaria, MutuoSemContaError } from '../exige-conta'

const COM_CONTA = { bankAccountId: 'cmq2o25qe0001y2faydl1yrp5' }
const SEM_CONTA = { bankAccountId: null }

describe('⛔⛔ as três formas do null virar filtro', () => {
  it('⛔⛔ FORMA 1 — `where: { bankAccountId: null }` casa com as ÓRFÃS DE CONTA', () => {
    // ⚠️ e elas existem aos montes: `transactions.bankAccountId` é nullable desde o Sprint
    // 4.0.1.a (PAYABLE/RECEIVABLE criados sem conta definida). Um filtro `IS NULL` ofereceria
    // essas contas a pagar pra vincular à parcela de um mútuo — vínculo que não existe.
    expect(() => exigeContaDoEmprestimo(SEM_CONTA, 'procurar candidatos')).toThrow(MutuoSemContaError)
  })

  it('⛔⛔ FORMA 2 — `?? undefined` REMOVE o filtro e casa com o banco INTEIRO', () => {
    // ⚠️ em Prisma, `undefined` num `where` faz o campo sumir da query. Nenhum dos 8 pontos
    // fazia isso, mas é o "conserto" mais provável de quem mexer sem entender — por isso o
    // guard devolve `string` (o TypeScript recusa passar null adiante) em vez de deixar o
    // call-site escolher um fallback.
    const id: string = exigeContaDoEmprestimo(COM_CONTA, 'x')
    expect(id).toBe(COM_CONTA.bankAccountId)
    expect(typeof id).toBe('string') // nunca undefined, nunca null
  })

  it('⛔⛔ FORMA 3 — `null !== null` é FALSE e APROVA o que devia recusar', () => {
    // esta é a pior: o guard que existia pra proteger vira porta aberta, em silêncio.
    const txSemConta = { bankAccountId: null }
    const loanSemConta = { bankAccountId: null }
    expect(txSemConta.bankAccountId !== loanSemConta.bankAccountId).toBe(false) // ⛔ "iguais"

    // a régua corrigida (a mesma das rotas): qualquer null RECUSA
    const recusa = (tx: { bankAccountId: string | null }, loan: { bankAccountId: string | null }) =>
      !loan.bankAccountId || !tx.bankAccountId || tx.bankAccountId !== loan.bankAccountId
    expect(recusa(txSemConta, loanSemConta)).toBe(true)
    expect(recusa({ bankAccountId: 'a' }, { bankAccountId: 'a' })).toBe(false) // e o caso bom passa
  })
})

describe('⭐ a recusa ENSINA — nunca um erro genérico', () => {
  it('⭐ a mensagem diz POR QUE não há o que casar, e o que ainda funciona', () => {
    try {
      exigeContaDoEmprestimo(SEM_CONTA, 'vincular a parcela')
      throw new Error('devia ter lançado')
    } catch (e) {
      const msg = (e as Error).message
      expect(msg).toContain('não transita por conta bancária')
      expect(msg).toContain('vincular a parcela')       // a AÇÃO que o usuário tentou
      expect(msg).toContain('devoluções')                // ⭐ o que AINDA funciona
    }
  })

  it('⭐ e a ação aparece na mensagem, então cada caminho se identifica', () => {
    const acoes = ['conciliar automaticamente', 'procurar candidatos', 'vincular a liberação']
    for (const a of acoes) {
      expect(() => exigeContaDoEmprestimo(SEM_CONTA, a)).toThrow(a)
    }
  })
})

describe('⚠️ listagem PULA o contrato sem conta em vez de quebrar', () => {
  it('⚠️ a detecção de pendentes não pode derrubar a tela por causa de um mútuo direto', () => {
    // o `deteccao-pendentes` agrupa contratos por conta pra buscar `bankAccountId: { in: [...] }`.
    // Um `null` na lista casaria com as órfãs; o certo é o contrato ficar de fora da busca.
    const loans = [COM_CONTA, SEM_CONTA, { bankAccountId: 'outra' }]
    const agrupaveis = loans.filter(temContaBancaria)
    expect(agrupaveis).toHaveLength(2)
    expect(agrupaveis.map((l) => l.bankAccountId)).not.toContain(null)
  })
})
