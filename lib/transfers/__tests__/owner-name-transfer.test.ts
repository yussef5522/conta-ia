// FASE 4 (12/08) — reconhecer NOME de sócio cadastrado como "próprio" no motor
// de par (REGRA 3: executa o classifier real). Caso Stone↔Banrisul: a perna da
// Stone traz o NOME do dono no memo (sem CNPJ) → o anti-pessoa marcava terceiro
// → 0 pares detectados. NARROW: só com valor exato + MESMO DIA + keyword.
//
// VERMELHO (flag OFF) = rejeitado; VERDE (flag ON) = camada 2 (0.85+).

import { describe, it, expect } from 'vitest'
import { classifyTransferPair, type UnifiedTx } from '../unified-transfer-engine'
import type { OwnEntityRefs } from '../own-entity-signals'

// refs sintéticas (sem PII real) — sócio "FULANO SILVA SANTOS".
const REFS: OwnEntityRefs = {
  cnpj: '29756732000198',
  names: ['cacula mix'],
  accountNames: ['banrisul', 'stone'],
  ownerCpfs: [],
  ownerNames: ['FULANO SILVA SANTOS'],
}

const D = (s: string) => new Date(`${s}T12:00:00.000Z`)
// débito Banrisul genérico ("PIX ENVIADO", sem nome) ↔ crédito Stone com o NOME.
const debitBanrisul: UnifiedTx = { id: 'b1', bankAccountId: 'banrisul', date: D('2026-08-10'), type: 'DEBIT', amount: 25000, description: 'PIX ENVIADO' }
const creditStone = (over: Partial<UnifiedTx> = {}): UnifiedTx => ({
  id: 's1', bankAccountId: 'stone', date: D('2026-08-10'), type: 'CREDIT', amount: 25000,
  description: 'FULANO SILVA SANTOS - Transferência | Pix', ...over,
})

describe('Motor de par — nome de sócio no memo (FASE 4)', () => {
  it('VERMELHO: flag OFF (default) → rejeitado (anti-pessoa marca terceiro)', () => {
    const r = classifyTransferPair(debitBanrisul, creditStone(), { refs: REFS, valorComum: new Set() })
    expect(r).toBeNull()
  })

  it('VERDE: flag ON → camada 2 STRONG, confiança ≥ 0.85 (não 0.99 da camada 1)', () => {
    const r = classifyTransferPair(debitBanrisul, creditStone(), { refs: REFS, valorComum: new Set(), matchOwnerName: true })
    expect(r).not.toBeNull()
    expect(r!.layer).toBe('STRONG')
    expect(r!.confidence).toBeGreaterThanOrEqual(0.85)
    expect(r!.confidence).toBeLessThan(0.99) // nome não é prova documental → não camada 1
    expect(r!.evidences[0]).toContain('nome do sócio')
  })

  it('NARROW: sem MESMO DIA (D+2) → NÃO entra pela regra do nome (mesmo com flag ON)', () => {
    const r = classifyTransferPair(debitBanrisul, creditStone({ date: D('2026-08-12') }), { refs: REFS, valorComum: new Set(), matchOwnerName: true })
    // pode virar weak/null, mas NUNCA STRONG pela regra do nome (exige same-day)
    expect(r?.layer === 'STRONG' && /nome do sócio/.test(r?.evidences[0] ?? '')).toBeFalsy()
  })

  it('NARROW: valor diferente → não entra', () => {
    const r = classifyTransferPair(debitBanrisul, creditStone({ amount: 24999 }), { refs: REFS, valorComum: new Set(), matchOwnerName: true })
    expect(r?.layer === 'STRONG' && /nome do sócio/.test(r?.evidences[0] ?? '')).toBeFalsy()
  })

  it('HOMÔNIMO: cliente com nome PARECIDO mas ≠ sócio → REJEITADO (não vira próprio)', () => {
    // "FULANO NEDAL DA SILVA" não contém o nome completo "FULANO SILVA SANTOS"
    const homonimo = creditStone({ description: 'FULANO NEDAL PEREIRA CLIENTE - Pix', amount: 66.98 })
    const debitPeq: UnifiedTx = { ...debitBanrisul, amount: 66.98, description: 'PIX ENVIADO' }
    const r = classifyTransferPair(debitPeq, homonimo, { refs: REFS, valorComum: new Set(), matchOwnerName: true })
    expect(r).toBeNull() // nome não casa ownerNames → terceiro → rejeitado
  })

  it('BLACKLIST continua matando (NURA×OP.CREDITO) mesmo com flag ON', () => {
    const opCred: UnifiedTx = { id: 'x', bankAccountId: 'banrisul', date: D('2026-08-10'), type: 'CREDIT', amount: 1000, description: 'OP. CREDITO C/GARANTIA' }
    const nura: UnifiedTx = { id: 'y', bankAccountId: 'stone', date: D('2026-08-10'), type: 'DEBIT', amount: 1000, description: 'FULANO SILVA SANTOS - Transferência | Pix' }
    const r = classifyTransferPair(nura, opCred, { refs: REFS, valorComum: new Set(), matchOwnerName: true })
    expect(r).toBeNull()
  })
})
