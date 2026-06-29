// Sprint DRE Cleanup (28/06/2026) — auditoria de coerencia engine ≡ SQL DRE.
//
// 3 achados corrigidos:
//   #1 mapper popula isCardPayment + pendingTransfer (defesa em profundidade)
//   #2 parcela emprestimo casada FORA da query principal + reinjetada como
//      juros (Despesas Financeiras), nao mais inflando uncategorized
//   #3 lookup deterministico (name + dreGroup) em /pair e /classify-equity

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('Sprint DRE Cleanup — ACHADO #2 query principal filtra parcela casada', () => {
  const code = readFileSync(root('app/api/empresas/[id]/dre/route.ts'), 'utf-8')

  it('SQL filtra loanInstallmentPaid: { is: null }', () => {
    expect(code).toMatch(/loanInstallmentPaid:\s*\{\s*is:\s*null\s*\}/)
  })

  it('SQL filtra loanDisbursement: { is: null } (liberacao nao eh receita)', () => {
    expect(code).toMatch(/loanDisbursement:\s*\{\s*is:\s*null\s*\}/)
  })

  it('query auxiliar busca parcelas casadas com interest + correcao', () => {
    expect(code).toMatch(/loanInstallmentPaid:\s*\{\s*isNot:\s*null\s*\}/)
    // Sprint Pagamento Parcela Redesign (28/06/2026) — select inclui correcao
    expect(code).toMatch(/loanInstallmentPaid:[\s\S]*?select:[\s\S]*?interest:\s*true/)
    expect(code).toMatch(/loanInstallmentPaid:[\s\S]*?select:[\s\S]*?correcao:\s*true/)
  })

  it('reinjeta parcelas como tx categorizada com loanInterestSplit = juros + correcao', () => {
    expect(code).toMatch(/loanInterestSplit:\s*jurosTotal/)
    expect(code).toMatch(/categoryId:\s*jurosCategory\.id/)
    // Sprint Pagamento Parcela Redesign — soma juros + correcao
    expect(code).toMatch(/const\s+jurosTotal\s*=\s*interest\s*\+\s*correcao/)
  })

  it('pula parcela 100% amortizacao (jurosTotal <= 0)', () => {
    expect(code).toMatch(/if\s*\(\s*jurosTotal\s*<=\s*0\s*\)\s*continue/)
  })

  it('busca categoria "Juros sobre Empréstimos" por nome (na empresa)', () => {
    expect(code).toMatch(/'Juros sobre Empréstimos'/)
  })
})

describe('Sprint DRE Cleanup — ACHADO #1 defesa em profundidade no mapper', () => {
  const code = readFileSync(root('app/api/empresas/[id]/dre/route.ts'), 'utf-8')

  it('select inclui isCardPayment + pendingTransfer', () => {
    // Dentro do select da query principal
    const selectBlock = code.match(/select:\s*\{[\s\S]+?categoryId:\s*true[\s\S]+?\}/)
    expect(selectBlock).toBeTruthy()
    expect(selectBlock![0]).toMatch(/isCardPayment:\s*true/)
    expect(selectBlock![0]).toMatch(/pendingTransfer:\s*true/)
  })

  it('mapper passa isCardPayment + pendingTransfer pro engine', () => {
    const mapBlock = code.match(/transactionsRaw\.map\(\(t\)\s*=>\s*\(\{[\s\S]+?\}\)\)/)
    expect(mapBlock).toBeTruthy()
    expect(mapBlock![0]).toMatch(/isCardPayment:\s*t\.isCardPayment/)
    expect(mapBlock![0]).toMatch(/pendingTransfer:\s*t\.pendingTransfer/)
  })
})

describe('Sprint DRE Cleanup — ACHADO #3 lookup determinístico equity', () => {
  it('/pair busca name + dreGroup (anti-duplicação)', () => {
    const code = readFileSync(
      root('app/api/transferencias/aguardando-par/[txId]/pair/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/targetCategoryDreGroup/)
    expect(code).toMatch(/'APORTES_CAPITAL'/)
    expect(code).toMatch(/'DISTRIBUICAO_LUCROS'/)
    // findFirst tem dreGroup no where
    expect(code).toMatch(/dreGroup:\s*targetCategoryDreGroup/)
  })

  it('/classify-equity também busca name + dreGroup', () => {
    const code = readFileSync(
      root('app/api/transferencias/aguardando-par/[txId]/classify-equity/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/targetCategoryDreGroup/)
    expect(code).toMatch(/dreGroup:\s*targetCategoryDreGroup/)
  })
})

describe('Sprint DRE Cleanup — TransactionForDRE type respeita os 5 campos', () => {
  it('TransactionForDRE inclui os 5 opcionais (defesa em profundidade)', () => {
    const code = readFileSync(root('lib/dre/types.ts'), 'utf-8')
    expect(code).toMatch(/isCardPayment\?:\s*boolean/)
    expect(code).toMatch(/pendingTransfer\?:\s*boolean/)
    expect(code).toMatch(/isLoanDisbursement\?:\s*boolean/)
    expect(code).toMatch(/loanInterestSplit\?:\s*number/)
  })
})
