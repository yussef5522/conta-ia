// Sprint A — Backfill dos órfãos "PAYABLE + RECONCILED + reconciledWithId=NULL".
//
// Contexto:
//   Algum fluxo legado (mark_paid bulk antigo) setou status=RECONCILED em
//   contas a pagar SEM criar o link reconciledWithId. Estado inválido pelo
//   modelo de conciliação (RECONCILED implica link com OFX).
//
//   Na Cacula Mix (CNPJ 59.078.582/0001-71) temos ~20 dessas linhas. Sem
//   este backfill elas continuam INVISÍVEIS pro matcher (ramo 1 quer
//   status=PENDING; ramo 2 quer lifecycle=EFFECTED).
//
// O que faz:
//   - Lista todas as linhas com lifecycle='PAYABLE' AND status='RECONCILED'
//     AND reconciledWithId IS NULL na empresa-alvo.
//   - Atualiza status → 'PENDING' (volta pra estado válido "a pagar").
//   - Lifecycle FICA PAYABLE (não muda — se o pagamento real for confirmado
//     depois, o matcher concilia naturalmente).
//   - Idempotente: re-rodar não afeta linhas já normalizadas.
//
// O que NÃO faz:
//   - Não toca lifecycle.
//   - Não toca paymentDate / dueDate / amount / description / categoryId / etc.
//   - Não cria links reconciledWithId (não há informação pra inferir).
//   - Não toca outras empresas (WHERE filtrado por companyId).
//
// ⚠️ ALTERs em tabela com DADOS REAIS:
//   Tabela: transactions
//   Coluna: status
//   Tipo:   UPDATE
//   Linhas afetadas: linhas Cacula Mix com PAYABLE+RECONCILED+NULL link (~20)
//   Risco:  Baixo (estado atual já é inválido; retorna pra estado válido)
//   Mitigação: backup pg_dump ANTES; WHERE explícito; idempotente;
//              listagem pré-update; audit log
//
// Uso:
//   npx tsx scripts/sprint-a-backfill-payable-orphans.ts            # dry-run
//   npx tsx scripts/sprint-a-backfill-payable-orphans.ts --execute  # aplica

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Cacula Mix (maiúscula, CNPJ 59.078.582/0001-71) — empresa onde o bug foi detectado.
const TARGET_COMPANY_ID = 'cmpr68ra50003cemtku0xu36m'

async function main() {
  const execute = process.argv.includes('--execute')

  console.log('🔧 Sprint A — Backfill PAYABLE+RECONCILED órfãos')
  console.log(`   Empresa-alvo: ${TARGET_COMPANY_ID}`)
  console.log(`   Modo: ${execute ? 'EXECUTE (vai alterar dados)' : 'DRY-RUN (sem alteração)'}`)
  console.log()

  // 1) Lista todos os candidatos (com escopo multi-tenant via OR nas 4 relações)
  const candidatos = await prisma.transaction.findMany({
    where: {
      lifecycle: 'PAYABLE',
      status: 'RECONCILED',
      reconciledWithId: null,
      OR: [
        { bankAccount: { companyId: TARGET_COMPANY_ID } },
        { supplier: { companyId: TARGET_COMPANY_ID } },
        { customer: { companyId: TARGET_COMPANY_ID } },
        { category: { companyId: TARGET_COMPANY_ID } },
      ],
    },
    select: {
      id: true,
      description: true,
      amount: true,
      dueDate: true,
      paymentDate: true,
      origin: true,
      lifecycle: true,
      status: true,
    },
    orderBy: { dueDate: 'asc' },
  })

  console.log(`📋 Encontrados ${candidatos.length} órfãos a normalizar:`)
  console.log()
  candidatos.forEach((c, i) => {
    const due = c.dueDate ? c.dueDate.toISOString().split('T')[0] : '—'
    const pay = c.paymentDate ? c.paymentDate.toISOString().split('T')[0] : '—'
    const desc = c.description.length > 35 ? c.description.slice(0, 32) + '...' : c.description
    console.log(
      `  ${(i + 1).toString().padStart(2)}. ${c.id}  R$ ${c.amount.toFixed(2).padStart(10)}  due=${due}  pay=${pay}  [${c.origin}]  "${desc}"`,
    )
  })
  console.log()

  if (candidatos.length === 0) {
    console.log('✅ Nada a fazer — estado já normalizado (idempotência OK).')
    await prisma.$disconnect()
    return
  }

  if (!execute) {
    console.log('🟡 DRY-RUN — nenhum dado foi alterado.')
    console.log('   Pra aplicar: npx tsx scripts/sprint-a-backfill-payable-orphans.ts --execute')
    await prisma.$disconnect()
    return
  }

  // 2) UPDATE atomic com escopo explícito
  console.log('⚙️  Aplicando UPDATE status: RECONCILED → PENDING')
  const ids = candidatos.map((c) => c.id)
  const result = await prisma.transaction.updateMany({
    where: {
      id: { in: ids },
      // Re-checagem das condições (defesa em profundidade contra race)
      lifecycle: 'PAYABLE',
      status: 'RECONCILED',
      reconciledWithId: null,
    },
    data: {
      status: 'PENDING',
    },
  })

  console.log(`✅ ${result.count} linha(s) atualizada(s).`)
  console.log()

  // 3) Audit log (1 entrada por linha — útil pra rastreamento forense)
  console.log('📝 Gravando audit logs...')
  let auditCount = 0
  for (const c of candidatos.slice(0, result.count)) {
    try {
      await prisma.auditLog.create({
        data: {
          action: 'SPRINT_A_BACKFILL_PAYABLE_ORPHAN',
          entityType: 'Transaction',
          entityId: c.id,
          companyId: TARGET_COMPANY_ID,
          userName: 'system (sprint-a-backfill)',
          userEmail: 'system@contaia.com.br',
          fieldsChanged: JSON.stringify({
            status: { before: 'RECONCILED', after: 'PENDING' },
          }),
          metadata: JSON.stringify({
            sprint: 'A',
            reason:
              'PAYABLE + status=RECONCILED + reconciledWithId=NULL é estado inválido — voltado pra estado válido PENDING',
            amount: c.amount,
            description: c.description,
            origin: c.origin,
            lifecycle: c.lifecycle,
          }),
        },
      })
      auditCount += 1
    } catch (err) {
      console.warn(`  ⚠️ falhou ao gravar audit pra ${c.id}: ${(err as Error).message}`)
    }
  }
  console.log(`✅ ${auditCount} audit log(s) gravado(s).`)
  console.log()

  // 4) Validação pós
  const restantes = await prisma.transaction.count({
    where: {
      lifecycle: 'PAYABLE',
      status: 'RECONCILED',
      reconciledWithId: null,
      OR: [
        { bankAccount: { companyId: TARGET_COMPANY_ID } },
        { supplier: { companyId: TARGET_COMPANY_ID } },
        { customer: { companyId: TARGET_COMPANY_ID } },
        { category: { companyId: TARGET_COMPANY_ID } },
      ],
    },
  })
  console.log(`📊 Órfãos restantes pós-UPDATE: ${restantes} (esperado: 0)`)

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('❌ Erro:', err)
  process.exit(1)
})
