// Sprint Engine de Assinatura FATIA 1 — Simula o estado de PROD em DEV
// pra mostrar EXATAMENTE o que o backfill vai fazer com os 4 users.
// USADO APENAS NO CHECKPOINT PRÉ-DEPLOY.

import bcrypt from 'bcryptjs'
import { prisma } from '../lib/db'

async function main() {
  console.log('=== Simulando estado de PROD em DEV ===\n')

  // Cria os 3 users que existem em prod mas não em dev (admin já existe)
  const proxyUsers = [
    {
      email: 'nouraawni90@gmail.com',
      name: 'nura musa',
      createdAt: new Date('2026-05-20T18:22:54.058Z'),
    },
    {
      email: 'newuser-1779151369@caixaos.com.br',
      name: 'Test User',
      createdAt: new Date('2026-05-19T00:42:50.393Z'),
    },
    {
      email: 'yussefmusa5522@gmail.com',
      name: 'nura abu zahry musa',
      createdAt: new Date('2026-05-17T06:24:51.876Z'),
    },
  ]

  for (const u of proxyUsers) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } })
    if (exists) {
      console.log(`  - ${u.email} já existe em dev (skip)`)
      continue
    }
    await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        password: await bcrypt.hash('FakeDevPassword123!', 10),
        createdAt: u.createdAt,
      },
    })
    console.log(`  + ${u.email} criado`)
  }

  console.log('\n=== Estado atual em dev ===')
  const all = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      createdAt: true,
      subscription: { select: { status: true, planId: true } },
      _count: { select: { companies: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  for (const u of all) {
    console.log(
      `  ${u.email}  →  ${u.subscription?.status ?? '❌ sem sub'} (${u._count.companies} empresas, cadastrado ${u.createdAt.toISOString().slice(0, 10)})`,
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌', err)
    process.exit(1)
  })
