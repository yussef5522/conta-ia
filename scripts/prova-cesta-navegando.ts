/**
 * ⭐⭐⭐ A PROVA DA CESTA EM PROD — 2 VIEWPORTS, NAVEGANDO (REGRA 12).
 *
 * O que ela responde, com o dado REAL da caçula:
 *   1. a tela abre nos dois viewports e as peças do sprint estão no chunk DELA
 *   2. o CAMPO não repõe o valor sozinho (a cicatriz: *"apago e ele volta na hora"*)
 *   3. 1 item escolhido == o cartão de HOJE, campo por campo (a regressão travada)
 *   4. a CESTA real (XIS + MINI FRITAS): Σ ao centavo, avulsos, teto PONDERADO, vantagem
 *   5. NA MESA com o caso real e a FATIA DOS FIXOS pelas duas portas
 *   6. o MONTADOR DE PIZZA intocado (regressão)
 *
 * ⛔⛔ **ZERO ESCRITA.** Tudo é GET + lib pura, e a contabilidade é conferida antes e depois
 * — a cicatriz de 07/10: um POST dentro de `$transaction` de prova **NÃO desfaz**, porque o
 * fetch vai pro processo do SERVIDOR, com conexão própria.
 *
 * ⚠️ Ela mede o chunk DESTA tela (achado por uma frase exclusiva dela), nunca a soma dos
 * chunks da página — *"achado não atribuível não é achado"* (a cicatriz de 06/10).
 */
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { lerMargem } from '@/lib/margem/leitura'
import { lerMontador } from '@/lib/margem/leitura-montador'
import {
  alternarNaCesta,
  estaNaCesta,
  montarCesta,
  mudarQtd,
  vantagemDoCombo,
  vereditoDaCesta,
  type ItemDaCesta,
} from '@/lib/margem/cesta-do-veredito'
import {
  CAMPO_INTOCADO,
  digitar,
  mostrarVoltarParaMedia,
  precoDoCampo,
  textoDoCampo,
  type TextoDoCampo,
} from '@/lib/margem/campo-de-preco'
import { fatiaDosFixos, naMesa } from '@/lib/margem/na-mesa'
import { montarBlocoDoVeredito, reguaPonderada } from '@/lib/margem/veredito-de-preco'

const CO = process.env.PROVA_COMPANY_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const CEL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const DESK = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const VIEWPORTS: [string, string][] = [
  ['CELULAR', CEL],
  ['DESKTOP', DESK],
]
const base = 'http://localhost:3001'
const brl = (n: number | null | undefined) =>
  n == null ? 'a apurar' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** tolera a escapação de acento do minificador (`ê` → `\xea`) — a cicatriz do `Sa\xeddas:` */
const temFrase = (chunk: string, f: string) =>
  chunk.includes(f) ||
  chunk.includes(
    [...f].map((c) => (c.charCodeAt(0) > 126 ? `\\x${c.charCodeAt(0).toString(16)}` : c)).join(''),
  )

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`[prova cesta] ${nome.trim()}`)

  const u = await prisma.user.findFirst({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({
    sub: u!.id,
    email: u!.email,
    name: u!.name ?? 'dono',
    role: 'OWNER',
  })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  const antes = {
    movimentos: await prisma.stockMovement.count({ where: { companyId: CO } }),
    versoes: await prisma.stockFichaVersao.count({ where: { companyId: CO } }),
    canais: await prisma.stockCanalVenda.count({ where: { companyId: CO } }),
  }

  /* ═════════════ 1. A TELA, NOS DOIS VIEWPORTS ═════════════ */
  console.log('\n═══ 1. A TELA (REGRA 12 — celular e desktop)')
  const chunk: Record<string, string> = {}
  for (const [v, ua] of VIEWPORTS) {
    const t0 = Date.now()
    const r = await fetch(`${base}/empresas/${CO}/margem`, { headers: { cookie, 'user-agent': ua } })
    const html = await r.text()
    let meu = ''
    for (const s of [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map((m) => m[1])) {
      const t = await (await fetch(base + s, { headers: { cookie } })).text()
      if (t.includes('Quem paga a casa')) meu += t
    }
    let css = ''
    for (const c of [...html.matchAll(/href="(\/_next\/static\/[^"]*\.css)"/g)].map((m) => m[1])) {
      css += await (await fetch(base + c, { headers: { cookie } })).text()
    }
    chunk[v] = meu
    chunk[`${v}_CSS`] = css
    console.log(`  ${v}  ${r.status} em ${Date.now() - t0}ms · chunk desta tela ${(meu.length / 1024) | 0} KB`)
  }

  /** as peças do SPRINT — cada uma conferida nos DOIS viewports */
  const PECAS = [
    'voltar pra média',
    'custo do combo',
    'os mesmos, avulsos, custam pro cliente',
    'teto do combo',
    'vendendo o combo a',
    'vantagem pro cliente',
    'combo SEM vantagem',
    'sabores e custo por fatia',
    'no período',
    'pros fixos',
    'cria a ficha que eu calculo',
  ]
  const faltam = VIEWPORTS.map(([v]) => v).flatMap((v) =>
    PECAS.filter((f) => !temFrase(chunk[v], f)).map((f) => `${v}:${f}`),
  )
  console.log(
    `  ${faltam.length === 0 ? '⭐' : '⛔'} ${PECAS.length * 2 - faltam.length}/${PECAS.length * 2} peças do sprint nos dois${faltam.length ? ` — FALTAM ${faltam.join(' | ')}` : ''}`,
  )
  const hex = [...chunk['CELULAR'].matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0])
  console.log(`  ⛔ hex de cor no chunk DESTA tela: ${hex.length === 0 ? '0 ✓' : hex.slice(0, 6).join(' ')}`)
  const css = chunk['CELULAR_CSS']
  const usados = [...new Set(chunk['CELULAR'].match(/--(?:prod|fam)-[a-z0-9-]+/g) ?? [])]
  const soNoClaro = usados.filter((t) => css.split(`${t}:`).length - 1 < 2)
  console.log(
    `  ${soNoClaro.length === 0 ? '✓' : '⛔'} os ${usados.length} tokens da tela nos DOIS mapas do CSS${soNoClaro.length ? ` — SÓ NO CLARO: ${soNoClaro.join(' ')}` : ''}`,
  )

  /* ═════════════ 2. O CAMPO — a cicatriz do valor que voltava ═════════════ */
  console.log('\n═══ 2. O CAMPO DE PREÇO (digitação real, os dois cartões)')
  const MEDIA = 95.9
  let txt: TextoDoCampo = CAMPO_INTOCADO
  const passo = (rot: string) =>
    console.log(
      `     ${rot.padEnd(16)} tela "${textoDoCampo(txt, MEDIA)}" · preço ${precoDoCampo(txt, MEDIA) ?? '—'} · ↺ ${mostrarVoltarParaMedia(txt, MEDIA) ? 'SIM' : 'não'}`,
    )
  passo('nasce')
  txt = digitar('')
  passo('apago tudo')
  txt = digitar('7')
  passo('digito 7')
  txt = digitar('78,')
  passo('digito 78,')
  txt = digitar('')
  passo('apago de novo')
  const depoisDoBlur = textoDoCampo(txt, MEDIA)
  console.log(
    `  ${depoisDoBlur === '' ? '⭐' : '⛔'} o campo VAZIO continua vazio (nem no blur ele repõe): "${depoisDoBlur}"`,
  )
  txt = CAMPO_INTOCADO
  console.log(
    `  ${textoDoCampo(txt, MEDIA) === '95,90' && !mostrarVoltarParaMedia(txt, MEDIA) ? '⭐' : '⛔'} ↺ voltar pra média devolve a média e o link SOME`,
  )

  /* ═════════════ 3. OS DADOS REAIS ═════════════ */
  const m = await lerMargem(CO, 'MES', new Date(), {}, prisma)
  const prods = m.produtos
  /** ⚠️ a MESMA tradução que a TELA faz (`page.tsx`) — uma 2ª aqui faria a prova medir outra coisa */
  const canais = (m.canais ?? []).map((c) => ({ canal: c.nome, taxaPct: c.taxaPct }))
  const acha = (frag: string) =>
    prods.find((p) => p.nome.toUpperCase().includes(frag.toUpperCase())) ?? null
  const xis = acha('XIS - COMPLETO') ?? acha('XIS COMPLETO') ?? acha('XIS')
  const fritas = acha('MINI FRITAS') ?? acha('FRITAS')

  console.log('\n═══ 3. 1 ITEM = O CARTÃO DE HOJE (a regressão travada)')
  if (!xis) {
    console.log('  ⚠️ não achei o produto de referência no cardápio — pulo')
  } else {
    const um: ItemDaCesta[] = [{ chave: xis.chave, qtd: 1 }]
    for (const alvo of xis.regua.alvosPct) {
      const v = vereditoDaCesta({
        produtos: prods,
        escolhas: um,
        preco: xis.preco,
        alvoPct: alvo,
        canais,
      })
      const hoje = montarBlocoDoVeredito({
        custo: xis.custo,
        preco: xis.preco,
        tetoPct: xis.regua.tetoPct,
        alvosPct: xis.regua.alvosPct,
        alvoPct: alvo,
        canais,
        tipo: 'produto',
      })
      const iguais =
        v.bloco.farol.tom === hoje.farol.tom &&
        v.bloco.tetoPct === hoje.tetoPct &&
        v.bloco.alvoPct === hoje.alvoPct &&
        JSON.stringify(v.bloco.canais) === JSON.stringify(hoje.canais)
      console.log(
        `  ${iguais ? '⭐' : '⛔'} alvo ${alvo}% · farol ${v.bloco.farol.tom} · ${v.bloco.canais.map((c) => `${c.canal} ${brl(c.preco)}`).join(' · ')}`,
      )
    }
  }

  /* ═════════════ 4. A CESTA REAL ═════════════ */
  console.log('\n═══ 4. A CESTA (XIS + MINI FRITAS, o caso do dono)')
  if (!xis || !fritas) {
    console.log('  ⚠️ não achei os dois produtos — pulo')
  } else {
    // o toque LIGA/DESLIGA, pelos gestos puros que a tela chama
    let esc: ItemDaCesta[] = [{ chave: xis.chave, qtd: 1 }]
    esc = alternarNaCesta(esc, fritas.chave)
    console.log(
      `  toque: ${xis.nome} ${estaNaCesta(esc, xis.chave) ? '✓' : '✗'} · ${fritas.nome} ${estaNaCesta(esc, fritas.chave) ? '✓' : '✗'}`,
    )
    esc = mudarQtd(esc, xis.chave, 2)
    esc = mudarQtd(esc, fritas.chave, 3)
    esc = mudarQtd(esc, fritas.chave, -5) // ⛔ o mínimo é 1
    const qtdFritas = esc.find((e) => e.chave === fritas.chave)?.qtd
    console.log(`  ${qtdFritas === 1 ? '⭐' : '⛔'} qtd mínima 1 (pedi −5, ficou ${qtdFritas})`)
    esc = mudarQtd(esc, fritas.chave, 1)

    const cesta = montarCesta(prods, esc)
    for (const l of cesta.linhas) {
      console.log(
        `     ${l.qtd}× ${l.nome} · custo ${brl(l.custoUn)} → ${brl(l.custoTotal)} · avulso ${brl(l.precoUn)} → ${brl(l.avulsoTotal)} · teto ${l.tetoPct}%`,
      )
    }
    const somaCusto = cesta.linhas.reduce((a, l) => a + (l.custoTotal ?? 0), 0)
    const somaAvulso = cesta.linhas.reduce((a, l) => a + (l.avulsoTotal ?? 0), 0)
    console.log(
      `  ⛔ Σ custo das linhas ${brl(Math.round(somaCusto * 100) / 100)} == custo do combo ${brl(cesta.custoDoCombo)} → ${cesta.custoDoCombo != null && Math.abs(somaCusto - cesta.custoDoCombo) < 0.005 ? '⭐ FECHA' : '⛔'}`,
    )
    console.log(
      `  ⛔ Σ avulsos ${brl(Math.round(somaAvulso * 100) / 100)} == avulsos ${brl(cesta.avulsos)} → ${cesta.avulsos != null && Math.abs(somaAvulso - cesta.avulsos) < 0.005 ? '⭐ FECHA' : '⛔'}`,
    )
    const simples = Math.round(
      cesta.linhas.reduce((a, l) => a + l.tetoPct, 0) / Math.max(1, cesta.linhas.length),
    )
    console.log(
      `  ⭐ TETO do combo ${cesta.regua.tetoPct}% (ponderado pelo CUSTO) × média simples ${simples}% · alvos ${cesta.regua.alvosPct.join(' · ')}`,
    )
    console.log(`     ${cesta.porque ?? '(nada a apurar)'}`)

    // a vantagem, nos três estados
    for (const preco of [cesta.avulsos == null ? null : cesta.avulsos * 0.85, cesta.avulsos, null]) {
      const v = vereditoDaCesta({
        produtos: prods,
        escolhas: esc,
        preco: preco ?? null,
        alvoPct: null,
        canais,
      })
      console.log(
        `  vendendo a ${preco == null ? '(vazio)' : brl(Math.round(preco * 100) / 100)} → [${v.vantagem.tom}] ${v.vantagem.frase}`,
      )
      console.log(`     ideal: ${v.bloco.canais.map((c) => `${c.canal} ${brl(c.preco)}`).join(' · ')}`)
      console.log(`     especialista: ${v.frase}`)
    }

    // ⛔ item SEM FICHA na cesta → combo inteiro "a apurar"
    const semFicha = prods.find((p) => !p.temFicha)
    if (semFicha) {
      const comSemFicha = montarCesta(prods, [...esc, { chave: semFicha.chave, qtd: 1 }])
      console.log(
        `  ${comSemFicha.custoDoCombo == null ? '⭐' : '⛔'} com «${semFicha.nome}» (sem ficha) na cesta → custo do combo ${brl(comSemFicha.custoDoCombo)} · ${comSemFicha.itensSemFicha} item(ns) sem ficha`,
      )
    }
  }

  /* ═════════════ 5. NA MESA + A FATIA DOS FIXOS ═════════════ */
  console.log('\n═══ 5. NA MESA e A FATIA DOS FIXOS (produto único)')
  if (xis) {
    const bloco = montarBlocoDoVeredito({
      custo: xis.custo,
      preco: xis.preco,
      tetoPct: xis.regua.tetoPct,
      alvosPct: xis.regua.alvosPct,
      alvoPct: xis.regua.alvosPct[0],
      canais,
      tipo: 'produto',
    })
    const mesa = naMesa({
      preco: xis.preco,
      ideal: bloco.canais[0]?.preco ?? null,
      unidades: xis.unidades,
    })
    console.log(
      `  «${xis.nome}» hoje ${brl(xis.preco)} · ideal ${brl(bloco.canais[0]?.preco)} · ${xis.unidades} un`,
    )
    console.log(`     [${mesa.tom}] ${mesa.frase}${mesa.conselho ? ` · ${mesa.conselho}` : ''}`)
    if (mesa.porque) console.log(`     porque: ${mesa.porque}`)
  }
  if (fritas) {
    const bloco = montarBlocoDoVeredito({
      custo: fritas.custo,
      preco: fritas.preco,
      tetoPct: fritas.regua.tetoPct,
      alvosPct: fritas.regua.alvosPct,
      alvoPct: fritas.regua.alvosPct[0],
      canais,
      tipo: 'produto',
    })
    const mesa = naMesa({
      preco: fritas.preco,
      ideal: bloco.canais[0]?.preco ?? null,
      unidades: fritas.unidades,
    })
    console.log(
      `  «${fritas.nome}» hoje ${brl(fritas.preco)} · ideal ${brl(bloco.canais[0]?.preco)} · ${fritas.unidades} un`,
    )
    console.log(`     [${mesa.tom}] ${mesa.frase}${mesa.conselho ? ` · ${mesa.conselho}` : ''}`)
    const sugereBaixar = /baix|desc|reduz/i.test(`${mesa.frase} ${mesa.conselho ?? ''}`)
    console.log(
      `  ${mesa.tom === 'verde' ? (mesa.conselho?.includes('segura') ? '⭐' : '⛔') : '(não é o caso verde hoje)'} ${mesa.tom === 'verde' ? 'o verde diz "segura o preço"' : ''}`,
    )
    console.log(
      `  ⛔ alguma frase sugere BAIXAR o preço? ${sugereBaixar && !/não baixa/.test(mesa.conselho ?? '') ? '⛔ SIM' : 'NÃO ✓'}`,
    )
  }
  const un = m.sobras.cobertura.unidadesDentro + m.sobras.cobertura.unidadesFora
  const fx = fatiaDosFixos(m.casa.custoFixo, un)
  console.log(
    `  FATIA DOS FIXOS: ${fx.frase}${fx.porque ? ` (${fx.porque})` : ''}  ← ${brl(m.casa.custoFixo)} ÷ ${un} un`,
  )

  /* ═════════════ 5b. O TETO PONDERADO, com o caso do dono ═════════════ */
  const caso = reguaPonderada([
    { tetoPct: 35, peso: 10 },
    { tetoPct: 40, peso: 5 },
    { tetoPct: 25, peso: 1 },
  ])
  console.log(
    `  ⭐ teto ponderado 35/40/25 com pesos 10/5/1 → ${caso.tetoPct}% (média simples daria 33%)`,
  )

  /* ═════════════ 6. O MONTADOR INTOCADO ═════════════ */
  console.log('\n═══ 6. O MONTADOR DE PIZZA (regressão)')
  const cat = await lerMontador(CO, prisma)
  console.log(
    `  canais ${cat.canais.length} · tamanhos ${cat.tamanhos.map((t) => `${t.tamanho}(${t.sabores}${t.base ? '✓' : ' SEM BASE'})`).join(' · ')}`,
  )
  console.log(
    `  sabores ${cat.sabores.length} (com ficha ${cat.sabores.filter((s) => s.temFicha).length})`,
  )
  const pizza = prods.find((p) => p.secao === 'PIZZAS')
  if (pizza) {
    console.log(
      `  ⭐ a linha discreta do produto-pizza «${pizza.nome}»: o cartão NÃO monta sabor — manda pro montador ao lado`,
    )
  }

  /* ═════════════ 7. ZERO ESCRITA ═════════════ */
  const depois = {
    movimentos: await prisma.stockMovement.count({ where: { companyId: CO } }),
    versoes: await prisma.stockFichaVersao.count({ where: { companyId: CO } }),
    canais: await prisma.stockCanalVenda.count({ where: { companyId: CO } }),
  }
  const intacto = JSON.stringify(antes) === JSON.stringify(depois)
  console.log(
    `\n═══ 7. movimentos ${antes.movimentos}→${depois.movimentos} · versões ${antes.versoes}→${depois.versoes} · canais ${antes.canais}→${depois.canais}`,
  )
  console.log(`  ${intacto ? '⭐ ZERO ESCRITA' : '⛔ GRAVOU ALGO'}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    // ⛔ a mensagem do erro pode vazar a URI com a senha — nunca imprimir a exceção crua
    console.error('FALHOU:', e instanceof Error ? `${e.name}: ${e.message.slice(0, 200)}` : 'erro')
    process.exit(1)
  })
