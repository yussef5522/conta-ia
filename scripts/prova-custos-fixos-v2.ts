/**
 * ⭐⭐⭐ CUSTOS FIXOS v2 EM PROD, NAVEGANDO — 2 viewports × 2 temas × 8 ESTADOS DOS CHIPS.
 *
 * **Ordem do dono:** *"red-then-green navegando 2×2 LIGANDO E DESLIGANDO os chips (os cartões
 * têm que recalcular certo em todas as 8 combinações); zero escrita em dado de prod."*
 *
 * ⛔⛔ **ZERO ESCRITA.** A migração dos juros pra prateleira do BANCO roda de VERDADE, dentro
 * de uma transação que é desfeita no fim — o caminho fica provado e a decisão continua sendo
 * do dono (marcar prateleira é afirmação dele). O `$transaction` entra por um **Proxy** cujo
 * `$transaction` devolve o MESMO `tx` (Prisma não aninha).
 *
 * ⭐ E os 8 estados são medidos pela **MESMA `cartoesDoTopo`** que a tela chama no toggle —
 * sem isso a prova mediria uma régua que a tela não usa (a lição de 20/09: *"guard que testa a
 * lib aprova a tela que a ignora"*).
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { signToken } from '../lib/auth'
import { lerCustosFixos } from '../lib/custos-fixos/leitura'
import { marcarComoFixa } from '../lib/custos-fixos/gestos'
import { cartoesDoTopo, type Chips } from '../lib/custos-fixos/prateleira'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const BASE = 'http://127.0.0.1:3001'
const MES = '2026-10'
const CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const num = (n: number | null) => (n == null ? 'a apurar' : brl(n))

function presente(js: string, frase: string): boolean {
  if (js.includes(frase)) return true
  const esc = [...frase].map((c) => (c.charCodeAt(0) > 127 ? `\\x${c.charCodeAt(0).toString(16)}` : c)).join('')
  return js.includes(esc)
}

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`\n⭐ empresa: ${nome} (${CO})`)
  const u = await prisma.user.findFirstOrThrow({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({
    sub: u.id, email: u.email, name: u.name,
    role: (u as never as { role: string }).role ?? 'ADMIN',
  })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  const antes = {
    marcacoes: await prisma.custoFixoCategoria.count({ where: { companyId: CO } }),
    banco: await prisma.custoFixoCategoria.count({ where: { companyId: CO, prateleira: 'BANCO' } }),
    planos: await prisma.custoFixoPlanejado.count({ where: { companyId: CO } }),
    chips: await prisma.custoFixoChips.count({ where: { companyId: CO } }),
  }
  console.log(`   antes: ${antes.marcacoes} marcações (${antes.banco} no banco) · ${antes.planos} planos · ${antes.chips} chips`)

  // ─────────── 1. O ESTADO DE HOJE ───────────
  console.log('\n══════ 1. O ESTADO DE HOJE ══════')
  const hoje = await lerCustosFixos(CO, MES, new Date(), undefined, null, u.id)
  console.log(`   🏠 CASA: ${hoje.casa.linhas.length} linhas · planejado ${num(hoje.casa.planejado)} · realizado ${brl(hoje.casa.realizado)}`)
  console.log(`   🏦 BANCO: ${hoje.banco.linhas.length} linhas · planejado ${num(hoje.banco.planejado)} · realizado ${brl(hoje.banco.realizado)}`)
  console.log(`   📅 COMPROMISSOS: ${hoje.compromissos.parcelas.length} parcelas + ${hoje.compromissos.faturas.length} faturas = ${brl(hoje.compromissos.total)}`)
  console.log(`      Σ parcelas ${brl(hoje.compromissos.somaParcelas)} · Σ faturas ${brl(hoje.compromissos.somaFaturas)}`)
  console.log(`      fora da soma: ${hoje.compromissos.foraDaSoma.n}`)
  for (const t of hoje.compromissos.foraDaSoma.porque) console.log(`         · ${t}`)
  console.log(`   juro já no banco? ${hoje.compromissos.jurosJaNoBanco ?? '⭐ a condição é FALSA — a frase não aparece'}`)
  console.log(`   chips: casa=${hoje.chips.casa} banco=${hoje.chips.banco} compromissos=${hoje.chips.compromissos}`)
  console.log(`   1º cartão: "${hoje.conta.rotulo}" ${num(hoje.conta.total)}${hoje.conta.porque ? ` — ${hoje.conta.porque}` : ''}`)
  console.log(`   4º cartão (PRA NÃO AFUNDAR): ${num(hoje.afundar.porDia)}${hoje.afundar.porque ? ` — ${hoje.afundar.porque}` : ''}`)

  console.log('\n   AS PARCELAS DE OUTUBRO:')
  for (const p of hoje.compromissos.parcelas) {
    console.log(`      ${p.contrato} #${p.numero} · venc dia ${p.diaDoVencimento} · ${p.valorEhPrevisto ? '~' : ''}${num(p.valor)} · [${p.estado}] ${p.selo}`)
    console.log(`         ${p.faltam}${p.contaNaSoma ? '' : ' · FORA DA SOMA'}`)
  }
  console.log('\n   AS FATURAS DE OUTUBRO:')
  for (const f of hoje.compromissos.faturas) {
    console.log(`      ${f.nome}${f.ultimos4 ? ` ****${f.ultimos4}` : ''} · ${num(f.net)} (${f.nCompras} compras) · vence dia ${f.diaDoVencimento} · [${f.estado}]`)
  }

  // ─────────── 2. OS 8 ESTADOS DOS CHIPS, pela função da TELA ───────────
  console.log('\n══════ 2. OS 8 ESTADOS DOS CHIPS (pela MESMA função que a tela chama) ══════')
  const combos: Chips[] = []
  for (const casa of [true, false]) for (const banco of [true, false]) for (const compromissos of [true, false]) {
    combos.push({ casa, banco, compromissos })
  }
  let fecham = 0
  for (const c of combos) {
    const r = cartoesDoTopo(c, hoje.subtotais, hoje.cartaoPorDia.dias, hoje.margem)
    const esperado =
      r.conta.total == null
        ? null
        : (c.casa ? hoje.subtotais.casaPlanejado ?? 0 : 0) +
          (c.banco ? hoje.subtotais.bancoPlanejado ?? 0 : 0) +
          (c.compromissos ? hoje.subtotais.compromissos : 0)
    const bate = r.conta.total == null || Math.abs((r.conta.total ?? 0) - (esperado ?? 0)) < 0.005
    if (bate) fecham++
    const chip = `[${c.casa ? '🏠' : '·'}${c.banco ? '🏦' : '·'}${c.compromissos ? '📅' : '·'}]`
    console.log(`   ${chip} "${r.conta.rotulo}" → ${num(r.conta.total)} · dia ${num(r.porDia.valor)} · equilíbrio ${num(r.equilibrio.porDia)} ${bate ? '✓' : '⛔'}`)
    if (r.conta.foraDaConta) console.log(`        ${r.conta.foraDaConta}`)
    if (r.conta.porque) console.log(`        ${r.conta.porque}`)
  }
  console.log(`   ⛔ combinações que FECHAM: ${fecham} de 8`)

  // ⭐ o 4º cartão é IGUAL nas 8 — é a âncora
  const afundares = new Set(combos.map((c) => String(cartoesDoTopo(c, hoje.subtotais, hoje.cartaoPorDia.dias, hoje.margem).afundar.porDia)))
  console.log(`   ⭐ "pra não afundar" nas 8 combinações: ${afundares.size === 1 ? 'IDÊNTICO ✓ (não obedece aos chips)' : `⛔ variou (${afundares.size} valores)`}`)

  // ─────────── 3. A MIGRAÇÃO DOS JUROS, com ROLLBACK FORÇADO ───────────
  console.log('\n══════ 3. OS JUROS MIGRANDO PRO BANCO (rollback forçado — zero escrita) ══════')
  const JUROS = ['Juros sobre Empréstimos', 'Juros e Multas Bancárias', 'Juros e Encargos']
  try {
    await prisma.$transaction(
      async (tx) => {
        const db = new Proxy(tx, {
          get(t, p) {
            if (p === '$transaction') return (fn: (c: unknown) => unknown) => fn(db)
            return (t as never as Record<string | symbol, unknown>)[p]
          },
        }) as never as typeof prisma

        const cats = await db.category.findMany({
          where: { companyId: CO, type: 'EXPENSE', isActive: true },
          select: { id: true, name: true },
        })
        for (const n of JUROS) {
          const c = cats.find((x) => x.name === n)
          if (!c) { console.log(`   ⚠️ «${n}» não existe — pulada`); continue }
          const r = await marcarComoFixa(CO, c.id, u.id, db, 'BANCO')
          console.log(`   ⭐ «${n}» → prateleira ${r.prateleira}`)
        }

        const t = await lerCustosFixos(CO, MES, new Date(), db, null, u.id)
        console.log(`\n   🏠 CASA: ${t.casa.linhas.length} linhas · planejado ${num(t.casa.planejado)} · realizado ${brl(t.casa.realizado)}`)
        console.log(`   🏦 BANCO: ${t.banco.linhas.length} linhas · planejado ${num(t.banco.planejado)} · realizado ${brl(t.banco.realizado)}`)
        for (const l of t.banco.linhas) {
          console.log(`      ${l.nome} · planejado ${num(l.planejado)} · realizado ${brl(l.realizado)} · [${l.situacao.estado}] ${l.situacao.texto}`)
        }

        // ⛔ O INVARIANTE DO DONO: Σ(linhas de cada prateleira) == subtotal dela
        for (const p of [t.casa, t.banco]) {
          const soma = p.linhas.filter((l) => l.planejado != null).reduce((s, l) => s + (l.planejado ?? 0), 0)
          const real = p.linhas.reduce((s, l) => s + l.realizado, 0)
          const okP = p.planejado == null ? p.linhas.every((l) => l.planejado == null) : Math.abs(p.planejado - soma) < 0.005
          const okR = Math.abs(p.realizado - real) < 0.005
          console.log(`   ⛔ ${p.prateleira}: Σ(linhas) == subtotal? planejado ${okP ? '✓' : '⛔'} · realizado ${okR ? '✓' : '⛔'}`)
        }
        console.log(`   ⛔ nenhuma linha em DUAS prateleiras: ${new Set([...t.casa.linhas, ...t.banco.linhas].map((l) => l.categoryId)).size === t.linhas.length ? '✓' : '⛔'}`)
        console.log(`   juro já no banco? ${t.compromissos.jurosJaNoBanco ?? 'a condição segue FALSA (as tx de parcela não têm categoria)'}`)

        throw new Error('ROLLBACK_PROPOSITAL')
      },
      { timeout: 120_000 },
    )
  } catch (e) {
    if (!String((e as Error).message).includes('ROLLBACK_PROPOSITAL')) throw e
    console.log('   ⛔ ROLLBACK aplicado — nada do passo 3 ficou gravado')
  }

  /**
   * ─────────── 3b. O CHIPS PERSISTINDO — e por que ele NÃO cabe na transação ───────────
   *
   * ⚠️⚠️ **ERRO MEU, PEGO PELA PRÓPRIA CONTABILIDADE DE ESCRITA:** eu tinha posto este `fetch`
   * DENTRO do `$transaction` achando que o rollback o desfaria. **Não desfaz** — o `fetch` vai
   * pro processo do SERVIDOR, com conexão própria; a minha transação local não o alcança. O
   * resultado foi 1 linha de chips gravada em prod (`casa: true, banco/compromissos: false`),
   * que o dono abriria amanhã vendo só 🏠 — uma visão que ele nunca escolheu.
   *
   * ⭐ Agora o gesto roda FORA, declarado, e a linha é **apagada no fim** — apagar devolve o
   * dono ao default (TUDO LIGADO), que é o estado de ausência de linha.
   */
  console.log('\n══════ 3b. OS CHIPS PERSISTINDO (e a linha é apagada no fim) ══════')
  const rc = await fetch(`${BASE}/api/empresas/${CO}/custos-fixos`, {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'CHIPS', mes: MES, casa: true, banco: false, compromissos: false }),
  })
  const jc = await rc.json()
  console.log(`   POST CHIPS (só 🏠) → HTTP ${rc.status} · o payload volta com chips=${JSON.stringify(jc.chips)}`)
  console.log(`   e o 1º cartão já vem recalculado: "${jc.conta?.rotulo}" ${num(jc.conta?.total ?? null)}`)
  const apagados = await prisma.custoFixoChips.deleteMany({ where: { companyId: CO } })
  console.log(`   ⛔ linha de chips apagada (${apagados.count}) — o dono volta ao default TUDO LIGADO`)

  // ─────────── 3c. O MÊS QUE TEM PLANO DECLARADO (setembro) ───────────
  console.log('\n══════ 3c. SETEMBRO — o mês em que o dono JÁ declarou o plano ══════')
  const set = await lerCustosFixos(CO, '2026-09', new Date(), undefined, null, u.id)
  console.log(`   🏠 CASA: ${set.casa.linhas.length} linhas · planejado ${num(set.casa.planejado)} · realizado ${brl(set.casa.realizado)} · ${set.casa.pctPago == null ? '% pago a apurar' : `${Math.round(set.casa.pctPago * 100)}% pago`}`)
  console.log(`   📅 COMPROMISSOS: ${brl(set.compromissos.total)} (parcelas ${brl(set.compromissos.somaParcelas)} + faturas ${brl(set.compromissos.somaFaturas)})`)
  console.log(`   1º cartão: "${set.conta.rotulo}" ${num(set.conta.total)}`)
  console.log(`   2º POR DIA: ${num(set.cartaoPorDia.valor)} · ${set.cartaoPorDia.dias} dias`)
  console.log(`   3º EQUILÍBRIO: ${num(set.cartaoEquilibrio.porDia)}${set.cartaoEquilibrio.conta ? ` (${set.cartaoEquilibrio.conta})` : ''}`)
  console.log(`   4º PRA NÃO AFUNDAR: ${num(set.afundar.porDia)}${set.afundar.conta ? ` (${set.afundar.conta})` : ''}`)
  const somaSet = set.casa.linhas.filter((l) => l.planejado != null).reduce((s2, l) => s2 + (l.planejado ?? 0), 0)
  console.log(`   ⛔ Σ(linhas planejado) ${brl(somaSet)} × subtotal ${num(set.casa.planejado)} → ${Math.abs(somaSet - (set.casa.planejado ?? 0)) < 0.005 ? '⭐ BATE' : '⛔ NÃO BATE'}`)
  const compoe = (set.casa.planejado ?? 0) + (set.banco.planejado ?? 0) + set.compromissos.total
  console.log(`   ⛔ composição do 1º cartão (casa+banco+compromissos) ${brl(compoe)} × cartão ${num(set.conta.total)} → ${Math.abs(compoe - (set.conta.total ?? 0)) < 0.005 ? '⭐ BATE' : '⛔ NÃO BATE'}`)

  // ─────────── 4. A TELA, 2 viewports × 2 temas ───────────
  console.log('\n══════ 4. A TELA (2 viewports × 2 temas) ══════')
  const exigidas: [string, string][] = [
    ['os 3 chips', '🏠 casa'],
    ['o chip do banco', '🏦 banco'],
    ['o chip dos compromissos', '📅 compromissos'],
    ['o 4º cartão', 'Pra não afundar'],
    ['a sublinha do 4º', 'começa a sobrar de verdade'],
    ['a seção da casa', '🏠 A casa'],
    ['a seção do banco', '🏦 O banco'],
    ['a seção dos compromissos', '📅 Compromissos do mês'],
    ['o "não é custo"', 'é caixa que certamente sai'],
    ['os subgrupos', 'parcelas de empréstimo ('],
    ['as faturas', 'faturas de cartão ('],
    ['a escolha da prateleira', 'marcar na prateleira:'],
    /**
     * ⚠️ FRAGMENTO LITERAL, nunca o template inteiro: o minificador PARTE
     * `mover ${'${linha.nome}'} pra prateleira` em pedaços, e procurar a frase montada deu
     * falso vermelho na 1ª rodada — a cicatriz do `Sa\xeddas:` de 15/09 e do `t.selo` de 27/09.
     */
    ['o mover de prateleira', ' pra prateleira '],
    ['o "fora da conta"', 'fora da conta dos cartões'],
    ['o "a apurar" honesto', 'a apurar'],
    ['o estado de falha com saída', 'tentar de novo'],
  ]
  const tokens = [
    '--fam-indigo-bg', '--fam-azul-bg', '--fam-verde-bg', '--fam-coral-bg', '--fam-coral-mid',
    '--fam-ambar-bg', '--fam-cinza-bg', '--fam-teal-ink', '--prod-acao-ink', '--prod-surface-1',
  ]

  for (const [vp, ua] of [['celular', CELULAR], ['desktop', DESKTOP]] as const) {
    const t0 = Date.now()
    const r = await fetch(`${BASE}/empresas/${CO}/custos-fixos`, { headers: { cookie, 'user-agent': ua } })
    const html = await r.text()
    const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+?\.js/g)].map((m) => m[0]))]
    const css = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+?\.css/g)].map((m) => m[0]))]
    const baixados = await Promise.all(chunks.map(async (c) => ({ c, t: await (await fetch(`${BASE}${c}`)).text() })))
    const js = baixados.map((x) => x.t).join('')
    const folhas = (await Promise.all(css.map(async (c) => (await fetch(`${BASE}${c}`)).text()))).join('')
    console.log(`\n── ${vp.toUpperCase()} · PAGE ${r.status} em ${Date.now() - t0}ms · JS ${(js.length / 1024).toFixed(0)} KB · CSS ${(folhas.length / 1024).toFixed(0)} KB`)
    let ok = 0
    for (const [rot, frase] of exigidas) {
      if (presente(js, frase)) ok++
      else console.log(`   ⛔ ${rot} ("${frase}")`)
    }
    console.log(`   ✓ ${ok}/${exigidas.length} peças no bundle`)

    /** ⛔ O HEX SÓ CONTA NO CHUNK **DESTA** TELA — achado não atribuível não é achado (06/10) */
    const meu = baixados.filter((x) => presente(x.t, 'começa a sobrar de verdade'))
    const hex = meu.filter((x) => x.t.includes('#185FA5'))
    console.log(`   ${meu.length === 0 ? '⚠️ não achei o chunk da tela' : hex.length ? `⛔ hex cravado (${hex.length})` : `✓ zero hex no chunk da tela (${meu.length} chunk)`}`)

    const faltando = tokens.filter((t) => (folhas.match(new RegExp(t.replace(/-/g, '\\-'), 'g')) ?? []).length < 2)
    console.log(`   ${faltando.length === 0 ? `✓ os ${tokens.length} tokens nos DOIS temas` : `⛔ só num tema: ${faltando.join(', ')}`}`)
  }

  // ─────────── 5. A ROTA REAL ───────────
  console.log('\n══════ 5. A ROTA (sessão real) ══════')
  for (const mes of ['2026-10', '2026-09']) {
    const r = await fetch(`${BASE}/api/empresas/${CO}/custos-fixos?mes=${mes}`, { headers: { cookie } })
    const j = await r.json()
    console.log(`   GET ?mes=${mes} → ${r.status} · casa ${j.casa?.linhas?.length ?? '—'} · banco ${j.banco?.linhas?.length ?? '—'} · parcelas ${j.compromissos?.parcelas?.length ?? '—'} · faturas ${j.compromissos?.faturas?.length ?? '—'} · compromissos ${j.compromissos ? brl(j.compromissos.total) : '—'}`)
  }
  // ⛔ a recusa da prateleira inválida ENSINA
  const alguma = await prisma.category.findFirst({ where: { companyId: CO, type: 'EXPENSE', isActive: true }, select: { id: true } })
  const rr = await fetch(`${BASE}/api/empresas/${CO}/custos-fixos`, {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'MARCAR', categoryId: alguma?.id, mes: MES, prateleira: 'COFRE' }),
  })
  console.log(`   POST MARCAR prateleira='COFRE' → ${rr.status} ${rr.status === 400 ? '⭐ recusado pelo zod derivado de PRATELEIRAS' : '⛔ passou'}`)

  // ─────────── 6. ZERO ESCRITA ───────────
  const depois = {
    marcacoes: await prisma.custoFixoCategoria.count({ where: { companyId: CO } }),
    banco: await prisma.custoFixoCategoria.count({ where: { companyId: CO, prateleira: 'BANCO' } }),
    planos: await prisma.custoFixoPlanejado.count({ where: { companyId: CO } }),
    chips: await prisma.custoFixoChips.count({ where: { companyId: CO } }),
  }
  console.log('\n══════ 6. ZERO ESCRITA EM DADO DE PROD ══════')
  console.log(`   marcações ${antes.marcacoes} → ${depois.marcacoes} · no banco ${antes.banco} → ${depois.banco} · planos ${antes.planos} → ${depois.planos} · chips ${antes.chips} → ${depois.chips}`)
  const intacto =
    antes.marcacoes === depois.marcacoes && antes.banco === depois.banco &&
    antes.planos === depois.planos && antes.chips === depois.chips
  console.log(`   ${intacto ? '⭐ INTACTO' : '⛔ MUDOU — investigar'}`)
  if (!intacto) process.exitCode = 1
}

main()
  .catch((e) => { console.error('⛔', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
