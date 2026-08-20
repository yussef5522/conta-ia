// ESTOQUE FASE 0 item 2 — o ÚNICO ponto que fala com a SEFAZ (REGRA 4).
//
// NFeDistribuicaoDFe é autenticada por mTLS: o certificado A1 (.pfx) entra como
// certificado-CLIENTE no handshake TLS (https.Agent({ pfx, passphrase })). O corpo da
// consulta NÃO precisa de assinatura XML (isso é só pros eventos/Ciência, item 3).
// Node `https` nativo — sem lib de SOAP, sem mandar o cert pra terceiro.

import https from 'node:https'
import { SEFAZ_DIST_ACTION } from './envelope'

export interface SefazHttpResult {
  status: number
  body: string
  tempoMs: number
}

export class SefazHttpError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'SefazHttpError'
    this.status = status
  }
}

/** POST do envelope SOAP 1.2 com mTLS (pfx). NÃO loga o pfx/senha nem o corpo. */
export function postDistDFe(input: {
  url: string
  envelope: string
  pfx: Buffer
  senha: string
  timeoutMs?: number
}): Promise<SefazHttpResult> {
  const { url, envelope, pfx, senha } = input
  const timeoutMs = input.timeoutMs ?? 30_000
  const u = new URL(url)
  const started = Date.now()

  return new Promise<SefazHttpResult>((resolve, reject) => {
    const req = https.request(
      {
        method: 'POST',
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        pfx,
        passphrase: senha,
        // AN exige TLS ≥1.2; deixa o Node negociar. minVersion trava o piso.
        minVersion: 'TLSv1.2',
        headers: {
          'Content-Type': `application/soap+xml; charset=utf-8; action="${SEFAZ_DIST_ACTION}"`,
          'Content-Length': Buffer.byteLength(envelope),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), tempoMs: Date.now() - started })
        })
      },
    )
    req.on('error', (e) => reject(new SefazHttpError(`Falha na conexão com a SEFAZ: ${e.message}`)))
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      reject(new SefazHttpError(`Timeout (${timeoutMs}ms) falando com a SEFAZ.`))
    })
    req.write(envelope)
    req.end()
  })
}
