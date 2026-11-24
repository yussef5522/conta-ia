// Sprint Pagamento Parcela Redesign — defensivos de integração.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

// ⛔⛔ R54/R55 (25/11/2026) — AQUI VIVIAM 3 DESCRIBES QUE EXIGIAM O DEFEITO: a rota do "marcar
// paga" com split PRÓPRIO (installment-match) gravando `payment`/`interest`/`correcao`/
// `closingBalance` POR CIMA da agenda, e o DRE lendo `interest + correcao` da agenda pela porta
// 1:1. A lei nova (docs/emprestimos-referencia.html) mata as duas coisas. O comportamento novo é
// provado por EXECUÇÃO em `lib/loans/__tests__/porta-unica-r54.integration.test.ts`; o que fica
// aqui é a trava estrutural de que a rota é um fio fino em volta da porta.
describe('⛔ R54 — o "marcar paga" do detalhe é a PORTA ÚNICA', () => {
  const sem = (c: string) => c.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  const rota = sem(readFileSync(root('app/api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]/route.ts'), 'utf-8'))
  const cand = sem(readFileSync(root('app/api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]/candidatos/route.ts'), 'utf-8'))
  it('POST grava por vincularPagamentoDeParcela e DELETE desfaz por desfazerVinculoDeParcela', () => {
    expect(rota).toMatch(/vincularPagamentoDeParcela\(/)
    expect(rota).toMatch(/desfazerVinculoDeParcela\(/)
  })
  it('⛔ a rota não escreve na parcela por conta própria (a agenda é sagrada — R55)', () => {
    expect(rota).not.toMatch(/loanInstallment\.update/)
    expect(rota).not.toMatch(/installment-match/)
  })
  it('as candidatas são a PRÉVIA da porta (mesma régua, mesmo split)', () => {
    expect(cand).toMatch(/previaDoVinculo\(/)
    expect(cand).not.toMatch(/computePosFixedSplit|computePreFixedSplit/)
  })
})

describe('UI — modal CandidatosDialog tem confirmação premium', () => {
  const code = readFileSync(
    root('app/(dashboard)/empresas/[id]/emprestimos/[loanId]/_components/candidatos-dialog.tsx'),
    'utf-8',
  )

  // ⛔ 25/11 (R54) — o selo de % de confiança e o banner do CDI morreram com o split próprio: o
  // diálogo mostra a PRÉVIA da porta (o que vai ser gravado), e a recusa da régua única
  it('breakdown "Como fica nos livros" com amortização + juros + correção', () => {
    expect(code).toMatch(/Como fica nos livros/)
    expect(code).toMatch(/Amortização do principal/)
    expect(code).toMatch(/Juros do contrato/)
    expect(code).toMatch(/split\.paidCorrection > 0/)
  })

  it('botões "Não é esta" e "Confirmar pagamento"', () => {
    expect(code).toMatch(/Não é esta/)
    expect(code).toMatch(/Confirmar pagamento/)
  })
})
