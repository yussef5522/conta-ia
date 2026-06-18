// Fix Detalhe Empréstimo Em Andamento (17/06/2026)
// Bug 1: badge falso "Liberação não linkada — receita fake no DRE" quando o
//        empréstimo é EM_ANDAMENTO. Liberação foi anterior ao período do
//        CAIXAOS, NUNCA entrou como receita.
// Bug 2: off-by-one na exibição de datas. "2021-10-19" virava "18 de out."
//        por causa de UTC midnight + BRT-3.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')

describe('Fix detalhe — endpoint expõe campos pra detectar EM_ANDAMENTO', () => {
  const code = readFileSync(
    join(ROOT, 'app/api/empresas/[id]/emprestimos/[loanId]/route.ts'),
    'utf-8',
  )

  it('expõe outstandingBalanceInitial + installmentsPaidBefore + trackingStartDate', () => {
    expect(code).toMatch(/outstandingBalanceInitial:\s*loan\.outstandingBalanceInitial/)
    expect(code).toMatch(/installmentsPaidBefore:\s*loan\.installmentsPaidBefore/)
    expect(code).toMatch(/trackingStartDate:\s*loan\.trackingStartDate\?\.toISOString/)
  })

  it('expõe rateType + indexer (úteis pro UI inteligente)', () => {
    expect(code).toMatch(/rateType:\s*loan\.rateType/)
    expect(code).toMatch(/indexer:\s*loan\.indexer/)
  })
})

describe('Fix detalhe — UI mostra badge correto', () => {
  const code = readFileSync(
    join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/[loanId]/page.tsx'),
    'utf-8',
  )

  it('LoanDetalhe.loan tem outstandingBalanceInitial: number | null', () => {
    expect(code).toMatch(/outstandingBalanceInitial:\s*number\s*\|\s*null/)
    expect(code).toMatch(/installmentsPaidBefore:\s*number/)
  })

  it('NUNCA mostra badge alarmista quando outstandingBalanceInitial != null', () => {
    expect(code).toMatch(/loan\.outstandingBalanceInitial !== null/)
    expect(code).toMatch(/Em andamento · liberação anterior ao período/)
  })

  it('badge alarmista só pra NOVO + sem tx + status≠QUITADO', () => {
    expect(code).toMatch(/!loan\.disbursementTransaction[\s\S]{0,100}loan\.status !== 'PAID_OFF'/)
    expect(code).toMatch(/Liberação não linkada — receita fake no DRE/)
  })

  it('cor neutra (slate) pro em andamento; amber só pra alarmista', () => {
    expect(code).toMatch(/bg-slate-50 text-slate-700 border-slate-200[\s\S]{0,200}Em andamento/)
  })
})

describe('Fix detalhe — fmtDate sem off-by-one', () => {
  const code = readFileSync(
    join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/[loanId]/page.tsx'),
    'utf-8',
  )

  it('fmtDate parsea pelos componentes Y/M/D (não direto via new Date(iso))', () => {
    // Padrão anti-fuso: split('-').map(Number) + new Date(y, m-1, d)
    expect(code).toMatch(/split\(['"]-['"]\)\.map\(Number\)/)
    expect(code).toMatch(/new Date\(y,\s*m\s*-\s*1,\s*d\)/)
  })

  it('NÃO usa new Date(iso) direto no fmtDate (causava UTC midnight)', () => {
    // O fmtDate antigo era exatamente `new Date(iso).toLocaleDateString(...)`
    // Garante que a nova versão tem o slice/split intermediário.
    const fmtBlock = code.match(/const fmtDate[\s\S]*?\}/)?.[0] ?? ''
    expect(fmtBlock).toContain('slice(0, 10)')
    expect(fmtBlock).toContain('split')
  })

  it('lida com string vazia e ISO malformado retornando "—"', () => {
    expect(code).toMatch(/if \(!iso\) return ['"]—['"]/)
    expect(code).toMatch(/if \(!y \|\| !m \|\| !d\) return ['"]—['"]/)
  })

  // Sanidade — simula o que o helper faria
  it('exemplos manuais: "2021-10-19" não deve virar "18" no dia', () => {
    const iso = '2021-10-19T00:00:00.000Z'
    const ymd = iso.slice(0, 10)
    const [y, m, d] = ymd.split('-').map(Number)
    const local = new Date(y, m - 1, d)
    // No local TZ, isso retorna 19, 9 (out=index 9), 2021 — independente do fuso
    expect(local.getDate()).toBe(19)
    expect(local.getMonth()).toBe(9) // outubro
    expect(local.getFullYear()).toBe(2021)
  })

  it('comportamento ANTIGO (anti-padrão) errava em BRT-3', () => {
    // Demonstrativo: new Date('2021-10-19') é UTC midnight; em BRT (UTC-3),
    // toLocaleDateString resolveria pro dia anterior dependendo do fuso.
    const utcMidnight = new Date('2021-10-19')
    // Em UTC (servidor) → 19. Em BRT-3 (dev/cliente) → 18.
    // Aceitamos qualquer um pra comprovar que era inconsistente.
    const day = utcMidnight.getDate()
    expect([18, 19]).toContain(day)
  })
})
