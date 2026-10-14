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
import { lerPreferenciaDeTela } from '@/lib/tema/servidor'
import {
  declaracoesDe,
  descreverViolacao,
  violacoesL7NoCss,
} from '@/lib/ui/varredura-l7'

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
  console.log(`estado do dono ANTES: tema=${prefAntes.tema} (a preferência do TRILHO foi aposentada)`)

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

  // ── A ROLAGEM E O «» MORTO, no CSS e no bundle que prod SERVE ──
  /**
   * ⭐⭐ ESTE BLOCO SUBSTITUI o do «» (14/10, tarde). O antigo conferia que o botão gravava a
   * preferência; o botão foi aposentado, então o que importa provar é o oposto — que ele NÃO
   * está mais no que prod serve — e a regra que entrou no lugar dele: **a lista rola**.
   *
   * ⚠️⚠️ **"E NENHUMA ROTA DE NEGÓCIO" CONTINUA FORA DAQUI — não é atribuível no bundle.** O
   * chunk do trilho **junta vários componentes** (e com eles o badge que lê
   * `/api/empresas/.../retiradas-pendentes`), então achar `/api/empresas` ali **não diz de quem
   * é a chamada**. *Achado não atribuível não é achado* (a cicatriz de 06/10). Quem garante a
   * procedência é o guard, que lê a FONTE arquivo por arquivo com a lista fechada.
   */
  console.log('\n── A ROLAGEM DO TRILHO (item 2) e o «» MORTO (item 1) ──')
  const bundleDoTrilho = await (async () => {
    const h = htmlPorTela['Quem paga a casa'] ?? ''
    const srcs = [...h.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1])
    let tudo = ''
    for (const sc of srcs) {
      const r = await fetch(sc.startsWith('http') ? sc : `${base}${sc}`)
      tudo += await r.text()
    }
    return tudo
  })()
  const corpoDaRegra = (sel: string) => {
    const m = css.match(
      new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
    )
    return m?.[1] ?? ''
  }
  const trilhoCss = corpoDaRegra('.trilho')
  const listaCss = corpoDaRegra('.trilho .lista')
  for (const [q, v] of [
    ['o nav tem ALTURA (height:100%) — é o que faz o scroll existir', /height:100%|height: 100%/.test(trilhoCss)],
    ['e NÃO rola ele mesmo (a logomarca fica fixa)', /overflow:hidden|overflow: hidden/.test(trilhoCss)],
    ['a LISTA rola na vertical', /overflow-y:auto|overflow-y: auto/.test(listaCss)],
    ['e pode encolher (min-height:0) — sem isso o overflow não ativa', /min-height:0|min-height: 0/.test(listaCss)],
    ['a barra é FINA e de token', css.includes('scrollbar-width:thin') || css.includes('scrollbar-width: thin')],
    ['o cresce-no-mouse segue de pé', /\.trilho\.rec:hover\{[^}]*width:230px/.test(css.replace(/\s+/g, ''))],
    ['⛔ o CSS do «» (.recolhe) MORREU', !css.includes('.recolhe')],
    ['⛔ o «» não está no bundle', !bundleDoTrilho.includes('/api/trilho')],
  ] as const) {
    console.log(`  ${ok(v)} ${q}`)
  }

  // ───────────────── L7: A VARREDURA DO CSS, CONTRA O QUE PROD SERVE ─────────────────
  /**
   * ⭐⭐ **O MESMO DETECTOR QUE O GUARD USA, rodado aqui contra o CSS SERVIDO.** A REGRA 11
   * mostrou que *arrancar a varredura do teste* (`it.skip`) **não produz vermelho nenhum** —
   * nenhum teste pega o próprio desligamento. Com o detector numa lib e executado nos DOIS
   * lugares, desligar um não esconde o outro.
   */
  console.log('\n── L7 a varredura do CSS SERVIDO (o mesmo detector do guard) ──')
  const foraL7 = violacoesL7NoCss(css, {
    claro: declaracoesDe(css, ':root'),
    escuro: declaracoesDe(css, '.dark'),
  })
  console.log(
    `  ${ok(foraL7.length === 0)} pares (tinta, chão) que reprovam no CSS servido: ${foraL7.length}`,
  )
  for (const v of foraL7) console.log(`      ⛔ ${descreverViolacao(v)}`)

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

  // ───────────────── A PREFERÊNCIA DO TRILHO, APOSENTADA ─────────────────
  /**
   * ⚠️⚠️ **ESTA SEÇÃO FOI INVERTIDA, COM O MOTIVO ESCRITO.** Até a manhã de 14/10 ela fazia o
   * ciclo `PUT aberto → PUT recolhido → "ABERTO" tolerado → "gaveta" 400` e devolvia o estado do
   * dono. O dono aposentou o «» na tarde do mesmo dia, então **não há mais escolha de trilho a
   * gravar** — e o que vale provar passou a ser o contrário: *a rota não existe, e a coluna
   * dorme*.
   *
   * ⭐ A METADE QUE FICA É O TEMA: ele segue vivo, pela MESMA porta única, intocado.
   */
  console.log('\n── A PREFERÊNCIA DO TRILHO FOI APOSENTADA (item 1) ──')
  const rotaMorta = await fetch(`${base}/api/trilho`, {
    method: 'PUT',
    headers: { cookie, 'content-type': 'application/json', 'user-agent': DESK },
    body: JSON.stringify({ trilho: 'aberto' }),
  })
  console.log(`  ${ok(rotaMorta.status === 404)} PUT /api/trilho → ${rotaMorta.status} (a rota não existe mais)`)

  const htmlDesk = (await pega(`/empresas/${CO}/margem`, DESK)).html
  const classeDoNav = (htmlDesk.match(/class="(trilho[^"]*)"/) ?? [])[1] ?? ''
  console.log(
    `  ${ok(classeDoNav.includes('rec'))} e a TELA nasce SEMPRE recolhida: class="${classeDoNav}" (sem fixar)`,
  )

  /**
   * ⛔ A COLUNA DORME — e a prova é medir o BANCO, não afirmar. Ela segue existindo com o
   * default e o CHECK; o que não existe mais é alguém escrevendo nela.
   */
  const colunaDorme = await prisma.$queryRawUnsafe<{ column_default: string | null }[]>(
    `SELECT column_default FROM information_schema.columns
      WHERE table_name = 'user_tema_preferencia' AND column_name = 'trilho'`,
  )
  console.log(
    `  ${ok(colunaDorme.length === 1)} a coluna \`trilho\` continua no banco, dormindo (default ${colunaDorme[0]?.column_default ?? '—'})`,
  )

  const depois = await lerPreferenciaDeTela(u.id)
  const linhasDepois = await prisma.userTemaPreferencia.count()
  console.log(
    `  ${ok(depois.tema === prefAntes.tema && linhasAntes === linhasDepois)} o TEMA intocado: "${depois.tema}" (era "${prefAntes.tema}") · linhas ${linhasAntes} → ${linhasDepois} ⭐ ZERO ESCRITA`,
  )
}
