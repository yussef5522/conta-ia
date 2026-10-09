/**
 * ⭐⭐ O FECHAMENTO DO GESTO — o Δ absorvido e o LEDGER intacto (08/10/2026).
 *
 * **Duas perguntas que a foto antes/depois NÃO responde:**
 *
 * 1. ⭐ **O Δ DAS 9 FOI ABSORVIDO?** A casa/liga leem o MÊS (outubro, 8 dias), e o Δ do
 *    preview foi medido na janela de **30 dias** — então comparar os dois números seria
 *    comparar janelas diferentes. A prova limpa é RODAR O PREVIEW DE NOVO: o Δ que sobra
 *    tem que ser **só o das 2 que PERGUNTAM**, porque as 9 viraram `jaNormalizada`.
 *
 * 2. ⛔⛔ **O LEDGER FOI TOCADO?** `atualizarFicha` versiona receita e **não escreve
 *    movimento nenhum** — mas afirmar isso sem medir é confiar no meu raciocínio. O que
 *    vale é: nenhum movimento foi CRIADO pelo gesto, e nenhum movimento ANTIGO foi tocado
 *    (o ledger é imutável por trigger; UPDATE seria recusado pelo banco, mas o `criadoEm`
 *    dos movimentos recentes diz se algo nasceu na janela da gravação).
 *
 * ⚠️ READ-ONLY.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { previewNormalizacao } from '@/lib/margem/preview-normalizacao'
import { checkStockInvariants } from '@/lib/stock/stock-invariants'

const CO = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const brl = (n: number | null | undefined) =>
  n == null ? 'a apurar' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** ⭐ a janela da GRAVAÇÃO — 08/10/2026 20:43, o minuto em que as 9 versões nasceram */
const GRAVACAO_DE = new Date('2026-10-08T23:40:00.000Z')
const GRAVACAO_ATE = new Date('2026-10-08T23:50:00.000Z')

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`[pós-normalização] ${nome.trim()}\n`)

  /* ══════════ 1. O Δ QUE SOBRA — tem que ser só o das 2 que PERGUNTAM ══════════ */
  console.log('═══ 1. O Δ ABSORVIDO (preview de novo, MESMA janela de 30 dias)')
  const p = await previewNormalizacao(CO, {}, prisma)
  const pendentes = p.grupos.flatMap((g) => g.linhas.filter((l) => !l.jaNormalizada))
  console.log(`  bases: ${p.totais.bases} · já normalizadas: ${p.totais.jaNormalizadas}`)
  console.log(`  pedem confirmação: ${p.totais.pedemConfirmacao}`)
  console.log(`  ⛔ Δ NO CUSTO DO PERÍODO que SOBRA: ${brl(p.totais.deltaNoPeriodo)}`)
  for (const l of pendentes) {
    console.log(`     «${l.nome}» ${brl(l.deltaNoPeriodo)} · ${l.classificacao.confianca}`)
  }
  const soPerguntam = pendentes.every((l) => l.classificacao.confianca !== 'CLARO')
  console.log(
    `  ${soPerguntam ? '⭐' : '⛔'} o que sobra é ${soPerguntam ? 'SÓ' : 'MAIS QUE'} as que perguntam`,
  )

  /* ══════════ 2. O LEDGER — nada nasceu do gesto, nada antigo se moveu ══════════ */
  console.log('\n═══ 2. O LEDGER (o gesto versiona RECEITA, nunca movimento)')
  const naJanela = await prisma.stockMovement.findMany({
    where: { companyId: CO, criadoEm: { gte: GRAVACAO_DE, lt: GRAVACAO_ATE } },
    select: { tipo: true, criadoEm: true, quantidade: true },
  })
  console.log(`  movimentos criados na janela da gravação (20:40–20:50): ${naJanela.length}`)
  for (const m of naJanela) console.log(`     ${m.tipo} · ${m.quantidade}`)

  /** ⚠️ os movimentos mais recentes: é a cozinha operando ao vivo, não o gesto */
  const ultimos = await prisma.stockMovement.findMany({
    where: { companyId: CO },
    orderBy: { criadoEm: 'desc' },
    take: 8,
    select: { tipo: true, criadoEm: true, criadoPorId: true },
  })
  console.log('  os 8 últimos movimentos (quem mexeu no estoque de verdade):')
  for (const m of ultimos) {
    const h = m.criadoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'short', dateStyle: 'short' })
    console.log(`     ${h} · ${m.tipo} · por ${m.criadoPorId?.slice(-6) ?? 'sistema'}`)
  }

  /* ══════════ 3. O JUIZ DO ESTOQUE — as invariantes do módulo ══════════ */
  console.log('\n═══ 3. O JUIZ DO ESTOQUE (invariantes do ledger e da produção)')
  const falhas = await checkStockInvariants(prisma)
  const minhas = falhas.filter((f) => f.companyId === CO)
  const erros = minhas.filter((f) => f.nivel !== 'aviso')
  const avisos = minhas.filter((f) => f.nivel === 'aviso')
  const porCodigo = new Map<string, number>()
  for (const f of minhas) porCodigo.set(f.invariante, (porCodigo.get(f.invariante) ?? 0) + 1)
  console.log(`  erros: ${erros.length} · avisos: ${avisos.length}`)
  console.log(`  por código: ${[...porCodigo].map(([k, v]) => `${k}=${v}`).join(' · ') || 'nenhum'}`)
  /** ⛔ E1/E2/E8/P1 são os que falariam se a receita tivesse mexido no ledger */
  const criticos = minhas.filter((f) => ['E1', 'E2', 'E8', 'P1'].includes(f.invariante))
  console.log(`  ⛔ os que acusariam toque no ledger (E1/E2/E8/P1): ${criticos.length}`)
  for (const f of criticos) console.log(`     ${f.invariante} ${f.detalhe}`)
}

main()
  .catch((e) => {
    console.error('⛔', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
