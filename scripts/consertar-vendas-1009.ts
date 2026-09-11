// ⛔⛔⛔ CONSERTO DO IMPORT DE VENDAS DE 10/09 (11/09/2026) — PREVIEW por padrão.
//
// **O QUE ACONTECEU, medido antes de tocar em nada:** o **Relatório de COMPLEMENTOS** foi
// subido na aba de **PRODUTOS**. Os dois layouts têm colunas diferentes:
//
//   PRODUTOS:     [Produto   · **Quantidade**             · Valor Extra · Valor total]
//   COMPLEMENTOS: [Descrição · **Valor médio por unidade** · Quantidade  · Valor Total]
//
// O parser lia a coluna 1 como quantidade → no arquivo errado ela é o **PREÇO**, e
// `R$ 14,99` virou **1499**. As 54 linhas (de 86) são porque as de `R$ 0,00` viraram
// quantidade 0 e sumiram — justamente os sabores inclusos no preço.
//
// ⚠️ **NÃO HOUVE BAIXA DUPLA** (a hipótese do dono não se confirmou): as 6 baixas são o
// "estorna-e-refaz" do reprocesso funcionando — 3 estornadas + 3 vivas. O estrago é o
// **−1.499 que deveria ser −1**, não a duplicidade.
//
// ⛔ NADA É APAGADO: o ledger é imutável, então o conserto é ESTORNO (a régua do módulo
// desde 20/08). A história fica contando o que houve, com cada perna nomeada.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
// ⭐ o helper da CASA: cria o oposto, recusa estornar estorno e é IDEMPOTENTE (se já
// existe estorno daquele movimento, devolve o que existe). Montar o oposto na mão aqui
// seria a segunda régua de estorno do módulo.
import { estornarMovimento } from '@/lib/stock/movement'
import { saldoItem } from '@/lib/stock/saldo'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const IMPORT_RUIM = 'cmtwea1a50001112905hcxgjd'
const APLICAR = process.argv.includes('--aplicar')
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  console.log(APLICAR ? '⚠️  APLICANDO\n' : '👁  PREVIEW (nada será gravado)\n')

  // ── 1. as pernas VIVAS do import ruim (as que ainda não foram estornadas) ──
  const doImport = await prisma.stockMovement.findMany({
    where: { companyId: CO, receiptId: IMPORT_RUIM },
    select: { id: true, itemId: true, tipo: true, quantidade: true, custoUnitario: true, custoTotal: true, estornoDeId: true },
    orderBy: { criadoEm: 'asc' },
  })
  const jaEstornados = new Set(doImport.map((m) => m.estornoDeId).filter(Boolean) as string[])
  const vivas = doImport.filter((m) => m.tipo === 'BAIXA_VENDA' && !jaEstornados.has(m.id))

  const nomes = new Map((await prisma.stockItem.findMany({
    where: { id: { in: doImport.map((m) => m.itemId) } }, select: { id: true, nome: true },
  })).map((i) => [i.id, i.nome]))

  console.log(`1) PERNAS DO IMPORT: ${doImport.length} movimentos · ${jaEstornados.size} já estornados · ${vivas.length} VIVAS a estornar`)
  for (const m of vivas) {
    console.log(`   [${m.id.slice(-8)}] ${m.quantidade} × ${brl(m.custoUnitario)} = ${brl(m.custoTotal)} · ${nomes.get(m.itemId)}`)
  }

  // ── 2. a linha de CONTAGEM a custo zero que nasceu do estrago ──
  // ⚠️ ela entrou na sessão de 04/09 EM 11/09, tentando consertar o saldo — e como o
  // custo médio já estava quebrado, entrou a R$ 0,00: unidades positivas, valor negativo.
  const ajustes = await prisma.stockMovement.findMany({
    where: {
      companyId: CO, tipo: 'AJUSTE_CONTAGEM',
      itemId: { in: [...new Set(vivas.map((m) => m.itemId))] },
      criadoEm: { gte: new Date('2026-09-11T00:00:00Z') },
    },
    select: { id: true, itemId: true, quantidade: true, custoUnitario: true, custoTotal: true, receiptId: true },
  })
  console.log(`\n2) LINHAS DE CONTAGEM de 11/09 nesses itens: ${ajustes.length}`)
  for (const a of ajustes) {
    console.log(`   [${a.id.slice(-8)}] ${a.quantidade} × ${brl(a.custoUnitario)} = ${brl(a.custoTotal)} · ${nomes.get(a.itemId)}`)
  }

  // ── 3. a sessão de contagem aberta há 7 dias ──
  const sessao = await prisma.stockContagem.findFirst({
    where: { companyId: CO, status: 'ABERTA' },
    select: { id: true, tipo: true, iniciadaEm: true },
  })
  const dias = sessao ? Math.floor((Date.now() - sessao.iniciadaEm.getTime()) / 86_400_000) : 0
  console.log(`\n3) SESSÃO DE CONTAGEM ABERTA: ${sessao ? `${sessao.tipo} de ${sessao.iniciadaEm.toISOString().slice(0, 10)} (${dias} dias)` : 'nenhuma'}`)

  // ── o depois ──
  console.log('\n4) SALDO E VALOR — antes → depois do conserto:')
  for (const id of [...new Set(vivas.map((m) => m.itemId))]) {
    const s = await saldoItem(prisma, CO, id)
    const desfaz = vivas.filter((m) => m.itemId === id).reduce((a, m) => a - m.quantidade, 0)
    const desfazV = vivas.filter((m) => m.itemId === id).reduce((a, m) => a - m.custoTotal, 0)
    const ajQ = ajustes.filter((a) => a.itemId === id).reduce((a, m) => a - m.quantidade, 0)
    const ajV = ajustes.filter((a) => a.itemId === id).reduce((a, m) => a - m.custoTotal, 0)
    console.log(`   ${(nomes.get(id) ?? '').padEnd(22)} ${String(s.saldo).padStart(7)} un ${brl(s.valor).padStart(14)}`
      + `  →  ${String(Math.round((s.saldo + desfaz + ajQ) * 100) / 100).padStart(7)} un ${brl(Math.round((s.valor + desfazV + ajV) * 100) / 100).padStart(12)}`)
  }

  if (!APLICAR) { console.log('\n⚠️  PREVIEW — nada gravado. Pra aplicar: --aplicar'); return }

  // ═══ APLICAR ═══
  for (const m of [...vivas, ...ajustes]) {
    await estornarMovimento(prisma, m.id)
    console.log(`   ✓ estornado [${m.id.slice(-8)}] ${nomes.get(m.itemId)}`)
  }
  /**
   * ⚠️ AS LINHAS DO IMPORT **NÃO** SÃO APAGADAS AQUI — quem as substitui é o REIMPORT.
   *
   * O import de vendas é idempotente por DIA (`@@unique(companyId, data)`): subir o
   * arquivo certo de 10/09 troca as linhas pelas boas. Apagar por fora seria um segundo
   * caminho de escrita pro mesmo dado — e se o reimport falhasse, o dia ficaria sem
   * registro nenhum em vez de ficar com o registro errado, que é pior (some a pista).
   * ⭐ O cardápio volta ao são no mesmo ato do reimport, porque é de lá que ele lê.
   */

  if (sessao) {
    await prisma.stockContagem.update({
      where: { id: sessao.id },
      data: { status: 'FINALIZADA', finalizadaEm: new Date() },
    })
    console.log(`   ✓ sessão de contagem ${sessao.iniciadaEm.toISOString().slice(0, 10)} FECHADA`)
  }
  console.log('\n✓ aplicado')
}

main().finally(() => prisma.$disconnect())
