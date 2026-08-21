// ESTOQUE FASE 1 item 3 — envio de evento à SEFAZ (NFeRecepcaoEvento4). mTLS (o mesmo
// PEM da Fase 0). Parseia o retorno (cStat do lote + cStat do evento + protocolo).

import { XMLParser } from 'fast-xml-parser'
import { postSefazSoap } from './client'

const URL_PROD = 'https://www1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx'
const URL_HOMOLOG = 'https://hom1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx'
const ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento'

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, trimValues: true })

export interface EventoResult {
  loteCStat: string
  loteMotivo: string
  cStat: string
  xMotivo: string
  nProt?: string
  dhRegEvento?: string
}

// cStat de evento aceitos como "deferido" (a nota fica disponível): 135 registrado e
// vinculado, 136 registrado não vinculado, 573 duplicidade (já havia Ciência).
export const EVENTO_OK = new Set(['135', '136', '573'])

export async function enviarEnvEvento(input: { envEvento: string; key: string; cert: string; homolog?: boolean }): Promise<EventoResult> {
  const url = input.homolog ? URL_HOMOLOG : URL_PROD
  const soap =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">` +
    `<soap12:Body>` +
    `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${input.envEvento}</nfeDadosMsg>` +
    `</soap12:Body></soap12:Envelope>`
  const r = await postSefazSoap({ url, action: ACTION, envelope: soap, key: input.key, cert: input.cert })
  return parseRetEvento(r.body)
}

function parseRetEvento(xml: string): EventoResult {
  const root = parser.parse(xml)
  // acha retEnvEvento em qualquer wrapper (nfeRecepcaoEventoNFResult, etc.) — varre.
  const ret = acharRetEnvEvento(root)
  if (!ret) throw new Error('Resposta da SEFAZ sem <retEnvEvento> — formato inesperado.')

  const loteCStat = String(ret.cStat ?? '')
  const loteMotivo = String(ret.xMotivo ?? '')
  const retEv = Array.isArray(ret.retEvento) ? ret.retEvento[0] : ret.retEvento
  const inf = retEv?.infEvento
  return {
    loteCStat,
    loteMotivo,
    cStat: String(inf?.cStat ?? loteCStat),
    xMotivo: String(inf?.xMotivo ?? loteMotivo),
    nProt: inf?.nProt ? String(inf.nProt) : undefined,
    dhRegEvento: inf?.dhRegEvento ? String(inf.dhRegEvento) : undefined,
  }
}

/** Varre o objeto até achar um retEnvEvento (independe do nome do wrapper). */
function acharRetEnvEvento(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  const obj = node as Record<string, unknown>
  if (obj.retEnvEvento && typeof obj.retEnvEvento === 'object') return obj.retEnvEvento as Record<string, unknown>
  for (const v of Object.values(obj)) {
    const achou = acharRetEnvEvento(v)
    if (achou) return achou
  }
  return null
}
