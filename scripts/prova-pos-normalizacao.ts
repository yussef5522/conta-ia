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
import { montarCtx, explodir } from '@/lib/stock/vendas/baixa-venda'
import { custoMedioPorItem } from '@/lib/stock/saldo'

const CO = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const brl = (n: number | null | undefined) =>
  n == null ? 'a apurar' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * ⭐⭐ A JANELA DO GESTO SAI DAS PRÓPRIAS VERSÕES, nunca de uma constante cravada.
 *
 * ⛔ Datar à mão (`'2026-10-08T23:40Z'`) mentiria na 2ª gravação: as 2 últimas entraram num
 * minuto diferente das 9, e a janela velha diria "0 movimentos" sem nem olhar pra elas —
 * verde por não ter procurado. A versão da ficha É o carimbo do gesto, então é dela que a
 * janela nasce, com folga de 2 minutos pra cada lado.
 */
const FOLGA_MS = 2 * 60 * 1000

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`[pós-normalização] ${nome.trim()}\n`)

  /** ⚠️ o preview é lido UMA vez e serve as duas seções — duas leituras poderiam divergir */
  const p = await previewNormalizacao(CO, {}, prisma)

  /* ══════════ 0. O COMBO — custo NA MÃO × PELA PORTA, e a dose dizendo ×2 ══════════ */
  console.log('═══ 0. O COMBO «PROMO 2 PIZZAS GRANDES» — 2× a grande')
  /** ⚠️ resolve pelo ITEM: `stock_ficha` não tem `@relation` com `stock_item` — o isolamento
   *  do módulo proíbe referência às tabelas fechadas, então o join é na mão */
  const itemCombo = await prisma.stockItem.findFirst({
    where: { companyId: CO, nome: { contains: 'PROMO 2 PIZZAS' } },
    select: { id: true, nome: true },
  })
  const combo = itemCombo
    ? await prisma.stockFicha.findFirst({
        where: { companyId: CO, itemProduzidoId: itemCombo.id },
        select: { id: true, versaoAtual: true },
      })
    : null
  if (!combo) {
    console.log('  ⛔ não achei a ficha do combo')
  } else {
    const v = await prisma.stockFichaVersao.findFirst({
      where: { fichaId: combo.id, versao: combo.versaoAtual },
      select: { id: true, versao: true },
    })
    const comps = await prisma.stockFichaComponente.findMany({
      where: { versaoId: v!.id },
      select: { itemId: true, qtdPlanejada: true },
    })
    const itens = await prisma.stockItem.findMany({
      where: { id: { in: comps.map((c) => c.itemId) } },
      select: { id: true, nome: true },
    })
    const nomeDe = new Map(itens.map((i) => [i.id, i.nome]))
    const custos = await custoMedioPorItem(prisma, CO)
    const ctx = await montarCtx(CO, prisma)

    /** ⭐ A SOMA NA MÃO — componente a componente, sem o motor no meio */
    let naMao = 0
    for (const c of comps) {
      const cm = custos.get(c.itemId) ?? null
      if (cm != null) naMao += c.qtdPlanejada * cm
      console.log(`      ${c.qtdPlanejada} × «${nomeDe.get(c.itemId)}» @ ${brl(cm)} = ${brl(cm == null ? null : c.qtdPlanejada * cm)}`)
    }
    /** ⭐ A PORTA ÚNICA — a MESMA explosão que a baixa de venda executa */
    const acc = new Map<string, number>()
    explodir({ tipo: 'FICHA', fichaId: combo.id }, 1, ctx, acc)
    let pelaPorta = 0
    for (const [itemId, qtd] of acc) {
      const cm = custos.get(itemId)
      if (cm != null) pelaPorta += qtd * cm
    }
    const bate = Math.abs(naMao - pelaPorta) < 0.005
    console.log(`  v${v!.versao} · ${comps.length} componentes`)
    console.log(`      NA MÃO ${brl(naMao)} × PELA PORTA ${brl(pelaPorta)} → ${bate ? '⭐ BATE ao centavo' : '⛔ NÃO BATE'}`)

    /**
     * ⚠️ E ELE TEM QUE SER ~2× A GRANDE — a conta que o dono mandou conferir. A base grande é
     * lida da `stock_base_do_tamanho`, nunca de um número escrito aqui: cravar 12,56 faria o
     * teste passar a mentir no dia em que o custo de um insumo mudasse.
     */
    const baseG = await prisma.stockBaseDoTamanho.findFirst({ where: { companyId: CO, tamanho: 'GRANDE' } })
    if (baseG) {
      const accG = new Map<string, number>()
      explodir({ tipo: 'FICHA', fichaId: baseG.fichaId }, 1, ctx, accG)
      let grande = 0
      for (const [itemId, qtd] of accG) {
        const cm = custos.get(itemId)
        if (cm != null) grande += qtd * cm
      }
      const razao = grande > 0 ? naMao / grande : null
      console.log(
        `      a base GRANDE custa ${brl(grande)} → o combo é ${razao == null ? 'a apurar' : razao.toFixed(4) + '×'} ` +
          `${razao != null && Math.abs(razao - 2) < 0.0001 ? '⭐ exatamente 2×' : '⛔ NÃO é 2×'}`,
      )
    }

    /** ⭐ a pendência do molho tem que DIZER que são 2 pizzas (ordem do dono) */
    const molho = p.itens.molho
    if (molho) {
      const dose = await prisma.stockDoseADeclarar.findFirst({
        where: { companyId: CO, fichaId: combo.id, itemId: molho.id },
        select: { motivo: true },
      })
      const diz = dose?.motivo.includes('2 pizzas') ?? false
      console.log(`      a dose do molho: ${diz ? '⭐ DIZ que são 2 pizzas' : '⛔ NÃO diz'} — «${dose?.motivo ?? 'sem pendência'}»`)
    }
  }

  /* ══════════ 1. O Δ QUE SOBRA — tem que ser só o das 2 que PERGUNTAM ══════════ */
  console.log('═══ 1. O Δ ABSORVIDO (preview de novo, MESMA janela de 30 dias)')
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
  /** as versões das 11 bases que o gesto criou — cada `criadoEm` é um instante de gravação */
  const idsBases = p.grupos.flatMap((g) => g.linhas.map((l) => l.fichaId))
  const versoesDoGesto = await prisma.stockFichaVersao.findMany({
    where: { companyId: CO, fichaId: { in: idsBases }, versao: { gt: 1 } },
    select: { criadoEm: true, versao: true, fichaId: true },
    orderBy: { criadoEm: 'asc' },
  })
  /**
   * ⛔⛔ A JANELA É ±2 MIN DE **CADA** INSTANTE, NUNCA O INTERVALO min→max.
   *
   * A 1ª versão deste script usava `min(instantes) → max(instantes)` — e as 11 versões
   * nasceram em DUAS gravações separadas por 3 HORAS, então a janela larga engolia tudo que
   * aconteceu no meio: ela acusou os **8 `ENTRADA_NF` que o próprio dono lançou às 21:01**
   * como se fossem do gesto. ⚠️ Janela que mistura a operação com o gesto não prova nada
   * sobre o gesto — e nesse caso prova ao CONTRÁRIO do que é verdade.
   */
  const instantes = versoesDoGesto.map((v) => v.criadoEm.getTime())
  const gravacoes = [...new Set(instantes.map((t) => Math.round(t / (5 * 60 * 1000))))].length
  console.log(`  versões criadas pelo gesto: ${versoesDoGesto.length} · em ${gravacoes} gravação(ões)`)
  const naJanela: { tipo: string; quantidade: number; criadoEm: Date }[] = []
  for (const t of instantes) {
    const perto = await prisma.stockMovement.findMany({
      where: { companyId: CO, criadoEm: { gte: new Date(t - FOLGA_MS), lt: new Date(t + FOLGA_MS) } },
      select: { tipo: true, criadoEm: true, quantidade: true },
    })
    for (const m of perto) if (!naJanela.some((x) => x.criadoEm.getTime() === m.criadoEm.getTime() && x.tipo === m.tipo)) naJanela.push(m)
  }
  for (const v of versoesDoGesto) {
    console.log(`     v${v.versao} em ${v.criadoEm.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', timeStyle: 'medium', dateStyle: 'short' })}`)
  }
  console.log(`  ⛔ movimentos criados a ±2 min de QUALQUER uma dessas versões: ${naJanela.length}`)
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
