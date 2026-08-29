// ITEM 2 — O CICLO DE VIDA DO AGENDADO (29/08/2026). O caso do CONSÓRCIO de 09/09.
//
// O extrato do Banrisul lista lançamentos FUTUROS no meio das linhas reais. Eles têm que:
//   1. no import: ficar de FORA (não são caixa) e aparecer LISTADOS com o motivo;
//   2. quando POSTAREM de verdade num export seguinte, entrar UMA vez — mesmo que o banco
//      renumere o FITID no caminho, que é mania conhecida dele (`fitidStability:
//      PER_DOWNLOAD` na ficha do Banrisul).
//
// ⚠️ O passo 2 é o que evita a duplicata clássica preview↔real: se o dedup dependesse do
// FITID, a linha renumerada entraria como "nova" e o mesmo consórcio contaria duas vezes.
// O `stableKey` é data+valor+memo justamente por isso.

import { describe, it, expect } from 'vitest'
import { partitionFutureLines } from '../future-line'
import { stableKey } from '@/lib/reconciliation/stable-key'

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

// o CONSÓRCIO real, como veio no Extrato_20260828.ofx
const CONSORCIO = { datePosted: D('2026-09-09'), fitid: '150023', valor: -1478.51, memo: 'PAGAMENTO CONSORCIO' }

describe('⭐ 1) no arquivo em que é FUTURO, fica de fora — e nomeado', () => {
  it('data depois da âncora → vai pro balde de futuras, não some', () => {
    const { realLines, futureLines } = partitionFutureLines([CONSORCIO], D('2026-08-28'))
    expect(realLines).toHaveLength(0)
    expect(futureLines).toHaveLength(1)
    expect(futureLines[0].memo).toBe('PAGAMENTO CONSORCIO')
  })

  it('⚠️ e o motivo é DETERMINÍSTICO: a data, contra a âncora declarada no arquivo', () => {
    // um dia antes da âncora → real. Um dia depois → futura. Nada além disso decide.
    expect(partitionFutureLines([{ ...CONSORCIO, datePosted: D('2026-08-27') }], D('2026-08-28')).futureLines).toHaveLength(0)
    expect(partitionFutureLines([{ ...CONSORCIO, datePosted: D('2026-08-29') }], D('2026-08-28')).futureLines).toHaveLength(1)
  })
})

describe('⭐⭐ 2) quando POSTAR, entra UMA vez — mesmo com FITID renumerado', () => {
  it('⭐ a chave de dedup NÃO usa FITID: data+valor+memo casam entre os dois downloads', () => {
    // arquivo 1 (28/08): o consórcio aparece como agendado, fitid 150023
    // arquivo 2 (10/09): o mesmo consórcio postou — o Banrisul renumerou pra outro fitid
    const noArquivo1 = stableKey({ date: D('2026-09-09'), signedAmount: -1478.51, memo: 'PAGAMENTO CONSORCIO' })
    const noArquivo2 = stableKey({ date: D('2026-09-09'), signedAmount: -1478.51, memo: 'PAGAMENTO CONSORCIO' })
    expect(noArquivo1).toBe(noArquivo2)
    // ⚠️ a prova de que o FITID não entra: ele nem é parâmetro da chave
    expect(noArquivo1).not.toContain('150023')
  })

  it('⭐ no arquivo em que a data já passou, ela é REAL (o mesmo lançamento, agora caixa)', () => {
    const { realLines, futureLines } = partitionFutureLines(
      [{ ...CONSORCIO, fitid: '907731' }], // fitid renumerado pelo banco
      D('2026-09-10'), // âncora do export de 10/09
    )
    expect(realLines).toHaveLength(1)
    expect(futureLines).toHaveLength(0)
  })

  it('⚠️ se a dedup usasse FITID, o consórcio entraria DUAS vezes', () => {
    // é o cenário que o `stableKey` existe pra impedir — o FITID muda, a chave não
    const chaveComFitid = (fitid: string) => `${fitid}|2026-09-09|-1478.51`
    expect(chaveComFitid('150023')).not.toBe(chaveComFitid('907731')) // duplicaria
    expect(stableKey({ date: D('2026-09-09'), signedAmount: -1478.51, memo: 'PAGAMENTO CONSORCIO' }))
      .toBe(stableKey({ date: D('2026-09-09'), signedAmount: -1478.51, memo: 'PAGAMENTO CONSORCIO' })) // não duplica
  })
})

describe('⚠️ o agendado não vira real só por ficar velho', () => {
  it('a âncora do ARQUIVO manda, não o relógio: mesmo arquivo, mesma resposta sempre', () => {
    // importar o arquivo de 28/08 hoje, amanhã ou mês que vem dá o MESMO resultado —
    // é o que impede o bug de 09/08 ("importar um dia depois deixava agendada passar").
    for (const agora of ['2026-08-28', '2026-09-30', '2027-01-01']) {
      const { futureLines } = partitionFutureLines([CONSORCIO], D('2026-08-28'), D(agora))
      expect(futureLines).toHaveLength(1)
    }
  })
})
