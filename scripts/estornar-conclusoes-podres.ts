/**
 * ⭐⭐ MARCA COMO ESTORNADA A CONCLUSÃO QUE O LEDGER JÁ DESFEZ (28/09/2026).
 *
 * **O caso que criou isto:** as duas conclusões de **22.864 unidades** da maionese (14 e
 * 16/09). A cirurgia de 19/09 **corrigiu o LEDGER** — o `PRODUCAO_GERACAO` de 22.864 está
 * estornado e relançado como 22,864 nas duas ordens —, mas **`stock_conclusao_estornada`
 * ficou com ZERO linhas**: o preview daquele dia estava pronto e o OK do dono só veio hoje.
 *
 * ⛔⛔ **E o estrago de deixar assim não é no estoque, é na RÉGUA.** A conclusão é o que
 * alimenta o `rendimentoMedidoDaFicha`, então o rendimento podre continuou sendo "o
 * histórico": medido em prod, **CUBA MAIONESE 715,55 un/receita-base** e **MAIONESE
 * 1.430,43** — números que envenenam o custo por unidade da ficha **e o próprio guard de
 * plausibilidade**, que passaria a aprovar o erro por ele ter virado a norma.
 *
 * ⚠️ **NÃO TOCA NO LEDGER.** O movimento é imutável e já foi corrigido pelo caminho certo
 * (estorno + novo). O que este gesto faz é dizer *"esta medição não é régua"* — e ele
 * carrega o rastro dos DOIS movimentos (o estorno e o relançamento), pra quem ler em três
 * meses saber que a correção existiu e onde ela está.
 *
 * ⛔ Idempotente por construção (unique no `conclusaoId`): rodar de novo não faz nada.
 *
 * USO:  npx tsx scripts/estornar-conclusoes-podres.ts            (preview, nada grava)
 *       npx tsx scripts/estornar-conclusoes-podres.ts --aplicar
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { marcarConclusaoEstornada, idsDeConclusoesEstornadas } from '@/lib/stock/producao/conclusao-estornada'
import { rendimentoMedidoDaFicha } from '@/lib/stock/producao/conclusao'

const EMP = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const APLICAR = process.argv.includes('--aplicar')
/** ⚠️ o alvo é EXPLÍCITO — script de cirurgia não sai varrendo "o que parece podre" */
const QTD_PODRE = Number(process.env.QTD_PODRE ?? 22864)
const MOTIVO = 'grandeza mil vezes maior (gramas digitadas em item controlado em KG) — ledger corrigido por estorno+novo em 19/09/2026; esta medição não é régua'

const n = (x: number, d = 4) => x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMP)
  const jaEstornadas = new Set(await idsDeConclusoesEstornadas(EMP, prisma))

  const podres = await prisma.stockProducaoConclusao.findMany({
    where: { companyId: EMP, qtdGerada: QTD_PODRE }, orderBy: { criadoEm: 'asc' },
  })
  if (!podres.length) { console.log(`nenhuma conclusão com qtdGerada ${QTD_PODRE}. Nada a fazer.`); return }

  const fichasTocadas = new Map<string, string>() // fichaId → nome do produzido
  const plano: { conclusaoId: string; ficha: string; estornoId: string | null; relancamentoId: string | null }[] = []

  for (const c of podres) {
    const ordem = await prisma.stockProductionOrder.findFirst({ where: { companyId: EMP, id: c.ordemId } })
    if (!ordem) { console.log(`⚠️ ordem ${c.ordemId} não existe — pulo`); continue }
    const ficha = await prisma.stockFicha.findFirst({ where: { companyId: EMP, id: ordem.fichaId } })
    const item = ficha ? await prisma.stockItem.findFirst({ where: { id: ficha.itemProduzidoId }, select: { nome: true } }) : null
    if (ficha) fichasTocadas.set(ficha.id, item?.nome ?? ficha.id)

    const movs = await prisma.stockMovement.findMany({
      where: { companyId: EMP, receiptId: c.ordemId }, orderBy: { criadoEm: 'asc' },
      select: { id: true, tipo: true, quantidade: true, estornoDeId: true },
    })
    // ⭐ o movimento PODRE é a geração com a quantidade errada; o estorno é quem aponta pra ele
    const podre = movs.find((m) => m.tipo === 'PRODUCAO_GERACAO' && Math.abs(m.quantidade) === QTD_PODRE)
    const estorno = podre ? movs.find((m) => m.estornoDeId === podre.id) : undefined
    // ⚠️ o relançamento é a ÚLTIMA geração VIVA da ordem (a cadeia pode ter mais de um passo)
    const estornados = new Set(movs.filter((m) => m.estornoDeId).map((m) => m.estornoDeId!))
    const vivas = movs.filter((m) => m.tipo === 'PRODUCAO_GERACAO' && !estornados.has(m.id))
    const relancamento = vivas[vivas.length - 1]

    console.log(`\n══ ${item?.nome ?? '?'} · conclusão ${c.id}`)
    console.log(`   ${c.criadoEm.toISOString().slice(0, 10)} · qtdGerada ${n(c.qtdGerada, 3)} · rendimento ${n(c.rendimento)}`)
    console.log(`   no ledger: geração podre ${podre ? podre.id : '⛔ não achei'} · estorno ${estorno ? estorno.id : '⛔ não achei'}`)
    console.log(`   relançamento vivo: ${relancamento ? `${relancamento.id} (${n(relancamento.quantidade, 3)})` : '⛔ nenhum'}`)
    if (jaEstornadas.has(c.id)) { console.log('   ⭐ JÁ marcada como estornada — idempotente, nada a fazer') ; continue }
    if (!estorno) {
      console.log('   ⛔ SEM estorno no ledger: a geração podre AINDA está viva. Marcar a conclusão')
      console.log('      aqui esconderia o número errado da média e deixaria o estoque torto — NÃO marco.')
      continue
    }
    plano.push({ conclusaoId: c.id, ficha: item?.nome ?? '?', estornoId: estorno.id, relancamentoId: relancamento?.id ?? null })
  }

  console.log(`\n── RENDIMENTO MEDIDO, ANTES ──`)
  const antes = new Map<string, { media: number | null; lotes: number }>()
  for (const [fichaId, nome] of fichasTocadas) {
    const r = await rendimentoMedidoDaFicha(EMP, fichaId, prisma)
    antes.set(fichaId, r)
    console.log(`   ${nome.padEnd(18)} ${r.media == null ? 'a apurar' : n(r.media)} (${r.lotes} lotes)`)
  }

  if (!plano.length) { console.log('\nnada a marcar.'); return }
  if (!APLICAR) {
    console.log(`\n⛔ PREVIEW — nada gravado. ${plano.length} conclusão(ões) seriam marcadas:`)
    for (const p of plano) console.log(`   ${p.ficha} · ${p.conclusaoId}`)
    console.log('   rode com --aplicar pra gravar.')
    return
  }

  for (const p of plano) {
    await marcarConclusaoEstornada({
      companyId: EMP, conclusaoId: p.conclusaoId, motivo: MOTIVO,
      estornoMovimentoId: p.estornoId, relancamentoMovimentoId: p.relancamentoId,
    }, prisma)
    console.log(`⭐ marcada: ${p.ficha} · ${p.conclusaoId}`)
  }

  console.log(`\n── RENDIMENTO MEDIDO, DEPOIS ──`)
  for (const [fichaId, nome] of fichasTocadas) {
    const r = await rendimentoMedidoDaFicha(EMP, fichaId, prisma)
    const a = antes.get(fichaId)!
    console.log(`   ${nome.padEnd(18)} ${a.media == null ? 'a apurar' : n(a.media)} (${a.lotes}) → ${r.media == null ? 'a apurar' : n(r.media)} (${r.lotes} lotes)`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
