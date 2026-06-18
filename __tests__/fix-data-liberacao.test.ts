// Fix Data-Liberação (17/06/2026)
// - IA agora extrai dataLiberacao + dataContratacao
// - UI pré-preenche disbursementDate com dataLiberacao (fallback dataContratacao)
// - Em modo EM_ANDAMENTO, disbursementDate é OPCIONAL (era obrigatório)

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeExtraction } from '@/lib/loans/contract-extract'

const ROOT = join(__dirname, '..')

describe('Fix Data-Liberação — extração AI', () => {
  it('normalizeExtraction inclui dataContratacao + dataLiberacao', () => {
    const r = normalizeExtraction({
      dataContratacao: '2021-10-19',
      dataLiberacao: '2021-10-19',
      bank: 'Banrisul',
    })
    expect(r.dataContratacao).toBe('2021-10-19')
    expect(r.dataLiberacao).toBe('2021-10-19')
  })

  it('campos ausentes viram null sem crash', () => {
    const r = normalizeExtraction({})
    expect(r.dataContratacao).toBeNull()
    expect(r.dataLiberacao).toBeNull()
  })

  it('prompt da IA pede explicitamente os 2 campos', () => {
    const code = readFileSync(join(ROOT, 'lib/loans/contract-extract.ts'), 'utf-8')
    expect(code).toMatch(/"dataContratacao":/)
    expect(code).toMatch(/"dataLiberacao":/)
    expect(code).toMatch(/Data da Contratação|dataContratacao: data de assinatura/i)
    expect(code).toMatch(/LIBERAÇÃO|Data Liberação|Data Crédito/i)
  })
})

describe('Fix Data-Liberação — UI pré-preenche disbursementDate', () => {
  const code = readFileSync(
    join(ROOT, 'app/(dashboard)/empresas/[id]/emprestimos/novo/page.tsx'),
    'utf-8',
  )

  it('handleUploadPdf usa e.dataLiberacao (com fallback dataContratacao)', () => {
    expect(code).toMatch(/e\.dataLiberacao/)
    expect(code).toMatch(/next\.disbursementDate\s*=\s*e\.dataLiberacao/)
    expect(code).toMatch(/e\.dataContratacao/)
  })

  it('label do input muda quando EM_ANDAMENTO ("informativo")', () => {
    expect(code).toMatch(/Data da liberação \(informativo\)/)
    expect(code).toMatch(/required=\{modo === 'NOVO'\}/)
  })

  it('validação client-side de EM_ANDAMENTO NÃO exige disbursementDate', () => {
    // Match list de campos obrigatórios em EM_ANDAMENTO
    const m = code.match(
      /modo === 'EM_ANDAMENTO' && \(!form\.outstandingBalanceInitial \|\| !form\.futureCount \|\| !form\.firstDueDate\)/,
    )
    expect(m).not.toBeNull()
    // Garante que NÃO tem !form.disbursementDate nessa condição
    expect(
      code.match(
        /modo === 'EM_ANDAMENTO' && \(!form\.outstandingBalanceInitial[^)]*disbursementDate/,
      ),
    ).toBeNull()
  })
})

describe('Fix Data-Liberação — backend EM_ANDAMENTO aceita ausência', () => {
  const code = readFileSync(
    join(ROOT, 'app/api/empresas/[id]/emprestimos/route.ts'),
    'utf-8',
  )

  it('Zod schema MID_LIFE: disbursementDate é optional', () => {
    expect(code).toMatch(/disbursementDate:\s*z\.coerce\.date\(\)\.optional\(\)/)
  })

  it('handler usa firstDueDate como fallback quando disbursementDate omitida', () => {
    expect(code).toMatch(/d\.disbursementDate \?\? d\.firstDueDate/)
  })
})
