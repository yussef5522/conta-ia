// ⛔⛔⛔ O BANCO RE-DATOU UMA LINHA JÁ PUBLICADA (05/09/2026) — o caso real, ao centavo.
//
// As 2 `CAPITALIZACAO RG` (297,84 cada, FITID 590244/590245): **01/09** no download do dia
// 01, **02/09** nos downloads de 02, 03 e 04 (os três concordam). O nosso ledger ficou com
// 01/09, porque entrou pelo primeiro.
//
// ⚠️ E O TESTE QUE MAIS IMPORTA AQUI NÃO É O DO CASO — é o do PIX DE 7.000: a tolerância
// não pode fundir duas linhas que são MESMO duas. Perder lançamento é pior que duplicar,
// porque duplicata a gente vê.

import { describe, it, expect } from 'vitest'
import { casarFronteiraDeDia, identidadeSemData, fraseDoDeslocamento } from '../fronteira-de-dia'
import { reconcileStatement } from '../reconcile-statement'
import type { StatementLine, DbBankTransaction } from '../types'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

const linha = (data: string, valor: number, memo: string, fitid?: string): StatementLine =>
  ({ datePosted: d(data), signedAmount: valor, memo, fitid })

const tx = (id: string, data: string, valor: number, memo: string, fitid?: string): DbBankTransaction =>
  ({ id, date: d(data), signedAmount: valor, memo, fitid, lifecycle: 'EFFECTED', type: valor < 0 ? 'DEBIT' : 'CREDIT' })

describe('⭐⭐ o caso real: as 2 CAPITALIZACAO RG que mudaram de dia', () => {
  // o nosso ledger, vindo do download de 01/09
  const noLedger = [
    tx('t1', '2026-09-01', -297.84, 'CAPITALIZACAO RG', '590244'),
    tx('t2', '2026-09-01', -297.84, 'CAPITALIZACAO RG', '590245'),
  ]
  // o arquivo de 04/09: as MESMAS duas, agora em 02/09
  const noArquivo = [
    linha('2026-09-02', -297.84, 'CAPITALIZACAO RG', '590244'),
    linha('2026-09-02', -297.84, 'CAPITALIZACAO RG', '590245'),
  ]

  it('⛔⛔ elas NÃO entram de novo — seriam R$ 595,68 duplicados', () => {
    const r = casarFronteiraDeDia(noLedger, noArquivo, noArquivo)
    expect(r.deslocamentos).toHaveLength(2)
    expect(r.linhasRestantes, 'sobrou linha pra importar = duplicata').toEqual([])
    expect(r.dbRestante, 'sobrou tx do ledger = vira órfã/fantasma').toEqual([])
    expect(r.deslocamentos[0].deData).toBe('2026-09-01')
    expect(r.deslocamentos[0].paraData).toBe('2026-09-02')
  })

  it('⭐⭐ e o reconcile inteiro concorda: 2 casadas, 0 novas, 0 órfãs', () => {
    const r = reconcileStatement(noArquivo, noLedger, d('2026-09-04'), d('2026-09-04'), { skipPreviewSeparation: true })
    expect(r.missing, 'entraria como nova → duplicata').toEqual([])
    expect(r.orphans, 'nossa linha viraria fantasma').toEqual([])
    expect(r.matched).toHaveLength(2)
    expect(r.deslocamentosDeDia).toHaveLength(2)
    expect(r.matched.every((m) => m.confidence === 'FRONTEIRA_DIA')).toBe(true)
  })

  it('⭐ a tela SUGERE com nome — não casa em silêncio', () => {
    const r = casarFronteiraDeDia(noLedger, noArquivo, noArquivo)
    const f = fraseDoDeslocamento(r.deslocamentos[0])
    expect(f).toMatch(/moveu/)
    expect(f).toMatch(/01\/09/)
    expect(f).toMatch(/02\/09/)
    expect(f).toMatch(/297,84/)
    expect(f, 'o dono precisa saber quem decide a data').toMatch(/PDF/)
  })

  it('⭐ a grafia do histórico pode mudar junto — a identidade é a CANÔNICA', () => {
    // o Banrisul alterna "OP. CREDITO"/"OP.CREDITO" no mesmo arquivo
    expect(identidadeSemData({ signedAmount: 4250.99, memo: 'OP. CREDITO C/GARANTIA' }))
      .toBe(identidadeSemData({ signedAmount: 4250.99, memo: 'OP.CREDITO C/GARANTIA' }))
  })
})

describe('⛔⛔⛔ O PIX DE 7.000 CONTINUA PROTEGIDO — a condição que segura tudo', () => {
  it('⛔⛔ dois PIX IGUAIS em dias VIZINHOS DE VERDADE seguem sendo DOIS', () => {
    // ⚠️ os dois estão no arquivo, cada um no seu dia. A linha do dia 13 NÃO sumiu —
    // então não há deslocamento nenhum, e fundir apagaria R$ 7.000 do ledger.
    const noLedger = [tx('t1', '2026-08-13', -7000, 'PIX ENVIADO')]
    const noArquivo = [
      linha('2026-08-13', -7000, 'PIX ENVIADO'),
      linha('2026-08-14', -7000, 'PIX ENVIADO'),
    ]
    const r = reconcileStatement(noArquivo, noLedger, d('2026-08-20'), d('2026-08-20'), { skipPreviewSeparation: true })
    expect(r.matched, 'a do dia 13 casa exato').toHaveLength(1)
    expect(r.matched[0].confidence).toBe('EXACT')
    expect(r.missing, 'a do dia 14 é OUTRA linha e TEM que entrar').toHaveLength(1)
    expect(r.missing[0].datePosted.toISOString().slice(0, 10)).toBe('2026-08-14')
    expect(r.deslocamentosDeDia).toEqual([])
  })

  it('⛔⛔⛔ O CASO QUE EXERCITA A CONDIÇÃO 4 — com sobra dos DOIS lados', () => {
    // ⚠️ A 1ª versão deste teste NÃO mordia: com o ledger tendo UMA linha, ela casava exato
    // no Tier 1 e nunca chegava na fronteira — removi a condição 4 e os 11 testes ficaram
    // VERDES. (REGRA 11: guard só conta depois de rodar contra o defeito.)
    //
    // O cenário que mede de verdade: o ledger tem DUAS de 7.000 em 13/08; o arquivo lista
    // UMA em 13/08 e uma em 14/08. Sobra 1 tx nossa E 1 linha do arquivo — o par perfeito
    // pra fronteira casar errado. E não pode: o arquivo AINDA lista 13/08, então a nossa
    // sobra é candidata a duplicata NOSSA, não a linha que "mudou de dia".
    const noLedger = [
      tx('t1', '2026-08-13', -7000, 'PIX ENVIADO'),
      tx('t2', '2026-08-13', -7000, 'PIX ENVIADO'),
    ]
    const noArquivo = [
      linha('2026-08-13', -7000, 'PIX ENVIADO'),
      linha('2026-08-14', -7000, 'PIX ENVIADO'),
    ]
    const r = casarFronteiraDeDia([noLedger[1]], [noArquivo[1]], noArquivo)
    expect(r.deslocamentos, 'fundiu duas linhas que podem ser duas — R$ 7.000 sumiriam').toEqual([])
    expect(r.linhasRestantes, 'a linha de 14/08 TEM que seguir pro tier seguinte').toHaveLength(1)
    expect(r.dbRestante).toHaveLength(1)

    // e pelo pipeline inteiro: a de 14/08 entra, a nossa sobra vira órfã pra revisão humana
    const full = reconcileStatement(noArquivo, noLedger, d('2026-08-20'), d('2026-08-20'), { skipPreviewSeparation: true })
    expect(full.missing, 'nada pode sumir em silêncio').toHaveLength(1)
    expect(full.missing[0].datePosted.toISOString().slice(0, 10)).toBe('2026-08-14')
    expect(full.deslocamentosDeDia).toEqual([])
  })

  it('⛔ AMBIGUIDADE não casa: candidata no dia anterior E no seguinte = palpite', () => {
    const noLedger = [tx('t1', '2026-09-02', -100, 'TARIFA X')]
    const noArquivo = [linha('2026-09-01', -100, 'TARIFA X'), linha('2026-09-03', -100, 'TARIFA X')]
    const r = casarFronteiraDeDia(noLedger, noArquivo, noArquivo)
    expect(r.deslocamentos).toEqual([])
    expect(r.dbRestante).toHaveLength(1)
    expect(r.linhasRestantes).toHaveLength(2)
  })

  it('⛔ D±2 NÃO é fronteira — é outra coisa, e outra coisa não se funde', () => {
    const noLedger = [tx('t1', '2026-09-01', -297.84, 'CAPITALIZACAO RG')]
    const noArquivo = [linha('2026-09-03', -297.84, 'CAPITALIZACAO RG')]
    expect(casarFronteiraDeDia(noLedger, noArquivo, noArquivo).deslocamentos).toEqual([])
  })

  it('⛔ valor diferente por 1 centavo NÃO é a mesma linha', () => {
    const noLedger = [tx('t1', '2026-09-01', -297.84, 'CAPITALIZACAO RG')]
    const noArquivo = [linha('2026-09-02', -297.85, 'CAPITALIZACAO RG')]
    expect(casarFronteiraDeDia(noLedger, noArquivo, noArquivo).deslocamentos).toEqual([])
  })

  it('⛔ histórico diferente NÃO é a mesma linha, nem no dia vizinho', () => {
    const noLedger = [tx('t1', '2026-09-01', -297.84, 'CAPITALIZACAO RG')]
    const noArquivo = [linha('2026-09-02', -297.84, 'PIX ENVIADO')]
    expect(casarFronteiraDeDia(noLedger, noArquivo, noArquivo).deslocamentos).toEqual([])
  })

  it('⛔ e o sinal conta: −297,84 não casa com +297,84 no dia vizinho', () => {
    const noLedger = [tx('t1', '2026-09-01', -297.84, 'CAPITALIZACAO RG')]
    const noArquivo = [linha('2026-09-02', 297.84, 'CAPITALIZACAO RG')]
    expect(casarFronteiraDeDia(noLedger, noArquivo, noArquivo).deslocamentos).toEqual([])
  })
})
