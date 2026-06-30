// Sprint Find-And-Match-Strict (30/06/2026) — defensivos do endpoint
// /api/conciliacao/find-and-match: tem que usar o helper compartilhado +
// NÃO ter RAMO 2 (EFFECTED MANUAL/IMPORT_EXCEL) hardcoded.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', p)

describe('/api/conciliacao/find-and-match — usa helper estrito', () => {
  const code = readFileSync(
    root('app/api/conciliacao/find-and-match/route.ts'),
    'utf-8',
  )

  it('importa buildStrictReconciliationWhere do helper único', () => {
    expect(code).toMatch(/import\s*\{\s*buildStrictReconciliationWhere\s*\}/)
    expect(code).toMatch(/from\s+['"]@\/lib\/conciliacao\/strict-where['"]/)
  })

  it('CHAMA buildStrictReconciliationWhere no fluxo da query', () => {
    expect(code).toMatch(/strictWhere\s*=\s*buildStrictReconciliationWhere/)
  })

  it('REMOVEU ramo1 / ramo2 / universoRamos locais', () => {
    expect(code).not.toMatch(/const\s+ramo1\s*:/)
    expect(code).not.toMatch(/const\s+ramo2\s*:/)
    expect(code).not.toMatch(/const\s+universoRamos\s*:/)
  })

  it('NÃO inclui mais lifecycle EFFECTED hardcoded no where', () => {
    // O scan SQL não deve conter mais "lifecycle: 'EFFECTED'" como filtro
    // (era o RAMO 2 puxando despesa já realizada).
    expect(code).not.toMatch(/lifecycle:\s*'EFFECTED'/)
  })

  it('NÃO inclui origin IN (IMPORT_EXCEL, MANUAL) hardcoded (era RAMO 2)', () => {
    expect(code).not.toMatch(
      /origin:\s*\{\s*in:\s*\[\s*'IMPORT_EXCEL'\s*,\s*'MANUAL'\s*\]/,
    )
  })

  it('preserva busca textual + janela + paginação + exclusão de ids', () => {
    // Confirma que o resto do endpoint continua intacto.
    expect(code).toMatch(/buscaWhere/)
    expect(code).toMatch(/dueWindow|windowDays/)
    expect(code).toMatch(/excluirIds/)
    expect(code).toMatch(/rankCandidates/)
  })

  it('citação Sprint Find-And-Match-Strict no comentário', () => {
    expect(code).toMatch(/Sprint Find-And-Match-Strict/)
  })
})

describe('/api/conciliacao/find-and-match — 6 cenários (estrutura via grep)', () => {
  const helperCode = readFileSync(
    root('lib/conciliacao/strict-where.ts'),
    'utf-8',
  )

  it('1+2. PAYABLE/RECEIVABLE pendente: filtro lifecycle = target', () => {
    expect(helperCode).toMatch(/targetLifecycle\s*=\s*ofx\.type\s*===\s*'DEBIT'\s*\?\s*'PAYABLE'\s*:\s*'RECEIVABLE'/)
  })

  it('3. PAYABLE paga NÃO aparece (paymentDate: null obrigatório)', () => {
    expect(helperCode).toMatch(/paymentDate:\s*null/)
  })

  it('4. PAYABLE outra conta NÃO aparece (sameAccountOrNull)', () => {
    expect(helperCode).toMatch(/sameAccountOrNull/)
    expect(helperCode).toMatch(/bankAccountId:\s*ofx\.bankAccountId/)
  })

  it('5+6. EFFECTED MANUAL caixa loja / Excel órfã NÃO aparece (helper estrito sem origin filter)', () => {
    expect(helperCode).not.toMatch(/lifecycle:\s*'EFFECTED'/)
    expect(helperCode).not.toMatch(/origin:\s*\{\s*in:\s*\[/)
  })
})

describe('Helper compartilhado — sem drift entre callers', () => {
  const findCandidatesCode = readFileSync(
    root('lib/conciliacao/find-candidates.ts'),
    'utf-8',
  )
  const findAndMatchCode = readFileSync(
    root('app/api/conciliacao/find-and-match/route.ts'),
    'utf-8',
  )

  it('find-candidates importa o helper compartilhado', () => {
    expect(findCandidatesCode).toMatch(
      /import\s*\{\s*buildStrictReconciliationWhere\s*\}\s*from\s+['"]\.\/strict-where['"]/,
    )
  })

  it('find-candidates NÃO redefine o where inline (centralizou)', () => {
    // Não pode mais ter o trecho duplicado com OR de 4 relações + sameAccountOrNull
    // hardcoded — agora vem do helper.
    expect(findCandidatesCode).not.toMatch(/const\s+companyScope\s*=\s*\{\s*OR:\s*\[\s*\{\s*bankAccount/)
    expect(findCandidatesCode).not.toMatch(/const\s+sameAccountOrNull\s*=\s*\{\s*OR:/)
  })

  it('find-and-match importa o MESMO helper (fonte única)', () => {
    expect(findAndMatchCode).toMatch(
      /import\s*\{\s*buildStrictReconciliationWhere\s*\}\s*from\s+['"]@\/lib\/conciliacao\/strict-where['"]/,
    )
  })
})
