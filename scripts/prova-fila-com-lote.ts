// ⭐ READ-ONLY — a fila REAL, pela MESMA função que a tela chama (09/09/2026).

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { filaDeConciliacao } from '@/lib/conciliacao/fila-de-conciliacao'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: Date) => new Date(d).toISOString().slice(0, 10)

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)
  const t0 = Date.now()
  const f = await filaDeConciliacao(COMPANY, prisma)
  console.log(`\nfila montada em ${Date.now() - t0} ms`)
  console.log(`totais: ${JSON.stringify(f.totais)}`)

  console.log(`\n=== LOTES SUGERIDOS: ${f.lotes.length} ===`)
  for (const l of f.lotes) {
    console.log(`\n⭐ ${l.fornecedorNome} · linha ${brl(l.valorDaLinha)} · dif ${brl(l.diferenca)}`)
    console.log(`   ${l.porQue}`)
    for (const n of l.notas) console.log(`      ${dia(n.vencimento)} ${brl(n.valor).padStart(12)} ${n.descricao.slice(0, 45)}`)
  }

  console.log(`\n=== NOMEIAM O FORNECEDOR E NÃO FECHAM: ${f.lotesQueNaoFecham.length} ===`)
  for (const x of f.lotesQueNaoFecham) {
    console.log(`   ${dia(x.data)} ${brl(x.valorDaLinha).padStart(12)} ${x.fornecedorNome.slice(0, 32).padEnd(32)} ${x.motivo} · ${x.abertasDoFornecedor} abertas somam ${brl(x.somaDasAbertas)}`)
  }

  console.log(`\n=== CARDS 1:1 que sobraram: ${f.contas.length} ===`)
  for (const c of f.contas.slice(0, 12)) {
    console.log(`   ${brl(c.conta.valor).padStart(12)} ${c.conta.descricao.slice(0, 40).padEnd(40)} ${c.sugestoes.length} sugestão(ões)`)
  }
}

main().finally(() => prisma.$disconnect())
