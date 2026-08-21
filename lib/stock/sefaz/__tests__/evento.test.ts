// ESTOQUE FASE 1 item 3 — assinatura do evento SEFAZ. Gera um A1 sintético (node-forge),
// assina uma Ciência (210210) e prova a estrutura que a SEFAZ valida: Reference ao
// infEvento, RSA-SHA1, SHA1, X509 no KeyInfo — e AUTO-VALIDA a assinatura (self-consistent).

import { describe, it, expect, beforeAll } from 'vitest'
import { SignedXml } from 'xml-crypto'
import { makePfx } from '../../__tests__/_make-pfx'
import { pfxToPem } from '../../certificate'
import { buildEvento, assinarEvento, buildEnvEvento, dhEventoBr, TP_EVENTO } from '../evento'

const CHAVE = '42260511222333000181550020063812691168173940'
const CNPJ = '11222333000181'
let pem: { key: string; cert: string; ca: string[] }

beforeAll(() => {
  const pfx = makePfx(`EMPRESA TESTE:${CNPJ}`, 'senha123', new Date('2026-01-01'), new Date('2027-01-01'))
  pem = pfxToPem(pfx, 'senha123')
})

describe('evento SEFAZ — Ciência 210210', () => {
  it('monta o <evento> com Id = ID+tpEvento+chave+nSeq', () => {
    const { xml, id } = buildEvento({ chave: CHAVE, cnpj: CNPJ, tpEvento: TP_EVENTO.CIENCIA, now: new Date('2026-08-20T15:00:00Z') })
    expect(id).toBe(`ID210210${CHAVE}01`)
    expect(xml).toContain('<descEvento>Ciencia da Operacao</descEvento>')
    expect(xml).toContain('<cOrgao>91</cOrgao>')
    expect(xml).toContain(`<chNFe>${CHAVE}</chNFe>`)
  })

  it('dhEvento sai em -03:00 (instante da manifestação)', () => {
    expect(dhEventoBr(new Date('2026-08-20T15:00:00Z'))).toBe('2026-08-20T12:00:00-03:00')
  })

  it('assina: Reference ao infEvento + RSA-SHA1 + SHA1 + X509 no KeyInfo', () => {
    const { xml, id } = buildEvento({ chave: CHAVE, cnpj: CNPJ, tpEvento: TP_EVENTO.CIENCIA, now: new Date() })
    const signed = assinarEvento(xml, pem.key, pem.cert)
    expect(signed).toContain('<Signature')
    expect(signed).toContain(`URI="#${id}"`)
    expect(signed).toMatch(/SignatureMethod[^>]*rsa-sha1/)
    expect(signed).toMatch(/DigestMethod[^>]*#sha1/)
    expect(signed).toContain('<X509Certificate>')
    expect(signed).toMatch(/Transform[^>]*enveloped-signature/)
  })

  it('a assinatura é criptograficamente VÁLIDA (auto-verifica)', () => {
    const { xml } = buildEvento({ chave: CHAVE, cnpj: CNPJ, tpEvento: TP_EVENTO.CIENCIA, now: new Date() })
    const signed = assinarEvento(xml, pem.key, pem.cert)
    const v = new SignedXml({ publicCert: pem.cert })
    const sigNode = /<Signature[\s\S]*<\/Signature>/.exec(signed)![0]
    v.loadSignature(sigNode)
    const ok = v.checkSignature(signed)
    expect(ok).toBe(true)
  })

  it('envEvento embrulha o evento assinado', () => {
    const { xml } = buildEvento({ chave: CHAVE, cnpj: CNPJ, tpEvento: TP_EVENTO.CIENCIA, now: new Date() })
    const env = buildEnvEvento([assinarEvento(xml, pem.key, pem.cert)])
    expect(env).toContain('<envEvento')
    expect(env).toContain('<idLote>1</idLote>')
    expect(env).toContain('<evento')
  })
})
