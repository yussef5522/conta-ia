// ⭐⭐ A COSTURA PAYABLE × EXTRATO (05/09/2026) — Fase 4, autorizada pelo dono.
//
// ⛔ O QUE ESTAVA ERRADO: o dono marcou 8 boletos como pagos e o extrato trouxe as MESMAS
// saídas. Como a conta a pagar **já é uma `Transaction`**, ficaram DUAS linhas pelo mesmo
// dinheiro. Medido: as **6 não conciliadas somam R$ 20.999,25 — exatamente** a diferença
// entre o `balance` gravado da Stone (−20.230,09) e o que o banco declara (769,16).
//
// ⭐⭐ E O MECANISMO ANTIDUPLA JÁ EXISTIA: **conciliada sai do saldo e do fluxo**. Foi medido
// nas 2 que o dono já tinha conciliado na mão — elas ficam FORA do cálculo. Ou seja: não
// precisa lifecycle novo nem tabela nova; precisa **conciliar**.
//
// ⭐ A LINHA DO BANCO FICA COMO A EFETIVA (decisão do dono): é a que bate com o extrato e a
// que ele já categorizou. A payable liquida **vinculada a ela**.
//
// ⛔ SEM `--apply` NÃO GRAVA.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo'   // Caçula Mix — REGRA 8
const APLICAR = process.argv.includes('--apply')
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Os pares, aprovados um a um pelo dono. ⚠️ `juros` só nos que ele mandou incluir —
 * valor diferente **nunca** casa sozinho.
 *
 * ⛔ O CANCIAN (230,81 × 232,81) FICOU DE FORA: pago 5 dias ANTES do vencimento e ainda com
 * acréscimo — não é juros, e já houve confusão entre duas notas dele em 30/08. O dono vai
 * olhar o comprovante. **Não se costura o que não se entende.**
 */
const PARES: { rotulo: string; payable: number; banco: number; dataBanco: string; juros?: number }[] = [
  { rotulo: 'Frigorífico Silva',  payable: 6006.45, banco: 6006.45, dataBanco: '2026-08-27' },
  { rotulo: 'Dalmolin & Vanzin',  payable: 2537.29, banco: 2537.29, dataBanco: '2026-08-31' },
  { rotulo: 'SPAL Bebidas',       payable: 4138.27, banco: 4138.27, dataBanco: '2026-08-31' },
  { rotulo: 'Frigorífico Silva',  payable: 6006.44, banco: 6024.46, dataBanco: '2026-09-04', juros: 18.02 },
  { rotulo: 'Casper Distrib.',    payable: 2079.99, banco: 2086.85, dataBanco: '2026-09-04', juros: 6.86 },
]

const cent = (a: number, b: number) => Math.abs(a - b) < 0.005

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  const exPayables = await prisma.transaction.findMany({
    where: { lifecycle: 'EFFECTED', origin: 'ESTOQUE_NF', reconciledWithId: null, supplier: { companyId: COMPANY } },
    select: { id: true, amount: true, date: true, description: true, notes: true, bankAccountId: true },
  })
  const doBanco = await prisma.transaction.findMany({
    where: { bankAccount: { companyId: COMPANY }, lifecycle: 'EFFECTED', type: 'DEBIT', origin: { not: 'ESTOQUE_NF' }, date: { gte: new Date('2026-08-25') } },
    select: { id: true, amount: true, date: true, description: true, categoryId: true, reconciledWithId: true },
  })
  const cats = await prisma.category.findMany({ where: { companyId: COMPANY }, select: { id: true, name: true } })
  const nomeCat = new Map(cats.map((c) => [c.id, c.name]))

  console.log(`\n=== COSTURA PAYABLE × EXTRATO — ${APLICAR ? 'APLICANDO' : 'PREVIEW'} ===\n`)
  const plano: { pay: typeof exPayables[number]; bank: typeof doBanco[number]; juros: number; rotulo: string }[] = []

  for (const p of PARES) {
    const pay = exPayables.filter((x) => cent(x.amount, p.payable))
    const bank = doBanco.filter((x) => cent(x.amount, p.banco) && x.date.toISOString().slice(0, 10) === p.dataBanco)
    // ⛔ ambiguidade ABORTA: dois candidatos do mesmo lado é palpite, e palpite aqui
    // amarra dinheiro na conta errada
    if (pay.length !== 1 || bank.length !== 1) {
      console.log(`  ⛔ ${p.rotulo} ${brl(p.payable)}: ${pay.length} payable(s) e ${bank.length} linha(s) do banco — AMBÍGUO, fora da costura.`)
      continue
    }
    if (bank[0].reconciledWithId) {
      console.log(`  ⏭  ${p.rotulo} ${brl(p.payable)}: a linha do banco já está conciliada — pulo.`)
      continue
    }
    plano.push({ pay: pay[0], bank: bank[0], juros: p.juros ?? 0, rotulo: p.rotulo })
    console.log(`  ${p.rotulo}`)
    console.log(`     payable  ${brl(pay[0].amount).padStart(12)} · ${pay[0].date.toISOString().slice(0, 10)} · "${pay[0].description.slice(0, 38)}"`)
    console.log(`     banco    ${brl(bank[0].amount).padStart(12)} · ${bank[0].date.toISOString().slice(0, 10)} · categoria ${nomeCat.get(bank[0].categoryId ?? '') ?? '—'}`)
    if (p.juros) console.log(`     ⚠️ delta ${brl(p.juros)} — juros/tarifa de boleto (decisão do dono)`)
  }

  const soma = plano.reduce((s, x) => s + x.pay.amount, 0)
  console.log(`\n  ${plano.length} par(es) · ${brl(soma)} saem da dupla contagem`)

  // ⭐ o efeito no saldo, ANTES de gravar
  const contas = [...new Set(plano.map((x) => x.pay.bankAccountId).filter((x): x is string => !!x))]
  for (const cid of contas) {
    const c = await prisma.bankAccount.findUniqueOrThrow({ where: { id: cid }, select: { name: true, balance: true, ledgerBal: true } })
    const daConta = plano.filter((x) => x.pay.bankAccountId === cid).reduce((s, x) => s + x.pay.amount, 0)
    console.log(`\n  ${c.name.trim()}: saldo ${brl(c.balance)} → ${brl(c.balance + daConta)} (o banco declara ${brl(c.ledgerBal ?? 0)})`)
  }

  if (!APLICAR) { console.log('\n⛔ NADA FOI GRAVADO. Rode com --apply.\n'); return }

  await prisma.$transaction(async (tx) => {
    for (const x of plano) {
      // ⭐ a payable liquida VINCULADA à linha do banco — é o vínculo que a tira do saldo e
      // do fluxo. ⚠️ Nada de apagar: o rastro da conta a pagar (nota, fornecedor, parcela)
      // continua existindo e agora aponta pro pagamento real.
      const rastro = `pagamento conciliado com a linha do extrato de ${x.bank.date.toISOString().slice(0, 10)} (${brl(x.bank.amount)})`
        + (x.juros ? ` · diferença de ${brl(x.juros)} = juros/tarifa de boleto, dentro da linha do banco` : '')
      await tx.transaction.update({
        where: { id: x.pay.id },
        data: {
          reconciledWithId: x.bank.id,
          notes: [x.pay.notes, rastro].filter(Boolean).join(' · '),
        },
      })
    }
  })

  // ⭐ recalcula o saldo das contas tocadas — o número tem que caminhar pro declarado
  const { recalcularSaldoConta } = await import('@/lib/balance/recalcular')
  for (const cid of contas) {
    const r = await recalcularSaldoConta(prisma, cid)
    const c = await prisma.bankAccount.findUniqueOrThrow({ where: { id: cid }, select: { name: true, ledgerBal: true } })
    console.log(`\n✓ ${c.name.trim()}: saldo agora ${brl(r.saldoDepois)} · o banco declara ${brl(c.ledgerBal ?? 0)}`)
  }
  console.log(`\n✓ ${plano.length} conta(s) a pagar liquidada(s) vinculada(s) — uma linha só por pagamento.\n`)
}

main().finally(() => prisma.$disconnect())
