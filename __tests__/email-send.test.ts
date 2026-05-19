// Email send + mask + isResendConfigured — Sprint 1.5.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sendEmail, maskEmail } from '@/lib/email/send'
import { isResendConfigured } from '@/lib/email/client'

describe('maskEmail', () => {
  it('mascara email padrão preservando primeira e última letra do user', () => {
    expect(maskEmail('admin@contaia.com.br')).toBe('a***n@contaia.com.br')
  })

  it('user curto (≤2 chars) usa só primeira letra', () => {
    expect(maskEmail('ab@x.com')).toBe('a***@x.com')
    expect(maskEmail('a@x.com')).toBe('a***@x.com')
  })

  it('preserva domínio inteiro', () => {
    expect(maskEmail('yussefmusa5522@gmail.com')).toBe(
      'y***2@gmail.com',
    )
  })

  it('email inválido retornado intacto (graceful)', () => {
    expect(maskEmail('not-email')).toBe('not-email')
  })
})

describe('isResendConfigured', () => {
  const originalKey = process.env.RESEND_API_KEY

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.RESEND_API_KEY
    } else {
      process.env.RESEND_API_KEY = originalKey
    }
  })

  it('true quando RESEND_API_KEY presente', () => {
    process.env.RESEND_API_KEY = 're_test_xxx'
    expect(isResendConfigured()).toBe(true)
  })

  it('false quando RESEND_API_KEY ausente', () => {
    delete process.env.RESEND_API_KEY
    expect(isResendConfigured()).toBe(false)
  })

  it('false quando RESEND_API_KEY = string vazia', () => {
    process.env.RESEND_API_KEY = ''
    expect(isResendConfigured()).toBe(false)
  })
})

describe('sendEmail — validação + skip em dev', () => {
  const originalKey = process.env.RESEND_API_KEY

  beforeEach(() => {
    delete process.env.RESEND_API_KEY
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY
    else process.env.RESEND_API_KEY = originalKey
    vi.restoreAllMocks()
  })

  it('email destinatário inválido → success=false', async () => {
    const r = await sendEmail({
      to: 'nao-eh-email',
      subject: 'x',
      html: '<p>x</p>',
      type: 'test',
    })
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/inválido/i)
  })

  it('RESEND_API_KEY ausente → skipped=true + success=true', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = await sendEmail({
      to: 'test@example.com',
      subject: 'x',
      html: '<p>x</p>',
      type: 'test',
    })
    expect(r.success).toBe(true)
    expect(r.skipped).toBe(true)
    expect(warn).toHaveBeenCalled()
  })
})
