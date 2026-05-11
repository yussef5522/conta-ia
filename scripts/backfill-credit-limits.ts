// Safety net pra contas bancárias criadas ANTES do Sprint 0.5 Dia 1.
//
// Contexto:
//   - Dia 1 adicionou allowNegativeBalance (default true), creditLimit (default 0),
//     lowBalanceThreshold (default null) em bank_accounts.
//   - Dia 3 introduz checkBalance que bloqueia transações que ultrapassem
//     -creditLimit. Com default=0, contas EXISTENTES que operam negativas
//     (caso normal da Cacula Mix) ficariam travadas pra novas despesas.
//
// Solução temporária (até UI do Dia 4 deixar configurar por conta):
//   Setta creditLimit = 999_999_999 (1 bilhão = "ilimitado prático") em todas
//   as contas pré-Sprint-0.5. Yussef configura o valor real depois via UI.
//
// Contas NOVAS (createdAt após o cutoff) NÃO são afetadas — usam default 0,
// forçando configuração consciente.
//
// Uso: npx tsx scripts/backfill-credit-limits.ts
// Idempotente: rodar múltiplas vezes só afeta contas que AINDA têm creditLimit=0
// dentro do cutoff. Contas alteradas manualmente ficam intactas.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Cutoff: data do primeiro commit do Sprint 0.5 (Dia 1). Contas criadas APÓS
// essa data são novas e não devem receber o backfill.
const SPRINT_0_5_CUTOFF = new Date('2026-05-11T23:59:59Z')

// Valor "ilimitado prático" pra contas pré-Sprint-0.5. 1 bilhão é grande o
// suficiente pra cobrir qualquer cheque especial real e pequeno o suficiente
// pra não causar problemas de overflow/precisão em Float64.
const SAFETY_NET_LIMIT = 999_999_999

async function main() {
  console.log('🔧 Backfill credit limits — Sprint 0.5 safety net')
  console.log(`   Cutoff: ${SPRINT_0_5_CUTOFF.toISOString()}`)
  console.log(`   Limite aplicado: R$ ${SAFETY_NET_LIMIT.toLocaleString('pt-BR')}`)
  console.log()

  // Lista contas que serão afetadas antes de updar (pra log claro)
  const candidatas = await prisma.bankAccount.findMany({
    where: {
      createdAt: { lt: SPRINT_0_5_CUTOFF },
      creditLimit: 0,
      allowNegativeBalance: true,
    },
    select: {
      id: true,
      name: true,
      balance: true,
      companyId: true,
      company: { select: { name: true } },
    },
  })

  if (candidatas.length === 0) {
    console.log('✅ Nada pra fazer — nenhuma conta pré-Sprint-0.5 com creditLimit=0.')
    await prisma.$disconnect()
    return
  }

  console.log(`📋 ${candidatas.length} conta(s) a atualizar:`)
  for (const c of candidatas) {
    console.log(
      `   - [${c.company.name}] ${c.name} (saldo atual: R$ ${c.balance.toLocaleString(
        'pt-BR',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
      )})`,
    )
  }
  console.log()

  const result = await prisma.bankAccount.updateMany({
    where: {
      createdAt: { lt: SPRINT_0_5_CUTOFF },
      creditLimit: 0,
      allowNegativeBalance: true,
    },
    data: {
      creditLimit: SAFETY_NET_LIMIT,
    },
  })

  console.log(`✅ ${result.count} conta(s) atualizada(s).`)
  console.log()
  console.log('⚠️  PRÓXIMO PASSO: Yussef deve configurar o creditLimit REAL de cada')
  console.log('    conta via UI (Dia 4 do Sprint 0.5). Exemplos reais:')
  console.log('      - Banrisul: R$ 600.000')
  console.log('      - Sicredi:  R$  80.000')

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('❌ Backfill falhou:', e)
  await prisma.$disconnect()
  process.exit(1)
})
