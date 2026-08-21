// ESTOQUE FASE 0 item 2 — o ÚNICO ponto que fala com a SEFAZ (REGRA 4).
//
// NFeDistribuicaoDFe é autenticada por mTLS: o certificado A1 (.pfx) entra como
// certificado-CLIENTE no handshake TLS (https.Agent({ pfx, passphrase })). O corpo da
// consulta NÃO precisa de assinatura XML (isso é só pros eventos/Ciência, item 3).
// Node `https` nativo — sem lib de SOAP, sem mandar o cert pra terceiro.

import https from 'node:https'
import { loadServerCa } from './server-ca'

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

/**
 * POST do envelope SOAP 1.2 com mTLS. Recebe key+cert em PEM (extraídos do .pfx via
 * node-forge) — NÃO passa o pfx cru, senão o Node 20/OpenSSL 3 recusa o A1 legado
 * (ERR_CRYPTO_UNSUPPORTED_OPERATION). NÃO loga cert/key nem o corpo.
 */
export function postSefazSoap(input: {
  url: string
  action: string // SOAP action (dist / recepção de evento / consulta…)
  envelope: string
  key: string
  cert: string // cert do CLIENTE (folha + intermediários concatenados)
  timeoutMs?: number
}): Promise<SefazHttpResult> {
  const { url, action, envelope, key, cert } = input
  const timeoutMs = input.timeoutMs ?? 30_000
  const u = new URL(url)
  const started = Date.now()

  return new Promise<SefazHttpResult>((resolve, reject) => {
    let settled = false
    const done = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }
    const req = https.request(
      {
        method: 'POST',
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        key,
        cert, // identidade do cliente (mTLS)
        ca: loadServerCa(), // pra VERIFICAR o servidor da SEFAZ (roots Node + sistema)
        agent: false, // conexão nova por chamada (sem keep-alive → sem acúmulo de listeners)
        minVersion: 'TLSv1.2',
        headers: {
          'Content-Type': `application/soap+xml; charset=utf-8; action="${action}"`,
          'Content-Length': Buffer.byteLength(envelope),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => done(() => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8'), tempoMs: Date.now() - started })))
      },
    )
    req.on('error', (e) => done(() => reject(new SefazHttpError(`Falha na conexão com a SEFAZ: ${e.message}`))))
    // timeout robusto no SOCKET (o req.setTimeout às vezes não morde no handshake).
    req.on('socket', (socket) => {
      socket.setTimeout(timeoutMs)
      socket.on('timeout', () => {
        req.destroy()
        done(() => reject(new SefazHttpError(`Timeout (${timeoutMs}ms) falando com a SEFAZ.`)))
      })
    })
    req.write(envelope)
    req.end()
  })
}
