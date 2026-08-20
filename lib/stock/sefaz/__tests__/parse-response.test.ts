// ESTOQUE FASE 0 item 2 — golden do parser da resposta SEFAZ. Monta um retDistDFeInt
// REAL (com docZip = gzip+base64 de verdade) e roda o parser (REGRA 3: gunzip + parse
// end-to-end). Anti-PII: CNPJ/nomes sintéticos.

import { describe, it, expect } from 'vitest'
import { gzipSync } from 'node:zlib'
import { parseSefazResponse, inflateDocZip } from '../parse-response'

const zip = (xml: string) => gzipSync(Buffer.from(xml, 'utf8')).toString('base64')

const resNFe = (chave: string, cnpj: string, nome: string, vNF: string, dhEmi: string, tpNF = '1', cSit = '1') =>
  `<resNFe versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><chNFe>${chave}</chNFe><CNPJ>${cnpj}</CNPJ><xNome>${nome}</xNome><IE>123</IE><dhEmi>${dhEmi}</dhEmi><tpNF>${tpNF}</tpNF><vNF>${vNF}</vNF><digVal>abc</digVal><dhRecbto>${dhEmi}</dhRecbto><cSitNFe>${cSit}</cSitNFe></resNFe>`

const procNFe = (chave: string, cnpj: string, nome: string, vNF: string, dhEmi: string) =>
  `<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chave}"><ide><dhEmi>${dhEmi}</dhEmi><tpNF>1</tpNF></ide><emit><CNPJ>${cnpj}</CNPJ><xNome>${nome}</xNome></emit><total><ICMSTot><vNF>${vNF}</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`

const evento = () =>
  `<resEvento versao="1.01" xmlns="http://www.portalfiscal.inf.br/nfe"><cOrgao>43</cOrgao><chNFe>43000000000000000000000000000000000000000009</chNFe><tpEvento>210210</tpEvento></resEvento>`

const CH_HIST = '43260800000000000111000000000000000000000001'
const CH_NOVA = '43260800000000000222000000000000000000000002'
const CH_COMPLETA = '43260800000000000333000000000000000000000003'

function soap(docs: { nsu: string; schema: string; b64: string }[], cStat = '138', ultNSU = '000000000000004', maxNSU = '000000000000004') {
  const zips = docs.map((d) => `<docZip NSU="${d.nsu}" schema="${d.schema}">${d.b64}</docZip>`).join('')
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeDistDFeInteresseResponse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDistDFeInteresseResult><retDistDFeInt versao="1.35" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>1</tpAmb><verAplic>1.0</verAplic><cStat>${cStat}</cStat><xMotivo>Documento(s) localizado(s)</xMotivo><dhResp>2026-08-19T12:00:00-03:00</dhResp><ultNSU>${ultNSU}</ultNSU><maxNSU>${maxNSU}</maxNSU><loteDistDFeInt>${zips}</loteDistDFeInt></retDistDFeInt></nfeDistDFeInteresseResult></nfeDistDFeInteresseResponse></soap:Body></soap:Envelope>`
}

describe('parseSefazResponse — retDistDFeInt', () => {
  const raw = soap([
    { nsu: '000000000000001', schema: 'resNFe_v1.01.xsd', b64: zip(resNFe(CH_HIST, '11222333000181', 'FORNECEDOR ANTIGO LTDA', '500.00', '2026-06-10T09:00:00-03:00')) },
    { nsu: '000000000000002', schema: 'resNFe_v1.01.xsd', b64: zip(resNFe(CH_NOVA, '44555666000199', 'LATICINIOS NOVO LTDA', '1234.56', '2026-08-19T09:00:00-03:00')) },
    { nsu: '000000000000003', schema: 'procNFe_v4.00.xsd', b64: zip(procNFe(CH_COMPLETA, '77888999000155', 'CARNES COMPLETA LTDA', '9999.90', '2026-08-19T10:00:00-03:00')) },
    { nsu: '000000000000004', schema: 'resEvento_v1.01.xsd', b64: zip(evento()) },
  ])
  const parsed = parseSefazResponse(raw)

  it('lê cStat/ultNSU/maxNSU', () => {
    expect(parsed.cStat).toBe('138')
    expect(parsed.ultNSU).toBe('000000000000004')
    expect(parsed.maxNSU).toBe('000000000000004')
    expect(parsed.docs).toHaveLength(4)
  })

  it('resumo (resNFe) → chave, emitente, valor, data, tipo', () => {
    const nova = parsed.docs.find((d) => d.chave === CH_NOVA)
    expect(nova?.tipo).toBe('resumo')
    expect(nova?.emitCnpj).toBe('44555666000199')
    expect(nova?.emitNome).toBe('LATICINIOS NOVO LTDA')
    expect(nova?.vNF).toBe(1234.56)
    expect(nova?.dataEmissao).toBe('2026-08-19T09:00:00-03:00')
    expect(nova?.tpNF).toBe('1')
    expect(nova?.cSitNFe).toBe('1')
  })

  it('NF completa (procNFe) → mesmos campos + tipo completo', () => {
    const c = parsed.docs.find((d) => d.chave === CH_COMPLETA)
    expect(c?.tipo).toBe('completo')
    expect(c?.emitCnpj).toBe('77888999000155')
    expect(c?.vNF).toBe(9999.9)
    expect(c?.chave).toBe(CH_COMPLETA)
  })

  it('evento não vira NF-e (tipo evento, sem chave de compra)', () => {
    const ev = parsed.docs.find((d) => d.tipo === 'evento')
    expect(ev).toBeTruthy()
    expect(ev?.emitCnpj).toBeUndefined()
  })

  it('o docZip descomprime pro XML original (gunzip real)', () => {
    const b64 = zip('<x>oi</x>')
    expect(inflateDocZip(b64)).toBe('<x>oi</x>')
  })

  it('cStat 137 (nenhum documento) → 0 docs, sem lançar', () => {
    const vazio = `<?xml version="1.0"?><retDistDFeInt xmlns="http://www.portalfiscal.inf.br/nfe"><cStat>137</cStat><xMotivo>Nenhum documento localizado</xMotivo><ultNSU>000000000000000</ultNSU><maxNSU>000000000000000</maxNSU></retDistDFeInt>`
    const p = parseSefazResponse(vazio)
    expect(p.cStat).toBe('137')
    expect(p.docs).toHaveLength(0)
  })
})
