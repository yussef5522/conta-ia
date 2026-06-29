// Sprint Pagamento Parcela Redesign — defensivos de integração.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('endpoint candidatos — aceita PDF + tolerância pos-fixado', () => {
  const code = readFileSync(
    root('app/api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]/candidatos/route.ts'),
    'utf-8',
  )

  it("origin aceita IN ('OFX','PDF','MANUAL')", () => {
    expect(code).toMatch(/origin:\s*\{\s*in:\s*\[\s*'OFX',\s*'PDF',\s*'MANUAL'\s*\]\s*\}/)
  })

  it('NÃO usa mais hardcoded origin=OFX', () => {
    expect(code).not.toMatch(/origin:\s*'OFX'\s*,/)
  })

  it('importa lib pura installment-match', () => {
    expect(code).toMatch(/from '@\/lib\/loans\/installment-match'/)
    expect(code).toMatch(/computeMatchConfidence/)
    expect(code).toMatch(/computePosFixedSplit/)
    expect(code).toMatch(/computePreFixedSplit/)
  })

  it('retorna confidence + split por candidato', () => {
    expect(code).toMatch(/confidence,/)
    expect(code).toMatch(/split,/)
  })
})

describe('endpoint POST — recalcula split pos-fixado server-side', () => {
  const code = readFileSync(
    root('app/api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]/route.ts'),
    'utf-8',
  )

  it('importa computePosFixedSplit / computePreFixedSplit', () => {
    expect(code).toMatch(/from '@\/lib\/loans\/installment-match'/)
    expect(code).toMatch(/computePosFixedSplit/)
    expect(code).toMatch(/computePreFixedSplit/)
  })

  it('escolhe split baseado em isEstimate', () => {
    expect(code).toMatch(/installment\.isEstimate\s*\?\s*computePosFixedSplit/)
  })

  it('grava interest + correcao + realPayment + closingBalance', () => {
    expect(code).toMatch(/realPayment:\s*split\.realPayment/)
    expect(code).toMatch(/interest:\s*split\.interest/)
    expect(code).toMatch(/correcao:\s*split\.correcao/)
    expect(code).toMatch(/closingBalance:\s*split\.closingBalance/)
    expect(code).toMatch(/payment:\s*split\.realPayment/)
  })

  it('response inclui split (pro toast da UI mostrar)', () => {
    expect(code).toMatch(/split:\s*\{/)
    expect(code).toMatch(/totalDespesaFinanceira/)
  })
})

describe('DRE — query auxiliar soma correcao + interest', () => {
  const code = readFileSync(root('app/api/empresas/[id]/dre/route.ts'), 'utf-8')

  it('select inclui correcao no loanInstallmentPaid', () => {
    expect(code).toMatch(/select:\s*\{\s*interest:\s*true,\s*correcao:\s*true,\s*amortization:\s*true/)
  })

  it('jurosTotal = interest + correcao (não so interest)', () => {
    expect(code).toMatch(/const\s+correcao\s*=\s*t\.loanInstallmentPaid\?\.correcao\s*\?\?\s*0/)
    expect(code).toMatch(/const\s+jurosTotal\s*=\s*interest\s*\+\s*correcao/)
    expect(code).toMatch(/loanInterestSplit:\s*jurosTotal/)
  })

  it('preserva guard de 100% amortização (jurosTotal === 0 → pula)', () => {
    expect(code).toMatch(/if\s*\(\s*jurosTotal\s*<=\s*0\s*\)\s*continue/)
  })
})

describe('UI — modal CandidatosDialog tem confirmação premium', () => {
  const code = readFileSync(
    root('app/(dashboard)/empresas/[id]/emprestimos/[loanId]/_components/candidatos-dialog.tsx'),
    'utf-8',
  )

  it('mostra selo IA com % confidence', () => {
    expect(code).toMatch(/IA ·/)
    expect(code).toMatch(/Math\.round\(.*?\.score.*?\* 100\)/)
  })

  it('banner CDI quando pos-fixado + diff positivo', () => {
    expect(code).toMatch(/showCDIBanner/)
    expect(code).toMatch(/correção do CDI/)
    expect(code).toMatch(/STJ/)
  })

  it('breakdown "Como fica nos livros" com amortização + juros + correção', () => {
    expect(code).toMatch(/Como fica nos livros/)
    expect(code).toMatch(/Amortização do principal/)
    expect(code).toMatch(/Juros do contrato/)
    expect(code).toMatch(/split\.correcao > 0/)
  })

  it('botões "Não é esta" e "Confirmar pagamento"', () => {
    expect(code).toMatch(/Não é esta/)
    expect(code).toMatch(/Confirmar pagamento/)
  })
})
