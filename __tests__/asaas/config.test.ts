// Sprint Asaas FATIA 3A — testes do loader de config.

import { describe, expect, test } from 'vitest'
import { loadAsaasConfig } from '@/lib/asaas/config'
import { AsaasConfigError } from '@/lib/asaas/errors'

const FAKE_KEY = '$aact_FAKE_TESTING_KEY_AAAAAAAAAA'

describe('loadAsaasConfig', () => {
  test('ASAAS_ENV=sandbox → URL sandbox', () => {
    const cfg = loadAsaasConfig({
      ASAAS_API_KEY: FAKE_KEY,
      ASAAS_ENV: 'sandbox',
    })
    expect(cfg.baseUrl).toBe('https://api-sandbox.asaas.com/v3')
    expect(cfg.env).toBe('sandbox')
  })

  test('ASAAS_ENV=production → URL produção', () => {
    const cfg = loadAsaasConfig({
      ASAAS_API_KEY: FAKE_KEY,
      ASAAS_ENV: 'production',
    })
    expect(cfg.baseUrl).toBe('https://api.asaas.com/v3')
    expect(cfg.env).toBe('production')
  })

  test('ASAAS_ENV ausente → default sandbox (defensivo)', () => {
    const cfg = loadAsaasConfig({ ASAAS_API_KEY: FAKE_KEY })
    expect(cfg.env).toBe('sandbox')
    expect(cfg.baseUrl).toBe('https://api-sandbox.asaas.com/v3')
  })

  test('ASAAS_ENV inválido → AsaasConfigError com mensagem clara', () => {
    expect(() =>
      loadAsaasConfig({ ASAAS_API_KEY: FAKE_KEY, ASAAS_ENV: 'staging' }),
    ).toThrow(AsaasConfigError)
    expect(() =>
      loadAsaasConfig({ ASAAS_API_KEY: FAKE_KEY, ASAAS_ENV: 'staging' }),
    ).toThrow(/sandbox.*production/)
  })

  test('ASAAS_API_KEY ausente → AsaasConfigError', () => {
    expect(() => loadAsaasConfig({})).toThrow(AsaasConfigError)
  })

  test('ASAAS_API_KEY vazia → AsaasConfigError (trim)', () => {
    expect(() => loadAsaasConfig({ ASAAS_API_KEY: '   ' })).toThrow(
      AsaasConfigError,
    )
  })

  test('ASAAS_ENV case-insensitive (SANDBOX = sandbox)', () => {
    const cfg = loadAsaasConfig({ ASAAS_API_KEY: FAKE_KEY, ASAAS_ENV: 'SANDBOX' })
    expect(cfg.env).toBe('sandbox')
  })
})
