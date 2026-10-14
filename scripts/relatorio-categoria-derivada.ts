/**
 * 📋 O RELATÓRIO DAS CATEGORIAS "DERIVADO" — item 5 do sprint da cesta (14/10/2026).
 *
 * Ordem do dono: *"A linha de categoria fica SÓ informativa. O RELATÓRIO lista todos os
 * produtos com categoria/teto «derivado» + os NOMES REAIS das seções do cardápio deles — e
 * liga esses nomes à régua certa no mapa único (provável que as seções do dono já estejam
 * certas e o mapa só não conheça os nomes)."*
 *
 * ⛔ **READ-ONLY.** Ele não grava uma linha: o mapa `REGUA_POR_SECAO` é CÓDIGO, e ligar nome
 * novo nele é um commit, não um UPDATE — por isso este script MEDE e o conserto é revisável.
 *
 * ⚠️ **REGRA 8b:** resolve a empresa por **ID** e **ABORTA** se ela não existir neste banco,
 * imprimindo contra qual banco mediu. *Zero silencioso é indistinguível de "não tem"* — foi
 * assim que eu concluí por escrito que 4 mapeamentos tinham sumido, medindo o SQLite de dev.
 */
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { lerMargem } from '@/lib/margem/leitura'
import { REGUA_POR_SECAO } from '@/lib/margem/veredito-de-preco'
import { secoesDaEmpresa } from '@/lib/stock/cardapio/secoes-db'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)

  /** ⭐ as seções REAIS do cardápio DELE — é o lado que o mapa pode não conhecer */
  const secoes = await secoesDaEmpresa(EMPRESA)
  console.log(`\n═══ AS SEÇÕES DO CARDÁPIO DA EMPRESA (${secoes.length}) ═══`)
  for (const s of secoes) {
    const r = REGUA_POR_SECAO[s.chave]
    const estado = r == null
      ? '⛔ O MAPA NÃO CONHECE ESTA CHAVE → cai em derivado 40%'
      : r.origem === 'DECLARADO'
        ? `⭐ DECLARADO ${r.tetoPct}%`
        : `⚠️ DERIVADO ${r.tetoPct}% — o dono ainda não declarou o teto`
    console.log(`  ${s.chave.padEnd(14)} «${s.nome}» · ${estado}`)
  }

  // ⚠️ MES: a janela que a tela abre por default
  const d = await lerMargem(EMPRESA, 'MES')
  const produtos = d.produtos

  const derivados = produtos.filter((p) => p.regua.origem === 'DERIVADO')
  const declarados = produtos.length - derivados.length

  console.log(`\n═══ OS PRODUTOS (${produtos.length}) ═══`)
  console.log(`  ⭐ com teto DECLARADO: ${declarados}`)
  console.log(`  ⚠️ com teto DERIVADO:  ${derivados.length}`)

  /** agrupa por SEÇÃO, com as unidades — a ordem é a do VOLUME, que é onde dói */
  const porSecao = new Map<string, { un: number; n: number; porque: string; nomes: string[] }>()
  for (const p of derivados) {
    const k = p.secao
    const g = porSecao.get(k) ?? { un: 0, n: 0, porque: p.regua.porque, nomes: [] }
    g.un += p.unidades
    g.n += 1
    if (g.nomes.length < 6) g.nomes.push(p.nome)
    porSecao.set(k, g)
  }

  console.log(`\n═══ OS DERIVADOS, POR SEÇÃO (ordenado pelo VOLUME) ═══`)
  const linhas = [...porSecao.entries()].sort((a, b) => b[1].un - a[1].un)
  for (const [secao, g] of linhas) {
    const nomeReal = secoes.find((s) => s.chave === secao)?.nome ?? '(não está no cardápio dele)'
    console.log(`\n  ⚠️ ${secao} «${nomeReal}» · ${g.n} produtos · ${g.un} un no período`)
    console.log(`     porquê: ${g.porque}`)
    console.log(`     exemplos: ${g.nomes.join(' · ')}`)
  }

  /**
   * ⭐⭐ O VEREDITO QUE O DONO PEDIU: separar *"o mapa não conhece o nome"* (que é conserto de
   * uma linha no mapa) de *"o dono ainda não declarou o teto desta categoria"* (que é decisão
   * dele). A hipótese dele era a primeira; quem decide é este número.
   */
  const chavesDoMapa = new Set(Object.keys(REGUA_POR_SECAO))
  const desconhecidas = linhas.filter(([s]) => !chavesDoMapa.has(s))
  const semTetoDeclarado = linhas.filter(
    ([s]) => chavesDoMapa.has(s) && REGUA_POR_SECAO[s].origem === 'DERIVADO',
  )

  console.log(`\n═══ O VEREDITO ═══`)
  console.log(`  ⛔ seções que o MAPA NÃO CONHECE: ${desconhecidas.length}`)
  for (const [s, g] of desconhecidas) console.log(`       ${s} · ${g.un} un — conserto de 1 linha no mapa`)
  console.log(`  ⚠️ seções no mapa SEM TETO DECLARADO pelo dono: ${semTetoDeclarado.length}`)
  for (const [s, g] of semTetoDeclarado) console.log(`       ${s} · ${g.un} un — decisão DELE, não minha`)

  /** ⚠️ e os TOP derivados por volume, pro dono ver o que mais pesa */
  console.log(`\n═══ OS 15 DERIVADOS DE MAIOR VOLUME ═══`)
  for (const p of [...derivados].sort((a, b) => b.unidades - a.unidades).slice(0, 15)) {
    console.log(
      `  ${String(p.unidades).padStart(5)} un · teto ${p.regua.tetoPct}% · ${p.secao.padEnd(12)} · ${p.nome}`,
    )
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('⛔', e instanceof Error ? e.message : e)
    await prisma.$disconnect()
    process.exit(1)
  })
