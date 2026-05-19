// Seed idempotente do Gerenciador inicial — Sprint 1.6.
//
// Uso (prod, 1 vez após migration):
//   cd /opt/conta-ia
//   npx tsx scripts/seed-gerenciador.ts
//
// Idempotente: se gerenciador@caixaos.com.br já existe, faz "skip".
// NÃO imprime a senha em hipótese alguma.

import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const SEED_EMAIL = 'gerenciador@caixaos.com.br'
const SEED_NAME = 'Yussef Musa'
const SEED_ROLE = 'OWNER'
// Senha inicial — Yussef troca depois via /admin/perfil (Sprint 1.7+)
// ou via SQL direto. NUNCA logamos o valor.
const SEED_PASSWORD = 'CaixaOS@Founder2026!'

async function main() {
  const prisma = new PrismaClient()
  try {
    const existing = await prisma.gerenciador.findUnique({
      where: { email: SEED_EMAIL },
    })

    if (existing) {
      console.log(
        `[seed-gerenciador] Já existe → skip. id=${existing.id} email=${existing.email} role=${existing.role} active=${existing.active}`,
      )
      return
    }

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12)
    const created = await prisma.gerenciador.create({
      data: {
        email: SEED_EMAIL,
        passwordHash,
        name: SEED_NAME,
        role: SEED_ROLE,
        active: true,
      },
    })
    console.log(
      `[seed-gerenciador] Gerenciador criado. id=${created.id} email=${created.email} role=${created.role}`,
    )
    console.log(
      '[seed-gerenciador] Senha inicial documentada em docs/SPRINT-1-6-RESUMO.md. Troque após primeiro login.',
    )
  } catch (err) {
    console.error(
      '[seed-gerenciador] ERRO:',
      err instanceof Error ? err.message : err,
    )
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void main()
