/**
 * ⭐⭐⭐ A PROVA DO v3.1 EM PROD — 3 TAMANHOS, COMPARANDO COM A REFERÊNCIA.
 *
 * ⛔⛔ **ZERO ESCRITA.** Tudo aqui é GET + lib pura, e a contabilidade de config/avisos é
 * conferida antes e depois (a cicatriz de 07/10: um POST dentro de `$transaction` de prova
 * NÃO desfaz, porque o fetch vai pro processo do SERVIDOR, com conexão própria).
 *
 * ⚠️ Ela mede o chunk DESTA tela (achado por uma frase exclusiva dela), nunca a soma dos 81
 * chunks da página — *"achado não atribuível não é achado"* (a cicatriz de 06/10, em que o
 * `#185FA5` do shell virou "hex cravado voltou").
 *
 * ⚠️ E as frases são conferidas com a escapação do MINIFICADOR em mente: ele escreve `ê` como
 * `\xea` (`ocorr\xeancia`) — a cicatriz do `Sa\xeddas:` de 15/09. Por isso as âncoras são
 * pedaços SEM acento quando dá, e a comparação tolera as duas formas.
 */
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { lerMargem } from '@/lib/margem/leitura'
import { lerMontador } from '@/lib/margem/leitura-montador'
import { montarPlacar, montarCarregadores, linhaDaCobertura } from '@/lib/margem/placar'
import { montarPizza } from '@/lib/margem/montador'
import { lerReferenciaVisual } from '@/lib/referencias/visual'

const CO = process.env.PROVA_COMPANY_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const CEL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const DESK = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
/**
 * ⭐ OS TRÊS TAMANHOS que o dono pediu (390 · 1280 · 1600+). ⚠️ O user-agent NÃO muda o
 * layout — ele é decidido por `@media` no navegador. Então a prova dos 3 tamanhos aqui é:
 * (a) a PÁGINA responde nos 3 e (b) **as REGRAS de cada corte existem no CSS que prod serve**
 * — que é a única coisa que o servidor pode afirmar sem um navegador de verdade. O olho do
 * dono continua sendo o que fecha (screenshot indisponível nesta sessão).
 */
const VIEWPORTS: [string, string][] = [
  ['CELULAR 390', CEL],
  ['NOTEBOOK 1280', DESK],
  ['MONITOR 1600+', DESK],
]
const base = 'http://localhost:3001'
const brl = (n: number | null | undefined) =>
  n == null ? 'a apurar' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const p1 = (n: number | null | undefined) => (n == null ? 'a apurar' : `${(n * 100).toFixed(1)}%`)

/** tolera a escapação de acento do minificador (`à` → `\xe0`) */
const temFrase = (chunk: string, f: string) =>
  chunk.includes(f) ||
  chunk.includes(
    [...f]
      .map((c) => (c.charCodeAt(0) > 126 ? `\\x${c.charCodeAt(0).toString(16)}` : c))
      .join(''),
  )

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`[prova v3] ${nome.trim()}`)

  const u = await prisma.user.findFirst({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({ sub: u!.id, email: u!.email, name: u!.name ?? 'dono', role: 'OWNER' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  const antes = {
    canais: await prisma.stockCanalVenda.count({ where: { companyId: CO } }),
    regras: await prisma.stockRegraSaboresTamanho.count({ where: { companyId: CO } }),
    bases: await prisma.stockBaseDoTamanho.count({ where: { companyId: CO } }),
    avisos: await prisma.aviso.count({ where: { companyId: CO } }),
  }

  /* ═════════════ 1. A TELA, NOS 3 TAMANHOS ═════════════ */
  console.log('\n═══ 1. A TELA, NOS 3 TAMANHOS (390 · 1280 · 1600+)')
  const chunk: Record<string, string> = {}
  for (const [v, ua] of VIEWPORTS) {
    const t0 = Date.now()
    const r = await fetch(`${base}/empresas/${CO}/margem`, { headers: { cookie, 'user-agent': ua } })
    const html = await r.text()
    let meu = ''
    for (const s of [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map((m) => m[1])) {
      const t = await (await fetch(base + s, { headers: { cookie } })).text()
      // ⚠️ a frase exclusiva DESTA tela — é ela que torna o achado atribuível
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

  /* ═════════════ 2. SEÇÃO POR SEÇÃO, CONTRA O ARQUIVO DO DONO ═════════════ */
  console.log('\n═══ 2. OS 6 CARTÕES DA REFERÊNCIA — seção por seção')
  /**
   * ⭐⭐ A MESMA PORTA DE LEITURA DO GUARD. ⛔ Na 1ª rodada da v3.1 a sonda tinha a própria
   * cópia do regex de medidas e acusou *"FALTAM 1024"* sobre uma tela CORRETA — o corte do
   * `@media` entrando como se fosse largura de elemento. Duas réguas pro mesmo arquivo e uma
   * delas mente, e é sempre a que ninguém reconsertou.
   */
  const REF = lerReferenciaVisual()
  const ref = REF.html
  /** ⭐ cada peça é conferida nos DOIS lados: na REFERÊNCIA e no BUNDLE que prod serve */
  const SECOES: { secao: string; pecas: string[] }[] = [
    { secao: '1 · LINHA DE CHEGADA', pecas: ['A LINHA DE CHEGADA', 'casa do dia', 'sobra do dia', 'daqui pra frente cada venda'] },
    { secao: '2 · O PLACAR', pecas: ['O placar de', 'custo fixo:', 'O que as vendas deixaram', 'A casa custou', 'a casa se enchendo', 'a bandeira é 100%', 'o verde é o lucro', 'cobertura:', 'o dia em que a casa se pagou'] },
    { secao: '3 · QUEM CARREGOU', pecas: ['Quem carregou a casa', 'toque abre a ficha', 'ver todos', 'fora da obra', 'sabores sem ficha', 'criar fichas sobe a cobertura'] },
    { secao: '4 · A LIGA', pecas: ['A liga do', 'selo = veredito', 'encheu o caixa', 'melhor margem', 'mais vendidos', 'MEDIANA do'] },
    { secao: '5 · MONTADOR', pecas: ['Monte uma pizza e veja o custo', 'nada grava, nada baixa', 'custo da pizza', 'vendendo a', '1 ocorr', 'sabor — escolher', 'toque e escolha', 'escolher o sabor da fatia', 'sem ficha'] },
    { secao: '6 · A FILA', pecas: ['sabores vendidos sem ficha', 'maior volume primeiro', 'e mais'] },
  ]
  let faltouAlgo = false
  for (const { secao, pecas } of SECOES) {
    const naRef = pecas.filter((f) => !ref.includes(f))
    const faltam = VIEWPORTS.map(([v]) => v).flatMap((v) =>
      pecas.filter((f) => !temFrase(chunk[v], f)).map((f) => `${v}:${f}`),
    )
    if (naRef.length) console.log(`  ⚠️ ${secao}: peça que NÃO está na referência (a lista do probe está errada): ${naRef.join(' | ')}`)
    if (faltam.length) faltouAlgo = true
    console.log(`  ${faltam.length === 0 ? '✓' : '⛔'} ${secao}  ${pecas.length * VIEWPORTS.length - faltam.length}/${pecas.length * VIEWPORTS.length}${faltam.length ? ` FALTAM ${faltam.join(' | ')}` : ''}`)
  }
  console.log(`  ${faltouAlgo ? '⛔' : '⭐'} as 6 seções ${faltouAlgo ? 'TÊM BURACO' : `estão COMPLETAS nos ${VIEWPORTS.length} tamanhos`}`)

  /* ═════════════ 3. OS TOKENS E AS MEDIDAS, EXTRAÍDOS DA REFERÊNCIA ═════════════ */
  console.log('\n═══ 3. OS TOKENS E AS MEDIDAS')
  const hex = [...chunk['CELULAR 390'].matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0])
  console.log(`  ⛔ hex de cor no chunk DESTA tela: ${hex.length === 0 ? '0 ✓' : hex.slice(0, 6).join(' ')}`)

  const css = chunk['CELULAR 390_CSS']
  const usados = [...new Set((chunk['CELULAR 390'].match(/--(?:prod|fam)-[a-z0-9-]+/g) ?? []))]
  const soNoClaro = usados.filter((t) => css.split(`${t}:`).length - 1 < 2)
  console.log(`  ${soNoClaro.length === 0 ? '✓' : '⛔'} os ${usados.length} tokens da tela nos DOIS mapas do CSS${soNoClaro.length ? ` — SÓ NO CLARO: ${soNoClaro.join(' ')}` : ''}`)

  const cssRef = REF.css
  const letras = REF.letras
  const semLetra = letras.filter((t) => !chunk['CELULAR 390'].includes(`text-[${t}px]`))
  console.log(`  ${semLetra.length === 0 ? '✓' : '⛔'} as ${letras.length} hierarquias de letra da referência no bundle${semLetra.length ? ` — FALTAM ${semLetra.join(' ')}` : ''}`)

  const medidas = REF.medidas
  const semMedida = medidas.filter((t) => !chunk['CELULAR 390'].includes(`[${t}px]`))
  console.log(`  ${semMedida.length === 0 ? '✓' : '⛔'} as ${medidas.length} medidas da referência no bundle${semMedida.length ? ` — FALTAM ${semMedida.join(' ')}` : ''}`)
  console.log(`  ⛔ o botão de tema da referência em prod: ${chunk['CELULAR 390'].includes('theme-btn') ? 'VEIO (2ª porta do tema!)' : 'NÃO VEIO ✓ (a casa tem o dela)'}`)

  /* ═════════════ 3b. A LEI DE LAYOUT (v3.1) ═════════════ */
  console.log('\n═══ 3b. A LEI DE LAYOUT — largura cheia + duplas')
  const bundle = chunk['CELULAR 390']
  const semEspaco = (t: string) => t.replace(/\s+/g, '')
  const cssPlano = semEspaco(css)

  console.log(`  ⛔ a coluna de 860px centralizada: ${bundle.includes('max-w-[860px]') ? 'VOLTOU ⛔' : 'MORREU ✓'}`)
  console.log(`  ${bundle.includes('max-w-[1440px]') ? '✓' : '⛔'} teto 1440px no bundle · ${cssPlano.includes('max-width:1440px') ? '✓' : '⛔'} compilado no CSS que prod serve`)

  // ⭐ as REGRAS de cada corte: é isso que o navegador recebe e aplica em cada tamanho
  const CORTES: [string, string, string][] = [
    ['≥1024px (duplas montadas)', 'min-width:1024px', 'grid-template-columns:repeat(2,minmax(0,1fr))'],
    ['≤700px (padding do celular)', 'max-width:700px', 'padding-left:14px'],
  ]
  for (const [rot, media, regra] of CORTES) {
    const temMedia = cssPlano.includes(semEspaco(media))
    const temRegra = cssPlano.includes(semEspaco(regra))
    console.log(`  ${temMedia && temRegra ? '✓' : '⛔'} ${rot}: @media ${temMedia ? 'ok' : 'FALTA'} · a regra ${temRegra ? 'ok' : 'FALTA'}`)
  }
  for (const c of ['lg:grid-cols-2', 'lg:items-start', 'lg:gap-[14px]', 'max-[700px]:px-[14px]']) {
    console.log(`  ${bundle.includes(c) ? '✓' : '⛔'} ${c} no bundle`)
  }
  // ⛔ `.duo .card{margin-bottom:0}` — sem ele a coluna curta empurra a linha seguinte
  console.log(`  ${cssPlano.includes('margin-bottom:0px') || cssPlano.includes('margin-bottom:0') ? '✓' : '⛔'} a margem do cartão DENTRO da dupla é zerada em ≥1024`)

  /* ═════════════ 4. O PLACAR FECHA, A BARRA SOMA 100 ═════════════ */
  console.log('\n═══ 4. O PLACAR E A BARRA, no dado real')
  const m = await lerMargem(CO, 'MES', new Date(), {}, prisma)
  const p = montarPlacar(m.casa)
  console.log(`  [${p.sobra.rotulo}] ${brl(p.sobra.valor)}`)
  console.log(`       ${p.sobra.sublinha}`)
  console.log(`  [${p.casa.rotulo}] ${brl(p.casa.valor)} · ${p.casa.sublinha}`)
  console.log(`  [${p.resultado.rotulo}] ${p.resultado.tom === 'PAGOU' ? '+' : ''}${brl(p.resultado.valor)} · ${p.resultado.sublinha}`)
  if (p.resultado.ressalva) console.log(`       ressalva: ${p.resultado.ressalva}`)
  const fecha =
    p.sobra.valor != null && p.casa.valor != null && p.resultado.valor != null &&
    Math.abs(Math.abs(p.sobra.valor - p.casa.valor) - p.resultado.valor) < 0.02
  console.log(`  ⛔ cartão1 − cartão2 = cartão3? ${fecha ? '⭐ FECHA' : 'NÃO FECHA'}`)
  if (p.barra) {
    const soma = (p.barra.pago + p.barra.transbordo) * 100
    console.log(`  BARRA  índigo ${(p.barra.pago * 100).toFixed(1)}% + verde ${(p.barra.transbordo * 100).toFixed(1)}% = ${soma.toFixed(1)}% ${Math.abs(soma - 100) < 0.05 ? '⭐ SOMA 100' : '⛔ NÃO SOMA 100'}`)
    console.log(`         bandeira ${p.barra.bandeira} · ${p.barra.rotuloTransbordo ?? p.barra.rotuloParcial}`)
  }
  console.log(`  COBERTURA (o pé do placar): ${linhaDaCobertura(m.casa).map((x) => (x.forte ? `**${x.texto}**` : x.texto)).join('')}`)

  /* ═════════════ 5. QUEM CARREGOU — Σ fecha, agregado, bolinha ═════════════ */
  console.log('\n═══ 5. QUEM CARREGOU A CASA')
  const l = montarCarregadores(m.casa, m.saboresSemFicha.length)
  const soma = [...l.visiveis, ...l.resto].reduce((a, x) => a + x.sobraTotal, 0)
  console.log(`  ⛔ Σ(carregadores) ${brl(Math.round(soma * 100) / 100)} == sobra bruta ${brl(m.casa.sobraTotal)} → ${Math.abs(soma - m.casa.sobraTotal) < 0.02 ? '⭐ FECHA' : 'NÃO'}`)
  for (const x of l.visiveis) {
    console.log(`     ${x.rei ? '👑' : '  '} [${x.familia}] ${x.nome} · ${p1(x.pctDaCasa)} da casa · ${brl(x.sobraTotal)} · barra ${(x.pctDaBarra * 100).toFixed(0)}%`)
  }
  if (l.agregado) {
    console.log(`     [cinza] + ${l.agregado.quantos} produtos · ${p1(l.agregado.pctDaCasa)} · ${brl(l.agregado.sobraTotal)} · barra ${(l.agregado.pctDaBarra * 100).toFixed(0)}% · ver todos ▾`)
  }
  console.log(`  rodapé: 🪑 ${l.rodape.foraDaObra} fora da obra · ${l.rodape.saboresSemFicha} sabores sem ficha · cobertura ${p1(l.rodape.cobertura)}`)

  /* ═════════════ 6. O MONTADOR — fatias, clique e preço ═════════════ */
  console.log('\n═══ 6. O MONTADOR (a bancada)')
  const cat = await lerMontador(CO, prisma)
  console.log(`  canais: ${cat.canais.map((c) => `${c.nome}=${c.taxaPct == null ? 'a declarar' : `${c.taxaPct * 100}%`}`).join(' · ')}`)
  console.log(`  tamanhos: ${cat.tamanhos.map((t) => `${t.tamanho}(${t.sabores}${t.derivadoDe ? `←${t.derivadoDe}` : ''}${t.base ? '✓' : ' SEM BASE'})`).join(' · ')}`)
  console.log(`  sabores ${cat.sabores.length} (com ficha ${cat.sabores.filter((s) => s.temFicha).length} · âmbar ${cat.sabores.filter((s) => !s.temFicha).length})`)
  for (const f of cat.faltando) console.log(`  ⚠️ ${f.frase}`)

  console.log(`  ⭐ o clique na fatia existe no bundle: ${chunk['CELULAR 390'].includes('aoTocar') || chunk['CELULAR 390'].includes('fatiaAberta') ? 'SIM ✓' : '⛔ NÃO'}`)

  // ⭐ TROCAR O TAMANHO REDESENHA N FATIAS — a conta que o clique do chip dispara
  for (const t of cat.tamanhos.filter((x) => x.sabores > 0).slice(0, 3)) {
    const z = montarPizza({ tamanho: t, escolhas: [], precoVenda: null, canais: cat.canais })
    console.log(`     ${t.tamanho} → ${z.fatias.length} fatia(s) desenhada(s)`)
  }

  const grande = cat.tamanhos.find((t) => t.base != null && t.sabores >= 2)
  if (!grande) {
    console.log('  ⚠️ nenhum tamanho com base apontada — a conta da pizza fica "a apurar" (honesto)')
  } else {
    const caros = cat.sabores.filter((s) => s.temFicha && s.custo != null).sort((a, b) => b.custo! - a.custo!)
    const esc = [caros[0] ?? null, caros[1] ?? null]
    for (const [rot, preco] of [['sem preço', null], ['a R$ 89,90', 89.9], ['a R$ 99,90', 99.9]] as const) {
      const z = montarPizza({ tamanho: grande, escolhas: esc, precoVenda: preco, canais: cat.canais })
      const canais = z.canais.map((c) => `${c.canal}${c.taxaPct ? ` (taxa ${c.taxaPct * 100}%)` : ''} ${c.sobra == null ? 'a apurar' : `~${brl(c.sobra)}`}`).join(' · ')
      console.log(`     ${grande.tamanho} de ${esc.map((s) => s?.nome).join(' + ')} · base ${brl(z.custoBase)} + sabores ${brl(z.custoSabores)} = ${brl(z.custoTotal)}`)
      console.log(`       ${rot} → ${canais}`)
    }
    console.log('  ⭐ o preço RECALCULA a sobra de cada canal (as três linhas acima são a mesma pizza)')
  }

  /* ═════════════ 7. ZERO ESCRITA ═════════════ */
  const depois = {
    canais: await prisma.stockCanalVenda.count({ where: { companyId: CO } }),
    regras: await prisma.stockRegraSaboresTamanho.count({ where: { companyId: CO } }),
    bases: await prisma.stockBaseDoTamanho.count({ where: { companyId: CO } }),
    avisos: await prisma.aviso.count({ where: { companyId: CO } }),
  }
  const intacto = JSON.stringify(antes) === JSON.stringify(depois)
  console.log(`\n═══ 7. canais ${antes.canais}→${depois.canais} · regras ${antes.regras}→${depois.regras} · bases ${antes.bases}→${depois.bases} · avisos ${antes.avisos}→${depois.avisos}`)
  console.log(`  ${intacto ? '⭐ ZERO ESCRITA' : '⛔ GRAVOU ALGO'}`)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    // ⛔ a mensagem do erro pode vazar a URI com a senha — nunca imprimir a exceção crua
    console.error('FALHOU:', e instanceof Error ? e.name : 'erro desconhecido')
    process.exit(1)
  })
