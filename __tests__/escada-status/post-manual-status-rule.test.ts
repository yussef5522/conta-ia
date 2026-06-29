// Sprint Escada-Status (28/06/2026) — F4: POST /api/transacoes
// (criação manual) agora deriva status do contexto (CASH? categoryId? IGNORED?)
// em vez de aceitar data.status cru do body. NÃO aceita RECONCILED sem
// categoria (violaria escada da Sprint Fundação Status).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const root = (p: string) => join(__dirname, '..', '..', p)

describe('POST /api/transacoes — derivação de statusEfetivo', () => {
  const code = readFileSync(root('app/api/transacoes/route.ts'), 'utf-8')

  it('a derivação de statusEfetivo cobre os 4 ramos (IGNORED, CASH, categoria, default)', () => {
    // Procura a expressão statusEfetivo
    const match = code.match(/const\s+statusEfetivo[\s\S]+?:\s*'PENDING'/)
    expect(match).toBeTruthy()
    const expr = match![0]
    expect(expr).toMatch(/data\.status\s*===\s*'IGNORED'/)
    expect(expr).toMatch(/accountType\s*===\s*'CASH'/)
    expect(expr).toMatch(/data\.categoryId/)
    expect(expr).toMatch(/'PENDING'/)
    expect(expr).toMatch(/'RECONCILED'/)
  })

  it('NÃO aceita data.status === \'RECONCILED\' sem categoria', () => {
    // Pega o trecho do statusEfetivo. Não deve ter "data.status === 'RECONCILED'"
    // em lugar nenhum — RECONCILED só é derivado de CASH ou categoryId.
    const m = code.match(/const\s+statusEfetivo[\s\S]+?:\s*'PENDING'/)
    expect(m![0]).not.toMatch(/data\.status\s*===\s*'RECONCILED'/)
  })

  it('citação Sprint Escada-Status no comentário', () => {
    expect(code).toMatch(/Sprint Escada-Status/)
  })
})
