// Sprint Fundação Status (28/06/2026) — defensivos: todos os endpoints
// que filtram "pendente" usam a fonte única.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { statusFromCategoryId } from '@/lib/transacoes/needs-review'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('PDF confirm aplica escada de status (categoryId null ⇒ PENDING)', () => {
  const code = readFileSync(
    root('app/api/contas-bancarias/[id]/importar-pdf-extrato/confirm/route.ts'),
    'utf-8',
  )

  it('importa statusFromCategoryId', () => {
    expect(code).toMatch(/statusFromCategoryId/)
    expect(code).toMatch(/from '@\/lib\/transacoes\/needs-review'/)
  })

  it('NAO usa mais hardcoded RECONCILED ao criar tx PDF', () => {
    expect(code).not.toMatch(/status:\s*'RECONCILED',\s*\n\s*origin:\s*'PDF'/)
  })

  it('usa statusFromCategoryId(null) na createMany', () => {
    expect(code).toMatch(/status:\s*statusFromCategoryId\(null\)/)
  })
})

describe('Fonte única usada em todos os callers de "pra revisar"', () => {
  const FILES = [
    'app/api/transacoes/route.ts',
    'app/api/conciliacao/ofx-pendentes/route.ts',
    'app/api/conciliacao/bulk-dry-run/route.ts',
    'app/api/dashboard/badges/route.ts',
  ]

  for (const f of FILES) {
    it(`${f} importa NEEDS_REVIEW_WHERE_PRISMA`, () => {
      const code = readFileSync(root(f), 'utf-8')
      expect(code).toMatch(/NEEDS_REVIEW_WHERE_PRISMA/)
      expect(code).toMatch(/from '@\/lib\/transacoes\/needs-review'/)
    })

    it(`${f} usa spread ...NEEDS_REVIEW_WHERE_PRISMA OU Object.assign`, () => {
      const code = readFileSync(root(f), 'utf-8')
      // Tolerante: pode ser spread ou Object.assign
      const usaSpread = /\.\.\.NEEDS_REVIEW_WHERE_PRISMA/.test(code)
      const usaAssign = /Object\.assign\(where,\s*NEEDS_REVIEW_WHERE_PRISMA\)/.test(code)
      expect(usaSpread || usaAssign).toBe(true)
    })
  }
})

describe('/pendentes (cliente) NÃO força mais status=PENDING', () => {
  const code = readFileSync(
    root('app/(dashboard)/empresas/[id]/pendentes/pendentes-client.tsx'),
    'utf-8',
  )

  it('removeu qs.set(status, PENDING) forçado', () => {
    // Defensivo: aceita comentário citando "status='PENDING'", mas REJEITA
    // chamada ativa qs.set('status', 'PENDING') no fluxo do fetchTransacoes.
    // Pegamos só o bloco do fetchTransacoes (até a chamada fetch).
    const fetchBlock = code.match(/const fetchTransacoes = useCallback\(async \(\) => \{[\s\S]+?const res = await fetch/)
    expect(fetchBlock).toBeTruthy()
    expect(fetchBlock![0]).not.toMatch(/qs\.set\(['"]status['"],\s*['"]PENDING['"]\)/)
  })
})

describe('/conciliacao/ofx-pendentes — NÃO duplica filtros inline (consolidou no spread)', () => {
  const code = readFileSync(
    root('app/api/conciliacao/ofx-pendentes/route.ts'),
    'utf-8',
  )

  it('o spread NEEDS_REVIEW_WHERE_PRISMA está dentro do where da query', () => {
    // Busca o bloco `findMany({ where: { ... ... } })` e confirma o spread
    const block = code.match(/findMany\(\{[\s\S]+?where:\s*\{[\s\S]+?\}/)
    expect(block).toBeTruthy()
    expect(block![0]).toMatch(/\.\.\.NEEDS_REVIEW_WHERE_PRISMA/)
  })
})

describe('Coerência: escada inviolável', () => {
  it('categoryId null produz status PENDING', () => {
    expect(statusFromCategoryId(null)).toBe('PENDING')
    expect(statusFromCategoryId('cat_xyz')).toBe('RECONCILED')
  })
})
