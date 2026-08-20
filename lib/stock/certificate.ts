// ESTOQUE FASE 0 item 1 (19/08/2026) — leitura do certificado A1 (.pfx / PKCS#12).
//
// Extrai do certificado, SEM gravar nada: CNPJ (pra validar == Company.cnpj, REGRA 8
// fiscal), razão social e validade (notBefore/notAfter — o juiz E12 alerta < 30 dias).
// Pure-JS via node-forge — não toca disco, não chama a SEFAZ, não loga o .pfx/senha.
//
// CNPJ do e-CNPJ ICP-Brasil: fica no CN do subject no formato "RAZAO SOCIAL:CNPJ"
// (14 dígitos) E no SubjectAltName otherName OID 2.16.76.1.3.3. Uso o CN como fonte
// primária (sempre presente no e-CNPJ) e um scan do DER pelo OID como rede de segurança.

import forge from 'node-forge'

export interface CertificateInfo {
  cnpj: string // 14 dígitos
  razaoSocial: string | null
  validadeDe: Date
  validadeAte: Date
}

export type StockCertificateErrorCode = 'SENHA_INVALIDA' | 'SEM_CERT' | 'SEM_CNPJ' | 'PFX_INVALIDO'

export class StockCertificateError extends Error {
  code: StockCertificateErrorCode
  constructor(code: StockCertificateErrorCode, message: string) {
    super(message)
    this.name = 'StockCertificateError'
    this.code = code
  }
}

const onlyDigits = (s: string) => s.replace(/\D/g, '')

/** CN "RAZAO:CNPJ" → 14 dígitos finais. */
function cnpjFromCN(cn: string): string | null {
  const m = cn.match(/(\d{14})\s*$/) || cn.match(/:(\d{14})\b/)
  return m ? m[1] : null
}

/** Rede de segurança: acha o OID 2.16.76.1.3.3 no DER e lê os 14 dígitos ASCII a
 *  seguir (o CNPJ do otherName do SubjectAltName). */
function cnpjFromSanOid(certDer: string): string | null {
  // OID 2.16.76.1.3.3 = bytes 06 05 60 4C 01 03 03
  const oid = '\x06\x05\x60\x4c\x01\x03\x03'
  const idx = certDer.indexOf(oid)
  if (idx < 0) return null
  // após o OID vem [0] EXPLICIT → OCTET STRING → 14 dígitos ASCII. Varre uma janela.
  const janela = certDer.slice(idx + oid.length, idx + oid.length + 40)
  const m = janela.match(/(\d{14})/)
  return m ? m[1] : null
}

/** Lê o .pfx cifrado-em-repouso NÃO — recebe o buffer JÁ decifrado + a senha em claro
 *  (só na memória, durante a leitura). Retorna os dados públicos do certificado. */
export function readPfx(pfxBuffer: Buffer, senha: string): CertificateInfo {
  let p12Asn1: forge.asn1.Asn1
  try {
    const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'))
    p12Asn1 = forge.asn1.fromDer(p12Der)
  } catch {
    throw new StockCertificateError('PFX_INVALIDO', 'Arquivo não parece um certificado .pfx/.p12 válido.')
  }

  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, senha)
  } catch {
    // senha errada OU .pfx corrompido — não dá pra distinguir com segurança.
    throw new StockCertificateError('SENHA_INVALIDA', 'Senha do certificado incorreta (ou o arquivo .pfx está corrompido).')
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]
  const cert = certBags?.[0]?.cert
  if (!cert) throw new StockCertificateError('SEM_CERT', 'Não encontrei o certificado dentro do .pfx.')

  const cnField = cert.subject.getField('CN')
  const cn: string = (cnField?.value as string) ?? ''
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  const cnpj = cnpjFromCN(cn) ?? cnpjFromSanOid(certDer)
  if (!cnpj) {
    throw new StockCertificateError(
      'SEM_CNPJ',
      'Não achei o CNPJ no certificado — não parece um e-CNPJ ICP-Brasil (certificado de pessoa jurídica).',
    )
  }

  const razaoSocial = cn.replace(/:?\s*\d{14}\s*$/, '').trim() || null
  return {
    cnpj: onlyDigits(cnpj),
    razaoSocial,
    validadeDe: cert.validity.notBefore,
    validadeAte: cert.validity.notAfter,
  }
}

export interface PemMaterial {
  key: string // chave privada PEM
  cert: string // cert do cliente (folha) PEM
  ca: string[] // cadeia (intermediários) PEM
}

/**
 * Converte o .pfx em key+cert PEM via node-forge. NECESSÁRIO porque o Node 20/OpenSSL 3
 * RECUSA o PKCS#12 do A1 brasileiro (cifrado com RC2/3DES/SHA1 legados) →
 * ERR_CRYPTO_UNSUPPORTED_OPERATION. Passando PEM pro TLS, o OpenSSL nunca abre o pkcs12.
 * A folha (leaf) = o cert com CNPJ no CN (e-CNPJ); o resto é cadeia (CA).
 */
export function pfxToPem(pfxBuffer: Buffer, senha: string): PemMaterial {
  let p12: forge.pkcs12.Pkcs12Pfx
  try {
    const p12Der = forge.util.createBuffer(pfxBuffer.toString('binary'))
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Der), false, senha)
  } catch {
    throw new StockCertificateError('SENHA_INVALIDA', 'Não consegui abrir o .pfx (senha incorreta ou arquivo corrompido).')
  }

  // chave privada (pkcs8ShroudedKeyBag no A1; keyBag como fallback)
  const keyBag =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0]
  if (!keyBag?.key) throw new StockCertificateError('SEM_CERT', 'Não achei a chave privada no .pfx.')
  const key = forge.pki.privateKeyToPem(keyBag.key)

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? []
  const certs = certBags.map((b) => b.cert!).filter(Boolean)
  if (certs.length === 0) throw new StockCertificateError('SEM_CERT', 'Não achei certificado no .pfx.')

  // folha = a que tem CNPJ (14 díg) no CN; senão a primeira.
  const leafIdx = certs.findIndex((c) => cnpjFromCN((c.subject.getField('CN')?.value as string) ?? '') != null)
  const leaf = certs[leafIdx >= 0 ? leafIdx : 0]
  const chain = certs.filter((c) => c !== leaf)

  return {
    key,
    cert: forge.pki.certificateToPem(leaf),
    ca: chain.map((c) => forge.pki.certificateToPem(c)),
  }
}
