// READ-ONLY: a fila nova e as sugestões dos Pendentes, medidas em prod pelas
// MESMAS funções que as telas usam (REGRA 3 — executa, não lê o fonte).
//
// USO: npx tsx scripts/prova-fila-conciliacao.ts

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { filaDeConciliacao, sugestoesParaPendentes } from '@/lib/conciliacao/fila-de-conciliacao'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix — REGRA 8
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: Date | string) => new Date(d).toISOString().slice(0, 10)

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  console.log('\n=== A FILA NOVA ===')
  const fila = await filaDeConciliacao(COMPANY)
  console.log(`  contas: ${fila.totais.contas} · COM SUGESTÃO: ${fila.totais.comSugestao}`)
  console.log(`  transferências aguardando par: ${fila.totais.transferencias}`)
  console.log(`  duplicatas suspeitas: ${fila.totais.duplicatas}`)

  console.log('\n  os pares sugeridos:')
  for (const c of fila.contas.filter((x) => x.sugestoes.length)) {
    console.log(`\n    [${c.situacao}] ${brl(c.conta.valor)} venc ${dia(c.conta.data)} · ${c.fornecedor ?? '—'}`)
    console.log(`       "${c.conta.descricao}"`)
    for (const s of c.sugestoes) {
      console.log(`    → ${s.confianca.toUpperCase()} (${s.score}) · extrato ${brl(s.extrato.valor)} ${dia(s.extrato.data)} · ${s.extratoConta} · categoria ${s.extratoCategoria ?? '—'}`)
      console.log(`       "${s.extrato.descricao}"`)
      console.log(`       porquê: ${s.porQue}`)
    }
  }
  const semPar = fila.contas.filter((x) => !x.sugestoes.length).length
  console.log(`\n  ${semPar} conta(s) sem par no extrato (informação de fundo, não fila)`)

  console.log('\n\n=== AS SUGESTÕES NA FILA DE PENDENTES ===')
  const sug = await sugestoesParaPendentes(COMPANY)
  const ids = Object.keys(sug)
  console.log(`  ${ids.length} linha(s) pendente(s) com sugestão de vínculo`)
  for (const id of ids) {
    console.log(`\n  [${id}]`)
    for (const s of sug[id]) {
      console.log(`     ${s.confianca.toUpperCase()} (${s.score}) · ${s.rotulo} · ${brl(s.outroLado.valor)} ${dia(s.outroLado.data)}`)
      console.log(`     "${s.outroLado.descricao}"`)
      console.log(`     porquê: ${s.porQue}`)
      console.log(`     diferença: ${brl(s.diferenca)}`)
    }
  }
  console.log('')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
