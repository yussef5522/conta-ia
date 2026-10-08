/**
 * 🍕 PREVIEW DA NORMALIZAÇÃO DAS BASES DE PIZZA — read-only por default.
 *
 * ⛔ `--aplicar` só depois do OK do dono no chat (item 3 do pedido de 07/10).
 *
 * Mostra, por tamanho: ficha ATUAL × PROPOSTA × Δ custo por pizza × Δ na sobra do período ×
 * quais nomes do PDV apontam pra cada base.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { previewNormalizacao } from '@/lib/margem/preview-normalizacao'
import { aplicarNormalizacao } from '@/lib/margem/aplicar-normalizacao'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const APLICAR = process.argv.includes('--aplicar')
const brl = (n: number | null | undefined) => (n == null ? 'a apurar' : `R$ ${n.toFixed(2)}`)
const pct = (n: number | null) => (n == null ? 'a apurar' : `${n.toFixed(1)}%`)

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const p = await previewNormalizacao(EMPRESA, {}, prisma)

  console.log('\n═══════ OS ITENS DA COMPOSIÇÃO — o que o leitor ACHOU ═══════')
  console.log(`  massa  : ${p.itens.massa ? `«${p.itens.massa.nome}»` : '⛔ não achei'}`)
  console.log(`  queijo : ${p.itens.queijo ? `«${p.itens.queijo.nome}»` : '⛔ não achei'}`)
  for (const t of ['PEQUENA', 'GRANDE', 'FAMILIA'] as const) {
    console.log(`  caixa ${t.padEnd(7)}: ${p.itens.caixa[t] ? `«${p.itens.caixa[t]!.nome}»` : '⛔ não achei'}`)
  }
  console.log(`  molho  : ${p.itens.molho ? `«${p.itens.molho.nome}» → vira pendência "a declarar"` : '⛔ não achei'}`)
  if (p.bloqueio) {
    console.log(`\n⛔ BLOQUEADO: ${p.bloqueio}\n`)
    return
  }

  console.log(`\n═══════ PREVIEW · janela ${p.janela.de} → ${p.janela.ate} (${p.janela.dias}d) ═══════`)
  for (const g of p.grupos) {
    const t = g.tamanho ?? 'TAMANHO NÃO RESOLVIDO'
    console.log(`\n──────────── ${t} ────────────`)
    for (const l of g.linhas) {
      const selo = l.jaNormalizada ? '✓ já normalizada' : l.classificacao.confianca === 'CLARO' ? '⭐ CLARO' : '⚠️ PERGUNTA'
      console.log(`\n  «${l.nome}» [${l.fichaId.slice(-6)}] v${l.versaoAtual} · ${selo}`)
      console.log(`     porque: ${l.classificacao.porque}`)
      if (l.faltandoHoje.length) console.log(`     ⛔ FALTA HOJE: ${l.faltandoHoje.join(' + ')}`)
      console.log(`     ATUAL    (${brl(l.custoAtual)}):`)
      for (const c of l.atual) console.log(`        ${c.qtd} × «${c.nome}» @ ${brl(c.custoUnit)}`)
      if (l.proposta.length) {
        console.log(`     PROPOSTA (${brl(l.custoProposto)}):`)
        for (const c of l.proposta) console.log(`        ${c.qtd} × «${c.nome}» @ ${brl(c.custoUnit)}`)
      } else {
        console.log('     PROPOSTA: ⛔ não dá pra propor sem o tamanho')
      }
      console.log(
        `     Δ por pizza: ${l.deltaPorPizza == null ? 'a apurar' : (l.deltaPorPizza >= 0 ? '+' : '') + brl(l.deltaPorPizza)}`,
      )
      console.log(`     margem: ${pct(l.margemAntes)} → ${pct(l.margemDepois)}`)
      console.log(`     PDV (${l.unidades} un na janela):`)
      for (const d of l.pdv) {
        console.log(`        «${d.nome}» · ${d.unidades} un × ${brl(d.precoPraticado)} = ${brl(d.faturamento)}`)
      }
      console.log(
        `     Δ no período: ${l.deltaNoPeriodo == null ? 'a apurar' : (l.deltaNoPeriodo >= 0 ? '+' : '') + brl(l.deltaNoPeriodo)}`,
      )
    }
    if (g.duplicatasDeGrafia.length) {
      console.log('\n     ⭐ CANDIDATO A DUPLICATA DE GRAFIA (mesmo preço praticado):')
      for (const d of g.duplicatasDeGrafia) console.log(`        R$ ${d.preco.toFixed(2)} → ${d.nomes.join(' | ')}`)
    } else {
      console.log('\n     ⚠️ nenhuma duplicata de grafia: cada nome deste tamanho tem um preço DIFERENTE')
      console.log('        → são pontos de preço distintos (balcão/app/promo), NÃO se fundem')
    }
  }

  if (p.recusadas.length) {
    console.log('\n═══════ RECUSADAS pela régua estrutural (não são base de tamanho) ═══════')
    for (const r of p.recusadas) console.log(`  «${r.nome}» → ${r.porque}`)
  }

  console.log('\n═══════ TOTAIS ═══════')
  console.log(`  bases: ${p.totais.bases} · já normalizadas: ${p.totais.jaNormalizadas}`)
  console.log(`  pedem confirmação do dono: ${p.totais.pedemConfirmacao}`)
  console.log(`  unidades na janela: ${p.totais.unidades}`)
  console.log(
    `  ⛔ Δ NO CUSTO DO PERÍODO: ${p.totais.deltaNoPeriodo == null ? 'a apurar' : (p.totais.deltaNoPeriodo >= 0 ? '+' : '') + brl(p.totais.deltaNoPeriodo)}`,
  )
  console.log('     (é o que SAI da sobra que a casa e a liga leem — margem deixa de vir inflada)')

  if (!APLICAR) {
    console.log('\n⭐ ZERO ESCRITA — preview. Pra gravar: --aplicar (só com o OK do dono).\n')
    return
  }

  console.log('\n═══════ APLICANDO ═══════')
  /**
   * ⭐⭐ O AUTOR VAI NO RASTRO — a ordem do dono diz *"atualizarFicha versionado com rastro"*, e
   * versão de receita sem autor é meia-gravação: em três meses ninguém sabe quem mudou a ficha.
   *
   * ⚠️ E ele é resolvido pelo **PAPEL NA EMPRESA** (`userCompanyRole`), nunca por e-mail
   * chutado: no sprint das bases eu usei `admin@contaia.com.br` e levei **403**, porque ele não
   * é o dono desta empresa. ⛔ Sem OWNER resolvido o script **ABORTA** em vez de gravar anônimo.
   */
  const papel = await prisma.userCompanyRole.findFirst({
    where: { companyId: EMPRESA, role: { name: 'OWNER' } },
    select: { userId: true, user: { select: { email: true, name: true } } },
  })
  if (!papel) throw new Error('não achei o OWNER desta empresa — sem autor eu não gravo')
  console.log(`  autor do rastro: ${papel.user?.name ?? papel.user?.email ?? papel.userId}`)
  const r = await aplicarNormalizacao(EMPRESA, { preview: p, userId: papel.userId }, prisma)
  for (const a of r.fichas) {
    console.log(`  «${a.nome}» v${a.de} → v${a.para} · ${a.resumo}`)
  }
  for (const b of r.basesApontadas) console.log(`  base ${b.tamanho} → «${b.nome}»${b.criada ? ' (criada)' : ''}`)
  for (const d of r.dosesADeclarar) console.log(`  pendência de dose: «${d.ficha}» espera «${d.item}»`)
  for (const s of r.pulados) console.log(`  ⚠️ pulado: «${s.nome}» — ${s.porque}`)
  console.log(`\n⭐ ${r.fichas.length} fichas versionadas · ${r.basesApontadas.length} bases apontadas`)
  console.log('⛔ HISTÓRICO NÃO REPROCESSADO — margem/liga/casa são leitura ao vivo e melhoram sozinhas.\n')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('⛔', e instanceof Error ? e.message : e)
    await prisma.$disconnect()
    process.exit(1)
  })
