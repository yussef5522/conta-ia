// Sprint Retirada-1-Clique — sugestão de retirada de sócio.

import { describe, it, expect } from 'vitest'
import {
  suggestWithdrawal,
  type SocioRef,
} from '@/lib/withdrawals/suggest-from-description'

const YUSSEF: SocioRef = {
  id: 'socio-yussef',
  nome: 'YUSSEF MUSA',
  cpf: '60025889060',
  pixKeys: ['yussefmusa5522@gmail.com', '51999991234'],
  papel: 'ADMINISTRADOR',
}

const NOURA: SocioRef = {
  id: 'socio-noura',
  nome: 'NOURA AWNI',
  cpf: '12345678901',
  pixKeys: [],
  papel: 'SOCIO',
}

describe('suggestWithdrawal — sinais FORTES (STRONG)', () => {
  it('descrição com CPF do sócio → STRONG + kind por papel', () => {
    const r = suggestWithdrawal(
      'PAGAMENTO PIX 60025889060 YUSSEF MUSA',
      [YUSSEF],
    )
    expect(r).not.toBeNull()
    expect(r!.strength).toBe('STRONG')
    expect(r!.socioId).toBe('socio-yussef')
    expect(r!.suggestedKind).toBe('PRO_LABORE') // ADMINISTRADOR
    expect(r!.reasons).toContain('CPF do sócio')
    expect(r!.reasons).toContain('Nome do sócio')
  })

  it('descrição com chave Pix do sócio → STRONG', () => {
    const r = suggestWithdrawal(
      'PIX RECEBIDO yussefmusa5522@gmail.com',
      [YUSSEF],
    )
    expect(r).not.toBeNull()
    expect(r!.strength).toBe('STRONG')
    expect(r!.reasons).toContain('Chave Pix do sócio')
  })

  it('descrição só com nome (sem CPF) → STRONG', () => {
    const r = suggestWithdrawal('TRANSF YUSSEF MUSA RECEBE', [YUSSEF])
    expect(r).not.toBeNull()
    expect(r!.strength).toBe('STRONG')
    expect(r!.reasons).toEqual(['Nome do sócio'])
  })

  it('multi-sócio: escolhe o que tem mais sinais', () => {
    const r = suggestWithdrawal(
      'PIX 60025889060 YUSSEF MUSA yussefmusa5522@gmail.com',
      [YUSSEF, NOURA],
    )
    expect(r!.socioId).toBe('socio-yussef')
    expect(r!.reasons.length).toBeGreaterThanOrEqual(2)
  })

  it('SOCIO regular → suggestedKind = DISTRIBUICAO', () => {
    const r = suggestWithdrawal('PIX NOURA AWNI 12345678901', [NOURA])
    expect(r!.suggestedKind).toBe('DISTRIBUICAO')
  })
})

describe('suggestWithdrawal — sinal FRACO (keyword pessoal)', () => {
  it('"COOPERATIVA DE PAIS E MESTRES" sem CPF → WEAK', () => {
    const r = suggestWithdrawal(
      'PAGAMENTO COOPERATIVA DE PAIS E MESTRES ESCOLA SANTA TERE',
      [YUSSEF],
    )
    expect(r).not.toBeNull()
    expect(r!.strength).toBe('WEAK')
    expect(r!.suggestedKind).toBe('RETIRADA_SOCIOS')
    expect(r!.reasons[0]).toContain('Despesa pessoal')
  })

  it('"RECARGA TELEFONE" → WEAK', () => {
    const r = suggestWithdrawal(
      'RECARGA TELEFONE PESSOAL R$ 50',
      [YUSSEF],
    )
    expect(r).not.toBeNull()
    expect(r!.strength).toBe('WEAK')
  })

  it('"NETFLIX" → WEAK', () => {
    const r = suggestWithdrawal('NETFLIX.COM ASSINATURA MENSAL', [YUSSEF])
    expect(r).not.toBeNull()
    expect(r!.strength).toBe('WEAK')
  })

  it('keyword pessoal sem sócios cadastrados → null', () => {
    const r = suggestWithdrawal('PAGAMENTO ESCOLA SANTA TERE', [])
    expect(r).toBeNull()
  })
})

describe('suggestWithdrawal — NÃO sugere (anti-falso-positivo)', () => {
  it('descrição neutra (fornecedor real) → null', () => {
    const r = suggestWithdrawal(
      'DOCEOLI ALIMENTOS LTDA - Pagamento',
      [YUSSEF, NOURA],
    )
    expect(r).toBeNull()
  })

  it('venda PIX cliente (não-relacionado) → null', () => {
    const r = suggestWithdrawal(
      'ANA PAULA MEIRELES SANTOS - Pix | Maquininha',
      [YUSSEF, NOURA],
    )
    expect(r).toBeNull()
  })

  it('CPF de outra pessoa (não cadastrada) → null', () => {
    const r = suggestWithdrawal('PIX 99999999999 OUTRA PESSOA', [YUSSEF])
    expect(r).toBeNull()
  })

  it('nome parcial sem 2 palavras significativas → null', () => {
    // Só "YUSSEF" sem "MUSA" pode bater em falso. Exige TODAS as words ≥4 chars
    const r = suggestWithdrawal('PIX YUSSEF DESCONHECIDO', [YUSSEF])
    // YUSSEF (≥4) + MUSA (≥4) → ambos precisam aparecer
    expect(r).toBeNull()
  })
})

describe('suggestWithdrawal — caso real Yussef (caçula mix)', () => {
  it('COOPERATIVA DE PAIS E MESTRES ESCOLA → WEAK pra retirada', () => {
    const r = suggestWithdrawal(
      'COOPERATIVA DE PAIS E MESTRES DA ESCOLA SANTA TERE',
      [YUSSEF],
    )
    expect(r).not.toBeNull()
    expect(r!.strength).toBe('WEAK')
    expect(r!.suggestedKind).toBe('RETIRADA_SOCIOS')
    expect(r!.reasons[0].toLowerCase()).toContain('cooperativa')
  })
})
