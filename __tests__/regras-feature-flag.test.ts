// Sprint Regras-Cadastro (22/06/2026) — feature flag AUTO_RULE_GENERATION
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isAutoRuleGenerationEnabled } from '../lib/regras/feature-flag'

describe('isAutoRuleGenerationEnabled', () => {
  const original = process.env.AUTO_RULE_GENERATION

  beforeEach(() => {
    delete process.env.AUTO_RULE_GENERATION
  })

  afterEach(() => {
    if (original === undefined) delete process.env.AUTO_RULE_GENERATION
    else process.env.AUTO_RULE_GENERATION = original
  })

  it('default: OFF quando env não está setado', () => {
    expect(isAutoRuleGenerationEnabled()).toBe(false)
  })

  it('OFF quando env = "false"', () => {
    process.env.AUTO_RULE_GENERATION = 'false'
    expect(isAutoRuleGenerationEnabled()).toBe(false)
  })

  it('OFF quando env = "0"', () => {
    process.env.AUTO_RULE_GENERATION = '0'
    expect(isAutoRuleGenerationEnabled()).toBe(false)
  })

  it('OFF quando env = "" string vazia', () => {
    process.env.AUTO_RULE_GENERATION = ''
    expect(isAutoRuleGenerationEnabled()).toBe(false)
  })

  it('ON apenas quando env = "true" exato', () => {
    process.env.AUTO_RULE_GENERATION = 'true'
    expect(isAutoRuleGenerationEnabled()).toBe(true)
  })

  it('OFF mesmo com "True" (case-sensitive)', () => {
    process.env.AUTO_RULE_GENERATION = 'True'
    expect(isAutoRuleGenerationEnabled()).toBe(false)
  })

  it('OFF com valor lixo', () => {
    process.env.AUTO_RULE_GENERATION = 'yes'
    expect(isAutoRuleGenerationEnabled()).toBe(false)
  })
})
