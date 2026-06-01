// Sprint Gestão de Conta (31/05/2026) — Cascade de exclusão User.
//
// Algoritmo atomic em $transaction, 7 passos (ver docs/sprints/
// gestao-conta-audit.md §2.3). Trata as 3 FKs sem onDelete (que
// seriam Restrict e bloqueariam o DELETE):
//
//   1. UPDATE OfxImport SET revertedById=null WHERE revertedById=:userId
//   2. UPDATE CompanyTaxProfile SET createdById=null WHERE createdById=:userId
//   3. DELETE RecurringSchedule WHERE createdById=:userId
//
// Companies do user que não tem outros donos (único UserCompany) são
// apagadas via DELETE Company → cascade massivo natural (BankAccount,
// Transaction, Category, Supplier, Customer, AiLearningRule, etc).
//
// Companies multi-dono: preservadas (só vínculo UserCompany do user
// é apagado via cascade do User).

import type { Prisma, PrismaClient } from '@prisma/client'

export interface DeleteUserCascadeResult {
  userId: string
  userEmail: string
  userName: string
  companiesDeleted: string[] // ids
  companiesKept: string[] // ids onde outros UserCompany ainda apontam
  countOfxImportsRevertedNulled: number
  countTaxProfilesCreatedByNulled: number
  countRecurringSchedulesDeleted: number
}

/**
 * Executa o cascade completo numa transação atomic. Lança se algo falhar
 * (rollback automático). Retorna snapshot pro audit log.
 *
 * @param prisma instância do prisma OU prisma transactional client
 * @param userId id do user a apagar
 */
export async function deleteUserCascade(
  prisma: PrismaClient | Prisma.TransactionClient,
  userId: string,
): Promise<DeleteUserCascadeResult> {
  // Carrega user antes de tudo (vai sumir no final)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  })
  if (!user) throw new Error(`User ${userId} não encontrado`)

  // Passo 1: identificar companies onde user é único dono.
  // Estratégia: select todas as companies do user; pra cada uma, contar
  // outros UserCompany. Se count === 1 (só o user), apaga a company.
  const userCompanies = await prisma.userCompany.findMany({
    where: { userId },
    select: { companyId: true },
  })
  const companyIds = userCompanies.map((uc) => uc.companyId)

  const companiesDeleted: string[] = []
  const companiesKept: string[] = []

  for (const companyId of companyIds) {
    const totalOwners = await prisma.userCompany.count({
      where: { companyId },
    })
    if (totalOwners === 1) {
      companiesDeleted.push(companyId)
    } else {
      companiesKept.push(companyId)
    }
  }

  // Passo 2: anular FK Restrict do OfxImport.revertedById
  const ofxNulled = await prisma.ofxImport.updateMany({
    where: { revertedById: userId },
    data: { revertedById: null },
  })

  // Passo 3: anular FK Restrict do CompanyTaxProfile.createdById
  const taxNulled = await prisma.companyTaxProfile.updateMany({
    where: { createdById: userId },
    data: { createdById: null },
  })

  // Passo 4: deletar RecurringSchedule criados pelo user (FK Restrict).
  // ⚠️ Atenção: se o RecurringSchedule está numa company que VAI ser
  // apagada no passo 5, o cascade da Company resolveria. Mas se está
  // numa company MULTI-DONO (kept), precisa apagar AQUI.
  // Por segurança e simplicidade, apaga TODOS os schedules do user.
  const schedulesDeleted = await prisma.recurringSchedule.deleteMany({
    where: { createdById: userId },
  })

  // Passo 5: deletar companies sem outro dono.
  // Cascade massivo: BankAccount → Transaction, Category, CostCenter,
  // Supplier, Customer, Employee, AiLearningRule, Role(custom), AuditLog,
  // CompanyInvite, CompanyTaxProfile(restante), etc.
  if (companiesDeleted.length > 0) {
    await prisma.company.deleteMany({
      where: { id: { in: companiesDeleted } },
    })
  }

  // Passo 6: deletar User.
  // Cascade automático: SavedView, UserCompany(restantes em multi-dono),
  // UserCompanyRole, AiUsageLog, AiInsightsLog, CouponRedemption,
  // PasswordResetCode, OfxImport (user owner, das companies kept).
  // SetNull em AuditLog.userId e CategoryHistory.userId (preserva
  // histórico anonimizado pra LGPD/fiscal).
  await prisma.user.delete({ where: { id: userId } })

  return {
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    companiesDeleted,
    companiesKept,
    countOfxImportsRevertedNulled: ofxNulled.count,
    countTaxProfilesCreatedByNulled: taxNulled.count,
    countRecurringSchedulesDeleted: schedulesDeleted.count,
  }
}
