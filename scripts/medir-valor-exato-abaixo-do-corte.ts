// ⭐ READ-ONLY — quantos pares de VALOR EXATO ficam invisíveis pelo corte de 70? (09/09)
//
// O caso do dono: `contabilidade R$ 1.621,00` (venc 04/09) tem a linha
// "I. V. S. LTDA - Pagamento" de 08/09 com o valor EXATO — e não é sugerida.
// Motivo: 50 (valor exato) + 5 (4-7 dias) + 0 (a conta não tem fornecedor) = 55 < 70.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { LINHA_DISPONIVEL_WHERE, fornecedoresDaEmpresa } from '@/lib/conciliacao/fila-de-conciliacao'
import { reconhecerFornecedor } from '@/lib/conciliacao/sugestao-de-vinculo'
import { scoreMatch } from '@/lib/conciliacao/match'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: Date) => d.toISOString().slice(0, 10)
const DIAS = 7

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)
  const fornecedores = await fornecedoresDaEmpresa(prisma, COMPANY)

  const contas = await prisma.transaction.findMany({
    where: {
      lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] }, status: 'PENDING', paymentDate: null,
      reconciledWithId: null, reconciledFrom: { none: {} },
      AND: [{ OR: [{ bankAccount: { companyId: COMPANY } }, { supplier: { companyId: COMPANY } }, { category: { companyId: COMPANY } }] }],
    },
    select: { id: true, description: true, amount: true, dueDate: true, date: true, type: true, supplierId: true },
  })
  const linhas = await prisma.transaction.findMany({
    where: { ...LINHA_DISPONIVEL_WHERE, bankAccount: { companyId: COMPANY }, date: { gte: new Date('2026-08-01') } },
    select: { id: true, description: true, amount: true, date: true, type: true, supplierId: true, bankAccountId: true },
  })

  let abaixo = 0, acima = 0
  const disputados = new Map<string, number>()
  const achados: string[] = []
  for (const c of contas) {
    const venc = c.dueDate ?? c.date
    for (const l of linhas) {
      if (l.type !== c.type) continue
      if (Math.abs(Math.abs(l.amount) - Math.abs(c.amount)) > 0.005) continue
      const dist = Math.round((l.date.getTime() - venc.getTime()) / 86400000)
      if (Math.abs(dist) > DIAS) continue
      const fid = l.supplierId ?? reconhecerFornecedor(l.description, fornecedores)?.id ?? null
      const s = scoreMatch(
        { id: l.id, description: l.description, amount: Math.abs(l.amount), type: l.type as 'DEBIT' | 'CREDIT', date: l.date, supplierId: fid, bankAccountId: l.bankAccountId ?? '' },
        { id: c.id, lifecycle: c.type === 'DEBIT' ? 'PAYABLE' : 'RECEIVABLE', description: c.description, amount: Math.abs(c.amount), dueDate: venc, supplierId: c.supplierId, customerId: null, categoryId: null },
      )
      if (!s) continue
      if (s.score >= 70) { acima++; continue }
      abaixo++
      disputados.set(c.id, (disputados.get(c.id) ?? 0) + 1)
      achados.push(`   ${dia(venc)} ${brl(Math.abs(c.amount)).padStart(12)} "${c.description.slice(0, 26).padEnd(26)}" → ${dia(l.date)} (${dist > 0 ? '+' : ''}${dist}d) "${l.description.slice(0, 40)}" score ${s.score}`)
    }
  }
  console.log(`\nvalor EXATO dentro de ±${DIAS} dias:`)
  console.log(`   já sugeridos hoje (score >= 70): ${acima}`)
  console.log(`   ⛔ INVISÍVEIS (score < 70):        ${abaixo}`)
  console.log(`   contas que ganhariam mais de uma opção: ${[...disputados.values()].filter((n) => n > 1).length}`)
  console.log(achados.join('\n'))
}

main().finally(() => prisma.$disconnect())
