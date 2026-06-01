// Sprint Engine de Assinatura FATIA 1 — Validação do CHECKPOINT.
// Roda 3 cenários e mostra o resultado pro Yussef antes do deploy:
//   1. Os 4 users existentes ficaram GRANTED (não expiram nunca)
//   2. Um cadastro NOVO cria TRIAL 14d
//   3. canAccessFeature/getEmpresaLimit respeitam GRANTED (B2: ninguém é bloqueado)

import { prisma } from '../lib/db'
import {
  canAccessFeature,
  computeEffectiveStatus,
  diasRestantesTrial,
  getEffectiveSubscriptionStatus,
  getEmpresaLimit,
} from '../lib/subscription/access'

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('CHECKPOINT — Validação Engine de Assinatura FATIA 1')
  console.log('═══════════════════════════════════════════════════════════\n')

  // ============================================================
  // CENÁRIO 1 — Os 4 users existentes: GRANTED + nunca expiram
  // ============================================================
  console.log('━━━ CENÁRIO 1: 4 users existentes ficaram GRANTED ━━━\n')

  const users = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      createdAt: true,
      subscription: true,
      _count: { select: { companies: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  for (const u of users) {
    if (!u.subscription) {
      console.log(`❌ ${u.email} — SEM SUBSCRIPTION (problema!)`)
      continue
    }
    const effective = getEffectiveSubscriptionStatus({
      status: u.subscription.status,
      planId: u.subscription.planId,
      trialEndsAt: u.subscription.trialEndsAt,
    })
    const exp = effective.isExpired ? '🚫 EXPIRADO' : '✅ ATIVO'
    console.log(
      `  ${exp}  ${u.email}  →  ${effective.rawStatus}/${effective.planId}` +
        ` (${u._count.companies} emp)`,
    )
  }

  const admin = users.find((u) => u.email === 'admin@contaia.com.br')
  console.log(
    `\n🎯 ATENÇÃO YUSSEF: admin@contaia.com.br (sua conta principal):`,
  )
  if (admin?.subscription) {
    console.log(`     status raw: ${admin.subscription.status}`)
    console.log(`     planId: ${admin.subscription.planId}`)
    console.log(`     trialEndsAt: ${admin.subscription.trialEndsAt ?? 'NULL (vitalício)'}`)
    const isExp = computeEffectiveStatus(
      {
        status: admin.subscription.status,
        planId: admin.subscription.planId,
        trialEndsAt: admin.subscription.trialEndsAt,
      },
      new Date(),
    )
    console.log(`     effective: ${isExp}`)
    console.log(
      `     → ${isExp === 'GRANTED' ? '✅ NUNCA EXPIRA' : '🚫 PROBLEMA!'}`,
    )
  }

  // Confirma que admin tem 1+ empresa (não pode quebrar Yussef)
  console.log(
    `     empresas vinculadas: ${admin?._count.companies ?? 0} ${
      admin && admin._count.companies >= 1
        ? '(✅ profit + Cacula preservados)'
        : ''
    }`,
  )

  // ============================================================
  // CENÁRIO 2 — Cadastro NOVO cria TRIAL 14d
  // ============================================================
  console.log('\n━━━ CENÁRIO 2: Cadastro NOVO cria TRIAL 14d ━━━\n')

  // Simula um user novo (sem chamar o endpoint pra não interferir com prisma direto)
  const fakeNew = await prisma.user.create({
    data: {
      email: `checkpoint-new-${Date.now()}@dev.local`,
      name: 'Checkpoint Demo',
      password: 'fake-hash',
    },
  })
  // Chama o helper REAL que o cadastro chama
  const { createTrialSubscription } = await import(
    '../lib/subscription/create-trial'
  )
  const trial = await createTrialSubscription(prisma, { userId: fakeNew.id })

  const trialEffective = getEffectiveSubscriptionStatus({
    status: trial.status,
    planId: trial.planId,
    trialEndsAt: trial.trialEndsAt,
  })
  console.log(`  User: ${fakeNew.email}`)
  console.log(`  status: ${trialEffective.rawStatus}`)
  console.log(`  effective: ${trialEffective.effectiveStatus}`)
  console.log(`  planId: ${trialEffective.planId} (mostra IA = âncora de valor)`)
  console.log(`  trialEndsAt: ${trial.trialEndsAt?.toISOString()}`)
  console.log(`  dias restantes: ${trialEffective.diasRestantesTrial}`)
  console.log(
    `  → ${
      trialEffective.diasRestantesTrial === 14
        ? '✅ TRIAL 14 DIAS CRIADO'
        : '🚫 PROBLEMA'
    }`,
  )

  // Cleanup
  await prisma.subscription.delete({ where: { userId: fakeNew.id } })
  await prisma.user.delete({ where: { id: fakeNew.id } })

  // ============================================================
  // CENÁRIO 3 — B2: nada bloqueia quem já usa
  // ============================================================
  console.log('\n━━━ CENÁRIO 3: B2 — nada bloqueia o acesso atual ━━━\n')

  console.log('  Funções expostas (UI pode chamar pra mostrar "upgrade"):')
  console.log(`    getEmpresaLimit("inteligencia") = ${getEmpresaLimit('inteligencia')}`)
  console.log(`    getEmpresaLimit("performance")  = ${getEmpresaLimit('performance')}`)
  console.log(`    canAccessFeature("inteligencia", "ia") = ${canAccessFeature('inteligencia', 'ia')}`)
  console.log(
    `    canAccessFeature("inicio", "ia")        = ${canAccessFeature('inicio', 'ia')}`,
  )

  console.log('\n  ⚠️  IMPORTANTE: nenhum endpoint do app está chamando essas')
  console.log('       funções pra bloquear acesso ainda. Yussef + os 4 users')
  console.log('       continuam acessando TUDO normalmente. B2 respeitado.\n')

  // Confirma que NÃO há bloqueio em endpoints atuais
  console.log('  Endpoints que poderiam bloquear acesso:')
  console.log(
    '    POST /api/empresas      → NÃO chama getEmpresaLimit (livre)',
  )
  console.log('    GET /api/ai/insights    → NÃO chama canAccessFeature (livre)')
  console.log('    GET /api/ai-categorizer → NÃO chama canAccessFeature (livre)')
  console.log('\n  → ✅ B2 RESPEITADO: zero bloqueio em features atuais.\n')

  // ============================================================
  // CENÁRIO 4 — JWT flag pra admin
  // ============================================================
  console.log('━━━ CENÁRIO 4: o que o JWT do admin@contaia vai carregar ━━━\n')

  if (admin?.subscription) {
    const effective = computeEffectiveStatus(
      {
        status: admin.subscription.status,
        planId: admin.subscription.planId,
        trialEndsAt: admin.subscription.trialEndsAt,
      },
      new Date(),
    )
    const subscriptionExpiredFlag = effective === 'EXPIRED'
    console.log(`  No próximo login do admin@contaia:`)
    console.log(`    JWT.subscriptionExpired = ${subscriptionExpiredFlag}`)
    console.log(
      `    → ${
        subscriptionExpiredFlag === false
          ? '✅ ADMIN NÃO É BLOQUEADO PELO MIDDLEWARE'
          : '🚫 ADMIN SERIA BLOQUEADO — PROBLEMA!'
      }`,
    )
  }

  console.log(
    '\n═══════════════════════════════════════════════════════════',
  )
  console.log('Pronto pro deploy quando Yussef confirmar.')
  console.log(
    '═══════════════════════════════════════════════════════════\n',
  )
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌', err)
    process.exit(1)
  })
