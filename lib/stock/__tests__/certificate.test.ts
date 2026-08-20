// ESTOQUE FASE 0 item 1 — golden do certificado + cifra. Gera um .pfx SINTÉTICO
// real (node-forge, CN no formato e-CNPJ) e roda readPfx/encrypt/decrypt de verdade
// (REGRA 3 — comportamento, não string). Anti-PII: CNPJ/nome sintéticos.

import { describe, it, expect, beforeAll } from 'vitest'
import { readPfx, pfxToPem, StockCertificateError } from '../certificate'
import { encryptSecret, decryptSecret, decryptSecretToString, StockCryptoError } from '../crypto'
import { makePfx } from './_make-pfx'

const CN = 'EMPRESA TESTE LTDA:11222333000181'
const SENHA = 'senha-de-teste-123'
const NOT_BEFORE = new Date('2026-01-01T00:00:00Z')
const NOT_AFTER = new Date('2027-01-01T00:00:00Z')

describe('readPfx — leitura do certificado A1', () => {
  let pfx: Buffer
  beforeAll(() => {
    pfx = makePfx(CN, SENHA, NOT_BEFORE, NOT_AFTER)
  })

  it('extrai CNPJ, razão social e validade', () => {
    const info = readPfx(pfx, SENHA)
    expect(info.cnpj).toBe('11222333000181')
    expect(info.razaoSocial).toBe('EMPRESA TESTE LTDA')
    expect(info.validadeDe.toISOString()).toBe(NOT_BEFORE.toISOString())
    expect(info.validadeAte.toISOString()).toBe(NOT_AFTER.toISOString())
  })

  it('senha errada → SENHA_INVALIDA (mensagem acionável, não genérica)', () => {
    try {
      readPfx(pfx, 'senha-errada')
      throw new Error('deveria ter lançado')
    } catch (e) {
      expect(e).toBeInstanceOf(StockCertificateError)
      expect((e as StockCertificateError).code).toBe('SENHA_INVALIDA')
    }
  })

  it('arquivo não-pfx → PFX_INVALIDO', () => {
    try {
      readPfx(Buffer.from('isto não é um pfx'), SENHA)
      throw new Error('deveria ter lançado')
    } catch (e) {
      expect((e as StockCertificateError).code).toBe('PFX_INVALIDO')
    }
  })

  it('pfxToPem extrai key + cert PEM (fix do ERR_CRYPTO do A1 legado)', () => {
    const pem = pfxToPem(pfx, SENHA)
    expect(pem.key).toMatch(/-----BEGIN (RSA )?PRIVATE KEY-----/)
    expect(pem.cert).toMatch(/-----BEGIN CERTIFICATE-----/)
    expect(Array.isArray(pem.ca)).toBe(true)
  })

  it('cert de pessoa física (CN sem CNPJ) → SEM_CNPJ', () => {
    const pfPfx = makePfx('FULANO DE TAL:12345678909', SENHA, NOT_BEFORE, NOT_AFTER) // CPF 11 díg
    // 12345678909 tem 11 dígitos → não casa /(\d{14})/ → SEM_CNPJ
    try {
      readPfx(pfPfx, SENHA)
      throw new Error('deveria ter lançado')
    } catch (e) {
      expect((e as StockCertificateError).code).toBe('SEM_CNPJ')
    }
  })
})

describe('cifra do certificado (AES-256-GCM)', () => {
  beforeAll(() => {
    process.env.STOCK_CERT_ENC_KEY = 'chave-de-teste-bem-longa-pra-scrypt-1234567890'
  })

  it('round-trip: cifra e decifra idêntico (binário e string)', () => {
    const bin = Buffer.from([0, 1, 2, 255, 128, 42])
    expect(decryptSecret(encryptSecret(bin)).equals(bin)).toBe(true)
    expect(decryptSecretToString(encryptSecret('senha-secreta'))).toBe('senha-secreta')
  })

  it('cada cifra tem IV diferente (não determinístico)', () => {
    expect(encryptSecret('x')).not.toBe(encryptSecret('x'))
  })

  it('chave trocada → StockCryptoError acionável (nunca decifra lixo em silêncio)', () => {
    const c = encryptSecret('segredo')
    process.env.STOCK_CERT_ENC_KEY = 'OUTRA-chave-completamente-diferente-9876543210'
    expect(() => decryptSecret(c)).toThrow(StockCryptoError)
    process.env.STOCK_CERT_ENC_KEY = 'chave-de-teste-bem-longa-pra-scrypt-1234567890' // restaura
  })

  it('sem STOCK_CERT_ENC_KEY → recusa cifrar (nunca chave vazia)', () => {
    const saved = process.env.STOCK_CERT_ENC_KEY
    delete process.env.STOCK_CERT_ENC_KEY
    expect(() => encryptSecret('x')).toThrow(StockCryptoError)
    process.env.STOCK_CERT_ENC_KEY = saved
  })
})
