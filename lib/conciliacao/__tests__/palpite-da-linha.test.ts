// ⭐⭐ A RÉGUA DO MELHOR PALPITE — o cartão ≍ do mock v3 (16/09/2026)
//
// O que estes testes seguram: o palpite **sugere e nunca decide**, a **diferença aparece
// SEMPRE**, o botão diz **o efeito**, e o **empate não escolhe no escuro**.

import { describe, it, expect } from 'vitest'
import {
  escolherPalpite, frasePraDiferenca, rotuloDoBotao, progressoDoMes, palpiteLevaAoAlvo,
  type CandidatoBruto,
} from '../palpite-da-linha'

const cand = (o: Partial<CandidatoBruto>): CandidatoBruto => ({
  acao: 'CASAR_PAGAR', familia: 'f', titulo: 't', detalhe: 'd',
  diferenca: 0, confianca: 'ALTA', alvo: {}, ...o,
})

describe('⛔ a DIFERENÇA nunca se esconde', () => {
  /**
   * ⚠️ A ASSERÇÃO USA O MESMO FORMATADOR, não a string escrita à mão: `toLocaleString`
   * pt-BR separa `R$` do número com **espaço não-quebrável** (U+00A0), e comparar com
   * espaço comum dá vermelho com a tela certa. É a família do `Sa\xeddas` de 15/09 —
   * *sonda errada dá um vermelho tão convincente quanto um defeito real*.
   */
  it('⭐ valor exato AINDA mostra a pílula — "fecha em R$ 0,00"', () => {
    const zero = (0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    expect(frasePraDiferenca(0, 3194.35)).toContain('valor exato')
    expect(frasePraDiferenca(0, 3194.35)).toContain(zero)
  })

  it('⭐ diferença pequena é explicada como juros/tarifa', () => {
    const f = frasePraDiferenca(6.86, 2086.84)
    expect(f).toContain('6,86')
    expect(f).toMatch(/juros|tarifa/)
  })

  /**
   * ⛔ ACIMA DE 10% O TOM MUDA PRA ALERTA — é o que impede o clique rápido no par errado.
   * O caso real: Ivan, linha 2.008,00 × notas 1.938,50 (3,5%) passa como juros; uma
   * diferença de 500 numa nota de 600 tem que gritar.
   */
  it('⭐ diferença grande VIRA ALERTA, não "juros"', () => {
    const f = frasePraDiferenca(500, 600)
    expect(f).toMatch(/⚠|confira/)
    expect(f).not.toMatch(/juros/)
  })

  it('⭐ e o palpite sempre carrega a frase', () => {
    const p = escolherPalpite([cand({ diferenca: 0 })], 'SAIDA', 100)
    expect(p?.diferenca).toBeTruthy()
  })
})

describe('⭐⭐ o botão diz O EFEITO, nunca "confirmar" seco', () => {
  const casos: [Parameters<typeof rotuloDoBotao>[0], RegExp][] = [
    ['PGTO_CARTAO', /baixa a fatura/],
    ['PARCELA_EMPRESTIMO', /parcela paga/],
    ['RECEBIMENTO_VENDA', /receita/],
    ['IGNORAR', /tira das filas/],
  ]
  for (const [acao, re] of casos) {
    it(`${acao} → "${re.source}"`, () => expect(rotuloDoBotao(acao)).toMatch(re))
  }

  it('⭐ CASAR_PAGAR NOMEIA a conta quando ela tem nome', () => {
    expect(rotuloDoBotao('CASAR_PAGAR', 'NF 1240679')).toContain('NF 1240679')
  })

  it('⚠️ e sem nome NÃO inventa um — cai no genérico', () => {
    expect(rotuloDoBotao('CASAR_PAGAR')).toBe('✓ Confirmar — concilia a conta')
  })
})

describe('⛔⛔ o empate não escolhe no escuro', () => {
  it('⭐ dois candidatos igualmente bons → NENHUM palpite', () => {
    const p = escolherPalpite([
      cand({ acao: 'PGTO_CARTAO', confianca: 'ALTA', diferenca: 0 }),
      cand({ acao: 'PARCELA_EMPRESTIMO', confianca: 'ALTA', diferenca: 0 }),
    ], 'SAIDA', 3194.35)
    expect(p, 'escolheu um de dois empatados — é o defeito do PAO DE MEL').toBeNull()
  })

  it('⭐ mas confiança MAIOR desempata', () => {
    const p = escolherPalpite([
      cand({ acao: 'CASAR_PAGAR', confianca: 'BAIXA', diferenca: 0 }),
      cand({ acao: 'PGTO_CARTAO', confianca: 'ALTA', diferenca: 0 }),
    ], 'SAIDA', 100)
    expect(p?.acao).toBe('PGTO_CARTAO')
  })

  it('⭐ e na MESMA confiança, a diferença menor ganha', () => {
    const p = escolherPalpite([
      cand({ acao: 'CASAR_PAGAR', confianca: 'MEDIA', diferenca: 50, alvoNome: 'longe' }),
      cand({ acao: 'PARCELA_EMPRESTIMO', confianca: 'MEDIA', diferenca: 1 }),
    ], 'SAIDA', 1000)
    expect(p?.acao).toBe('PARCELA_EMPRESTIMO')
  })
})

describe('⛔ a LEI DO SENTIDO vale no palpite também', () => {
  /**
   * A tela não pode oferecer com botão gigante o que o servidor recusaria — o
   * `resolverLinha` checa `acaoValePraSentido` e devolveria a frase que ensina. Palpite
   * que leva a 422 é a meia-ponte de novo, agora em verde.
   */
  it('⭐ CRÉDITO nunca ganha palpite de "casar com conta a pagar"', () => {
    const p = escolherPalpite([cand({ acao: 'CASAR_PAGAR', confianca: 'ALTA' })], 'ENTRADA', 308.5)
    expect(p, 'crédito ganhou palpite de pagar dívida').toBeNull()
  })

  it('⭐ e a entrada aceita o palpite dela', () => {
    const p = escolherPalpite([cand({ acao: 'RECEBIMENTO_VENDA', confianca: 'ALTA' })], 'ENTRADA', 308.5)
    expect(p?.acao).toBe('RECEBIMENTO_VENDA')
  })
})

describe('⚠️ a tela sabe quem GRAVA e quem LEVA ao alvo', () => {
  it('⭐ casar/transferência LEVAM (a escolha do alvo tem casa própria)', () => {
    for (const acao of ['CASAR_PAGAR', 'CASAR_RECEBER', 'TRANSFERENCIA_ENVIADA'] as const) {
      const p = escolherPalpite([cand({ acao, confianca: 'ALTA' })], acao === 'CASAR_RECEBER' ? 'ENTRADA' : 'SAIDA', 10)
      expect(palpiteLevaAoAlvo(p!), `${acao} deveria levar ao alvo`).toBe(true)
    }
  })

  it('⭐ fatura e parcela GRAVAM ali mesmo', () => {
    const p = escolherPalpite([cand({ acao: 'PGTO_CARTAO', confianca: 'ALTA' })], 'SAIDA', 10)
    expect(palpiteLevaAoAlvo(p!)).toBe(false)
  })
})

describe('⭐⭐ o anel de progresso deriva dos MESMOS contadores', () => {
  it('⭐ os números do mock: 86% · 190 resolvidas · 1 na caixa', () => {
    const p = progressoDoMes({ arquivo: 190, saidas: 1, entradas: 0, total: 221 })
    expect(p.resolvidas).toBe(190)
    expect(p.naCaixa).toBe(1)
    expect(p.frase).toBe('190 resolvidas · 1 na caixa')
    expect(p.pct).toBe(86)
  })

  /**
   * ⛔ CAIXA VAZIA COM ARQUIVO VAZIO NÃO É 100%. Anel cheio sobre o nada seria a tela se
   * parabenizando por trabalho que não existe — a família do "erro disfarçado de vazio".
   */
  it('⭐ nada importado → 0%, e a frase DIZ que é ausência', () => {
    const p = progressoDoMes({ arquivo: 0, saidas: 0, entradas: 0, total: 0 })
    expect(p.pct).toBe(0)
    expect(p.frase).toMatch(/nada importado/)
  })

  it('⭐ tudo resolvido → 100%', () => {
    expect(progressoDoMes({ arquivo: 9, saidas: 0, entradas: 0, total: 9 }).pct).toBe(100)
  })
})
