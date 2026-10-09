/**
 * ⭐ O `notes` FICA COM O QUE NÃO SE DERIVA (item 5 do pedido, 09/10/2026).
 *
 * **A régua do dono:** *"nota manual vira só a parte que não se deriva (origem, decisão da
 * entrada não registrada)"*. Devolução, total devolvido e saldo saem do HISTÓRICO a cada
 * leitura — escrevê-los aqui é o que fez a nota dizer *"Saldo 290.000"* ao lado de um cartão
 * de R$ 240.000.
 *
 * ⚠️ Preview por default; grava só com `--aplicar`.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { saldoDevedorAtual } from '@/lib/loans/saldo'

const CO = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const PRINCIPAL = 'cmshqt1hk0003cz0e11lhwwpv'
const FORNO = 'cmtja8ziu009hnluh75xiazg0'
const APLICAR = process.argv.includes('--aplicar')

const NOVOS: Record<string, string> = {
  [PRINCIPAL]:
    'Mútuo com a Arafat (arafet thalji), empresa do grupo, iniciado em mai/2026 — sem juros, ' +
    'devolução conforme o caixa. A entrada original NÃO foi registrada no sistema, por decisão ' +
    'do dono (competência mai/2026). ⚠️ As devoluções, o total devolvido e o saldo são DERIVADOS ' +
    'do histórico desta tela — não se escrevem aqui.',
  [FORNO]:
    '2ª tranche do mútuo com a Arafat, para compra de forno (imobilizado). PAGO EM ESPÉCIE ' +
    'DIRETAMENTE AO FORNECEDOR PELO MUTUANTE; SEM TRÂNSITO POR CONTA DA EMPRESA. Mesmas ' +
    `condições do contrato original (${PRINCIPAL}): sem juros, devolução conforme o caixa. ` +
    '⚠️ O saldo desta tranche e o total da dívida com a Arafat são DERIVADOS — a soma dos ' +
    'saldos dos dois contratos.',
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  let somaSaldos = 0

  for (const id of [PRINCIPAL, FORNO]) {
    const loan = await prisma.loan.findUniqueOrThrow({
      where: { id },
      include: { installments: { orderBy: { number: 'asc' } } },
    })
    if (loan.companyId !== CO) throw new Error(`contrato ${id} não é desta empresa`)
    const saldo = saldoDevedorAtual(loan, loan.installments)
    somaSaldos += saldo

    console.log(`\n═══ ${loan.lender}${loan.contractNumber ? ` · ${loan.contractNumber}` : ''} ═══`)
    console.log(`  o sistema DERIVA hoje: principal ${brl(loan.principal)} · saldo ${brl(saldo)}`)
    console.log(`\n  ANTES:\n    ${loan.notes ?? '(vazio)'}`)
    console.log(`\n  DEPOIS:\n    ${NOVOS[id]}`)
    if (APLICAR) {
      await prisma.loan.update({ where: { id }, data: { notes: NOVOS[id] } })
      console.log('\n  ⭐ GRAVADO')
    }
  }

  console.log(`\n⭐ total da dívida com a Arafat, DERIVADO agora: ${brl(Math.round(somaSaldos * 100) / 100)}`)
  console.log(APLICAR ? '\n⭐ APLICADO' : '\n⚠️ PREVIEW — nada gravado (use --aplicar)')
  await prisma.$disconnect()
}
main().catch((e) => { console.error('[notes] erro:', e instanceof Error ? e.message : e); process.exit(1) })
