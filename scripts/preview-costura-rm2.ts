// ⛔⛔ PREVIEW — READ-ONLY. NÃO GRAVA NADA. (04/09/2026)
//
// A duplicata da RM2 nasceu do seletor que escondia 63 dos 85 fornecedores (o bug corrigido
// hoje). Antes de costurar, o dono precisa ver **a transação que está pendurada na "rm2"**
// pra confirmar que é a mesma empresa — ele deixou a escolha em aberto ("NÃO SEI — me mostra
// a transação da 'rm2' antes").
//
// ⚠️ FUSÃO ERRADA DE FORNECEDOR É PIOR QUE DUPLICATA VISÍVEL: a duplicata se resolve depois;
// a fusão errada manda dívida pro CNPJ errado e ninguém percebe. Por isso este script
// mostra e para.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { normalizarBusca } from '@/lib/busca-texto'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix — REGRA 8: por ID, nunca por nome
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  const [doFinanceiro, doEstoque] = await Promise.all([
    prisma.supplier.findMany({
      where: { companyId: COMPANY },
      select: { id: true, razaoSocial: true, cnpj: true, fonte: true, createdAt: true },
    }),
    prisma.stockSupplier.findMany({
      where: { companyId: COMPANY },
      select: { id: true, razaoSocial: true, cnpj: true, criadoVia: true },
    }),
  ])

  const ehRm2 = (nome: string) => normalizarBusca(nome).includes('rm2')
  const finRm2 = doFinanceiro.filter((f) => ehRm2(f.razaoSocial))
  const stkRm2 = doEstoque.filter((f) => ehRm2(f.razaoSocial))

  console.log(`\n=== FORNECEDORES "RM2" — o que existe hoje ===`)
  console.log(`financeiro (Supplier): ${doFinanceiro.length} no total · ${finRm2.length} com "rm2"`)
  console.log(`estoque (stock_supplier): ${doEstoque.length} no total · ${stkRm2.length} com "rm2"\n`)

  for (const f of finRm2) {
    const [txs, notas] = await Promise.all([
      prisma.transaction.findMany({
        where: { supplierId: f.id },
        select: {
          id: true, date: true, amount: true, type: true, description: true,
          lifecycle: true, status: true, dueDate: true, paymentDate: true, origin: true,
          category: { select: { name: true } },
          bankAccount: { select: { name: true } },
        },
        orderBy: { date: 'asc' },
      }),
      // conta a pagar criada pela ponte do estoque aponta a nota de origem
      prisma.stockPayableLink.count({ where: { companyId: COMPANY } }),
    ])
    void notas

    console.log(`--- [FINANCEIRO] ${f.razaoSocial}`)
    console.log(`    id=${f.id} · cnpj=${f.cnpj ?? '—'} · fonte=${f.fonte ?? '—'} · criado=${f.createdAt.toISOString().slice(0, 10)}`)
    console.log(`    transações penduradas: ${txs.length}`)
    for (const t of txs) {
      console.log(
        `      · ${t.date.toISOString().slice(0, 10)} · ${t.type} · ${brl(t.amount)} · ${t.lifecycle}/${t.status}` +
        `\n        "${t.description}"` +
        `\n        conta=${t.bankAccount?.name ?? '—'} · categoria=${t.category?.name ?? '— (sem categoria)'}` +
        ` · vencimento=${t.dueDate?.toISOString().slice(0, 10) ?? '—'} · pago=${t.paymentDate?.toISOString().slice(0, 10) ?? '—'}` +
        ` · origem=${t.origin ?? '—'} · tx=${t.id}`,
      )
    }
    console.log('')
  }

  for (const s of stkRm2) {
    // ⚠️ o mapa de produto é chaveado por CNPJ (não pelo id) — sem CNPJ, 0 por construção
    const [mapas, entradas] = await Promise.all([
      s.cnpj ? prisma.stockSupplierProduct.count({ where: { companyId: COMPANY, supplierCnpj: s.cnpj } }) : Promise.resolve(0),
      prisma.stockEntradaManual.count({ where: { companyId: COMPANY, supplierId: s.id } }),
    ])
    console.log(`--- [ESTOQUE] ${s.razaoSocial}`)
    console.log(`    id=${s.id} · cnpj=${s.cnpj ?? '—'} · criadoVia=${s.criadoVia ?? '—'}`)
    console.log(`    mapas de produto: ${mapas} · entradas manuais: ${entradas}\n`)
  }

  console.log('=== O QUE A COSTURA FARIA (nada foi gravado) ===')
  if (finRm2.length === 2) {
    const [a, b] = finRm2.sort((x, y) => +x.createdAt - +y.createdAt)
    console.log(`  · manter "${a.razaoSocial}" (${a.id}) — o cadastro mais antigo, feito à mão`)
    console.log(`  · mover a(s) transação(ões) de "${b.razaoSocial}" (${b.id}) pra ele`)
    console.log(`  · desativar/remover "${b.razaoSocial}" só depois de a última transação sair`)
  }
  console.log('\n⛔ NADA FOI GRAVADO. A confirmação de que são a mesma empresa é do dono.\n')
}

main().finally(() => prisma.$disconnect())
