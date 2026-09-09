// ⭐ READ-ONLY — 1 PIX paga N notas? (09/09/2026)
//
// **O dono:** *"~30 contas VENCIDAS não apareceram na conciliação, e os pagamentos EXISTEM
// no extrato. O padrão: fornecedor pequeno com VÁRIAS notinhas — eu pago JUNTO, num PIX só."*
//
// ⛔⛔ A 1ª RODADA DESTE SCRIPT PROVOU O RISCO ANTES DE EU CODAR A FEATURE: subset-sum SEM
// trava de nome é caça-níquel. Com 6 notinhas pequenas, quase qualquer alvo é alcançável —
// ele "casou" a ODISSEA com uma linha *"YUSSEF ABU ZAHRY MUSA · Distribuição de Lucros"* de
// R$ 500,00. Por isso a régua abaixo exige que a LINHA NOMEIE O FORNECEDOR (a mesma
// `reconhecerFornecedor` da casa) antes de qualquer combinação.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { LINHA_DISPONIVEL_WHERE, fornecedoresDaEmpresa } from '@/lib/conciliacao/fila-de-conciliacao'
import { reconhecerFornecedor } from '@/lib/conciliacao/sugestao-de-vinculo'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: Date) => d.toISOString().slice(0, 10)

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)
  const fornecedores = await fornecedoresDaEmpresa(prisma, COMPANY)

  const contas = await prisma.transaction.findMany({
    where: {
      lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] }, status: 'PENDING', paymentDate: null,
      reconciledWithId: null, reconciledFrom: { none: {} },
      AND: [{ OR: [
        { bankAccount: { companyId: COMPANY } }, { supplier: { companyId: COMPANY } },
        { customer: { companyId: COMPANY } }, { category: { companyId: COMPANY } },
      ] }],
    },
    select: {
      id: true, description: true, amount: true, dueDate: true, date: true, type: true,
      supplierId: true, supplier: { select: { razaoSocial: true } },
    },
    orderBy: { dueDate: 'asc' },
  })

  const linhas = await prisma.transaction.findMany({
    where: { ...LINHA_DISPONIVEL_WHERE, bankAccount: { companyId: COMPANY }, date: { gte: new Date('2026-08-20') } },
    select: {
      id: true, description: true, amount: true, date: true, type: true, supplierId: true,
      category: { select: { name: true } }, bankAccount: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  })
  console.log(`\ncontas abertas: ${contas.length} · linhas disponíveis (desde 20/08): ${linhas.length}`)

  // ⭐ a linha só é candidata do fornecedor F se ELA NOMEIA F (ou tem a FK)
  const donoDaLinha = new Map<string, string | null>()
  for (const l of linhas) {
    donoDaLinha.set(l.id, l.supplierId ?? reconhecerFornecedor(l.description, fornecedores)?.id ?? null)
  }
  const comNome = [...donoDaLinha.values()].filter(Boolean).length
  console.log(`linhas que NOMEIAM um fornecedor cadastrado: ${comNome} de ${linhas.length}`)

  const porForn = new Map<string, typeof contas>()
  for (const c of contas) if (c.supplierId) porForn.set(c.supplierId, [...(porForn.get(c.supplierId) ?? []), c])

  const emLote = new Set<string>()
  console.log('\n=== 1. LINHA QUE NOMEIA O FORNECEDOR == SOMA DE N NOTAS DELE ===')
  for (const l of linhas) {
    const fid = donoDaLinha.get(l.id)
    if (!fid) continue
    const notas = (porForn.get(fid) ?? []).filter((c) => c.type === l.type)
    if (notas.length < 2) continue
    const alvo = Math.abs(l.amount)
    const combos = todosOsSubconjuntos(notas.map((c) => Math.abs(c.amount)), alvo, 0.02)
    if (!combos.length) continue
    const nome = notas[0].supplier?.razaoSocial ?? fid
    if (combos.length > 1) {
      console.log(`\n⚠️  ${nome} · linha ${dia(l.date)} ${brl(alvo)} → ${combos.length} combinações diferentes fecham: AMBÍGUO, não sugere`)
      continue
    }
    const escolhidas = combos[0].map((i) => notas[i])
    console.log(`\n⭐ ${nome}`)
    console.log(`   linha ${dia(l.date)} ${brl(alvo)} · "${l.description.slice(0, 55)}" · ${l.bankAccount?.name?.trim()} · cat: ${l.category?.name ?? '—'}`)
    console.log(`   = soma EXATA de ${escolhidas.length} nota(s) (o fornecedor tem ${notas.length} abertas):`)
    for (const n of escolhidas) {
      console.log(`      ${dia(n.dueDate ?? n.date)} ${brl(Math.abs(n.amount))} · ${n.description.slice(0, 50)}`)
      emLote.add(n.id)
    }
  }

  const hoje = new Date()
  const vencidas = contas.filter((c) => (c.dueDate ?? c.date) < hoje)
  console.log(`\n=== 2. VENCIDAS: ${vencidas.length} · cobertas por lote: ${vencidas.filter((c) => emLote.has(c.id)).length} ===`)
  for (const c of vencidas) {
    console.log(`   ${emLote.has(c.id) ? '⭐lote' : '     '} ${dia(c.dueDate ?? c.date)} ${brl(Math.abs(c.amount)).padStart(12)} ${(c.supplier?.razaoSocial ?? '— sem fornecedor').slice(0, 30).padEnd(30)} ${c.description.slice(0, 38)}`)
  }
}

/** TODOS os subconjuntos (2..15) que fecham no alvo — 2+ resultados = ambíguo */
function todosOsSubconjuntos(valores: number[], alvo: number, tol: number): number[][] {
  const idx = valores.map((_, i) => i).sort((a, b) => valores[b] - valores[a])
  const achados: number[][] = []
  const busca = (pos: number, resta: number, atual: number[]) => {
    if (achados.length > 1) return
    if (Math.abs(resta) <= tol && atual.length >= 2) { achados.push([...atual]); return }
    if (pos >= idx.length || resta < -tol || atual.length >= 15) return
    const i = idx[pos]
    if (valores[i] <= resta + tol) busca(pos + 1, resta - valores[i], [...atual, i])
    busca(pos + 1, resta, atual)
  }
  busca(0, alvo, [])
  return achados
}

main().finally(() => prisma.$disconnect())
