// Sprint Ponte-na-hora (08/08) — Regra 1. Antes do fix, escolher categoria de
// retirada no dropdown NÃO abria o painel. Este helper decide o gatilho; no
// código pré-fix a função não existia → import falha = VERMELHO.

import { describe, it, expect } from 'vitest'
import { detectWithdrawalTrigger } from '../detect-trigger'

describe('detectWithdrawalTrigger — gatilho + tipo (decisão Yussef 08/08)', () => {
  it('Distribuição de Lucros → dispara, tipo DISTRIBUICAO', () => {
    const r = detectWithdrawalTrigger({ name: 'Distribuição de Lucros', dreGroup: 'DISTRIBUICAO_LUCROS' })
    expect(r).toEqual({ triggers: true, suggestedKind: 'DISTRIBUICAO' })
  })

  it('Pró-labore (DESPESAS_PESSOAL) → dispara, tipo PRO_LABORE', () => {
    const r = detectWithdrawalTrigger({ name: 'Pró-labore', dreGroup: 'DESPESAS_PESSOAL' })
    expect(r).toEqual({ triggers: true, suggestedKind: 'PRO_LABORE' })
  })

  it('INSS sobre Pró-labore → NÃO dispara (imposto, não retirada)', () => {
    const r = detectWithdrawalTrigger({ name: 'INSS sobre Pró-labore', dreGroup: 'DISTRIBUICAO_LUCROS' })
    expect(r.triggers).toBe(false)
  })

  it('mistas (ambíguas) → dispara mas tipo VAZIO (usuário escolhe)', () => {
    for (const name of ['Pró-labore Sócios', 'Pró-labore e Distribuição', 'Retirada de Lucros / Pró-labore']) {
      const r = detectWithdrawalTrigger({ name, dreGroup: 'DISTRIBUICAO_LUCROS' })
      expect(r.triggers).toBe(true)
      expect(r.suggestedKind).toBeNull()
    }
  })

  it('categoria normal (não retirada) → NÃO dispara', () => {
    expect(detectWithdrawalTrigger({ name: 'Tarifas Bancárias', dreGroup: 'DESPESAS_FINANCEIRAS' }).triggers).toBe(false)
    expect(detectWithdrawalTrigger({ name: 'Salários', dreGroup: 'DESPESAS_PESSOAL' }).triggers).toBe(false)
    expect(detectWithdrawalTrigger({ name: 'Receita de Vendas', dreGroup: 'RECEITA_BRUTA' }).triggers).toBe(false)
  })
})
