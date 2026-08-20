// Helper de teste — gera um .pfx SINTÉTICO real (node-forge). Uma cópia só (REGRA 4);
// certificate.test.ts e certificate-service.integration.test.ts usam este.
import forge from 'node-forge'

export function makePfx(cn: string, senha: string, notBefore: Date, notAfter: Date): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(1024) // 1024 = rápido (não é o cert real)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01'
  cert.validity.notBefore = notBefore
  cert.validity.notAfter = notAfter
  const attrs = [{ name: 'commonName', value: cn }]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)
  cert.sign(keys.privateKey)
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], senha, { algorithm: '3des' })
  return Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary')
}
