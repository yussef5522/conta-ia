// ESTOQUE FASE 0 item 3 (19/08) — parse da NF-e COMPLETA (procNFe/nfeProc). Extrai
// itens, duplicatas e emitente da nota assinada. Puro (XML in → estrutura out).
// Só roda pras notas NOVAS (>= corte); históricas não parseiam.

import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
})

const asArray = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v])
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return isNaN(n) ? null : n
}
const str = (v: unknown): string | undefined => (v == null ? undefined : String(v))
const digits = (v: unknown): string | undefined => {
  const d = String(v ?? '').replace(/\D/g, '')
  return d.length ? d : undefined
}

export interface NfeItem {
  nItem: number
  cProd?: string
  cEAN?: string
  xProd: string
  ncm?: string
  cest?: string
  cfop?: string
  uCom?: string
  qCom: number | null
  vUnCom: number | null
  vProd: number | null
  uTrib?: string
  qTrib: number | null
}
export interface NfeDup {
  nDup?: string
  dVenc?: string // ISO date
  vDup: number
}
export interface NfeEmit {
  cnpj?: string
  cpf?: string
  xNome: string
  xFant?: string
  ie?: string
  uf?: string
  xMun?: string
  cMun?: string
}
export interface NfeCompleta {
  chave: string
  nNF?: string
  dhEmi?: string
  tpNF?: string
  natOp?: string
  emit: NfeEmit
  itens: NfeItem[]
  duplicatas: NfeDup[]
  totais: { vNF: number | null; vProd: number | null; vDesc: number | null; vFrete: number | null }
}

export class NfeParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NfeParseError'
  }
}

/** Parseia o XML completo (nfeProc/NFe/infNFe). Lança se não achar infNFe. */
export function parseNfeCompleta(xml: string): NfeCompleta {
  const obj = parser.parse(xml)
  const infNFe = obj.nfeProc?.NFe?.infNFe ?? obj.NFe?.infNFe ?? obj.infNFe
  if (!infNFe) throw new NfeParseError('XML não é uma NF-e completa (sem infNFe) — talvez seja só o resumo (falta Ciência).')

  const chave = digits(infNFe['@_Id']) ?? ''
  const ide = infNFe.ide ?? {}
  const emitRaw = infNFe.emit ?? {}
  const ender = emitRaw.enderEmit ?? {}
  const total = infNFe.total?.ICMSTot ?? {}

  const emit: NfeEmit = {
    cnpj: digits(emitRaw.CNPJ),
    cpf: digits(emitRaw.CPF),
    xNome: str(emitRaw.xNome) ?? '(sem nome)',
    xFant: str(emitRaw.xFant),
    ie: str(emitRaw.IE),
    uf: str(ender.UF),
    xMun: str(ender.xMun),
    cMun: str(ender.cMun),
  }

  const itens: NfeItem[] = asArray<Record<string, unknown>>(infNFe.det).map((det, i) => {
    const p = (det.prod ?? {}) as Record<string, unknown>
    return {
      nItem: Number((det['@_nItem'] as string) ?? i + 1),
      cProd: str(p.cProd),
      cEAN: str(p.cEAN),
      xProd: str(p.xProd) ?? '(sem descrição)',
      ncm: str(p.NCM),
      cest: str(p.CEST),
      cfop: str(p.CFOP),
      uCom: str(p.uCom),
      qCom: num(p.qCom),
      vUnCom: num(p.vUnCom),
      vProd: num(p.vProd),
      uTrib: str(p.uTrib),
      qTrib: num(p.qTrib),
    }
  })

  const duplicatas: NfeDup[] = asArray<Record<string, unknown>>(infNFe.cobr?.dup).map((d) => ({
    nDup: str(d.nDup),
    dVenc: str(d.dVenc),
    vDup: num(d.vDup) ?? 0,
  }))

  return {
    chave,
    nNF: str(ide.nNF),
    dhEmi: str(ide.dhEmi),
    tpNF: str(ide.tpNF),
    natOp: str(ide.natOp),
    emit,
    itens,
    duplicatas,
    totais: {
      vNF: num(total.vNF),
      vProd: num(total.vProd),
      vDesc: num(total.vDesc),
      vFrete: num(total.vFrete),
    },
  }
}
