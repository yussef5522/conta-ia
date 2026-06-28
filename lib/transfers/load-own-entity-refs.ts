// Sprint Owner Detection (28/06/2026) — loader centralizado de OwnEntityRefs.
//
// 6 callers diferentes construíam manualmente o objeto (variações sutis +
// algum esquecendo de incluir sócios). Sprint Owner Detection adicionou
// ownerCpfs + ownerNames, então centralizei pra garantir TODO caller pegar
// os 5 tipos de identificadores próprios consistentemente:
//   - cnpj da empresa
//   - tradeName + razão social
//   - nomes das bank_accounts ativas
//   - CPFs dos SocioPF
//   - nomes dos SocioPF
//
// Escalável (não-hardcode): tudo vem do cadastro existente (Company +
// BankAccount + SocioPF). Nenhuma constante mágica de cliente específico.

import type { PrismaClient } from '@prisma/client'
import { normalizeCnpj, normalizeCpf, type OwnEntityRefs } from './own-entity-signals'

/**
 * Carrega refs da entidade própria pra uma empresa.
 *
 * @param prisma — instância Prisma (ou tx do $transaction)
 * @param companyId — empresa de referência
 * @returns refs preenchidos. Se a empresa não existir, devolve refs vazios
 *          (zero match — fail safe).
 */
export async function loadOwnEntityRefs(
  prisma: Pick<PrismaClient, 'company'>,
  companyId: string,
): Promise<OwnEntityRefs> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      cnpj: true,
      name: true,
      tradeName: true,
      bankAccounts: {
        where: { isActive: true },
        select: { name: true },
      },
      sociosPF: { select: { nome: true, cpf: true } },
    },
  })
  if (!company) {
    return { cnpj: null, names: [], accountNames: [], ownerCpfs: [], ownerNames: [] }
  }

  const names = [company.name, company.tradeName].filter(
    (n): n is string => typeof n === 'string' && n.length > 0,
  )
  const accountNames = company.bankAccounts
    .map((a) => a.name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
  const ownerNames = company.sociosPF
    .map((s) => s.nome)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
  const ownerCpfs = company.sociosPF
    .map((s) => normalizeCpf(s.cpf))
    .filter((c): c is string => c !== null)

  return {
    cnpj: normalizeCnpj(company.cnpj),
    names,
    accountNames,
    ownerCpfs,
    ownerNames,
  }
}
