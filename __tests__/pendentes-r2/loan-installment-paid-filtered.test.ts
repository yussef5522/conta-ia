// Sprint Pendentes Fix R2 — pagamentos de parcelas de emprestimo casadas
// (LoanInstallment.reconciledTransactionId aponta pra tx) NAO aparecem
// em pendencias/categorias/badges/drill-down.
//
// Motivacao: bug do filtro (mesma classe do R6.1 cartao). Sem este filtro,
// tx ja casada com parcela vira nova "obrigacao de categorizar" do user.
// Pior: se ele categoriza, vai pra DRE e duplica contagem (engine ja conta
// juros via loanInterestSplit).
//
// Padrao Prisma: filtro reverso 1-1 `loanInstallmentPaid: { is: null }`.
// Equivalente a "nenhuma LoanInstallment tem reconciledTransactionId = tx.id".
//
// Tests de "presenca da linha" no codigo (defensivos a regressao do filtro).
// Mesmo padrao do R6.1 (__tests__/credit-card-pj/r6-1-card-payment-filtered.test.ts).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('Sprint Pendentes R2 — loanInstallmentPaid: { is: null } em endpoints de pendencias', () => {
  it('1) /api/conciliacao/ofx-pendentes exclui parcela casada', () => {
    const code = readFileSync(
      root('app/api/conciliacao/ofx-pendentes/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/loanInstallmentPaid:\s*\{\s*is:\s*null\s*\}/)
  })

  it('2) /api/transacoes (semCategoria=true) exclui parcela casada', () => {
    const code = readFileSync(root('app/api/transacoes/route.ts'), 'utf-8')
    // O fix esta dentro do bloco `if (semCategoria)` — exige que a
    // assignment aparece junto com semCategoria
    expect(code).toMatch(/where\.loanInstallmentPaid\s*=\s*\{\s*is:\s*null\s*\}/)
    expect(code).toMatch(/semCategoria/)
  })

  it('3) /api/conciliacao/bulk-dry-run exclui parcela casada', () => {
    const code = readFileSync(
      root('app/api/conciliacao/bulk-dry-run/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/loanInstallmentPaid:\s*\{\s*is:\s*null\s*\}/)
  })

  it('4) /api/dashboard/badges exclui parcela casada (em AMBAS as 2 counts)', () => {
    const code = readFileSync(root('app/api/dashboard/badges/route.ts'), 'utf-8')
    // 2 ocorrencias (1 por count: a conciliacao OFX + a pendentes)
    const matches = code.match(/loanInstallmentPaid:\s*\{\s*is:\s*null\s*\}/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it('5) /api/empresas/[id]/relatorios/drill-down/transacoes exclui parcela casada', () => {
    const code = readFileSync(
      root('app/api/empresas/[id]/relatorios/drill-down/transacoes/route.ts'),
      'utf-8',
    )
    expect(code).toMatch(/loanInstallmentPaid:\s*\{\s*is:\s*null\s*\}/)
  })
})

// ============================================================================
// Sanity check: telas legitimas onde o pagamento DEVE continuar aparecendo
// NAO podem ter o filtro adicionado.
// ============================================================================
describe('Sprint Pendentes R2 — telas legitimas mantem visibilidade', () => {
  it('extrato/lista geral de transacoes SEM filtro semCategoria nao exclui parcela casada', () => {
    const code = readFileSync(root('app/api/transacoes/route.ts'), 'utf-8')
    // Confirma que loanInstallmentPaid so eh filtrado DENTRO do bloco semCategoria
    // (pra lista geral, default, NAO deve esconder pagamentos de parcela)
    const semCategoriaBlockMatch = code.match(/if \(semCategoria\) \{[\s\S]+?\n\s*\}/)
    expect(semCategoriaBlockMatch).toBeTruthy()
    expect(semCategoriaBlockMatch![0]).toMatch(/loanInstallmentPaid/)
    // Fora do bloco semCategoria nao deve ter where.loanInstallmentPaid seta
    // (extrato completo mantem visibilidade)
    const codeWithoutBlock = code.replace(semCategoriaBlockMatch![0], '')
    expect(codeWithoutBlock).not.toMatch(/where\.loanInstallmentPaid/)
  })

  it('schema Prisma tem o relation reverso esperado (loanInstallmentPaid)', () => {
    // Defesa contra rename/remove do relation — todo o filtro depende dele.
    const schema = readFileSync(root('prisma/schema.prisma'), 'utf-8')
    expect(schema).toMatch(/loanInstallmentPaid\s+LoanInstallment\?/)
    expect(schema).toMatch(/reconciledTransactionId\s+String\?\s+@unique/)
  })
})
