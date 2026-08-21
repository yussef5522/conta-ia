// ESTOQUE FASE 1 item 4 — "chegou sem aparecer na fila": busca UMA NF-e por chave na
// SEFAZ (consChNFe) e coloca na fila. Idempotente (nota já baixada → devolve a existente).
// Persiste pelo helper ÚNICO (persistSefazDoc) — mesma porta do download. Só stock_.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { decryptSecret, decryptSecretToString } from '../crypto'
import { pfxToPem } from '../certificate'
import { buildDistDFeConsChNFeEnvelope, ufToCodigo, SEFAZ_DIST_URL_PROD, SEFAZ_DIST_URL_HOMOLOG, SEFAZ_DIST_ACTION } from './envelope'
import { postSefazSoap } from './client'
import { parseSefazResponse } from './parse-response'
import { persistSefazDoc } from './persist-doc'

type Db = PrismaClient | Prisma.TransactionClient

const CHAVE_RE = /^\d{44}$/

export interface BuscarChaveResult {
  ok: boolean
  motivo: string
  cStat?: string
  chave: string
  nfeId?: string
  status?: 'AGUARDANDO_MERCADORIA' | 'HISTORICA' | 'CONFIRMADA'
  jaExistia?: boolean
  naFila?: boolean
}

export async function buscarNfePorChave(input: { companyId: string; chave: string; db?: Db; now?: Date }): Promise<BuscarChaveResult> {
  const db = input.db ?? defaultPrisma
  const chave = input.chave.replace(/\D/g, '')
  if (!CHAVE_RE.test(chave)) return { ok: false, motivo: 'A chave tem que ter 44 dígitos.', chave }

  // idempotente: se a nota já está no sistema, não bate na SEFAZ de novo
  const existente = await db.stockNfe.findUnique({ where: { companyId_chave: { companyId: input.companyId, chave } }, select: { id: true, status: true } })
  if (existente) {
    return { ok: true, motivo: 'Essa nota já estava no sistema.', chave, nfeId: existente.id, status: existente.status as BuscarChaveResult['status'], jaExistia: true, naFila: existente.status === 'AGUARDANDO_MERCADORIA' }
  }

  const state = await db.stockSefazState.findUnique({ where: { companyId: input.companyId }, select: { dataCorte: true, blockedUntil: true } })
  if (!state?.dataCorte) return { ok: false, motivo: 'Configure a data de corte do estoque antes de buscar notas.', chave }
  const now = input.now ?? new Date()
  if (state.blockedUntil && state.blockedUntil > now) return { ok: false, motivo: `SEFAZ bloqueada até ${state.blockedUntil.toLocaleString('pt-BR')} (consumo indevido). Tente depois.`, chave }

  const cert = await db.stockCertificate.findFirst({ where: { companyId: input.companyId, status: 'ATIVO' } })
  if (!cert) return { ok: false, motivo: 'Sem certificado ativo — suba o .pfx antes de buscar na SEFAZ.', chave }
  const company = await db.company.findUnique({ where: { id: input.companyId }, select: { cnpj: true, state: true } })
  const cUF = ufToCodigo(company?.state)
  if (!company?.cnpj || !cUF) return { ok: false, motivo: `Empresa sem CNPJ/UF válidos (UF="${company?.state ?? ''}").`, chave }

  const pfx = decryptSecret(cert.pfxCipher)
  const senha = decryptSecretToString(cert.senhaCipher)
  const pem = pfxToPem(pfx, senha)
  const clientCert = [pem.cert, ...pem.ca].join('\n')
  const url = process.env.SEFAZ_HOMOLOG === 'true' ? SEFAZ_DIST_URL_HOMOLOG : SEFAZ_DIST_URL_PROD
  const tpAmb = process.env.SEFAZ_HOMOLOG === 'true' ? '2' : '1'

  const envelope = buildDistDFeConsChNFeEnvelope({ cnpj: company.cnpj, cUFAutor: cUF, chave, tpAmb })
  const r = await postSefazSoap({ url, action: SEFAZ_DIST_ACTION, envelope, key: pem.key, cert: clientCert })
  let resp
  try { resp = parseSefazResponse(r.body) } catch { return { ok: false, motivo: `SEFAZ respondeu HTTP ${r.status} (não deu pra ler).`, chave } }

  await db.stockSefazLog.create({ data: { companyId: input.companyId, nsuInicial: '0', nsuFinal: resp.ultNSU || '0', nDocs: resp.docs.length, cStat: resp.cStat, xMotivo: `consChNFe ${chave.slice(-8)}: ${resp.xMotivo}`.slice(0, 250), tempoMs: 0 } })

  if (resp.cStat === '656') return { ok: false, motivo: 'SEFAZ bloqueou por consumo indevido (aguarde ~1h).', cStat: resp.cStat, chave }

  const docNfe = resp.docs.find((d) => (d.tipo === 'resumo' || d.tipo === 'completo') && d.chave === chave) ?? resp.docs.find((d) => d.tipo === 'resumo' || d.tipo === 'completo')
  if (!docNfe) return { ok: false, motivo: resp.xMotivo || 'A SEFAZ não devolveu essa nota (você é a destinatária dela?).', cStat: resp.cStat, chave }

  const res = await persistSefazDoc(db, input.companyId, docNfe, state.dataCorte)
  if (!res.nfeId) return { ok: false, motivo: 'Documento veio sem chave utilizável.', cStat: resp.cStat, chave }

  return {
    ok: true,
    cStat: resp.cStat,
    chave,
    nfeId: res.nfeId,
    status: res.status ?? undefined,
    naFila: res.status === 'AGUARDANDO_MERCADORIA',
    motivo: res.status === 'AGUARDANDO_MERCADORIA' ? 'Nota encontrada e colocada na fila.' : res.status === 'HISTORICA' ? 'Nota encontrada, mas é anterior à data de corte (histórica).' : 'Nota encontrada.',
  }
}
