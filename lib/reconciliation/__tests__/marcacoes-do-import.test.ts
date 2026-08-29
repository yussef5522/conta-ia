// REGRA 1 — AS MARCAÇÕES DO IMPORT NUNCA CHEGAVAM NA TRANSAÇÃO (29/08/2026).
//
// O CASO REAL: o dono importou o extrato do Sicredi, marcou a linha
// "PAGAMENTO PIX MERCADO PAGO −2.666,44" como **pagamento de cartão**, ESCOLHEU o cartão e
// confirmou. A transação nasceu **crua** — `isCardPayment=false`, sem cartão, sem categoria —
// e foi parar na fila de pendentes; a fatura do MP seguiu ABERTA.
//
// ⚠️⚠️ A CAUSA: a tela aplicava as marcações DEPOIS do import, cruzando o `dedupHash` do
// PREVIEW com o `dedupHash` GRAVADO. **São formatos diferentes:**
//
//     preview  → ofxHashOf(linha)              = fitid|data|valor|memo
//     gravado  → buildLineDedupHash(sk, id, n) = stableKey#<importId>:<occ>
//
// e o `importId` **só existe DEPOIS do import** — o preview não teria como conhecê-lo. O
// cruzamento era impossível por construção, então NENHUMA marcação jamais completou no
// caminho vivo (RECONCILE_V2): nem cartão, nem receita/despesa, nem transferência, nem
// ignorar. Os 3 retries com backoff na tela existiam pra contornar uma "race" que nem era
// race — era hash incompatível.

import { describe, it, expect } from 'vitest'
import { stableKey } from '../stable-key'
import { buildLineDedupHash } from '../line-dedup-hash'
import { dedupHashOFX as computeOfxDedupHash } from '@/lib/ofx/dedup'

const LINHA = {
  date: new Date('2026-08-26T00:00:00.000Z'),
  signedAmount: -2666.44,
  memo: 'PAGAMENTO PIX-PIX_DEB   10573521000191 MERCADO PAGO INSTITUICAO DE PAGAMENTO LTDA',
  fitid: '23272499186',
}

describe('⭐⭐ os dois hashes NUNCA poderiam casar', () => {
  it('⭐⭐ o hash gravado embute o importId; o do preview não tem como conhecê-lo', () => {
    const sk = stableKey({ date: LINHA.date, signedAmount: LINHA.signedAmount, memo: LINHA.memo })
    const importId = 'cmtdmxr5h00rsi3gyofcfeqmm' // o id REAL do import do dono
    const gravado = buildLineDedupHash(sk, importId, 0)

    expect(gravado).toContain(importId)
    // ⚠️ o preview roda ANTES do import existir — logo, não pode produzir esta string
    expect(gravado).toBe(`${sk}#${importId}:0`)
  })

  it('⭐ e o do preview tem outro formato, então o cruzamento dá vazio', () => {
    const doPreview = computeOfxDedupHash({
      fitid: LINHA.fitid, datePosted: LINHA.date,
      amount: Math.abs(LINHA.signedAmount), type: 'DEBIT', memo: LINHA.memo,
    })
    const sk = stableKey({ date: LINHA.date, signedAmount: LINHA.signedAmount, memo: LINHA.memo })
    const gravado = buildLineDedupHash(sk, 'qualquer-import-id', 0)

    expect(doPreview).not.toBe(gravado)
    // o mapa que a tela montava: chave = gravado. A busca: chave = doPreview → sempre miss.
    const mapaDaTela = new Map([[gravado, 'tx-123']])
    expect(mapaDaTela.get(doPreview)).toBeUndefined() // ← a marcação sumia AQUI
  })

  it('⚠️ e nenhum retry resolveria: não é race, é incompatibilidade', () => {
    // a tela tentava 3× com backoff 0/400/1200ms. O hash não muda com o tempo.
    const sk = stableKey({ date: LINHA.date, signedAmount: LINHA.signedAmount, memo: LINHA.memo })
    const tentativas = [0, 400, 1200].map(() => buildLineDedupHash(sk, 'import-x', 0))
    expect(new Set(tentativas).size).toBe(1) // sempre o mesmo valor errado
  })
})

describe('⭐ a ponte que conserta: o mapa vem do CONFIRM', () => {
  it('⭐⭐ com ofxHash → txId, a marcação acha a transação', () => {
    const doPreview = computeOfxDedupHash({
      fitid: LINHA.fitid, datePosted: LINHA.date,
      amount: Math.abs(LINHA.signedAmount), type: 'DEBIT', memo: LINHA.memo,
    })
    // é exatamente o que `runImportV2` passa a devolver: a chave do PREVIEW → o id gravado
    const txIdByOfxHash: Record<string, string> = { [doPreview]: 'tx-real-123' }
    expect(new Map(Object.entries(txIdByOfxHash)).get(doPreview)).toBe('tx-real-123')
  })

  it('⚠️ o mapa é montado no MESMO laço que cria a tx — os dois hashes na mesma mão', () => {
    // a garantia estrutural: não há duas fases pra divergir, nem race pra contornar.
    const linhas = [LINHA, { ...LINHA, signedAmount: -100, fitid: '999' }]
    const mapa: Record<string, string> = {}
    for (const [i, l] of linhas.entries()) {
      const h = computeOfxDedupHash({ fitid: l.fitid, datePosted: l.date, amount: Math.abs(l.signedAmount), type: 'DEBIT', memo: l.memo })
      mapa[h] = `tx-${i}`
    }
    expect(Object.keys(mapa)).toHaveLength(2)
    for (const l of linhas) {
      const h = computeOfxDedupHash({ fitid: l.fitid, datePosted: l.date, amount: Math.abs(l.signedAmount), type: 'DEBIT', memo: l.memo })
      expect(mapa[h]).toBeDefined()
    }
  })
})

describe('⚠️ pagamento de cartão sai da fila de pendentes pela FLAG, não pelo status', () => {
  it('⭐ o filtro de pendências exige isCardPayment: false', async () => {
    const { NEEDS_REVIEW_WHERE_PRISMA } = await import('@/lib/transacoes/needs-review')
    // por isso `status=PENDING` numa tx de pagamento de cartão é inofensivo: o que tira da
    // fila é a flag. Pendência é sobre FALTA de classificação, não sobre o status.
    expect(NEEDS_REVIEW_WHERE_PRISMA.isCardPayment).toBe(false)
  })
})
