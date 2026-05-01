import { describe, it, expect } from 'vitest'
import { dedupHashOFX, filtrarNovasOFX, TransacaoParaHash } from '../lib/ofx/dedup'

function tx(over: Partial<TransacaoParaHash> = {}): TransacaoParaHash {
  return {
    fitid: '000001',
    datePosted: new Date('2026-04-15T12:00:00Z'),
    amount: 150,
    type: 'DEBIT',
    memo: 'PIX ENVIADO PADARIA',
    ...over,
  }
}

describe('dedupHashOFX', () => {
  it('é determinístico (mesma transação → mesmo hash)', () => {
    expect(dedupHashOFX(tx())).toBe(dedupHashOFX(tx()))
  })

  it('retorna hex SHA-256 de 64 caracteres', () => {
    const h = dedupHashOFX(tx())
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('caso Banrisul: mesmo FITID, datas diferentes → hashes diferentes', () => {
    const a = tx({ fitid: '000001', datePosted: new Date('2026-04-15T12:00:00Z') })
    const b = tx({ fitid: '000001', datePosted: new Date('2026-04-16T12:00:00Z') })
    expect(dedupHashOFX(a)).not.toBe(dedupHashOFX(b))
  })

  it('caso Banrisul: mesmo FITID, valores diferentes → hashes diferentes', () => {
    const a = tx({ fitid: '000001', amount: 150 })
    const b = tx({ fitid: '000001', amount: 200 })
    expect(dedupHashOFX(a)).not.toBe(dedupHashOFX(b))
  })

  it('caso Banrisul: mesmo FITID, memos diferentes → hashes diferentes', () => {
    const a = tx({ fitid: '000001', memo: 'PADARIA' })
    const b = tx({ fitid: '000001', memo: 'POSTO DE GASOLINA' })
    expect(dedupHashOFX(a)).not.toBe(dedupHashOFX(b))
  })

  it('mesmo valor mas tipos opostos (CREDIT vs DEBIT) → hashes diferentes', () => {
    const a = tx({ amount: 150, type: 'CREDIT' })
    const b = tx({ amount: 150, type: 'DEBIT' })
    expect(dedupHashOFX(a)).not.toBe(dedupHashOFX(b))
  })

  it('FITIDs diferentes mas resto idêntico → hashes diferentes', () => {
    const a = tx({ fitid: '000001' })
    const b = tx({ fitid: '000002' })
    expect(dedupHashOFX(a)).not.toBe(dedupHashOFX(b))
  })

  it('memo com whitespace extra → mesmo hash (normalização)', () => {
    const a = tx({ memo: 'PIX  ENVIADO   PADARIA' })
    const b = tx({ memo: '  PIX ENVIADO PADARIA  ' })
    expect(dedupHashOFX(a)).toBe(dedupHashOFX(b))
  })

  it('horário diferente no mesmo dia → mesmo hash (só YYYY-MM-DD importa)', () => {
    const a = tx({ datePosted: new Date('2026-04-15T08:00:00Z') })
    const b = tx({ datePosted: new Date('2026-04-15T22:30:00Z') })
    expect(dedupHashOFX(a)).toBe(dedupHashOFX(b))
  })

  it('drift de float em valor → mesmo hash (toFixed normaliza)', () => {
    const a = tx({ amount: 0.1 + 0.2 })  // 0.30000000000000004
    const b = tx({ amount: 0.3 })
    expect(dedupHashOFX(a)).toBe(dedupHashOFX(b))
  })
})

describe('filtrarNovasOFX', () => {
  it('caso Banrisul: 3 transações com FITIDs duplicados, mas dados distintos → todas passam', () => {
    const transacoes = [
      tx({ fitid: '000001', datePosted: new Date('2026-04-15T12:00:00Z'), amount: 100, memo: 'A' }),
      tx({ fitid: '000001', datePosted: new Date('2026-04-16T12:00:00Z'), amount: 200, memo: 'B' }),
      tx({ fitid: '000001', datePosted: new Date('2026-04-17T12:00:00Z'), amount: 300, memo: 'C' }),
    ]
    const r = filtrarNovasOFX(transacoes, new Set())
    expect(r.novas).toHaveLength(3)
    expect(r.duplicadasNoArquivo).toBe(0)
    expect(r.duplicadasNoBanco).toBe(0)
    // Cada uma tem hash distinto
    const hashes = new Set(r.novas.map((t) => t.dedupHash))
    expect(hashes.size).toBe(3)
  })

  it('caso Itaú: 3 transações com FITIDs únicos → todas passam', () => {
    const transacoes = [
      tx({ fitid: 'IT202604010001' }),
      tx({ fitid: 'IT202604020002' }),
      tx({ fitid: 'IT202604030003' }),
    ]
    const r = filtrarNovasOFX(transacoes, new Set())
    expect(r.novas).toHaveLength(3)
    expect(r.duplicadasNoArquivo).toBe(0)
  })

  it('reimport completo: todos os hashes já no DB → 0 novas', () => {
    const transacoes = [tx({ fitid: 'A' }), tx({ fitid: 'B' })]
    const hashesExistentes = new Set(transacoes.map(dedupHashOFX))
    const r = filtrarNovasOFX(transacoes, hashesExistentes)
    expect(r.novas).toHaveLength(0)
    expect(r.duplicadasNoBanco).toBe(2)
    expect(r.duplicadasNoArquivo).toBe(0)
  })

  it('mistura: 2 já existentes + 2 novas → só 2 passam', () => {
    const ja = [tx({ fitid: 'JA1' }), tx({ fitid: 'JA2' })]
    const novas = [tx({ fitid: 'NEW1' }), tx({ fitid: 'NEW2' })]
    const hashesExistentes = new Set(ja.map(dedupHashOFX))
    const r = filtrarNovasOFX([...ja, ...novas], hashesExistentes)
    expect(r.novas).toHaveLength(2)
    expect(r.duplicadasNoBanco).toBe(2)
    expect(r.duplicadasNoArquivo).toBe(0)
    expect(r.novas.map((t) => t.fitid).sort()).toEqual(['NEW1', 'NEW2'])
  })

  it('dedup intra-arquivo: mesma 4-tupla repetida no mesmo OFX → só 1 passa', () => {
    const t1 = tx({ fitid: 'A', amount: 100, memo: 'PIX', datePosted: new Date('2026-04-15T12:00:00Z') })
    const t2 = tx({ fitid: 'A', amount: 100, memo: 'PIX', datePosted: new Date('2026-04-15T12:00:00Z') })
    const r = filtrarNovasOFX([t1, t2], new Set())
    expect(r.novas).toHaveLength(1)
    expect(r.duplicadasNoArquivo).toBe(1)
    expect(r.duplicadasNoBanco).toBe(0)
  })

  it('cada transação retornada vem com seu dedupHash calculado', () => {
    const t = tx({ fitid: 'X' })
    const r = filtrarNovasOFX([t], new Set())
    expect(r.novas[0].dedupHash).toBe(dedupHashOFX(t))
  })

  it('dois arquivos distintos do mesmo período (2 transações comuns + 1 nova em cada) → identifica corretamente', () => {
    // Simulando: usuário já importou arquivo A (2 tx). Agora importa B (mesmas 2 + 1 nova).
    const compartilhada1 = tx({ fitid: '01', amount: 100, memo: 'COMPRA 1' })
    const compartilhada2 = tx({ fitid: '02', amount: 200, memo: 'COMPRA 2' })
    const novaNoArquivoB = tx({ fitid: '03', amount: 300, memo: 'COMPRA 3' })

    const hashesExistentes = new Set([compartilhada1, compartilhada2].map(dedupHashOFX))
    const r = filtrarNovasOFX([compartilhada1, compartilhada2, novaNoArquivoB], hashesExistentes)

    expect(r.novas).toHaveLength(1)
    expect(r.novas[0].fitid).toBe('03')
    expect(r.duplicadasNoBanco).toBe(2)
  })
})
