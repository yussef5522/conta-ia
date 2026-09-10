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

  const emLote = new Map<string, string>()
  for (const l of f.lotes) for (const n of l.notas) emLote.set(n.id, l.fornecedorNome)
  const com11 = new Map(f.contas.filter((c) => c.sugestoes.length > 0).map((c) => [c.conta.id, c.sugestoes[0]]))

  // ⭐⭐ O ROTEIRO SE LÊ POR FORNECEDOR, não por nota: o Alan tem 3 notas vencidas e as
  // MESMAS 5 linhas no extrato — repetir isso 3× é ruído, não informação.
  type Nota = (typeof vencidas)[number]
  const porFornecedor = new Map<string, Nota[]>()
  for (const v of vencidas) {
    const k = v.supplierId ?? `(sem fornecedor) ${v.id}`
    porFornecedor.set(k, [...(porFornecedor.get(k) ?? []), v])
  }

  const A: string[] = [], B: string[] = [], C: string[] = []
  const JANELA = 12 * 86400000

  for (const [, notas] of porFornecedor) {
    const fid = notas[0].supplierId
    const nome = notas[0].supplier?.razaoSocial ?? '— lançada à mão, sem fornecedor'
    const soma = Math.round(notas.reduce((a, x) => a + Math.abs(x.amount), 0) * 100) / 100
    const lista = notas
      .map((n) => `        ${dia(n.dueDate)} ${brl(Math.abs(n.amount)).padStart(12)}  ${n.description.slice(0, 46)}`)
      .join('\n')
    const cab = `   ${nome.slice(0, 34).padEnd(34)} ${notas.length} nota(s) · ${brl(soma)}`

    // (a) — alguma nota deste fornecedor tem par/lote esperando clique
    const comPar = notas.filter((n) => emLote.has(n.id) || com11.has(n.id))
    if (comPar.length) {
      const det = comPar.map((n) => {
        const s = com11.get(n.id)
        return `        ⭐ ${brl(Math.abs(n.amount))} ${n.description.slice(0, 34)} → ${
          emLote.has(n.id) ? `LOTE do ${emLote.get(n.id)}` : `${brl(s!.extrato.valor)} de ${dia(s!.extrato.data)} · ${s!.porQue}`}`
      }).join('\n')
      A.push(`${cab}\n${det}`)
      if (comPar.length === notas.length) continue
    }

    const suas = fid ? linhas.filter((l) => donoDaLinha.get(l.id) === fid && l.type === 'DEBIT') : []
    if (suas.length) {
      // ⚠️ só as linhas na JANELA dos vencimentos entram na conta — pagamento de três
      // semanas atrás não é candidato a pagar a nota de ontem.
      const alvos = notas.map((n) => (n.dueDate ?? new Date()).getTime())
      const perto = suas.filter((l) => alvos.some((t) => Math.abs(l.date.getTime() - t) <= JANELA))
      const fora = suas.length - perto.length
      const ls = (perto.length ? perto : suas)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((l) => `        ${dia(l.date)} ${brl(Math.abs(l.amount)).padStart(12)}  ${l.bankAccount?.name?.trim()}`)
        .join('\n')
      const somaPerto = Math.round(perto.reduce((a, l) => a + Math.abs(l.amount), 0) * 100) / 100
      B.push(`${cab}\n${lista}\n     ↓ linha(s) do fornecedor no extrato${perto.length ? ` (na janela do vencimento${fora ? `; +${fora} fora da janela` : ''})` : ' (nenhuma na janela — as de fora)'}:\n${ls}\n     ⚠️ notas ${brl(soma)} × linha(s) ${brl(perto.length ? somaPerto : 0)} · diferença ${brl(Math.round((somaPerto - soma) * 100) / 100)}`)
      continue
    }

    const banco = bancoDe(fid)
    const conta = contasBancarias.find((x) => x.name.trim() === banco)
    C.push(`${cab}\n${lista}\n     ⛔ nenhuma linha deste fornecedor em extrato nenhum${
      banco ? ` · costuma ser pago pela ${banco.toUpperCase()} (extrato até ${dia(ultimoPorConta.get(conta?.id ?? '') ?? null)})` : ' · sem histórico de pagamento — não dá pra dizer o banco'}`)
  }

  const n = (l: string[]) => l.reduce((s, x) => s + (x.match(/\d{4}-\d{2}-\d{2}/g)?.length ?? 0), 0)
  console.log(`\n\n═══ (a) PAR/LOTE SUGERIDO — 1 clique · ${A.length} fornecedor(es) ═══`)
  console.log(A.join('\n\n') || '   (nenhum — a fila foi trabalhada)')
  console.log(`\n\n═══ (b) PAGAMENTO NO EXTRATO QUE NÃO FECHA · ${B.length} fornecedor(es) ═══`)
  console.log(B.join('\n\n') || '   (nenhum)')
  console.log(`\n\n═══ (c) NENHUMA LINHA DO FORNECEDOR EM EXTRATO NENHUM · ${C.length} ═══`)
  console.log(C.join('\n\n') || '   (nenhum)')
  console.log(`\n   VENCIDAS: ${vencidas.length} nota(s) · a=${A.length} b=${B.length} c=${C.length} fornecedores`)
  console.log(`   fila hoje: ${f.totais.lotes} lote(s) · ${f.totais.comSugestao} conta(s) com par 1:1`)
}

main().finally(() => prisma.$disconnect())
