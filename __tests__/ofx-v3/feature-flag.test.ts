// Sprint OFX V3 — feature flag

import { describe, it, expect } from 'vitest'
import { isOfxImportV3Enabled } from '@/lib/ofx-v3/feature-flag'

describe('isOfxImportV3Enabled', () => {
  it('true quando OFX_IMPORT_V3_ENABLED=true', () => {
    expect(isOfxImportV3Enabled({ OFX_IMPORT_V3_ENABLED: 'true' })).toBe(true)
  })
  it('false sem env', () => {
    expect(isOfxImportV3Enabled({})).toBe(false)
  })
  it('false quando false', () => {
    expect(isOfxImportV3Enabled({ OFX_IMPORT_V3_ENABLED: 'false' })).toBe(false)
  })
  it('aceita variações de case e espaço', () => {
    expect(isOfxImportV3Enabled({ OFX_IMPORT_V3_ENABLED: ' TRUE ' })).toBe(true)
    expect(isOfxImportV3Enabled({ OFX_IMPORT_V3_ENABLED: '1' })).toBe(false)
  })
})
