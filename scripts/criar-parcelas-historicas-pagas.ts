// Sprint Emprestimos UI Pagas — cria parcelas históricas PAID nos 8 loans
// da Cacula pra UI mostrar progresso correto. Idempotente: pula loan que já
// tem PAID. Anti-duplicação rigoroso:
//
//   - PAID históricas tem payment=0, amortization=0, interest=0
//     → saldoDevedor (= principal - SUM(amort)) MANTÉM o valor já registrado
//   - Não cria nenhuma Transaction
//   - Não mexe em balance, ledgerBal, DRE, dashboard
//   - Marca isEstimate=true e correcao=0 pra diferenciar de parcelas reais
//   - paidDate = dueDate (vencimento histórico)
//
// Bônus: ajusta termMonths dos 2 Caixa Econômica (carência 11/12 períodos)
// pra refletir parcelas EFETIVAS (pagas + a pagar), não totais do contrato
// incluindo carência.

import { PrismaClient } from '@prisma/client'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const prisma = new PrismaClient()

interface LoanConfig {
  contractNumber: string
  lender: string
  produto: string
  pagasReais: number
  /** Se diferente de termMonths atual, AJUSTAR (caso dos 2 Caixa com carência). */
  termMonthsEfetivo?: number
}

const CONFIGS: LoanConfig[] = [
  // Sicredi
  { contractNumber: 'C41022227-1', lender: 'Sicredi', produto: 'BNDES Peq/Médias', pagasReais: 21 },
  { contractNumber: 'C41022570-0', lender: 'Sicredi', produto: 'PRONAMPE Solidário RS', pagasReais: 11 },
  { contractNumber: 'C41033828-8', lender: 'Sicredi', produto: 'Veículos', pagasReais: 18 },
  { contractNumber: 'C61021346-2', lender: 'Sicredi', produto: 'GIRO PRONAMPE', pagasReais: 0 },
  // Caixa — carência foi de ~12 períodos antes da 1ª parcela. Ajustar termMonths
  // pra refletir só as parcelas EFETIVAS (pagas + a pagar).
  { contractNumber: '000000000001837311', lender: 'Caixa Econômica Federal', produto: 'GiroFAMPE', pagasReais: 28, termMonthsEfetivo: 35 },
  { contractNumber: '000000000001827478', lender: 'Caixa Econômica Federal', produto: 'GIROCAIXA', pagasReais: 29, termMonthsEfetivo: 36 },
  // Banrisul — deduzido por min(number)-1 nas installments existentes; bate
  // com installmentsPaidBefore informado no cadastro.
  { contractNumber: '002100057538834', lender: 'Banrisul', produto: 'SAC', pagasReais: 55 },
  { contractNumber: '002100064956967', lender: 'Banrisul', produto: 'PRICE', pagasReais: 21 },
]

async function main() {
  console.log('━'.repeat(80))
  console.log('Criar parcelas históricas PAID — anti-duplicação rigoroso')
  console.log('━'.repeat(80))

  // ─── Baseline ───
  const saldosAntes = await prisma.bankAccount.findMany({
    where: { companyId: CACULA, isActive: true, ledgerBal: { not: null } },
    select: { name: true, balance: true, ledgerBal: true },
    orderBy: { name: 'asc' },
  })
  console.log('\n━━ Saldos ANTES (devem ficar identicos depois) ━━')
  for (const s of saldosAntes) {
    console.log(`  ${s.name.padEnd(15)} balance=R$ ${s.balance.toFixed(2).padStart(12)} ledger=R$ ${(s.ledgerBal ?? 0).toFixed(2).padStart(12)}`)
  }

  // ─── Cada loan ───
  let totalCriadas = 0
  let totalTermAjustados = 0
  for (const cfg of CONFIGS) {
    const loan = await prisma.loan.findFirst({
      where: { companyId: CACULA, contractNumber: cfg.contractNumber },
      include: { installments: { orderBy: { number: 'asc' } } },
    })
    if (!loan) {
      console.log(`\n  ⚠ ${cfg.contractNumber} ${cfg.produto}: loan não encontrado — SKIP`)
      continue
    }

    console.log(`\n━━ ${cfg.contractNumber} ${cfg.lender} ${cfg.produto} ━━`)
    const existentes = loan.installments
    const ja_pagas = existentes.filter((i) => i.status === 'PAID').length
    const min_existente = existentes.length > 0 ? Math.min(...existentes.map((i) => i.number)) : null
    console.log(`  Estado atual: ${existentes.length} installments (${ja_pagas} PAID, ${existentes.length - ja_pagas} OPEN) | menor numero=${min_existente}`)

    // Idempotência: pula se já tem PAID >= pagasReais
    if (ja_pagas >= cfg.pagasReais) {
      console.log(`  ⚠ Já tem ${ja_pagas} PAID — SKIP histórico`)
    } else if (cfg.pagasReais === 0) {
      console.log(`  ℹ pagasReais=0 (nenhuma paga) — SKIP histórico`)
    } else {
      if (min_existente === null) {
        console.log(`  🚨 Sem installments — não dá pra deduzir startNumber. SKIP`)
        continue
      }

      // Cria parcelas históricas: number 1..pagasReais
      // dueDate calculada: vencimento da 1ª futura recua N meses
      const firstFutureInst = existentes.find((i) => i.number === min_existente)
      if (!firstFutureInst) {
        console.log(`  🚨 Não acha 1ª futura — SKIP`)
        continue
      }
      const firstFutureDue = firstFutureInst.dueDate

      const toCreate: Array<{
        number: number
        dueDate: Date
        openingBalance: number
        interest: number
        amortization: number
        payment: number
        closingBalance: number
        status: string
        paidDate: Date
        isEstimate: boolean
        correcao: number
      }> = []

      for (let n = 1; n <= cfg.pagasReais; n++) {
        // dueDate retroativo: 1ª futura é número (min_existente). Pra parcela n,
        // recua (min_existente - n) meses.
        const monthsBack = min_existente - n
        const dueDate = new Date(Date.UTC(
          firstFutureDue.getUTCFullYear(),
          firstFutureDue.getUTCMonth() - monthsBack,
          firstFutureDue.getUTCDate(),
        ))
        toCreate.push({
          number: n,
          dueDate,
          openingBalance: 0,
          interest: 0,
          amortization: 0,
          payment: 0,
          closingBalance: 0,
          status: 'PAID',
          paidDate: dueDate,
          isEstimate: true,
          correcao: 0,
        })
      }

      // Idempotência já garantida acima por ja_pagas >= pagasReais
      const result = await prisma.loanInstallment.createMany({
        data: toCreate.map((r) => ({ loanId: loan.id, ...r })),
      })
      console.log(`  ✅ Criadas ${result.count} parcelas PAID (números 1 a ${cfg.pagasReais}, dueDate retroativo)`)
      console.log(`     1ª retroativa: ${toCreate[0].dueDate.toISOString().slice(0, 10)} · última paga: ${toCreate[toCreate.length - 1].dueDate.toISOString().slice(0, 10)}`)
      totalCriadas += result.count
    }

    // Ajustar termMonths se necessário (Caixa Econômica)
    if (cfg.termMonthsEfetivo !== undefined && loan.termMonths !== cfg.termMonthsEfetivo) {
      await prisma.loan.update({
        where: { id: loan.id },
        data: { termMonths: cfg.termMonthsEfetivo },
      })
      console.log(`  ✅ termMonths ajustado: ${loan.termMonths} → ${cfg.termMonthsEfetivo} (exclui carência)`)
      totalTermAjustados++
    }
  }

  // ─── Validação ───
  console.log('\n' + '━'.repeat(80))
  console.log('VALIDAÇÃO PÓS-MIGRAÇÃO')
  console.log('━'.repeat(80))

  const saldosDepois = await prisma.bankAccount.findMany({
    where: { companyId: CACULA, isActive: true, ledgerBal: { not: null } },
    select: { name: true, balance: true, ledgerBal: true },
    orderBy: { name: 'asc' },
  })
  let saldosOk = true
  console.log('\n━━ Saldos DEPOIS (devem == antes) ━━')
  for (let i = 0; i < saldosDepois.length; i++) {
    const a = saldosAntes[i]
    const d = saldosDepois[i]
    const delta = d.balance - a.balance
    if (Math.abs(delta) > 0.001) saldosOk = false
    console.log(`  ${d.name.padEnd(15)} balance=R$ ${d.balance.toFixed(2).padStart(12)} Δantes=${delta.toFixed(4)}`)
  }
  console.log(`  ${saldosOk ? '✅' : '🚨'} Saldos NÃO mudaram (cadastro não cria CREDIT/DEBIT)`)

  console.log('\n━━ 8 loans pós-migração ━━')
  const loansFinais = await prisma.loan.findMany({
    where: { companyId: CACULA },
    include: { installments: true },
    orderBy: [{ lender: 'asc' }, { createdAt: 'asc' }],
  })
  let totalDivida = 0
  for (const l of loansFinais) {
    const paid = l.installments.filter((i) => i.status === 'PAID').length
    const open = l.installments.filter((i) => i.status === 'OPEN').length
    const pct = (l.installments.length > 0 ? Math.round((paid / l.installments.length) * 100) : 0)
    totalDivida += l.outstandingBalanceInitial ?? l.principal
    console.log(`  ${l.lender.padEnd(10)} ${(l.contractNumber ?? '').padEnd(20)} term=${String(l.termMonths).padStart(3)} | ${String(paid).padStart(3)}P + ${String(open).padStart(3)}O = ${String(l.installments.length).padStart(3)} | ${String(pct).padStart(3)}% pagas | saldo R$ ${(l.outstandingBalanceInitial ?? l.principal).toFixed(2).padStart(11)}`)
  }
  console.log(`\n  Dívida total: R$ ${totalDivida.toFixed(2)}`)
  console.log(`  Esperado:     R$ 596773.75`)
  console.log(`  ${Math.abs(totalDivida - 596773.75) < 0.01 ? '✅' : '🚨'} Bate (Δ R$ ${(totalDivida - 596773.75).toFixed(2)})`)

  // 0 transactions criadas pelo script
  const txRecentes = await prisma.transaction.count({
    where: {
      bankAccount: { companyId: CACULA },
      createdAt: { gt: new Date(Date.now() - 5 * 60 * 1000) },
    },
  })
  console.log(`  ${txRecentes === 0 ? '✅' : '⚠'} Transactions criadas últimos 5 min: ${txRecentes} (esperado 0 do script; Yussef pode estar usando app)`)

  console.log(`\n━━ Resumo ━━`)
  console.log(`  Parcelas PAID criadas: ${totalCriadas}`)
  console.log(`  termMonths ajustados: ${totalTermAjustados}`)

  await prisma.$disconnect()
  console.log('\n━ FIM ━')
}
main().catch((e) => { console.error('🚨', e); process.exit(1) })
