// Seed idempotente do cupom FUNDADOR100 — Sprint 1.7.
//
// 100% off vitalício, máx 100 resgates, 1 por usuário.
// Criado pelo primeiro Gerenciador OWNER ativo encontrado (geralmente Yussef).
//
// Uso:
//   cd /opt/conta-ia
//   npx tsx scripts/seed-coupon-fundador.ts
//
// Idempotente: se cupom já existe (mesmo code), faz skip.

import { PrismaClient } from '@prisma/client'

const SEED_CODE = 'FUNDADOR100'
const SEED_DESCRIPTION =
  '100% off vitalício para os 100 primeiros fundadores do CAIXAOS'
const SEED_TYPE = 'PERCENTAGE'
const SEED_VALUE = 100
const SEED_MAX_USES = 100
const SEED_MAX_PER_USER = 1

async function main() {
  const prisma = new PrismaClient()
  try {
    const existing = await prisma.coupon.findUnique({
      where: { code: SEED_CODE },
    })

    if (existing) {
      console.log(
        `[seed-coupon-fundador] Já existe → skip. id=${existing.id} status=${existing.status} uses=${existing.currentUses}/${existing.maxUses}`,
      )
      return
    }

    // Acha um Gerenciador OWNER ativo pra atribuir createdById
    const owner = await prisma.gerenciador.findFirst({
      where: { role: 'OWNER', active: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!owner) {
      throw new Error(
        'Nenhum Gerenciador OWNER ativo encontrado. Rode scripts/seed-gerenciador.ts primeiro.',
      )
    }

    const created = await prisma.coupon.create({
      data: {
        code: SEED_CODE,
        description: SEED_DESCRIPTION,
        type: SEED_TYPE,
        value: SEED_VALUE,
        freeMonths: null,
        validFrom: new Date(),
        validUntil: null, // vitalício
        maxUses: SEED_MAX_USES,
        maxUsesPerUser: SEED_MAX_PER_USER,
        status: 'ACTIVE',
        createdById: owner.id,
      },
    })

    console.log(
      `[seed-coupon-fundador] Cupom criado. id=${created.id} code=${created.code} maxUses=${created.maxUses}`,
    )
    console.log(
      `[seed-coupon-fundador] Compartilhe: https://app.caixaos.com.br/cadastro?cupom=${SEED_CODE}`,
    )
  } catch (err) {
    console.error(
      '[seed-coupon-fundador] ERRO:',
      err instanceof Error ? err.message : err,
    )
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void main()
