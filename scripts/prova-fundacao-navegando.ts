/**
 * ⭐⭐⭐ A PROVA DA FUNDAÇÃO EM PROD — 2 VIEWPORTS × 2 TEMAS, NAVEGANDO (REGRA 12).
 *
 * O que ela responde, no que **prod SERVE** (não no meu código-fonte):
 *   L1  o TRILHO nasce recolhido, a classe vem do SERVIDOR, e no celular existe a GAVETA
 *   L2  as 3 tintas e o `.dinheiro` chegam nos DOIS mapas do CSS
 *   L4  a régua de tabela (cabeçalho 2px, divisória, zebra OPT-IN) está no CSS servido
 *   L6  a sombra: 2 camadas no claro, `none` no escuro
 *   L7  os dois defeitos de contraste corrigidos — o par `solid`/`on` no bundle das 2 telas
 *   C   o TOPO: uma barra, os 4 controles, o ☰ só por CSS
 *   +   as 6 telas-chave do dono respondem nos dois viewports
 *   +   a PREFERÊNCIA grava e volta pela porta única — e o estado dele fica como estava
 *
 * ⛔⛔ **ESCRITA DECLARADA E DEVOLVIDA:** o passo da preferência GRAVA de propósito (é a única
 * escrita do sprint e precisa ser provada ponta a ponta). Ele lê o estado do dono ANTES,
 * exercita os dois valores e **restaura**, conferindo a contagem de linhas no fim. ⚠️ A
 * cicatriz de 07/10: `fetch` dentro de `$transaction` de prova **NÃO desfaz** — o request vai
 * pro processo do SERVIDOR, com conexão própria. Por isso a volta é explícita.
 *
 * ⚠️ O CSS é recortado por **CORPO DE CADA REGRA**, nunca por `indexOf(':root')` nem por
 * `split('.dark')` — o CSS servido é minificado, tem 4 `:root` e centenas de `.dark\:`, e a
 * ordem das regras não é a do fonte (as cicatrizes de 10/10 e 11/10, que deram 10 falsos
 * vermelhos).
 *
 * ⚠️ As frases são medidas no chunk que carrega a tela, tolerando a escapação do minificador
 * (`ê` → `\xea`, a cicatriz do `Sa\xeddas:`).
 */
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { lerPreferenciaDeTela, gravarPreferencia } from '@/lib/tema/servidor'

const CO = process.env.PROVA_COMPANY_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const CEL =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const DESK =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'
const VIEWPORTS: [string, string][] = [
  ['CELULAR', CEL],
  ['DESKTOP', DESK],
]
const base = 'http://localhost:3001'

/** tolera a escapação de acento do minificador */
const temFrase = (s: string, f: string) =>
  s.includes(f) ||
  s.includes(
    [...f].map((c) => (c.charCodeAt(0) > 126 ? `\\x${c.charCodeAt(0).toString(16)}` : c)).join(''),
  )

const ok = (b: boolean) => (b ? '✓' : '⛔')

/**
 * ⭐ Quais SELETORES definem um token — lendo o CORPO de cada regra. É isto que distingue
 * "o token existe no arquivo" de "o token é definido no mapa claro E no escuro".
 */
function seletoresQueDefinem(css: string, token: string): string[] {
  const achados: string[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    if (new RegExp(`${token}\\s*:`).test(m[2])) achados.push(m[1].trim())
  }
  return achados
}

/** uma regra existe no CSS com a declaração pedida? (corpo, nunca o arquivo inteiro) */
function regraTem(css: string, seletor: string, decl: RegExp): boolean {
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    if (m[1].includes(seletor) && decl.test(m[2])) return true
  }
  return false
}

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`[prova fundação] ${nome.trim()}`)

  const u = await prisma.user.findFirst({ where: { email: 'yussefmusa5522@gmail.com' } })
  if (!u) throw new Error('dono não encontrado')
  const token = await signToken({
    sub: u.id,
    email: u.email,
    name: u.name ?? 'dono',
    role: 'OWNER',
  })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  const linhasAntes = await prisma.userTemaPreferencia.count()
  const prefAntes = await lerPreferenciaDeTela(u.id)
  console.log(`estado do dono ANTES: tema=${prefAntes.tema} · trilho=${prefAntes.trilho}`)

  const pega = async (url: string, ua: string) => {
    const t0 = Date.now()
    const r = await fetch(`${base}${url}`, { headers: { cookie, 'user-agent': ua } })
    const html = await r.text()
    return { status: r.status, ms: Date.now() - t0, html }
  }

  // ───────────────────────────────── AS 6 TELAS-CHAVE ─────────────────────────────────
  const TELAS: [string, string][] = [
    ['Quem paga a casa', `/empresas/${CO}/margem`],
    ['Produção (Hoje ao vivo)', `/empresas/${CO}/estoque/producao/hoje`],
    ['Receitas de produção', `/empresas/${CO}/estoque/producao/receitas`],
    ['Custos fixos', `/empresas/${CO}/custos-fixos`],
    ['Vendas', `/empresas/${CO}/vendas`],
    ['Produção (lista)', `/empresas/${CO}/estoque/producao`],
  ]

  console.log('\n── AS TELAS-CHAVE, nos 2 viewports ──')
  const htmlPorTela: Record<string, string> = {}
  for (const [rotulo, url] of TELAS) {
    const linha: string[] = []
    for (const [vp, ua] of VIEWPORTS) {
      const r = await pega(url, ua)
      linha.push(`${vp} ${r.status} em ${r.ms}ms`)
      if (vp === 'DESKTOP') htmlPorTela[rotulo] = r.html
      if (r.status !== 200) console.log(`  ⛔ ${rotulo} (${vp}) → ${r.status}`)
    }
    console.log(`  ${ok(true)} ${rotulo.padEnd(26)} ${linha.join(' · ')}`)
  }

  // ── a página da ORDEM (precisa de uma ordem real) ──
  const ordem = await prisma.stockProductionOrder.findFirst({
    where: { companyId: CO },
    orderBy: { dataProducao: 'desc' },
    select: { id: true, estado: true },
  })
  if (ordem) {
    const linha: string[] = []
    for (const [vp, ua] of VIEWPORTS) {
      const r = await pega(`/empresas/${CO}/estoque/producao/${ordem.id}`, ua)
      linha.push(`${vp} ${r.status} em ${r.ms}ms`)
      if (vp === 'DESKTOP') htmlPorTela['página da ordem'] = r.html
    }
    console.log(`  ${ok(true)} ${`página da ordem (${ordem.estado})`.padEnd(26)} ${linha.join(' · ')}`)
  } else {
    console.log('  ⚠️ nenhuma ordem de produção — a página da ordem não dá pra navegar hoje')
  }

  // ───────────────────────────────── O CSS SERVIDO ─────────────────────────────────
  const htmlHome = htmlPorTela['Quem paga a casa'] ?? ''
  const cssHrefs = [...htmlHome.matchAll(/href="([^"]+\.css[^"]*)"/g)].map((m) => m[1])
  let css = ''
  for (const h of cssHrefs) {
    const r = await fetch(h.startsWith('http') ? h : `${base}${h}`)
    css += await r.text()
  }
  const regras = (css.match(/\{/g) ?? []).length
  console.log(`\n── O CSS QUE PROD SERVE ── ${cssHrefs.length} arquivo(s) · ${regras} regras`)

  // ── L2/L6: os tokens da fundação nos DOIS mapas ──
  const TOKENS = [
    '--prod-bg',
    '--prod-surface',
    '--prod-surface-1',
    '--prod-surface-2',
    '--prod-primary',
    '--prod-secondary',
    '--prod-muted',
    '--prod-line',
    '--prod-line-strong',
    '--prod-accent',
    '--prod-acao-bg',
    '--prod-acao-ink',
    '--prod-sombra',
    // ⚠️ os nomes são os do CSS, LIDOS dele — a 1ª rodada chutou `--prod-trilho-bg`,
    // que não existe, e deu 1 falso vermelho de 20. *Chutar nome de token produz
    // achado falso tão convincente quanto um real.*
    '--prod-trilho',
    '--prod-trilho-tx',
    '--prod-trilho-on',
    '--prod-trilho-pilula',
    '--prod-trilho-borda',
    '--fam-coral-mid',
    '--fam-ambar-solid',
    '--fam-ambar-on',
    '--fam-indigo-ink',
    '--fam-verde-ink',
  ]
  let nosDois = 0
  const faltando: string[] = []
  for (const t of TOKENS) {
    const sel = seletoresQueDefinem(css, t)
    const claro = sel.some((s) => s.includes(':root') && !s.includes('.dark'))
    const escuro = sel.some((s) => s.includes('.dark'))
    if (claro && escuro) nosDois++
    else faltando.push(`${t} (claro=${claro} escuro=${escuro})`)
  }
  console.log(`  ${ok(faltando.length === 0)} os ${TOKENS.length} tokens nos DOIS mapas: ${nosDois}`)
  for (const f of faltando) console.log(`      ⛔ ${f}`)

  // ── L6: a sombra tem 2 camadas no claro e é `none` no escuro ──
  const sombraClaro = seletoresQueDefinem(css, '--prod-sombra').filter(
    (s) => s.includes(':root') && !s.includes('.dark'),
  )
  const corpoDe = (seletor: string, token: string) => {
    const re = /([^{}]+)\{([^{}]*)\}/g
    let m: RegExpExecArray | null
    while ((m = re.exec(css))) {
      if (m[1].trim() === seletor && new RegExp(`${token}\\s*:`).test(m[2])) {
        return (m[2].match(new RegExp(`${token}\\s*:([^;}]+)`)) ?? [])[1]?.trim() ?? ''
      }
    }
    return ''
  }
  const vClaro = corpoDe(sombraClaro[0] ?? ':root', '--prod-sombra')
  const selEscuro = seletoresQueDefinem(css, '--prod-sombra').find((s) => s.includes('.dark'))
  const vEscuro = corpoDe(selEscuro ?? '.dark', '--prod-sombra')
  console.log(
    `  ${ok(vClaro.split(',').length >= 2 && vEscuro === 'none')} L6 sombra: claro "${vClaro}" · escuro "${vEscuro}"`,
  )

  // ── L4: a régua de tabela no CSS servido ──
  const L4 = [
    ['cabeçalho com régua forte (2px)', regraTem(css, 'thead th', /border-bottom:\s*2px/)],
    ['divisória de 1px nas células', regraTem(css, 'tbody td', /border-bottom:\s*1px/)],
    ['zebra OPT-IN (classe .zebra)', regraTem(css, '.zebra', /background/)],
    ['hover gateado em linha clicável', /\.density-\w+ tbody tr[^{]*hover/.test(css)],
    ['o .dinheiro é 800 tabular', regraTem(css, '.dinheiro', /font-weight:\s*800/)],
  ] as const
  console.log('  ── L4/L2 a régua de linha e a tinta do dinheiro ──')
  for (const [q, v] of L4) console.log(`    ${ok(v)} ${q}`)

  // ── L1: o trilho no CSS ──
  const L1 = [
    ['o trilho recolhido tem 64px', regraTem(css, '.trilho.rec', /width:\s*64px/)],
    ['o aberto tem 230px', regraTem(css, '.trilho', /width:\s*230px/)],
    ['cresce no :hover do PAI', /\.trilho\.rec:hover/.test(css)],
    ['a largura transiciona', regraTem(css, '.trilho', /transition[^;]*width/)],
    ['no recolhido os nomes somem', /\.trilho\.rec:not\(:hover\)/.test(css)],
    ['o badge vira mini (absoluto)', regraTem(css, '.badge', /position:\s*absolute/)],
    ['a logomarca é gradiente', regraTem(css, '.marca', /gradient/)],
    ['o ☰ do topo só no celular', regraTem(css, '.menu-m', /display:\s*none/)],
  ] as const
  console.log('  ── L1 o trilho e o ☰, por CSS (zero JavaScript) ──')
  for (const [q, v] of L1) console.log(`    ${ok(v)} ${q}`)

  // ───────────────────────── O TRILHO E O TOPO NO HTML SERVIDO ─────────────────────────
  console.log('\n── O TRILHO E O TOPO, no HTML que prod serve ──')
  for (const [vp, ua] of VIEWPORTS) {
    const r = await pega(`/empresas/${CO}/margem`, ua)
    const h = r.html
    const classeTrilho = (h.match(/class="(trilho[^"]*)"/) ?? [])[1] ?? '(nenhuma)'
    const barras = (h.match(/class="topo/g) ?? []).length
    console.log(`  ${vp}:`)
    console.log(`    ${ok(classeTrilho.includes('rec'))} o trilho vem do servidor: class="${classeTrilho}"`)
    console.log(`    ${ok(barras === 1)} UMA barra de topo no DOM (${barras})`)
    console.log(`    ${ok(h.includes('menu-m'))} o ☰ existe no DOM (o CSS esconde no desktop)`)
    console.log(`    ${ok(temFrase(h, 'CAIXAOS'))} a logomarca do trilho`)
    for (const [q, v] of [
      ['o selo PJ/PF da empresa', /class="(pj|pf)"/.test(h)],
      ['o sino', temFrase(h, 'Avisos')],
      ['o botão de tema', temFrase(h, 'tema')],
      ['o avatar com iniciais', h.includes('class="avatar"')],
    ] as const) {
      console.log(`    ${ok(v)} ${q}`)
    }
  }

  // ── a GAVETA: o ☰ do celular abre o trilho ──
  const chunkDoBotao = await (async () => {
    const h = htmlPorTela['Quem paga a casa'] ?? ''
    const srcs = [...h.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1])
    let achado = ''
    for (const s of srcs) {
      const r = await fetch(s.startsWith('http') ? s : `${base}${s}`)
      const txt = await r.text()
      if (txt.includes('/api/trilho')) achado += txt
    }
    return achado
  })()
  console.log('\n── A GAVETA E O «», no bundle servido ──')
  /**
   * ⚠️⚠️ **"E NENHUMA ROTA DE NEGÓCIO" SAIU DAQUI — não é atribuível no bundle.** A 1ª rodada
   * deu vermelho: o chunk que carrega o «» **junta vários componentes** (o trilho inteiro, e
   * com ele o badge que lê `/api/empresas/.../retiradas-pendentes`), então achar
   * `/api/empresas` ali **não diz de quem é a chamada**. *Achado não atribuível não é achado*
   * (a cicatriz de 06/10). Quem garante a procedência é o guard, que lê a FONTE arquivo por
   * arquivo com a lista fechada de rotas por arquivo.
   */
  for (const [q, v] of [
    ['o «» grava a preferência (/api/trilho)', chunkDoBotao.includes('/api/trilho')],
    ['o PUT que falha DIZ o motivo', temFrase(chunkDoBotao, 'não consegui')],
  ] as const) {
    console.log(`  ${ok(v)} ${q}`)
  }

  // ───────────────────────── L7: OS DOIS DEFEITOS CORRIGIDOS ─────────────────────────
  console.log('\n── L7 os dois defeitos de contraste, no que prod serve ──')
  const htmlOrdem = htmlPorTela['página da ordem'] ?? ''
  const item = await prisma.stockItem.findFirst({
    where: { companyId: CO },
    select: { id: true, nome: true },
  })
  const htmlItem = item
    ? (await pega(`/empresas/${CO}/estoque/itens/${item.id}`, DESK)).html
    : ''
  for (const [rotulo, html] of [
    ['a ordem parada ("concluir agora")', htmlOrdem],
    [`a ficha do item (${item?.nome?.trim() ?? '—'})`, htmlItem],
  ] as const) {
    if (!html) {
      console.log(`  ⚠️ ${rotulo}: não deu pra navegar`)
      continue
    }
    const temMid = /--fam-ambar-mid/.test(html)
    console.log(`  ${ok(!temMid)} ${rotulo}: o --fam-ambar-mid como CHÃO não aparece`)
  }
  // ⭐ e o par solid/on chega no CSS, nos dois temas
  const solid = seletoresQueDefinem(css, '--fam-ambar-solid')
  console.log(
    `  ${ok(solid.some((s) => s.includes(':root') && !s.includes('.dark')) && solid.some((s) => s.includes('.dark')))} o par solid/on existe nos DOIS temas`,
  )

  // ───────────────────────── A PREFERÊNCIA, PELA PORTA ÚNICA ─────────────────────────
  console.log('\n── A PREFERÊNCIA (a ÚNICA escrita do sprint) ──')
  const put = async (trilho: string) => {
    const r = await fetch(`${base}/api/trilho`, {
      method: 'PUT',
      headers: { cookie, 'content-type': 'application/json', 'user-agent': DESK },
      body: JSON.stringify({ trilho }),
    })
    return { status: r.status, corpo: await r.text() }
  }
  const a1 = await put('aberto')
  const dep1 = await lerPreferenciaDeTela(u.id)
  console.log(`  ${ok(a1.status === 200 && dep1.trilho === 'aberto')} PUT aberto → ${a1.status} · o banco diz "${dep1.trilho}"`)
  const htmlAberto = (await pega(`/empresas/${CO}/margem`, DESK)).html
  const classeAberta = (htmlAberto.match(/class="(trilho[^"]*)"/) ?? [])[1] ?? ''
  console.log(`  ${ok(!classeAberta.includes('rec'))} e a TELA nasce aberta: class="${classeAberta}"`)

  const a2 = await put('recolhido')
  const dep2 = await lerPreferenciaDeTela(u.id)
  console.log(`  ${ok(a2.status === 200 && dep2.trilho === 'recolhido')} PUT recolhido → ${a2.status} · o banco diz "${dep2.trilho}"`)

  /**
   * ⚠️⚠️ **O TORTO DA ROTA É O DESCONHECIDO, NÃO A CAIXA ALTA — e a 1ª rodada me corrigiu.**
   * Eu mandei `'ABERTO'` chamando de torto e levei 200: a rota **tolera caixa e espaço** e
   * normaliza ANTES de gravar (é a régua de leitura, e é o que mantém o banco só com o
   * normalizado). O que ela recusa — e está escrito no arquivo dela — é o valor que ela não
   * conhece: *"aceitar 'gaveta' e gravar 'recolhido' faria o «» responder ok e fazer outra
   * coisa — a família do salvo que mentia"*. **Caixa alta é torto pro CHECK do BANCO; valor
   * desconhecido é torto pra ROTA.** Duas perguntas, e eu as misturei.
   */
  const tolerado = await put('ABERTO')
  const depTolerado = await lerPreferenciaDeTela(u.id)
  console.log(
    `  ${ok(tolerado.status === 200 && depTolerado.trilho === 'aberto')} PUT "ABERTO" é TOLERADO e normalizado → ${tolerado.status} · o banco diz "${depTolerado.trilho}" (nunca 'ABERTO')`,
  )

  const torto = await put('gaveta')
  console.log(`  ${ok(torto.status === 400)} PUT "gaveta" (desconhecido) → ${torto.status} ${torto.corpo.slice(0, 70)}`)
  const depTorto = await lerPreferenciaDeTela(u.id)
  console.log(
    `  ${ok(depTorto.trilho === 'aberto')} e NADA gravou — segue no último válido: "${depTorto.trilho}"`,
  )

  // ⭐ o TEMA não foi sobrescrito por nenhum dos PUTs do trilho
  console.log(
    `  ${ok(depTorto.tema === prefAntes.tema)} o TEMA sobreviveu aos PUTs do trilho: "${depTorto.tema}" (era "${prefAntes.tema}")`,
  )

  // ── devolver o estado do dono ──
  await gravarPreferencia(u.id, { tema: prefAntes.tema, trilho: prefAntes.trilho })
  const fim = await lerPreferenciaDeTela(u.id)
  const linhasDepois = await prisma.userTemaPreferencia.count()
  console.log(
    `\n  ⭐ DEVOLVIDO: tema=${fim.tema} trilho=${fim.trilho} · linhas ${linhasAntes} → ${linhasDepois} ${
      fim.tema === prefAntes.tema && fim.trilho === prefAntes.trilho && linhasAntes === linhasDepois
        ? '⭐ como encontrou'
        : '⛔ MUDOU'
    }`,
  )
}

main()
  .catch((e) => {
    console.error('⛔ prova falhou:', e?.message ?? e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
