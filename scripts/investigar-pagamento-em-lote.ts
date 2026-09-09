// ⭐ READ-ONLY — 1 PIX paga N notas? (09/09/2026)
//
// **O dono:** *"~30 contas VENCIDAS não apareceram na conciliação, e os pagamentos EXISTEM
// no extrato. O padrão delas: fornecedor pequeno com VÁRIAS notinhas — eu pago JUNTO, num
// PIX só. Aposto que o matcher só casa 1-pra-1."*
//
// Este script NÃO grava nada. Ele responde três perguntas com a régua real da fila:
//   1. existe linha do extrato cujo valor == SOMA de N contas abertas do MESMO fornecedor?
//   2. as 4 sem fornecedor (oesa · contabilidade · di car · aluguel): o valor exato existe?
//   3. quantas das vencidas ficariam resolvidas por lote?

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { LINHA_DISPONIVEL_WHERE } from '@/lib/conciliacao/fila-de-conciliacao'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: Date) => d.toISOString().slice(0, 10)

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

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
    where: { ...LINHA_DISPONIVEL_WHERE, bankAccount: { companyId: COMPANY }, date: { gte: new Date('2026-08-25') } },
    select: {
      id: true, description: true, amount: true, date: true, type: true,
      categoryId: true, category: { select: { name: true } },
      bankAccount: { select: { name: true } },
    },
    orderBy: { date: 'asc' },
  })

  console.log(`\ncontas abertas: ${contas.length} · linhas disponíveis (desde 25/08): ${linhas.length}`)

  // ── 1. subset-sum por fornecedor ────────────────────────────────
  const porForn = new Map<string, typeof contas>()
  for (const c of contas) {
    const k = c.supplierId ?? '(sem fornecedor)'
    porForn.set(k, [...(porForn.get(k) ?? []), c])
  }
  const usadasEmLote = new Set<string>()

  console.log('\n=== 1. LINHA DO EXTRATO == SOMA DE N NOTAS DO MESMO FORNECEDOR ===')
  for (const [fid, lista] of porForn) {
    if (fid === '(sem fornecedor)' || lista.length < 2) continue
    const nome = lista[0].supplier?.razaoSocial ?? fid
    for (const l of linhas) {
      if (l.type !== 'DEBIT') continue
      const alvo = Math.abs(l.amount)
      const combo = acharSubconjunto(lista.map((c) => Math.abs(c.amount)), alvo, 0.02)
      if (!combo) continue
      const notas = combo.map((i) => lista[i])
      console.log(`\n⭐ ${nome}`)
      console.log(`   linha ${dia(l.date)} ${brl(alvo)} · "${l.description.slice(0, 60)}" · ${l.bankAccount?.name?.trim()} · cat: ${l.category?.name ?? '—'}`)
      console.log(`   = soma de ${notas.length} nota(s):`)
      for (const n of notas) {
        console.log(`      ${dia(n.dueDate ?? n.date)} ${brl(Math.abs(n.amount))} · ${n.description.slice(0, 55)}`)
        usadasEmLote.add(n.id)
      }
      break // uma linha por fornecedor já prova o padrão
    }
  }

  // ── 2. as sem fornecedor que o dono nomeou ──────────────────────
  console.log('\n=== 2. AS SEM FORNECEDOR — o valor exato existe no extrato? ===')
  const semForn = (porForn.get('(sem fornecedor)') ?? [])
  for (const c of semForn) {
    const v = Math.abs(c.amount)
    const iguais = linhas.filter((l) => l.type === c.type && Math.abs(Math.abs(l.amount) - v) < 0.02)
    const venc = c.dueDate ?? c.date
    const dentroDaJanela = iguais.filter((l) => Math.abs(l.date.getTime() - venc.getTime()) <= 15 * 86400000)
    console.log(`\n${dia(venc)} ${brl(v)} · ${c.description.slice(0, 50)}`)
    if (!iguais.length) { console.log('   ⛔ nenhuma linha com esse valor no extrato'); continue }
    for (const l of iguais) {
      const dist = Math.round((l.date.getTime() - venc.getTime()) / 86400000)
      console.log(`   ${dentroDaJanela.includes(l) ? '⭐' : '⚠️ fora da janela'} ${dia(l.date)} (${dist > 0 ? '+' : ''}${dist}d) ${brl(Math.abs(l.amount))} · "${l.description.slice(0, 50)}" · cat: ${l.category?.name ?? '—'}`)
    }
  }

  // ── 3. as vencidas ──────────────────────────────────────────────
  const hoje = new Date()
  const vencidas = contas.filter((c) => (c.dueDate ?? c.date) < hoje)
  console.log(`\n=== 3. VENCIDAS: ${vencidas.length} · resolvidas por lote no teste acima: ${vencidas.filter((c) => usadasEmLote.has(c.id)).length} ===`)
  for (const c of vencidas.slice(0, 40)) {
    console.log(`   ${usadasEmLote.has(c.id) ? '⭐lote' : '     '} ${dia(c.dueDate ?? c.date)} ${brl(Math.abs(c.amount))} ${(c.supplier?.razaoSocial ?? '—').slice(0, 28).padEnd(28)} ${c.description.slice(0, 40)}`)
  }
}

/** subconjunto cuja soma bate no alvo — 2..15 elementos, busca exaustiva podada */
function acharSubconjunto(valores: number[], alvo: number, tol: number): number[] | null {
  const idx = valores.map((_, i) => i).sort((a, b) => valores[b] - valores[a])
  let achado: number[] | null = null
  const busca = (pos: number, resta: number, atual: number[]) => {
    if (achado) return
    if (Math.abs(resta) <= tol && atual.length >= 2) { achado = [...atual]; return }
    if (pos >= idx.length || resta < -tol || atual.length >= 15) return
    const i = idx[pos]
    if (valores[i] <= resta + tol) busca(pos + 1, resta - valores[i], [...atual, i])
    busca(pos + 1, resta, atual)
  }
  busca(0, alvo, [])
  return achado
}

main().finally(() => prisma.$disconnect())
