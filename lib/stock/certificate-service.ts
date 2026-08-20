// ESTOQUE FASE 0 item 1 (19/08/2026) — serviço do certificado A1.
//
// Orquestra: lê o .pfx → valida CNPJ == Company.cnpj (REGRA 8 fiscal) e validade →
// cifra .pfx + senha → desativa o certificado ativo anterior → grava o novo ATIVO.
// LÊ a Company (permitido); NÃO escreve em nenhuma tabela fechada. Nunca devolve a
// senha nem o .pfx; nunca loga nenhum dos dois.

import { prisma } from '@/lib/db'
import { readPfx, StockCertificateError } from './certificate'
import { encryptSecret } from './crypto'

const onlyDigits = (s: string) => s.replace(/\D/g, '')

export interface CertificateStatus {
  id: string
  cnpj: string
  razaoSocial: string | null
  validadeDe: string
  validadeAte: string
  diasParaVencer: number
  status: string
  criadoEm: string
  vencido: boolean
  venceEmBreve: boolean // < 30 dias (o mesmo corte do juiz E12)
}

export type SaveCertErrorCode = StockCertificateError['code'] | 'CNPJ_MISMATCH' | 'VENCIDO' | 'EMPRESA_SEM_CNPJ'

export class SaveCertificateError extends Error {
  code: SaveCertErrorCode
  constructor(code: SaveCertErrorCode, message: string) {
    super(message)
    this.name = 'SaveCertificateError'
    this.code = code
  }
}

const E12_DIAS = 30

function diasEntre(ate: Date, agora: Date): number {
  return Math.floor((ate.getTime() - agora.getTime()) / 86_400_000)
}

/** Sobe/substitui o certificado ativo da empresa. Retorna o status público (sem senha). */
export async function saveCertificate(input: {
  companyId: string
  userId: string
  pfxBuffer: Buffer
  senha: string
  agora?: Date
}): Promise<CertificateStatus> {
  const agora = input.agora ?? new Date()

  // 1. Lê o certificado (pode lançar StockCertificateError — senha/pfx/cnpj).
  const info = readPfx(input.pfxBuffer, input.senha)

  // 2. REGRA 8 fiscal: CNPJ do cert == CNPJ da empresa.
  const company = await prisma.company.findUnique({ where: { id: input.companyId }, select: { cnpj: true } })
  if (!company?.cnpj) throw new SaveCertificateError('EMPRESA_SEM_CNPJ', 'A empresa não tem CNPJ cadastrado — cadastre o CNPJ antes do certificado.')
  if (onlyDigits(company.cnpj) !== info.cnpj) {
    throw new SaveCertificateError(
      'CNPJ_MISMATCH',
      `O CNPJ do certificado (${info.cnpj}) é diferente do CNPJ da empresa (${onlyDigits(company.cnpj)}). ` +
        `Recusado — o certificado tem que ser DESTA empresa.`,
    )
  }

  // 3. Validade > hoje.
  if (info.validadeAte.getTime() <= agora.getTime()) {
    throw new SaveCertificateError('VENCIDO', `O certificado venceu em ${info.validadeAte.toLocaleDateString('pt-BR')}. Suba um certificado válido.`)
  }

  // 4. Cifra + grava (desativa o ativo anterior na mesma transação → índice parcial ok).
  const pfxCipher = encryptSecret(input.pfxBuffer)
  const senhaCipher = encryptSecret(input.senha)
  const created = await prisma.$transaction(async (tx) => {
    await tx.stockCertificate.updateMany({ where: { companyId: input.companyId, status: 'ATIVO' }, data: { status: 'INATIVO' } })
    return tx.stockCertificate.create({
      data: {
        companyId: input.companyId,
        pfxCipher,
        senhaCipher,
        cnpj: info.cnpj,
        razaoSocial: info.razaoSocial,
        validadeDe: info.validadeDe,
        validadeAte: info.validadeAte,
        status: 'ATIVO',
        criadoPorId: input.userId,
      },
    })
  })

  return toStatus(created, agora)
}

/** Status público do certificado ativo (ou null). Nunca inclui senha/pfx. */
export async function getCertificateStatus(companyId: string, agora = new Date()): Promise<CertificateStatus | null> {
  const cert = await prisma.stockCertificate.findFirst({
    where: { companyId, status: 'ATIVO' },
    orderBy: { criadoEm: 'desc' },
    select: { id: true, cnpj: true, razaoSocial: true, validadeDe: true, validadeAte: true, status: true, criadoEm: true },
  })
  return cert ? toStatus(cert, agora) : null
}

function toStatus(
  c: { id: string; cnpj: string; razaoSocial: string | null; validadeDe: Date; validadeAte: Date; status: string; criadoEm: Date },
  agora: Date,
): CertificateStatus {
  const dias = diasEntre(c.validadeAte, agora)
  return {
    id: c.id,
    cnpj: c.cnpj,
    razaoSocial: c.razaoSocial,
    validadeDe: c.validadeDe.toISOString(),
    validadeAte: c.validadeAte.toISOString(),
    diasParaVencer: dias,
    status: c.status,
    criadoEm: c.criadoEm.toISOString(),
    vencido: dias < 0,
    venceEmBreve: dias >= 0 && dias < E12_DIAS,
  }
}
