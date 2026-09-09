// ⭐ READ-ONLY — por fornecedor: que linhas NOMEIAM ele, e o que fecha? (09/09/2026)
//
// Responde as duas perguntas que sobraram da 1ª medição:
//   • por que IVAN / MARIA LUIZA / CIA DA FRUTA não casaram em lote?
//   • qual o RISCO de coincidência do subset-sum (quantos alvos aleatórios fechariam)?

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
      reconciledWithId: null, reconciledFrom: { none: {} }, supplierId: { not: null },
      AND: [{ OR: [{ bankAccount: { companyId: COMPANY } }, { supplier: { companyId: COMPANY } }] }],
    },
    select: { id: true, description: true, amount: true, dueDate: true, date: true, type: true, supplierId: true },
  })
  const linhas = await prisma.transaction.findMany({
    where: { ...LINHA_DISPONIVEL_WHERE, bankAccount: { companyId: COMPANY }, date: { gte: new Date('2026-08-20') } },
    select: { id: true, description: true, amount: true, date: true, type: true, supplierId: true },
  })

  const nomePorId = new Map(fornecedores.map((f) => [f.id, f.nomeFantasia ?? f.razaoSocial]))
  const porForn = new Map<string, typeof contas>()
  for (const c of contas) porForn.set(c.supplierId!, [...(porForn.get(c.supplierId!) ?? []), c])

  for (const [fid, notas] of [...porForn].sort((a, b) => b[1].length - a[1].length)) {
    if (notas.length < 2) continue
    const suas = linhas.filter((l) => (l.supplierId ?? reconhecerFornecedor(l.description, fornecedores)?.id) === fid)
    const valores = notas.map((c) => Math.abs(c.amount))
    console.log(`\n━━ ${nomePorId.get(fid)} · ${notas.length} notas abertas (Σ ${brl(valores.reduce((a, b) => a + b, 0))})`)
    if (!suas.length) { console.log('   ⛔ NENHUMA linha do extrato nomeia este fornecedor — nada a sugerir'); continue }
    for (const l of suas) {
      const alvo = Math.abs(l.amount)
      const c = combos(valores, alvo, 0.02)
      const veredito = c.length === 0 ? '— não fecha com nenhuma combinação'
        : c.length > 1 ? `⚠️ AMBÍGUO (${c.length}+ combinações fecham)`
        : `⭐ fecha com ${c[0].length} nota(s): ${c[0].map((i) => brl(valores[i])).join(' + ')}`
      console.log(`   ${dia(l.date)} ${brl(alvo).padStart(12)} "${l.description.slice(0, 42)}" ${veredito}`)
    }
    // ⚠️ o risco de coincidência: quantos alvos ALEATÓRIOS na mesma faixa fechariam?
    const total = valores.reduce((a, b) => a + b, 0)
    let acasos = 0
    for (let k = 1; k <= 200; k++) {
      const alvoFalso = Math.round((total * k / 200) * 100) / 100
      if (combos(valores, alvoFalso, 0.02).length) acasos++
    }
    console.log(`   ⚠️ risco: ${acasos} de 200 valores aleatórios na faixa também fechariam (${Math.round(acasos / 2)}%)`)
  }
}

function combos(valores: number[], alvo: number, tol: number): number[][] {
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
