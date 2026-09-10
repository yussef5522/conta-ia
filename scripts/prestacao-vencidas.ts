// ⭐ READ-ONLY — as contas VENCIDAS, uma a uma, em três grupos (10/09/2026).
//
// **O dono:** *"pra CADA conta vencida em aberto, me diz em qual grupo ela está AGORA:
// (a) par/lote sugerido esperando clique · (b) pagamento no extrato que NÃO fecha (com a
// linha e a diferença) · (c) nenhuma linha do fornecedor em nenhum extrato importado
// (esperando o OFX de qual banco). Tabela completa — é meu roteiro de amanhã."*
//
// ⛔ E o "de qual banco" é MEDIDO, não chutado: sai de por onde aquele fornecedor foi pago
// no passado (as linhas já conciliadas dele), não de um palpite sobre a Stone.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { filaDeConciliacao, LINHA_DISPONIVEL_WHERE, fornecedoresDaEmpresa } from '@/lib/conciliacao/fila-de-conciliacao'
import { reconhecerFornecedor } from '@/lib/conciliacao/sugestao-de-vinculo'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—')

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const agora = new Date()

  // ── até quando cada conta tem extrato? é isso que separa "falta arquivo" de "lacuna" ──
  const contasBancarias = await prisma.bankAccount.findMany({
    where: { companyId: CO, isActive: true },
    select: { id: true, name: true },
  })
  const ultimoPorConta = new Map<string, Date | null>()
  for (const c of contasBancarias) {
    const u = await prisma.transaction.findFirst({
      where: { bankAccountId: c.id, origin: 'OFX' },
      orderBy: { date: 'desc' }, select: { date: true },
    })
    ultimoPorConta.set(c.id, u?.date ?? null)
  }
  console.log('\n=== ATÉ QUANDO CADA CONTA TEM EXTRATO ===')
  for (const c of contasBancarias) {
    console.log(`   ${c.name.trim().padEnd(18)} ${dia(ultimoPorConta.get(c.id) ?? null)}`)
  }

  const f = await filaDeConciliacao(CO, prisma, agora)
  const fornecedores = await fornecedoresDaEmpresa(prisma, CO)

  const vencidas = await prisma.transaction.findMany({
    where: {
      lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] }, status: 'PENDING', paymentDate: null,
      reconciledWithId: null, reconciledFrom: { none: {} },
      dueDate: { lt: agora },
      AND: [{ OR: [{ bankAccount: { companyId: CO } }, { supplier: { companyId: CO } }, { category: { companyId: CO } }] }],
    },
    select: {
      id: true, description: true, amount: true, dueDate: true, supplierId: true,
      supplier: { select: { razaoSocial: true } },
    },
    orderBy: { dueDate: 'asc' },
  })

  // ── todas as linhas disponíveis, com o fornecedor resolvido ──
  const linhas = await prisma.transaction.findMany({
    where: { ...LINHA_DISPONIVEL_WHERE, bankAccount: { companyId: CO }, date: { gte: new Date('2026-08-01') } },
    select: {
      id: true, description: true, amount: true, date: true, type: true, supplierId: true,
      bankAccountId: true, bankAccount: { select: { name: true } },
    },
  })
  const donoDaLinha = new Map<string, string | null>()
  for (const l of linhas) {
    donoDaLinha.set(l.id, l.supplierId ?? reconhecerFornecedor(l.description, fornecedores)?.id ?? null)
  }

  // ── por onde ESTE fornecedor já foi pago antes? (a resposta do "qual banco") ──
  const pagasAntes = await prisma.transaction.findMany({
    where: {
      supplierId: { not: null }, lifecycle: 'EFFECTED',
      bankAccountId: { not: null },
      OR: [{ supplier: { companyId: CO } }, { bankAccount: { companyId: CO } }],
    },
    select: { supplierId: true, bankAccount: { select: { name: true } } },
  })
  const contaHabitual = new Map<string, Map<string, number>>()
  for (const p of pagasAntes) {
    if (!p.supplierId || !p.bankAccount) continue
    const m = contaHabitual.get(p.supplierId) ?? new Map()
    const n = p.bankAccount.name.trim()
    m.set(n, (m.get(n) ?? 0) + 1)
    contaHabitual.set(p.supplierId, m)
  }
  const bancoDe = (fid: string | null) => {
    if (!fid) return null
    const m = contaHabitual.get(fid)
    if (!m) return null
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  const emLote = new Map<string, string>()
  for (const l of f.lotes) for (const n of l.notas) emLote.set(n.id, l.fornecedorNome)
  const com11 = new Map(f.contas.filter((c) => c.sugestoes.length > 0).map((c) => [c.conta.id, c.sugestoes[0]]))

  const A: string[] = [], B: string[] = [], C: string[] = []
  for (const v of vencidas) {
    const valor = Math.abs(v.amount)
    const nome = v.supplier?.razaoSocial ?? '— sem fornecedor'
    const cab = `${dia(v.dueDate)} ${brl(valor).padStart(12)} ${nome.slice(0, 30).padEnd(30)} ${v.description.slice(0, 34)}`

    if (emLote.has(v.id)) { A.push(`   ⭐ LOTE  ${cab}\n            → ${emLote.get(v.id)}`); continue }
    const s = com11.get(v.id)
    if (s) { A.push(`   ⭐ 1:1   ${cab}\n            → ${brl(s.extrato.valor)} de ${dia(s.extrato.data)} · ${s.porQue}`); continue }

    // (b) o fornecedor TEM linha no extrato, mas nada fecha
    const suas = v.supplierId ? linhas.filter((l) => donoDaLinha.get(l.id) === v.supplierId && l.type === 'DEBIT') : []
    if (suas.length) {
      const abertas = vencidas.filter((x) => x.supplierId === v.supplierId)
      const somaAbertas = Math.round(abertas.reduce((a, x) => a + Math.abs(x.amount), 0) * 100) / 100
      const ls = suas.map((l) => `${dia(l.date)} ${brl(Math.abs(l.amount))} (${l.bankAccount?.name?.trim()})`).join(' · ')
      const maior = suas.map((l) => Math.abs(l.amount)).sort((a, b) => b - a)[0]
      B.push(`   ⚠️       ${cab}\n            linha(s): ${ls}\n            ${abertas.length} nota(s) vencida(s) somam ${brl(somaAbertas)} · diferença pra maior linha: ${brl(Math.round((maior - somaAbertas) * 100) / 100)}`)
      continue
    }

    const banco = bancoDe(v.supplierId)
    C.push(`   ⛔       ${cab}\n            nenhuma linha deste fornecedor em extrato nenhum${banco ? ` · costuma ser pago pela ${banco} (extrato até ${dia(ultimoPorConta.get(contasBancarias.find((x) => x.name.trim() === banco)?.id ?? '') ?? null)})` : ' · sem histórico de pagamento pra dizer o banco'}`)
  }

  console.log(`\n\n═══ (a) PAR/LOTE SUGERIDO — 1 clique: ${A.length} ═══`)
  console.log(A.join('\n') || '   (nenhuma)')
  console.log(`\n═══ (b) PAGAMENTO NO EXTRATO QUE NÃO FECHA: ${B.length} ═══`)
  console.log(B.join('\n') || '   (nenhuma)')
  console.log(`\n═══ (c) NENHUMA LINHA DO FORNECEDOR EM EXTRATO NENHUM: ${C.length} ═══`)
  console.log(C.join('\n') || '   (nenhuma)')
  console.log(`\n   TOTAL DE VENCIDAS: ${vencidas.length}  ·  a=${A.length}  b=${B.length}  c=${C.length}`)
}

main().finally(() => prisma.$disconnect())
