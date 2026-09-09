// ⭐ READ-ONLY — as 31 vencidas, uma a uma: quem a fila resolve agora e quem NÃO (09/09).

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { filaDeConciliacao } from '@/lib/conciliacao/fila-de-conciliacao'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: Date | string) => new Date(d).toISOString().slice(0, 10)

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const f = await filaDeConciliacao(CO, prisma)

  const vencidas = await prisma.transaction.findMany({
    where: {
      lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] }, status: 'PENDING', paymentDate: null,
      reconciledWithId: null, reconciledFrom: { none: {} },
      dueDate: { lt: new Date() },
      AND: [{ OR: [{ bankAccount: { companyId: CO } }, { supplier: { companyId: CO } }, { category: { companyId: CO } }] }],
    },
    select: { id: true, description: true, amount: true, dueDate: true, supplierId: true, supplier: { select: { razaoSocial: true } } },
    orderBy: { dueDate: 'asc' },
  })

  const emLote = new Map<string, string>()
  for (const l of f.lotes) for (const n of l.notas) emLote.set(n.id, l.fornecedorNome)
  const com11 = new Set(f.contas.filter((c) => c.sugestoes.length > 0).map((c) => c.conta.id))
  const fornNaoFecha = new Set(f.lotesQueNaoFecham.map((x) => x.fornecedorId))

  const baldes = { lote: 0, um: 0, naoFecha: 0, semPagamento: 0 }
  console.log(`\n=== ${vencidas.length} CONTAS VENCIDAS ===`)
  for (const v of vencidas) {
    let estado: string
    if (emLote.has(v.id)) { estado = '⭐ LOTE — 1 clique'; baldes.lote++ }
    else if (com11.has(v.id)) { estado = '⭐ 1:1 — 1 clique'; baldes.um++ }
    else if (v.supplierId && fornNaoFecha.has(v.supplierId)) { estado = '⚠️ pagamento existe e não fecha — escolher na mão'; baldes.naoFecha++ }
    else { estado = '⛔ nenhum pagamento no extrato importado'; baldes.semPagamento++ }
    console.log(`   ${dia(v.dueDate!)} ${brl(Math.abs(v.amount)).padStart(12)} ${(v.supplier?.razaoSocial ?? '— sem fornecedor').slice(0, 30).padEnd(30)} ${estado}`)
  }
  console.log(`\n   ⭐ resolvidas em 1 clique: ${baldes.lote + baldes.um} (lote ${baldes.lote} · 1:1 ${baldes.um})`)
  console.log(`   ⚠️ pagamento no extrato mas soma não fecha: ${baldes.naoFecha}`)
  console.log(`   ⛔ sem pagamento no extrato importado: ${baldes.semPagamento}`)
}

main().finally(() => prisma.$disconnect())
