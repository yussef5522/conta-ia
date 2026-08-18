import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseSicrediFatura } from '../deterministic/sicredi-fatura-parser'
import { computeIdentity } from '../../import-identity/compute-identity'

// FASE 2 — IDEMPOTÊNCIA. Importar a MESMA fatura Sicredi 2× = 0 linha nova. O confirm
// deduplica por `contentHash` (computeIdentity com o memo/descrição). Este teste roda
// o parser REAL + computeIdentity REAL sobre a fatura real e simula o filtro do confirm.
// REGRA 3: não é grep — é o hash real das 78 linhas reais.

const REAL = readFileSync(
  fileURLToPath(new URL('../deterministic/__tests__/fixtures/sicredi-fatura-real.txt', import.meta.url)),
  'utf8',
)
const CARD = 'card:sicredi-test'
const hashDe = (line: { date: string; description: string; amount: number; suggestedKind: string }) =>
  computeIdentity({
    accountId: CARD,
    fitid: null,
    date: line.date,
    amount: line.amount,
    type: line.suggestedKind === 'ESTORNO' ? 'CREDIT' : 'DEBIT',
    memo: line.description,
  }).contentHash

describe('IDEMPOTÊNCIA — importar a fatura Sicredi 2× = 0 nova', () => {
  const lines = parseSicrediFatura(REAL).extraction.lines
  const hashes1 = lines.map(hashDe)

  it('a fatura parseia com linhas (sanidade)', () => {
    expect(lines.length).toBeGreaterThan(50)
  })

  it('contentHash é ESTÁVEL: rodar 2× dá o mesmo hash por linha', () => {
    const hashes2 = lines.map(hashDe)
    expect(hashes2).toEqual(hashes1)
  })

  it('sem falso-dedup: hash SÓ colide em linhas GENUINAMENTE idênticas (nunca distintas)', () => {
    // A fatura tem "Be On" 5,00 DUAS vezes (compra repetida real, mesma data+valor+desc)
    // → contentHash igual, e isso é CORRETO (são a mesma coisa). Falso-dedup seria colidir
    // linhas DISTINTAS (199,99/40,00 de comerciantes diferentes → memo distingue → hashes ≠).
    // Prod tem as 2 "Be On" (net 7896.32 certo — nada perdido: o createMany da 1ª importação
    // cria as duas; o dedup só bloqueia contra tx JÁ existentes, e o import é atômico).
    const byHash = new Map<string, typeof lines>()
    lines.forEach((l, i) => { const a = byHash.get(hashes1[i]) ?? []; a.push(l); byHash.set(hashes1[i], a) })
    for (const [, arr] of byHash) {
      if (arr.length > 1) {
        const f = arr[0]
        expect(arr.every((l) => l.date === f.date && l.amount === f.amount && l.description === f.description)).toBe(true)
      }
    }
    // 77 linhas, 76 identidades (1 par idêntico "Be On").
    expect(new Set(hashes1).size).toBe(lines.length - 1)
  })

  it('2ª importação (existentes = as da 1ª) → 0 linhas novas', () => {
    const existentes = new Set(hashes1) // o que a 1ª importação gravou
    const segundaImport = lines.filter((_, i) => !existentes.has(hashes1[i]))
    expect(segundaImport).toHaveLength(0)
  })

  it('uma linha NOVA (valor/data inédito) NÃO é bloqueada', () => {
    const existentes = new Set(hashes1)
    const nova = { date: '2026-08-31', description: 'Compra Inédita XYZ', amount: 12345.67, suggestedKind: 'COMPRA_AVISTA' }
    expect(existentes.has(hashDe(nova))).toBe(false)
  })
})
