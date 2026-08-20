// ESTOQUE FASE 0 item 2 (19/08/2026) — parser da resposta NFeDistribuicaoDFe.
//
// A SEFAZ devolve <retDistDFeInt> com cStat/ultNSU/maxNSU + <loteDistDFeInt> com N
// <docZip> (base64 de um GZIP de um XML). Cada docZip é um resumo (resNFe), uma NF
// completa (procNFe/nfeProc) ou um evento (resEvento/procEventoNFe). Aqui só LÊ e
// estrutura — não fala com a SEFAZ, não grava. Parse puro (testável, REGRA 3).

import { gunzipSync } from 'node:zlib'
import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // tira soap:/ns → Envelope, Body, retDistDFeInt direto
  parseTagValue: false, // mantém tudo string (chave/NSU não viram número)
  trimValues: true,
})

export type SefazDocTipo = 'resumo' | 'completo' | 'evento' | 'desconhecido'

export interface SefazDoc {
  nsu: string
  schema: string
  tipo: SefazDocTipo
  chave?: string
  emitCnpj?: string
  emitNome?: string
  vNF?: number
  dataEmissao?: string // ISO (dhEmi)
  tpNF?: string
  cSitNFe?: string
  xml: string // XML descomprimido (auditoria/legal)
}

export interface SefazResponse {
  cStat: string
  xMotivo: string
  ultNSU: string
  maxNSU: string
  docs: SefazDoc[]
}

const asArray = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])
const digits = (s: unknown): string | undefined => {
  const d = String(s ?? '').replace(/\D/g, '')
  return d.length ? d : undefined
}

/** Descomprime um <docZip> (base64 → gzip → XML). */
export function inflateDocZip(base64: string): string {
  return gunzipSync(Buffer.from(base64, 'base64')).toString('utf8')
}

/** Lê os campos de cabeçalho de um doc já descomprimido (resNFe OU nfeProc). */
function extractDocFields(xml: string): Partial<SefazDoc> {
  const obj = parser.parse(xml)

  // Resumo (resNFe)
  if (obj.resNFe) {
    const r = obj.resNFe
    return {
      chave: digits(r.chNFe),
      emitCnpj: digits(r.CNPJ ?? r.CPF),
      emitNome: r.xNome ? String(r.xNome) : undefined,
      vNF: r.vNF != null ? Number(r.vNF) : undefined,
      dataEmissao: r.dhEmi ? String(r.dhEmi) : undefined,
      tpNF: r.tpNF != null ? String(r.tpNF) : undefined,
      cSitNFe: r.cSitNFe != null ? String(r.cSitNFe) : undefined,
    }
  }

  // NF completa (nfeProc > NFe > infNFe)
  const infNFe = obj.nfeProc?.NFe?.infNFe ?? obj.NFe?.infNFe
  if (infNFe) {
    const ide = infNFe.ide ?? {}
    const emit = infNFe.emit ?? {}
    const total = infNFe.total?.ICMSTot ?? {}
    const id: string = infNFe['@_Id'] ?? ''
    return {
      chave: digits(id) ?? digits(ide.chNFe),
      emitCnpj: digits(emit.CNPJ ?? emit.CPF),
      emitNome: emit.xNome ? String(emit.xNome) : undefined,
      vNF: total.vNF != null ? Number(total.vNF) : undefined,
      dataEmissao: ide.dhEmi ? String(ide.dhEmi) : undefined,
      tpNF: ide.tpNF != null ? String(ide.tpNF) : undefined,
      cSitNFe: '1', // procNFe = autorizada (o cancelamento vem como evento)
    }
  }

  return {}
}

function tipoFromSchema(schema: string, xml: string): SefazDocTipo {
  if (/resNFe/i.test(schema) || /<resNFe/i.test(xml)) return 'resumo'
  if (/procNFe|nfeProc/i.test(schema) || /<nfeProc|<NFe\b/i.test(xml)) return 'completo'
  if (/Evento/i.test(schema) || /<resEvento|<procEventoNFe/i.test(xml)) return 'evento'
  return 'desconhecido'
}

/** Parseia a resposta SOAP crua da NFeDistribuicaoDFe. */
export function parseSefazResponse(rawSoapXml: string): SefazResponse {
  const root = parser.parse(rawSoapXml)
  // desce até retDistDFeInt (com ou sem Envelope/Body/…Result)
  const ret =
    root?.Envelope?.Body?.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult?.retDistDFeInt ??
    root?.Body?.nfeDistDFeInteresseResult?.retDistDFeInt ??
    root?.nfeDistDFeInteresseResult?.retDistDFeInt ??
    root?.retDistDFeInt
  if (!ret) {
    throw new SefazParseError('Resposta da SEFAZ sem <retDistDFeInt> — formato inesperado.')
  }

  const cStat = String(ret.cStat ?? '')
  const xMotivo = String(ret.xMotivo ?? '')
  const ultNSU = String(ret.ultNSU ?? '000000000000000')
  const maxNSU = String(ret.maxNSU ?? '000000000000000')

  const docZips = asArray<Record<string, unknown>>(ret.loteDistDFeInt?.docZip)
  const docs: SefazDoc[] = []
  for (const dz of docZips) {
    const nsu = String(dz['@_NSU'] ?? '')
    const schema = String(dz['@_schema'] ?? '')
    const base64 = String(dz['#text'] ?? '')
    if (!base64) continue
    let xml: string
    try {
      xml = inflateDocZip(base64)
    } catch {
      // docZip corrompido — registra como desconhecido, não derruba a resposta inteira.
      docs.push({ nsu, schema, tipo: 'desconhecido', xml: '' })
      continue
    }
    const tipo = tipoFromSchema(schema, xml)
    const fields = tipo === 'evento' ? {} : extractDocFields(xml)
    docs.push({ nsu, schema, tipo, xml, ...fields })
  }

  return { cStat, xMotivo, ultNSU, maxNSU, docs }
}

export class SefazParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SefazParseError'
  }
}
