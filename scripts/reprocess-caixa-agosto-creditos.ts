// Reprocess CIRÚRGICO da fatura Caixa de agosto/2026 (FASE 4, 18/08).
//
// O Vision leu os 15 DÉBITOS certos (Σ 7.292,97) mas PERDEU os 3 CRÉDITOS (sufixo C
// no PDF, 12,58) → K1 do juiz vermelho (net das linhas 7.292,97 ≠ metadata 7.280,39).
// O parser determinístico Caixa (golden ao centavo) prova que faltam EXATAMENTE:
//   28/07 CASHBACK ANUIDADE GASTOS ADIC   12,50 C
//   29/06 AJUSTE CRED PARC S/ JUROS        0,04 C
//   27/07 AJUSTE CREDITO PARC. LOJISTAA    0,04 C
// Adiciona esses 3 como CREDIT (reduz a despesa, NÃO é receita) → net 7.280,39 → K1 verde.
// NÃO mexe nos 15 débitos (já certos) nem no pagamento (a fatura segue OPEN até o
// débito chegar no extrato — correto). Idempotente por contentHash (rodar 2× = 0 nova).
//
// USO:  npx tsx scripts/reprocess-caixa-agosto-creditos.ts            (DRY-RUN, só mostra)
//       npx tsx scripts/reprocess-caixa-agosto-creditos.ts --apply    (grava)
//       ... --category=<categoryId>   (opcional; default null = sem categoria, reduz o net)

import { PrismaClient } from '@prisma/client'
import { computeIdentity } from '../lib/import-identity/compute-identity'
import { faturaNetTotal } from '../lib/credit-card-pj/fatura-net-total'

const prisma = new PrismaClient()

const CACULA_COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo' // REGRA 8: por ID, nunca por nome
const INVOICE_MONTH = '2026-08'
const APPLY = process.argv.includes('--apply')
const categoryArg = process.argv.find((a) => a.startsWith('--category='))
const CATEGORY_ID: string | null = categoryArg ? categoryArg.split('=')[1] : null

// Os 3 créditos que o Vision perdeu — EXATOS como o parser determinístico produz
// (date+desc+amount fixam o contentHash → idempotência e paridade com re-import futuro).
const CREDITOS = [
  { date: '2026-07-28', description: 'CASHBACK ANUIDADE GASTOS ADIC', amount: 12.5 },
  { date: '2026-06-29', description: 'AJUSTE CRED PARC S/ JUROS', amount: 0.04 },
  { date: '2026-07-27', description: 'AJUSTE CREDITO PARC. LOJISTAA', amount: 0.04 },
]

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  console.log(`\n=== REPROCESS CAIXA AGOSTO — ${APPLY ? '🔴 APPLY (grava)' : '🟡 DRY-RUN (só mostra)'} ===\n`)

  // 1. Resolver o cartão Caixa da caçula por ID de empresa (REGRA 8).
  const allCards = await prisma.businessCreditCard.findMany({
    where: { companyId: CACULA_COMPANY_ID },
    select: { id: true, name: true, bankName: true, companyId: true, lastInvoiceMonth: true, lastInvoiceTotalToPay: true },
  })
  const cards = allCards.filter((c) => /caixa/i.test(c.bankName ?? ''))
  if (cards.length !== 1) {
    console.error(`❌ Esperava 1 cartão Caixa na caçula, achei ${cards.length}. Abortando (não adivinha).`)
    cards.forEach((c) => console.error(`   - ${c.id} · ${c.name} · ${c.bankName}`))
    process.exit(1)
  }
  const card = cards[0]
  console.log(`Empresa: ${card.companyId}`)
  console.log(`Cartão:  ${card.id} · ${card.name} · banco "${card.bankName}"`)
  console.log(`Metadata: lastInvoiceMonth=${card.lastInvoiceMonth} · lastInvoiceTotalToPay=${card.lastInvoiceTotalToPay != null ? brl(card.lastInvoiceTotalToPay) : 'null'}\n`)

  // 2. Estado atual da fatura de agosto.
  const existentes = await prisma.transaction.findMany({
    where: { businessCreditCardId: card.id, invoiceMonth: INVOICE_MONTH, isCardPayment: false },
    select: { id: true, date: true, description: true, amount: true, type: true, contentHash: true, categoryId: true },
    orderBy: { date: 'asc' },
  })
  const netAntes = faturaNetTotal(existentes.map((t) => ({ type: t.type, amount: t.amount, isCardPayment: false }))).net
  const debitos = existentes.filter((t) => t.type !== 'CREDIT')
  const creditosExistentes = existentes.filter((t) => t.type === 'CREDIT')
  console.log(`Fatura ${INVOICE_MONTH} HOJE: ${existentes.length} linhas (${debitos.length} débito · ${creditosExistentes.length} crédito)`)
  console.log(`  net atual = ${brl(netAntes)}  ${Math.abs(netAntes - (card.lastInvoiceTotalToPay ?? 0)) > 0.02 ? `⚠️ ≠ metadata (${brl(card.lastInvoiceTotalToPay ?? 0)}) → K1 VERMELHO por ${brl(netAntes - (card.lastInvoiceTotalToPay ?? 0))}` : '✅ bate a metadata'}\n`)

  // 3. Créditos a inserir (idempotente por contentHash).
  console.log(`Créditos a inserir (o que o Vision perdeu):`)
  const aInserir: { data: any; label: string }[] = []
  for (const c of CREDITOS) {
    const identity = computeIdentity({ accountId: `card:${card.id}`, fitid: null, date: c.date, amount: c.amount, type: 'CREDIT', memo: c.description })
    const jaExiste = existentes.some((t) => t.contentHash === identity.contentHash)
    const label = `  ${c.date}  ${c.description.padEnd(32)} ${brl(c.amount).padStart(12)} C  hash=${identity.contentHash.slice(0, 10)}`
    if (jaExiste) {
      console.log(`${label}  ⏭️  JÁ EXISTE (pula)`)
      continue
    }
    console.log(`${label}  ➕ NOVA`)
    aInserir.push({
      label,
      data: {
        bankAccountId: null,
        businessCreditCardId: card.id,
        categoryId: CATEGORY_ID,
        date: new Date(c.date),
        description: c.description,
        amount: c.amount, // sempre positivo — o sinal vem do type
        type: 'CREDIT', // estorno/crédito → reduz a despesa, NUNCA receita
        status: 'RECONCILED',
        origin: 'CREDIT_CARD_PDF',
        externalId: null,
        dedupHash: null,
        contentHash: identity.contentHash,
        isCardPayment: false,
        invoiceMonth: INVOICE_MONTH,
      },
    })
  }

  const netDepois = Math.round((netAntes - aInserir.reduce((s, x) => s + x.data.amount, 0) + 1e-9) * 100) / 100
  console.log(`\nnet DEPOIS = ${brl(netDepois)}  (alvo 7.280,39 = metadata → K1 verde)`)
  console.log(`categoria dos créditos: ${CATEGORY_ID ?? 'null (sem categoria — reduz o net, nunca entra como receita)'}\n`)

  if (aInserir.length === 0) {
    console.log('✅ Nada a inserir (já reprocessado). Idempotente.')
    await prisma.$disconnect()
    return
  }

  if (!APPLY) {
    console.log(`🟡 DRY-RUN — nada gravado. Rode com --apply pra gravar as ${aInserir.length} linhas.`)
    await prisma.$disconnect()
    return
  }

  await prisma.transaction.createMany({ data: aInserir.map((x) => x.data) })
  // prova pós-write
  const depois = await prisma.transaction.findMany({
    where: { businessCreditCardId: card.id, invoiceMonth: INVOICE_MONTH, isCardPayment: false },
    select: { type: true, amount: true },
  })
  const netProva = faturaNetTotal(depois.map((t) => ({ type: t.type, amount: t.amount, isCardPayment: false }))).net
  const pagamentos = await prisma.transaction.count({ where: { businessCreditCardId: card.id, isCardPayment: true, paidInvoiceMonth: INVOICE_MONTH } })
  console.log(`\n✅ GRAVADO ${aInserir.length} créditos.`)
  console.log(`   net agora = ${brl(netProva)}  ${Math.abs(netProva - 7280.39) <= 0.02 ? '✅ = 7.280,39 (K1 deve ficar verde)' : '❌ NÃO fechou — investigar'}`)
  console.log(`   pagamentos vinculados a ${INVOICE_MONTH}: ${pagamentos} (fatura segue ${pagamentos === 0 ? 'OPEN — correto, o débito ainda não chegou' : 'PAID'})`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('erro fatal:', (e as Error).message)
  process.exit(1)
})
