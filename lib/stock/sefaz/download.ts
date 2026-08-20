// ESTOQUE FASE 0 item 2 — orquestrador do download SEFAZ. Loop por NSU, persiste
// stock_nfe (status por DATA DE CORTE), loga cada chamada, respeita o bloqueio 1h.
// O LOOP é testável por injeção do `pager` (a chamada real fica no client.ts).

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { decryptSecret, decryptSecretToString } from '../crypto'
import { pfxToPem } from '../certificate'
import { buildDistDFeEnvelope, ufToCodigo, SEFAZ_DIST_URL_PROD, SEFAZ_DIST_URL_HOMOLOG } from './envelope'
import { postDistDFe } from './client'
import { parseSefazResponse, type SefazResponse } from './parse-response'
import { statusForNfe } from './corte'
import { saveNfeCompleta } from './persist-nfe'

type Db = PrismaClient | Prisma.TransactionClient

const BLOCK_MS = 60 * 60 * 1000 // "consumo indevido" = 1h
const MAX_PAGINAS = 50 // trava de segurança (≈2500 docs/rodada)
const CSTAT_DOCS = '138'
const CSTAT_VAZIO = '137'
const CSTAT_CONSUMO_INDEVIDO = '656'

export interface DownloadResult {
  cStat: string
  xMotivo: string
  ultNSU: string
  maxNSU: string
  paginas: number
  totalDocs: number
  novas: number // AGUARDANDO_MERCADORIA (dataEmissao >= corte)
  historicas: number // HISTORICA (dataEmissao < corte)
  eventos: number
  blocked: boolean // a SEFAZ bloqueou (consumo indevido)
  bloqueadoAte?: string
}

/** Uma "página" da SEFAZ: recebe o ultNSU, devolve a resposta parseada. */
export type SefazPager = (ultNSU: string) => Promise<SefazResponse>

const nsuNum = (s: string) => Number(String(s).replace(/\D/g, '') || '0')

/** O LOOP puro (testável): pagina do ultNSU até maxNSU, persiste, loga. */
export async function downloadSefaz(input: {
  companyId: string
  pager: SefazPager
  db?: Db
  now?: Date
}): Promise<DownloadResult> {
  const db = input.db ?? defaultPrisma
  const now = input.now ?? new Date()
  const state = await db.stockSefazState.findUnique({ where: { companyId: input.companyId } })
  if (!state) throw new Error('Sem stock_sefaz_state pra empresa — configure a DATA DE CORTE antes de baixar.')

  if (state.blockedUntil && state.blockedUntil > now) {
    return { cStat: 'BLOQUEADO', xMotivo: `bloqueado até ${state.blockedUntil.toISOString()}`, ultNSU: state.ultNSU, maxNSU: state.maxNSU, paginas: 0, totalDocs: 0, novas: 0, historicas: 0, eventos: 0, blocked: true, bloqueadoAte: state.blockedUntil.toISOString() }
  }

  const corte = state.dataCorte
  let ultNSU = state.ultNSU
  let maxNSU = state.maxNSU
  let lastCStat = ''
  let lastMotivo = ''
  let paginas = 0
  const acc = { totalDocs: 0, novas: 0, historicas: 0, eventos: 0 }
  let blocked = false
  let bloqueadoAte: string | undefined

  for (let i = 0; i < MAX_PAGINAS; i++) {
    const resp = await input.pager(ultNSU)
    paginas++
    lastCStat = resp.cStat
    lastMotivo = resp.xMotivo

    await db.stockSefazLog.create({
      data: { companyId: input.companyId, nsuInicial: ultNSU, nsuFinal: resp.ultNSU, nDocs: resp.docs.length, cStat: resp.cStat, xMotivo: resp.xMotivo.slice(0, 250), tempoMs: 0 },
    })

    if (resp.cStat === CSTAT_CONSUMO_INDEVIDO) {
      bloqueadoAte = new Date(now.getTime() + BLOCK_MS).toISOString()
      blocked = true
      await db.stockSefazState.update({ where: { companyId: input.companyId }, data: { blockedUntil: new Date(now.getTime() + BLOCK_MS), lastRunAt: now } })
      break
    }

    // persiste os docs desta página
    for (const doc of resp.docs) {
      acc.totalDocs++
      if (doc.tipo === 'evento') { acc.eventos++; continue }
      if (!doc.chave) continue // sem chave não dá pra deduplicar; ignora (raro)
      const dataEmissao = doc.dataEmissao ? new Date(doc.dataEmissao) : null
      const status = statusForNfe(dataEmissao, corte)
      if (status === 'HISTORICA') acc.historicas++
      else acc.novas++
      const row = await db.stockNfe.upsert({
        where: { companyId_chave: { companyId: input.companyId, chave: doc.chave } },
        create: {
          companyId: input.companyId, chave: doc.chave, nsu: doc.nsu, emitCnpj: doc.emitCnpj ?? null, emitNome: doc.emitNome ?? null,
          vNF: doc.vNF ?? null, dataEmissao, cSitNFe: doc.cSitNFe ?? null, tpNF: doc.tpNF ?? null, status,
          temXmlCompleto: doc.tipo === 'completo', schema: doc.schema || null, docXml: doc.xml || null,
        },
        update: {
          // idempotente: só evolui de resumo → completo; nunca reclassifica HISTORICA/nova
          nsu: doc.nsu,
          ...(doc.tipo === 'completo' ? { temXmlCompleto: true, schema: doc.schema || null, docXml: doc.xml || null } : {}),
        },
        select: { id: true },
      })
      // NOVA com XML completo → parseia itens/duplicatas/emitente (histórica NÃO parseia)
      if (status === 'AGUARDANDO_MERCADORIA' && doc.tipo === 'completo' && doc.xml) {
        try {
          await saveNfeCompleta({ nfeId: row.id, companyId: input.companyId, chave: doc.chave, xml: doc.xml, db })
        } catch {
          // parse falhou (XML atípico) — a nota fica na fila sem itens; não derruba o download.
        }
      }
    }

    // avança
    ultNSU = resp.ultNSU
    maxNSU = resp.maxNSU
    await db.stockSefazState.update({ where: { companyId: input.companyId }, data: { ultNSU, maxNSU, lastRunAt: now } })

    // condições de parada
    if (resp.cStat === CSTAT_VAZIO) break
    if (resp.cStat !== CSTAT_DOCS) break // erro/aviso inesperado → para, não insiste
    if (nsuNum(ultNSU) >= nsuNum(maxNSU)) break // alcançou o fim
    if (resp.docs.length === 0) break
  }

  return { cStat: lastCStat, xMotivo: lastMotivo, ultNSU, maxNSU, paginas, ...acc, blocked, bloqueadoAte }
}

/** Wire real: carrega o cert, decifra, monta o pager que fala com a SEFAZ, e roda o loop. */
export async function runSefazDownload(input: { companyId: string; db?: Db; now?: Date }): Promise<DownloadResult> {
  const db = input.db ?? defaultPrisma
  const cert = await db.stockCertificate.findFirst({ where: { companyId: input.companyId, status: 'ATIVO' } })
  if (!cert) throw new Error('Sem certificado ATIVO — suba o .pfx antes de baixar da SEFAZ.')

  const company = await db.company.findUnique({ where: { id: input.companyId }, select: { cnpj: true, state: true } })
  const cUF = ufToCodigo(company?.state)
  if (!company?.cnpj || !cUF) {
    throw new Error(`Empresa sem CNPJ/UF válidos (UF="${company?.state ?? ''}") — não dá pra montar a consulta SEFAZ.`)
  }

  // pfx → PEM (node-forge lê o A1 legado; o TLS recebe key+cert, nunca o pkcs12 cru).
  const pfx = decryptSecret(cert.pfxCipher)
  const senha = decryptSecretToString(cert.senhaCipher)
  const pem = pfxToPem(pfx, senha)
  const clientCert = [pem.cert, ...pem.ca].join('\n') // folha + intermediários (o server monta a cadeia do cliente)
  const url = process.env.SEFAZ_HOMOLOG === 'true' ? SEFAZ_DIST_URL_HOMOLOG : SEFAZ_DIST_URL_PROD
  const tpAmb = process.env.SEFAZ_HOMOLOG === 'true' ? '2' : '1'

  const pager: SefazPager = async (ultNSU) => {
    const envelope = buildDistDFeEnvelope({ cnpj: company.cnpj, cUFAutor: cUF, ultNSU, tpAmb })
    const r = await postDistDFe({ url, envelope, key: pem.key, cert: clientCert })
    if (r.status !== 200) {
      // a SEFAZ às vezes devolve o SOAP fault com 500 + corpo útil; tenta parsear mesmo assim
      try { return parseSefazResponse(r.body) } catch { throw new Error(`SEFAZ HTTP ${r.status}`) }
    }
    return parseSefazResponse(r.body)
  }

  const res = await downloadSefaz({ companyId: input.companyId, pager, db, now: input.now })
  await db.stockCertificate.update({ where: { id: cert.id }, data: { ultimoUsoEm: input.now ?? new Date() } })
  return res
}
