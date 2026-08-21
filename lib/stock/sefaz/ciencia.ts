// ESTOQUE FASE 1 item 3 — orquestra o envio de evento (Ciência/Confirmação/Op não
// Realizada): carrega o cert, assina, envia, e REGISTRA em stock_sefaz_event. A Ciência
// (210210) libera o XML COMPLETO da nota na próxima consulta de distribuição.

import type { PrismaClient, Prisma } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'
import { decryptSecret, decryptSecretToString } from '../crypto'
import { pfxToPem } from '../certificate'
import { buildEvento, assinarEvento, buildEnvEvento, type TpEvento } from './evento'
import { enviarEnvEvento, EVENTO_OK } from './recepcao-evento'

type Db = PrismaClient | Prisma.TransactionClient

export interface EnviarEventoResult {
  chave: string
  tpEvento: string
  ok: boolean
  cStat: string
  xMotivo: string
  nProt?: string
}

/** Envia UM evento pra uma nota. Registra em stock_sefaz_event (ENVIADO/ERRO). */
export async function enviarEvento(
  input: { companyId: string; chave: string; tpEvento: TpEvento; justificativa?: string; db?: Db; now?: Date },
): Promise<EnviarEventoResult> {
  const db = input.db ?? defaultPrisma
  const now = input.now ?? new Date()

  const cert = await db.stockCertificate.findFirst({ where: { companyId: input.companyId, status: 'ATIVO' } })
  if (!cert) throw new Error('Sem certificado ATIVO — não dá pra assinar o evento.')
  const company = await db.company.findUnique({ where: { id: input.companyId }, select: { cnpj: true } })
  if (!company?.cnpj) throw new Error('Empresa sem CNPJ.')

  // nSeqEvento = quantos deste tpEvento já foram enviados pra essa chave + 1
  const jaEnviados = await db.stockSefazEvent.count({ where: { companyId: input.companyId, chave: input.chave, tpEvento: input.tpEvento } })
  const nSeqEvento = jaEnviados + 1

  const pem = pfxToPem(decryptSecret(cert.pfxCipher), decryptSecretToString(cert.senhaCipher))
  const clientCert = [pem.cert, ...pem.ca].join('\n')
  const { xml } = buildEvento({ chave: input.chave, cnpj: company.cnpj, tpEvento: input.tpEvento, nSeqEvento, justificativa: input.justificativa, now })
  const assinado = assinarEvento(xml, pem.key, clientCert)
  const envEvento = buildEnvEvento([assinado])

  const registro = await db.stockSefazEvent.create({
    data: { companyId: input.companyId, chave: input.chave, tpEvento: input.tpEvento, nSeqEvento, status: 'PENDENTE', tentativas: 1 },
  })

  try {
    const r = await enviarEnvEvento({ envEvento, key: pem.key, cert: clientCert, homolog: process.env.SEFAZ_HOMOLOG === 'true' })
    const ok = EVENTO_OK.has(r.cStat)
    await db.stockSefazEvent.update({
      where: { id: registro.id },
      data: { status: ok ? 'ENVIADO' : 'ERRO', cStat: r.cStat, xMotivo: r.xMotivo.slice(0, 250), protocolo: r.nProt ?? null },
    })
    await db.stockCertificate.update({ where: { id: cert.id }, data: { ultimoUsoEm: now } })
    return { chave: input.chave, tpEvento: input.tpEvento, ok, cStat: r.cStat, xMotivo: r.xMotivo, nProt: r.nProt }
  } catch (e) {
    await db.stockSefazEvent.update({
      where: { id: registro.id },
      data: { status: 'ERRO', xMotivo: (e as Error).message.slice(0, 250), proximoRetry: new Date(now.getTime() + 15 * 60_000) },
    })
    throw e
  }
}
