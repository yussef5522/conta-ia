// ESTOQUE FASE 1 item 4 — envelope da consulta por CHAVE (consChNFe). Puro (REGRA 3).

import { describe, it, expect } from 'vitest'
import { buildDistDFeConsChNFeEnvelope } from '../envelope'

const CHAVE = '43260850607080000199550100000000011234500017'

describe('buildDistDFeConsChNFeEnvelope', () => {
  it('monta o consChNFe com a chave e o CNPJ (só dígitos)', () => {
    const xml = buildDistDFeConsChNFeEnvelope({ cnpj: '29.756.732/0001-98', cUFAutor: '43', chave: CHAVE })
    expect(xml).toContain('<consChNFe><chNFe>' + CHAVE + '</chNFe></consChNFe>')
    expect(xml).toContain('<CNPJ>29756732000198</CNPJ>')
    expect(xml).toContain('<cUFAutor>43</cUFAutor>')
    expect(xml).toContain('<tpAmb>1</tpAmb>')
    expect(xml).not.toContain('distNSU') // é consulta por chave, não por NSU
  })
  it('homologação usa tpAmb 2', () => {
    expect(buildDistDFeConsChNFeEnvelope({ cnpj: '1', cUFAutor: '43', chave: CHAVE, tpAmb: '2' })).toContain('<tpAmb>2</tpAmb>')
  })
})
