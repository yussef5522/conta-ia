// Sprint 5.0.2.c — Validação do system prompt expert.

import { describe, it, expect } from 'vitest'
import { TAX_EXPERT_SYSTEM_PROMPT, buildExpertPrompt } from '@/lib/tax/expert-prompt'

describe('Expert Prompt — estrutura', () => {
  it('tem seção IDENTIDADE (contador 30 anos)', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toContain('IDENTIDADE')
    expect(TAX_EXPERT_SYSTEM_PROMPT).toMatch(/30 anos/i)
  })

  it('tem seção EXPERTISE TÉCNICA', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toContain('EXPERTISE TÉCNICA')
  })

  it('tem seção COMPORTAMENTO', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toContain('COMPORTAMENTO')
  })

  it('tem seção LIMITES E DISCLAIMERS', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toMatch(/LIMITES.*DISCLAIMER/i)
  })

  it('cita LC 123/2006 (Simples)', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toContain('LC 123/2006')
  })

  it('cita Lei 14.148/2021 (PERSE)', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toContain('14.148/2021')
  })

  it('cita EC 132/2023 + LC 214/2025 (Reforma)', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toContain('EC 132/2023')
    expect(TAX_EXPERT_SYSTEM_PROMPT).toContain('LC 214/2025')
  })

  it('cita jurisprudência STF Tema 69', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toContain('Tema 69')
  })

  it('proíbe inventar leis', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toMatch(/NÃO inventar|não inventar/i)
  })

  it('exige disclaimer ("valide com contador")', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toMatch(/valide com.*contador/i)
  })

  it('menciona Fator R 28%', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toMatch(/28%|0,28/)
  })

  it('cobre os 3 ramos verticais (restaurante/academia/comércio)', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT.toLowerCase()).toContain('restaurante')
    expect(TAX_EXPERT_SYSTEM_PROMPT.toLowerCase()).toContain('academia')
    expect(TAX_EXPERT_SYSTEM_PROMPT.toLowerCase()).toMatch(/comércio|comercio/i)
  })

  it('inclui exemplo de resposta estruturada', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toContain('EXEMPLO DE RESPOSTA')
    expect(TAX_EXPERT_SYSTEM_PROMPT).toContain('OPORTUNIDADES')
  })

  it('formato de números brasileiro (R$ com vírgula)', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toMatch(/R\$ \d/)
  })

  it('buildExpertPrompt() retorna string não-vazia', () => {
    const out = buildExpertPrompt()
    expect(out).toBeTruthy()
    expect(out.length).toBeGreaterThan(500)
  })
})

describe('Expert Prompt — defesa contra mau uso', () => {
  it('proíbe garantir resultados absolutos', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toMatch(/garantir|nunca/i)
  })

  it('proíbe recomendar sonegação', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toMatch(/sonegação|lícit/i)
  })

  it('exige citar base legal', () => {
    expect(TAX_EXPERT_SYSTEM_PROMPT).toMatch(/base legal|citar.*lei/i)
  })
})
