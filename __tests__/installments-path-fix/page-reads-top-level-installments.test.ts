// Sprint Fix Installments Path (27/06/2026) — defensivo de regressão.
//
// O endpoint /api/empresas/[id]/emprestimos/[loanId] retorna installments
// NO TOP-LEVEL ({loan, agregados, installments, chartPoints}). A page do
// importar OFX V3 lia `data.loan?.installments` (sempre undefined) — bug
// cosmético que zerava pendingInstallments dos loans no client.
//
// Este teste lê o source da page e do endpoint, e garante o contrato:
//   1. page.tsx do importar OFX consome `data.installments` (top-level)
//   2. endpoint do detalhe de loan EXPÕE `installments` no top-level
//   3. page.tsx NÃO usa mais o caminho errado `data.loan?.installments`

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('Sprint Fix Installments Path — shape contract', () => {
  const importarPagePath = root(
    'app/(dashboard)/empresas/[id]/contas/[contaId]/importar/page.tsx',
  )
  const detailEndpointPath = root(
    'app/api/empresas/[id]/emprestimos/[loanId]/route.ts',
  )

  it('page.tsx do importar OFX usa data.installments (top-level)', () => {
    const code = readFileSync(importarPagePath, 'utf-8')
    expect(code).toMatch(/data\.installments/)
  })

  it('page.tsx do importar OFX NAO usa o caminho errado data.loan?.installments (em código ativo)', () => {
    const code = readFileSync(importarPagePath, 'utf-8')
    // Remove comentários e strings antes de checar (comentário ainda
    // documenta o bug, mas não conta como uso real). Comentário começa
    // com `//` (linha) ou `*` (jsdoc) — tira ambos.
    const codeWithoutComments = code
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
      .replace(/^\s*\/\/.*$/gm, '')      // line comments
    expect(codeWithoutComments).not.toMatch(/data\.loan\?\.installments/)
    expect(codeWithoutComments).not.toMatch(/data\.loan\.installments/)
  })

  it('endpoint detail expõe installments NO TOP-LEVEL do JSON', () => {
    const code = readFileSync(detailEndpointPath, 'utf-8')
    // Múltiplos `return NextResponse.json(...)` no arquivo (erros + sucesso).
    // Pegamos o BLOCO de sucesso, que tem agregados/loan/installments juntos.
    const allReturns = [...code.matchAll(/return\s+NextResponse\.json\(\s*\{[\s\S]+?\n\s+\}\s*\)/g)]
    const successBlock = allReturns
      .map((m) => m[0])
      .find((b) => /loan:\s*\{/.test(b) && /agregados:/.test(b))
    expect(successBlock).toBeTruthy()

    const block = successBlock!

    // Top-level deve ter `installments,` ou `installments\n` — confirma que
    // NÃO está dentro de `loan: { ... installments }`.
    const loanBlockMatch = block.match(/loan:\s*\{[\s\S]+?\n\s+\},/)
    if (loanBlockMatch) {
      expect(loanBlockMatch[0]).not.toMatch(/^\s*installments[,:]/m)
    }
    // E confirma que `installments` aparece como chave no objeto raiz
    expect(block).toMatch(/\n\s+installments,/)
  })

  it('tipo TS explícito do response previne regressão futura', () => {
    const code = readFileSync(importarPagePath, 'utf-8')
    // Confirma que existe uma interface tipando o shape correto
    expect(code).toMatch(/interface\s+LoanDetailResponse/)
    expect(code).toMatch(/installments:\s*Array<\{/)
  })
})
