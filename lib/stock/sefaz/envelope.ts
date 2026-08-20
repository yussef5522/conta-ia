// ESTOQUE FASE 0 item 2 — envelope SOAP da NFeDistribuicaoDFe (consulta por NSU).
// Puro (string in → string out), testável. Não fala com a SEFAZ.

// UF sigla → cUF IBGE (cUFAutor da consulta).
const UF_CODE: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
  MG: '31', ES: '32', RJ: '33', SP: '35',
  PR: '41', SC: '42', RS: '43',
  MS: '50', MT: '51', GO: '52', DF: '53',
}

export function ufToCodigo(uf: string | null | undefined): string | null {
  if (!uf) return null
  return UF_CODE[uf.trim().toUpperCase()] ?? null
}

const NSU15 = (nsu: string) => nsu.replace(/\D/g, '').padStart(15, '0').slice(-15)

/** Envelope da consulta por ÚLTIMO NSU (distNSU). tpAmb: '1' produção, '2' homolog. */
export function buildDistDFeEnvelope(input: {
  cnpj: string
  cUFAutor: string
  ultNSU: string
  tpAmb?: '1' | '2'
}): string {
  const cnpj = input.cnpj.replace(/\D/g, '')
  const tpAmb = input.tpAmb ?? '1'
  const ultNSU = NSU15(input.ultNSU)
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">` +
    `<nfeDadosMsg>` +
    `<distDFeInt versao="1.35" xmlns="http://www.portalfiscal.inf.br/nfe">` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<cUFAutor>${input.cUFAutor}</cUFAutor>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<distNSU><ultNSU>${ultNSU}</ultNSU></distNSU>` +
    `</distDFeInt>` +
    `</nfeDadosMsg>` +
    `</nfeDistDFeInteresse>` +
    `</soap12:Body>` +
    `</soap12:Envelope>`
  )
}

// Ambiente Nacional (AN) — produção. Homologação via env se precisar testar assinatura.
export const SEFAZ_DIST_URL_PROD = 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
export const SEFAZ_DIST_URL_HOMOLOG = 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
export const SEFAZ_DIST_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse'
