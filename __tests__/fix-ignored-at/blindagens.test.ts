// Sprint Fix-IgnoredAt (06/07/2026) — blindagens estáticas.
//
// Cobre:
//   (a) PUT /api/transacoes/[id] sincroniza ignoredAt com status
//   (b) IGNORED sem timestamp → seta agora (new Date())
//   (c) IGNORED com timestamp preserva (idempotente, não sobrescreve)
//   (d) Status sai de IGNORED → zera ignoredAt

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)
const read = (p: string) => readFileSync(root(p), 'utf-8')

describe('PUT /api/transacoes/[id]: fix ignoredAt sincronizado com status', () => {
  const code = read('app/api/transacoes/[id]/route.ts')

  it('data object inclui ignoredAt condicional após status', () => {
    // O bloco `data:` da update precisa ter `...(statusEnforced === 'IGNORED' ? ... : ...)`
    // depois do `status: statusEnforced,` — comentário longo entre os dois é OK.
    expect(code).toMatch(
      /status:\s*statusEnforced,[\s\S]{0,1500}statusEnforced\s*===\s*['"]IGNORED['"]/,
    )
  })

  it('quando status final é IGNORED e ainda não tinha timestamp: seta new Date()', () => {
    // Padrão: `antiga.ignoredAt ? {} : { ignoredAt: new Date() }`
    // Preserva timestamp original se já existir.
    expect(code).toMatch(
      /statusEnforced\s*===\s*['"]IGNORED['"][\s\S]{0,300}antiga\.ignoredAt[\s\S]{0,120}ignoredAt:\s*new Date\(\)/,
    )
  })

  it('quando status sai de IGNORED: zera ignoredAt (null)', () => {
    // O ternário externo tem uma cauda `: { ignoredAt: null }` pra caso status !== IGNORED
    expect(code).toMatch(
      /statusEnforced\s*===\s*['"]IGNORED['"][\s\S]{0,400}:\s*\{\s*ignoredAt:\s*null\s*\}/,
    )
  })

  it('idempotente: se antiga.ignoredAt já existe, NÃO sobrescreve (retorna {} vazio)', () => {
    // O ternário interno é `antiga.ignoredAt ? {} : { ignoredAt: new Date() }`
    expect(code).toMatch(
      /antiga\.ignoredAt\s*\?\s*\{\s*\}\s*:\s*\{\s*ignoredAt:\s*new Date\(\)\s*\}/,
    )
  })

  it('não regride: status: statusEnforced continua sendo aplicado (enforcement)', () => {
    // Defesa: garante que a mudança não tirou o enforcement do status
    expect(code).toMatch(/status:\s*statusEnforced,/)
  })

  it('comentário explicativo cita NEEDS_REVIEW_WHERE_PRISMA como razão', () => {
    // Documenta o link com o filtro pra futuros mantenedores entenderem
    expect(code).toMatch(/NEEDS_REVIEW_WHERE_PRISMA/)
  })
})
