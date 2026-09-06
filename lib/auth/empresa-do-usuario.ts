// ⛔⛔⛔ "LINKED TEM DUAS PORTAS" — A TERCEIRA VEZ (06/09/2026).
//
// **MEDIDO EM PROD, numa perícia de segurança:** havia **144 registros de `USER_LOGIN`** e
// **todos** eram de quem tem linha no modelo ANTIGO (`UserCompany`). A Marcyelle — a **única**
// pessoa que entrou por **CONVITE** — é a única cujo login **nunca foi auditado**.
//
// A auditoria resolvia a empresa com `userCompany.findFirst`; o aceite de convite escreve em
// **`UserCompanyRole`** (o RBAC). Achava nada, e o `if (!userCompany) return` engolia o
// registro **em silêncio** — apagando justamente o rastro de quem mais interessa vigiar: o
// convidado. *Zero silencioso é indistinguível de "não tem".*
//
// ⚠️ É A MESMA CLASSE QUE JÁ MORDEU DUAS VEZES: em 14/08 o vínculo de parcela (1:1 × N:1,
// e eu declarei 8 parcelas "órfãs" que não eram), em 30/08 a listagem de empresas (o
// convidado aceitava certo e caía num workspace vazio). Checar UMA porta e concluir "não
// tem" é o bug.
//
// ⭐ POR ISSO A DECISÃO VIRA UMA FUNÇÃO, e não mais um `findFirst` copiado: quem precisar da
// empresa de alguém chama aqui e ganha as duas portas de graça.

import type { PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/db'

/**
 * A empresa de um usuário, pelas DUAS portas. `null` quando ele não está em nenhuma.
 *
 * ⚠️ Ordem: **RBAC primeiro** (é o modelo vivo — todo acesso novo nasce lá), legado como
 * reserva pro histórico. Devolver `null` aqui é resposta legítima: conta recém-criada, ainda
 * sem convite aceito, não está em empresa nenhuma. O caller trata como exceção NOMEADA, nunca
 * como "achei nada na tabela".
 */
export async function empresaDoUsuarioParaAuditoria(
  userId: string,
  db: PrismaClient = defaultPrisma,
): Promise<string | null> {
  const rbac = await db.userCompanyRole.findFirst({
    where: { userId }, orderBy: { createdAt: 'asc' }, select: { companyId: true },
  })
  if (rbac) return rbac.companyId
  const legado = await db.userCompany.findFirst({
    where: { userId }, orderBy: { createdAt: 'asc' }, select: { companyId: true },
  })
  return legado?.companyId ?? null
}
