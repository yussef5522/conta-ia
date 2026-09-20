// ⛔⛔⛔ O PALPITE DE EMPRÉSTIMO NUNCA APARECEU — SELECT INCOMPLETO (19/09/2026)
//
// **O dono:** *"vinculei a parcela pelo gesto da caixa e nada aconteceu."*
//
// ⭐ **A CADEIA INTEIRA, medida em prod:**
//
//  1. `palpites-da-caixa.ts` buscava os contratos **sem o campo `status`**;
//  2. `detectLoanPayment` começa com `loans.filter(l => l.status === 'ACTIVE' || 'LATE')`
//     → com o campo **undefined**, a lista ficava **VAZIA**;
//  3. → nenhum contrato casava → **nenhum palpite de parcela, nunca**, nem pra
//     `LIQUIDACAO DE PARCELA-C41022570`, que a lib resolve sozinha (contrato `C41022570-0`,
//     parcela 14 — medido);
//  4. sem palpite, o dono escolheu numa lista de 8 contratos → **pegou o errado**;
//  5. resultado: a linha do `C41022570` foi parar na parcela **#24 do C41022227-1**
//     (vínculo CRUZADO), e a 2ª tentativa levou *"Alguns lançamentos não são elegíveis"*,
//     que não diz qual dos três motivos nem onde.
//
// ⚠️⚠️ **É A DOENÇA DO SELECT INCOMPLETO — a mesma do PIX de 7.000 (17/08):** o motor decide
// com um campo que a consulta não trouxe, e **não dá erro, dá silêncio**. O que deixou
// passar foi um `as never` no call-site: sem o cast, o TypeScript tinha pego.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectLoanPayment } from '@/lib/loans/detect-payment'
import { sugerirVinculoEmprestimo } from '@/lib/loans/sugerir-vinculo'

const fonte = (arq: string) =>
  readFileSync(join(process.cwd(), arq), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

/** ⭐ os contratos REAIS da Caçula (medidos em prod), com o `status` que o motor exige */
const LOANS = [
  { id: 'l-570', contractNumber: 'C41022570-0', lender: 'Sicredi', status: 'ACTIVE', dueDay: null },
  { id: 'l-227', contractNumber: 'C41022227-1', lender: 'Sicredi', status: 'ACTIVE', dueDay: null },
]
const PARCELAS = {
  'l-570': [{ number: 14, dueDate: new Date('2026-09-14'), status: 'OPEN', payment: 5617.23, paidTotal: null }],
  'l-227': [{ number: 25, dueDate: new Date('2026-10-14'), status: 'OPEN', payment: 6903.45, paidTotal: null }],
}
const LINHA = {
  description: 'LIQUIDACAO DE PARCELA-C41022570',
  type: 'DEBIT',
  date: new Date('2026-09-15'),
  amount: 5617.23,
}

describe('⭐⭐ a linha do extrato NOMEIA o contrato — e o motor acha', () => {
  it('⭐ o caso real: C41022570 (extrato) casa com C41022570-0 (cadastro)', () => {
    const d = detectLoanPayment(LINHA, LOANS as never)
    expect(d).toMatchObject({ kind: 'CONTRACT', loanId: 'l-570', contractNumber: 'C41022570-0' })
  })

  it('⭐ e a sugestão já vem com a PARCELA — o gesto é um clique só', () => {
    const s = sugerirVinculoEmprestimo(LINHA, LOANS as never, PARCELAS as never)
    expect(s).toMatchObject({ kind: 'SUGERIDO', loanId: 'l-570', installmentNumber: 14 })
  })

  it('⛔⛔ SEM O `status`, o motor fica CEGO — era este o defeito', () => {
    // exatamente o que o select incompleto produzia: objetos sem `status`
    const semStatus = LOANS.map(({ status: _s, ...resto }) => resto)
    const d = detectLoanPayment(LINHA, semStatus as never)
    expect(d, 'com o campo faltando o motor devia falhar — e falhava em SILÊNCIO')
      .not.toMatchObject({ kind: 'CONTRACT' })
    const s = sugerirVinculoEmprestimo(LINHA, semStatus as never, PARCELAS as never)
    expect(s).not.toMatchObject({ kind: 'SUGERIDO' })
  })

  it('⛔ o contrato ERRADO nunca casa com esta linha', () => {
    const soOutro = [LOANS[1]]
    const d = detectLoanPayment(LINHA, soOutro as never)
    expect(d).not.toMatchObject({ kind: 'CONTRACT', loanId: 'l-227' })
  })
})

describe('⛔⛔ o SELECT do palpite traz tudo que o motor lê', () => {
  const arq = 'lib/conciliacao/palpites-da-caixa.ts'

  it('⭐ o `status` está no select dos contratos', () => {
    const t = fonte(arq)
    const select = t.match(/db\.loan\.findMany\(\{[\s\S]{0,300}?\}\)/)?.[0] ?? ''
    expect(select, 'o `status` sumiu do select — o motor volta a ficar cego')
      .toMatch(/status: true/)
  })

  it('⛔⛔ e o `as never` NÃO volta — foi ele que calou o TypeScript', () => {
    const t = fonte(arq)
    expect(t, 'o cast voltou: o compilador para de pegar campo faltando')
      .not.toMatch(/loans as never/)
  })
})

describe('⭐ a recusa do vínculo ENSINA — e chega até a tela', () => {
  it('⭐ a mensagem genérica dos 3 motivos morreu', () => {
    const t = fonte('lib/loans/vincular-pagamento.ts')
    expect(t, 'voltou a listar os três motivos sem dizer qual')
      .not.toMatch(/'Alguns lançamentos não são elegíveis \(conta errada/)
    expect(t, 'a frase deixou de dizer ONDE a linha já está vinculada')
      .toMatch(/já está vinculada à parcela \$\{[\s\S]{0,40}\} do contrato/)
  })

  it('⛔ e o erro do vínculo vira 422 que fala, não 500 mudo', () => {
    const t = fonte('lib/conciliacao/resolver-linha.ts')
    expect(t, 'o VinculoDeParcelaError voltou a escapar como 500 sem corpo')
      .toMatch(/e instanceof VinculoDeParcelaError[\s\S]{0,60}new ResolverError\(e\.message\)/)
  })

  it('⛔ a recusa aparece NA LINHA, não no topo da tela', () => {
    const t = fonte('components/conciliacao/caixa-de-entrada.tsx')
    expect(t, 'o erro do gesto voltou pro topo — no celular isso é silêncio')
      .toMatch(/setErroDaLinha\(\{[\s\S]{0,80}id: linha\.id/)
    expect(t).toMatch(/erro=\{erroDaLinha\?\.id === l\.id/)
  })
})
