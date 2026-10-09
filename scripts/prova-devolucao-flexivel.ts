/**
 * ⭐⭐⭐ A PROVA DA PORTA DE DEVOLUÇÃO, EM PROD, COM ROLLBACK FORÇADO (09/10/2026).
 *
 * ⚠️ `registrarDevolucao` abre a PRÓPRIA `$transaction` — então o rollback mora num `Proxy`
 * cujo `$transaction` devolve o MESMO `tx` (o padrão de 05/10). Sem isso o gesto commitaria
 * por dentro e a prova gravaria em prod.
 *
 * ⛔ E a contabilidade de escrita é parte da prova, não enfeite: foi ela que pegou a ordem
 * fantasma de ontem (531 → 532) quando nenhuma asserção minha pegou.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { previaDaDevolucao, registrarDevolucao, DevolucaoError } from '@/lib/loans/devolucao-flexivel'
import { resumoDoFlexivel } from '@/lib/loans/resumo-do-flexivel'
import { saldoDevedorAtual } from '@/lib/loans/saldo'
import { lerCompromissos } from '@/lib/custos-fixos/compromissos'
import { ehJanelaBancaria } from '@/lib/loans/janela-bancaria'
import type { PrismaClient } from '@prisma/client'

const CO = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const FLEX = 'cmshqt1hk0003cz0e11lhwwpv' // Arafat, principal 380.000
const COFRE = 'cmq2o25qe0001y2faydl1yrp5'
const HOJE = new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())}T12:00:00.000Z`)
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function estado(db: PrismaClient) {
  const [tx, v11, vn1, conta] = await Promise.all([
    db.transaction.count({ where: { bankAccountId: COFRE } }),
    db.loanInstallment.count({ where: { loanId: FLEX, reconciledTransactionId: { not: null } } }),
    db.loanInstallmentPayment.count({ where: { installment: { loanId: FLEX } } }),
    db.bankAccount.findUniqueOrThrow({ where: { id: COFRE }, select: { balance: true } }),
  ])
  return { tx, v11, vn1, saldoCofre: Math.round(conta.balance * 100) / 100 }
}

async function retrato(db: PrismaClient, rotulo: string) {
  const loan = await db.loan.findUniqueOrThrow({
    where: { id: FLEX },
    include: {
      installments: {
        orderBy: { number: 'asc' },
        include: {
          reconciledTransaction: { select: { amount: true, date: true } },
          payments: { select: { amount: true, transaction: { select: { date: true } } } },
        },
      },
    },
  })
  const saldo = saldoDevedorAtual(loan, loan.installments)
  const devolucoes = loan.installments.flatMap((i) => [
    ...(i.reconciledTransaction ? [{ data: i.reconciledTransaction.date, valor: i.reconciledTransaction.amount }] : []),
    ...i.payments.flatMap((p) => (p.transaction ? [{ data: p.transaction.date, valor: p.amount }] : [])),
  ])
  const r = resumoDoFlexivel(loan.principal, saldo, devolucoes)
  const amortizado = loan.installments.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.amortization, 0)
  console.log(`\n  ${rotulo}`)
  console.log(`    ${r.frase}`)
  console.log(`    histórico: ${r.devolucoes} linha(s) · Σ ${brl(r.totalDevolvido)} · saldo ${brl(saldo)}`)
  console.log(`    amortizado (parcelas PAID): ${brl(Math.round(amortizado * 100) / 100)}`)
  console.log(
    `    ⛔ GUARD Σ(histórico) == amortizado == principal − saldo: ${
      r.fecha && Math.abs(amortizado - r.totalDevolvido) <= 0.02 ? '⭐ FECHA' : '⛔ NÃO FECHA'
    }`,
  )
  return r
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)

  const antes = await estado(prisma)
  console.log('ESTADO ANTES:', JSON.stringify(antes))
  await retrato(prisma, 'O CONTRATO HOJE')

  // ═══ 1. A PRÉVIA do caso real, sem nada gravado ═══
  console.log('\n═══ 1. A PRÉVIA DE HOJE (40.000 pelo cofre) ═══')
  const p = await previaDaDevolucao(prisma, { companyId: CO, loanId: FLEX, valor: 40000, data: HOJE })
  console.log(`  ação: ${p.acao} · ${p.frase}`)
  console.log(`  referência: #${p.referencia.number} (vence ${p.referencia.dueDate.toISOString().slice(0, 10)}) — a próxima aberta por ordem`)
  console.log(`  descrição automática: "${p.descricao}"`)
  console.log(`  categoria: ${p.categoria?.nome ?? '⛔ nenhuma'} · pede categoria: ${p.pedeCategoria}`)
  console.log(`  candidatas no cofre (janela de 10 dias): ${p.candidatos.length}`)
  for (const c of p.candidatos) console.log(`    · ${c.data.toISOString().slice(0, 10)} ${brl(c.valor)} [${c.origem}] ${c.descricao}`)
  console.log(`  depois: ${p.depois.devolucoes}ª devolução · Σ ${brl(p.depois.totalDevolvido)} · saldo ${brl(p.depois.saldo)}`)

  // ═══ 2. O CICLO INTEIRO, com rollback forçado ═══
  console.log('\n═══ 2. O CICLO (ROLLBACK FORÇADO — nada fica gravado) ═══')
  try {
    await prisma.$transaction(
      async (tx) => {
        const db = new Proxy(tx as unknown as PrismaClient, {
          get(alvo, prop) {
            if (prop === '$transaction') return async (fn: (t: unknown) => unknown) => fn(tx)
            return (alvo as unknown as Record<string | symbol, unknown>)[prop]
          },
        }) as PrismaClient

        // (a) o dono lança a saída na mão, como ele faz
        const manual = await tx.transaction.create({
          data: {
            bankAccountId: COFRE, date: HOJE, description: 'arafat', amount: 40000,
            type: 'DEBIT', status: 'RECONCILED', origin: 'MANUAL',
          },
          select: { id: true },
        })
        console.log(`  (a) o dono lançou na mão: saída de ${brl(40000)} no cofre`)

        // (b) a prévia ACHA e propõe CASAR
        const pc = await previaDaDevolucao(db, { companyId: CO, loanId: FLEX, valor: 40000, data: HOJE })
        console.log(`  (b) a prévia achou ${pc.candidatos.length} candidata(s) · ação ${pc.acao === 'CRIAR' ? 'CRIAR (sem escolher)' : pc.acao}`)

        // (c) criar COM candidata e sem escape → RECUSADO
        let recusou = false
        try {
          await registrarDevolucao(db, { companyId: CO, loanId: FLEX, valor: 40000, data: HOJE })
        } catch (e) {
          recusou = e instanceof DevolucaoError && e.code === 'SAIDA_JA_EXISTE'
          console.log(`  (c) criar outra saída → ${recusou ? '⭐ RECUSADO' : '⛔ passou'}: ${(e as Error).message.slice(0, 120)}…`)
        }
        const txDepoisDaRecusa = await tx.transaction.count({ where: { bankAccountId: COFRE } })

        // (d) CASAR com a manual
        const g = await registrarDevolucao(db, {
          companyId: CO, loanId: FLEX, valor: 40000, data: HOJE, casarComTransactionId: manual.id,
        })
        console.log(`  (d) CASOU: criou saída? ${g.criouSaida ? '⛔ SIM' : '⭐ NÃO'} · referência #${g.referencia} · ${brl(g.valor)}`)
        const txDepoisDoCasar = await tx.transaction.count({ where: { bankAccountId: COFRE } })
        console.log(`      saídas no cofre: antes da recusa ${txDepoisDaRecusa} · depois de casar ${txDepoisDoCasar} → ${txDepoisDaRecusa === txDepoisDoCasar ? '⭐ NENHUMA saída nova' : '⛔ duplicou'}`)

        await retrato(db, 'O CONTRATO DEPOIS (o estado que o dono vai ver)')

        // (e) o mês de outubro pelo CAIXA do mês
        const c = await lerCompromissos(CO, HOJE.toISOString().slice(0, 7), new Date(), db)
        const ara = c.parcelas.find((x) => /arafat/i.test(x.contrato))
        console.log('\n  (e) O SELO DO MÊS (a lei de 07/10 — o caixa do mês, não o vínculo):')
        console.log(`      ${ara?.contrato} · referência #${ara?.numero} · ${brl(ara?.valor ?? 0)}`)
        console.log(`      selo: "${ara?.selo}"`)
        console.log(`      estado: ${ara?.estado} ${ara?.estado === 'A_VENCER' ? '⭐ (flexível NUNCA atrasa)' : '⛔'}`)

        throw new Error('ROLLBACK')
      },
      { timeout: 60_000 },
    )
  } catch (e) {
    if ((e as Error).message !== 'ROLLBACK') throw e
  }

  // ═══ 3. A TRAVA DA JANELA BANCÁRIA ═══
  console.log('\n═══ 3. A JANELA BANCÁRIA — fechada no flexível, VIVA no bancário ═══')
  const contratos = await prisma.loan.findMany({
    where: { companyId: CO },
    select: { id: true, lender: true, contractNumber: true, scheduleSource: true },
    orderBy: { lender: 'asc' },
  })
  for (const c of contratos) {
    const nome = `${c.lender}${c.contractNumber ? ` ${c.contractNumber}` : ''}`.slice(0, 44).padEnd(44)
    console.log(`  ${nome} ${c.scheduleSource?.padEnd(9)} janela bancária: ${ehJanelaBancaria(c.scheduleSource) ? '⭐ VIVA' : '⛔ FECHADA'}`)
  }

  // ═══ 4. ESTADO DEPOIS ═══
  const depois = await estado(prisma)
  console.log('\nESTADO DEPOIS:', JSON.stringify(depois))
  const igual = JSON.stringify(antes) === JSON.stringify(depois)
  console.log(igual ? '⭐ ZERO ESCRITA — o rollback valeu' : '⛔ ALGO FOI GRAVADO')
  await prisma.$disconnect()
  if (!igual) process.exit(1)
}

main().catch((e) => {
  console.error('[prova] erro:', e instanceof Error ? e.message : e)
  process.exit(1)
})
