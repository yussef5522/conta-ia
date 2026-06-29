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

// Sprint Fundação Status (28/06/2026): os 4 primeiros endpoints
// consolidaram o filtro inline em NEEDS_REVIEW_WHERE_PRISMA (lib única).
// Aceita ambos: filtro literal OU spread da fonte única.
function temFiltroLoanInstallment(code: string): boolean {
  const literal = /loanInstallmentPaid:\s*\{\s*is:\s*null\s*\}/.test(code)
  const fonteUnica =
    /\.\.\.NEEDS_REVIEW_WHERE_PRISMA/.test(code) ||
    /Object\.assign\(where,\s*NEEDS_REVIEW_WHERE_PRISMA\)/.test(code)
  return literal || fonteUnica
}

describe('Sprint Pendentes R2 — loanInstallmentPaid em endpoints de pendencias', () => {
  it('1) /api/conciliacao/ofx-pendentes exclui parcela casada', () => {
    const code = readFileSync(
      root('app/api/conciliacao/ofx-pendentes/route.ts'),
      'utf-8',
    )
    expect(temFiltroLoanInstallment(code)).toBe(true)
  })

  it('2) /api/transacoes (semCategoria=true) exclui parcela casada', () => {
    const code = readFileSync(root('app/api/transacoes/route.ts'), 'utf-8')
    // Sprint Fundação Status: filtro vem do spread NEEDS_REVIEW_WHERE_PRISMA
    // dentro do bloco if(semCategoria). Ambos devem aparecer.
    expect(code).toMatch(/semCategoria/)
    expect(temFiltroLoanInstallment(code)).toBe(true)
  })

  it('3) /api/conciliacao/bulk-dry-run exclui parcela casada', () => {
    const code = readFileSync(
      root('app/api/conciliacao/bulk-dry-run/route.ts'),
      'utf-8',
    )
    expect(temFiltroLoanInstallment(code)).toBe(true)
  })

  it('4) /api/dashboard/badges exclui parcela casada (em AMBAS as 2 counts)', () => {
    const code = readFileSync(root('app/api/dashboard/badges/route.ts'), 'utf-8')
    // Sprint Fundação Status: a fonte unica eh aplicada nas 2 contagens via
    // spread. Em vez de contar literais, conferimos que o spread aparece >= 2x.
    const spreads = code.match(/\.\.\.NEEDS_REVIEW_WHERE_PRISMA/g) ?? []
    const literais = code.match(/loanInstallmentPaid:\s*\{\s*is:\s*null\s*\}/g) ?? []
    expect(spreads.length + literais.length).toBeGreaterThanOrEqual(2)
  })

  it('5) /api/empresas/[id]/relatorios/drill-down/transacoes exclui parcela casada', () => {
    const code = readFileSync(
      root('app/api/empresas/[id]/relatorios/drill-down/transacoes/route.ts'),
      'utf-8',
    )
    // Drill-down não migrou pra fonte única (propósito diferente — lista
    // tx de categoria, não fila pendentes). Mantém filtro literal.
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
    // Sprint Fundação Status: filtro vem do NEEDS_REVIEW_WHERE_PRISMA aplicado
    // DENTRO do bloco if(semCategoria) via Object.assign. Lista geral fora do
    // bloco mantém visibilidade dos pagamentos de parcela.
    const semCategoriaBlockMatch = code.match(/if \(semCategoria\) \{[\s\S]+?\n\s{2,4}\}/)
    expect(semCategoriaBlockMatch).toBeTruthy()
    expect(semCategoriaBlockMatch![0]).toMatch(/NEEDS_REVIEW_WHERE_PRISMA/)
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
