// ESTOQUE FASE 1 item 3 — eventos de manifestação SEFAZ (Ciência/Confirmação/Op não
// Realizada). Monta o <evento>, ASSINA (XMLDSig enveloped, RSA-SHA1, C14N — o que a
// SEFAZ valida) e embrulha no <envEvento>. Assinatura com o A1 (PEM, pfx→PEM da Fase 0).

import { SignedXml } from 'xml-crypto'

export const TP_EVENTO = {
  CIENCIA: '210210',
  CONFIRMACAO: '210200',
  OP_NAO_REALIZADA: '210240',
} as const
export type TpEvento = (typeof TP_EVENTO)[keyof typeof TP_EVENTO]

const DESC: Record<TpEvento, string> = {
  '210210': 'Ciencia da Operacao',
  '210200': 'Confirmacao da Operacao',
  '210240': 'Operacao nao Realizada',
}

const SIG = {
  rsaSha1: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  c14n: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  sha1: 'http://www.w3.org/2000/09/xmldsig#sha1',
  enveloped: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
}

/** "now" em -03:00 (o dhEvento é o instante REAL da manifestação — timestamp legítimo,
 *  não decisão sobre o dado). Recebe o relógio pra ser testável. */
export function dhEventoBr(now: Date): string {
  const br = new Date(now.getTime() - 3 * 3600_000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${br.getUTCFullYear()}-${p(br.getUTCMonth() + 1)}-${p(br.getUTCDate())}T${p(br.getUTCHours())}:${p(br.getUTCMinutes())}:${p(br.getUTCSeconds())}-03:00`
}

export interface EventoInput {
  chave: string // 44 díg
  cnpj: string // destinatário (a empresa)
  tpEvento: TpEvento
  nSeqEvento?: number // default 1
  tpAmb?: '1' | '2' // default 1 (produção)
  justificativa?: string // só pra 210240 (Op não Realizada), 15..255 chars
  now: Date
}

/** Monta o <evento> NÃO assinado. Id = "ID"+tpEvento+chave+nSeqEvento(2 díg). */
export function buildEvento(input: EventoInput): { xml: string; id: string } {
  const nSeq = input.nSeqEvento ?? 1
  const id = `ID${input.tpEvento}${input.chave}${String(nSeq).padStart(2, '0')}`
  const tpAmb = input.tpAmb ?? '1'
  const cnpj = input.cnpj.replace(/\D/g, '')
  const detExtra = input.tpEvento === TP_EVENTO.OP_NAO_REALIZADA && input.justificativa
    ? `<xJust>${input.justificativa}</xJust>`
    : ''
  const xml =
    `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
    `<infEvento Id="${id}">` +
    `<cOrgao>91</cOrgao>` + // 91 = Ambiente Nacional (manifestação)
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<CNPJ>${cnpj}</CNPJ>` +
    `<chNFe>${input.chave}</chNFe>` +
    `<dhEvento>${dhEventoBr(input.now)}</dhEvento>` +
    `<tpEvento>${input.tpEvento}</tpEvento>` +
    `<nSeqEvento>${nSeq}</nSeqEvento>` +
    `<verEvento>1.00</verEvento>` +
    `<detEvento versao="1.00"><descEvento>${DESC[input.tpEvento]}</descEvento>${detExtra}</detEvento>` +
    `</infEvento>` +
    `</evento>`
  return { xml, id }
}

/** Assina o <evento> (referência ao infEvento, enveloped + C14N, RSA-SHA1, X509 no KeyInfo). */
export function assinarEvento(eventoXml: string, pemKey: string, pemCert: string): string {
  const sig = new SignedXml({
    privateKey: pemKey,
    publicCert: pemCert,
    signatureAlgorithm: SIG.rsaSha1,
    canonicalizationAlgorithm: SIG.c14n,
  })
  sig.addReference({
    xpath: "//*[local-name(.)='infEvento']",
    transforms: [SIG.enveloped, SIG.c14n],
    digestAlgorithm: SIG.sha1,
  })
  sig.computeSignature(eventoXml, { location: { reference: "//*[local-name(.)='infEvento']", action: 'after' } })
  return sig.getSignedXml()
}

/** Embrulha o(s) evento(s) assinado(s) no <envEvento>. */
export function buildEnvEvento(eventosAssinados: string[], idLote = '1'): string {
  return (
    `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">` +
    `<idLote>${idLote}</idLote>` +
    eventosAssinados.join('') +
    `</envEvento>`
  )
}
