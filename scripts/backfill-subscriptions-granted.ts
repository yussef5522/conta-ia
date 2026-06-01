// Sprint Engine de Assinatura FATIA 1 (31/05/2026)
//
// Backfill de subscription pros 4 users existentes em prod:
// todos viram GRANTED vitalício (decisão A4 do Yussef).
//
// IDEMPOTENTE: se user já tem subscription, NÃO modifica.
// SEGURO: lista todos, mostra o plano, e SÓ cria pra quem não tem.
//
// Como rodar (DEV):   npx tsx scripts/backfill-subscriptions-granted.ts
// Como rodar (PROD):  ssh root@host 'cd /opt/conta-ia && npx tsx scripts/backfill-subscriptions-granted.ts'

import { prisma } from '../lib/db'

const REASON = 'early-adopter-pre-paywall'

async function main() {
  console.log('=== Backfill Subscriptions GRANTED ===\n')

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      subscription: { select: { id: true, status: true, planId: true } },
      _count: { select: { companies: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Total users: ${users.length}\n`)

  const toGrant: typeof users = []
  const skipped: typeof users = []

  for (const u of users) {
    if (u.subscription) {
      skipped.push(u)
    } else {
      toGrant.push(u)
    }
  }

  console.log(`Já têm subscription (skip): ${skipped.length}`)
  for (const u of skipped) {
    console.log(
      `  - ${u.email} → ${u.subscription?.status}/${u.subscription?.planId}`,
    )
  }

  console.log(`\nA criar GRANTED: ${toGrant.length}`)
  for (const u of toGrant) {
    console.log(
      `  - ${u.email} (${u.name}, ${u._count.companies} empresas, cadastrado ${u.createdAt.toISOString().slice(0, 10)})`,
    )
  }

  if (toGrant.length === 0) {
    console.log('\nNada a fazer. Saindo.')
    return
  }

  console.log('\nCriando subscriptions GRANTED...')

  const created: { userId: string; email: string; subscriptionId: string }[] = []

  for (const u of toGrant) {
    const sub = await prisma.subscription.create({
      data: {
        userId: u.id,
        planId: 'inteligencia',
        status: 'GRANTED',
        trialEndsAt: null,
      },
    })
    created.push({ userId: u.id, email: u.email, subscriptionId: sub.id })
    console.log(`  ✓ ${u.email} → subscription ${sub.id} (GRANTED)`)

    // Audit no GerenciadorAuditLog (gerenciadorId=null = sistema)
    await prisma.gerenciadorAuditLog.create({
      data: {
        gerenciadorId: null,
        action: 'BACKFILL_SUBSCRIPTION_GRANTED',
        entityType: 'Subscription',
        entityId: sub.id,
        metadata: JSON.stringify({
          userId: u.id,
          userEmail: u.email,
          userName: u.name,
          reason: REASON,
          script: 'scripts/backfill-subscriptions-granted.ts',
        }),
      },
    })
  }

  console.log(
    `\n✅ ${created.length} subscription(s) GRANTED criada(s) + auditadas.`,
  )
  console.log('\n=== Snapshot final (todas as subscriptions) ===\n')

  const all = await prisma.user.findMany({
    select: {
      email: true,
      subscription: {
        select: {
          status: true,
          planId: true,
          trialEndsAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  for (const u of all) {
    if (!u.subscription) {
      console.log(`  ${u.email}  →  ❌ NENHUMA`)
    } else {
      console.log(
        `  ${u.email}  →  ${u.subscription.status}/${u.subscription.planId}` +
          (u.subscription.trialEndsAt
            ? ` (trial until ${u.subscription.trialEndsAt.toISOString().slice(0, 10)})`
            : ' (vitalício)'),
      )
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ ERRO:', err)
    process.exit(1)
  })
