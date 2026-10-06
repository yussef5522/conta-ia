/**
 * ⭐⭐ A TELA DE CUSTOS FIXOS EM PROD, NAVEGANDO — com ROLLBACK FORÇADO (06/10/2026).
 *
 * **Ordem do dono:** *"red-then-green navegando nos 2 viewports × 2 temas · zero escrita em
 * dado de prod fora de planejados/preferências."*
 *
 * ⛔⛔ **E AQUI NEM O PLANEJADO É GRAVADO.** O plano é uma AFIRMAÇÃO do dono (*"o aluguel deve
 * custar 8.500"*) — declarar por ele seria pôr na tela um número que ele não escolheu, que é
 * exatamente o que o `minimoSugerido` do estoque se recusa a fazer. Então o gesto roda de
 * verdade, DENTRO de uma transação que é desfeita no fim: o caminho fica provado e o dado
 * dele intacto.
 *
 * ⚠️ O `$transaction` entra por um **Proxy** cujo `$transaction` devolve o MESMO `tx` — Prisma
 * não aninha, e os gestos/leituras recebem o client transacional (o padrão da prova da
 * contagem-âncora, 05/10).
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { signToken } from '../lib/auth'
import { lerCustosFixos } from '../lib/custos-fixos/leitura'
import { marcarComoFixa, definirPlanejado } from '../lib/custos-fixos/gestos'
import { produzirAvisosDeFinanceiro } from '../lib/avisos/produtores/financeiro'
import { avaliarLinguaDoBalcao } from '../lib/avisos/lingua-do-balcao'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const BASE = 'http://127.0.0.1:3001'
const CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function presente(js: string, frase: string): boolean {
  if (js.includes(frase)) return true
  const esc = [...frase].map((c) => (c.charCodeAt(0) > 127 ? `\\x${c.charCodeAt(0).toString(16)}` : c)).join('')
  return js.includes(esc)
}

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`\n⭐ empresa: ${nome} (${CO})`)
  const u = await prisma.user.findFirstOrThrow({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({ sub: u.id, email: u.email, name: u.name, role: (u as never as { role: string }).role ?? 'ADMIN' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  const antes = {
    marcacoes: await prisma.custoFixoCategoria.count({ where: { companyId: CO } }),
    planos: await prisma.custoFixoPlanejado.count({ where: { companyId: CO } }),
    avisos: await prisma.aviso.count({ where: { companyId: CO } }),
  }
  console.log(`   antes: ${antes.marcacoes} marcação(ões) · ${antes.planos} plano(s) · ${antes.avisos} aviso(s)`)

  // ─────────── 1. O VERMELHO: a tela ANTES de o dono marcar nada ───────────
  console.log('\n══════ 1. O ESTADO DE HOJE (nada marcado) ══════')
  const vazio = await lerCustosFixos(CO, '2026-10')
  console.log(`   linhas: ${vazio.linhas.length} · cartão "a casa custa": ${vazio.casaCustaMes == null ? 'a apurar ⭐' : brl(vazio.casaCustaMes)}`)
  console.log(`   por dia aberto: ${vazio.porDiaAberto.valor == null ? 'a apurar ⭐' : brl(vazio.porDiaAberto.valor)} · ${vazio.porDiaAberto.rotulo}`)
  console.log(`   ponto de equilíbrio: ${vazio.pontoDeEquilibrio.porDia == null ? `a apurar — "${vazio.pontoDeEquilibrio.porque}" ⭐` : brl(vazio.pontoDeEquilibrio.porDia)}`)
  console.log(`   MARGEM medida: ${vazio.margem.pct == null ? `a apurar (${vazio.margem.porque})` : `${(vazio.margem.pct * 100).toFixed(1)}%`}`)
  console.log(`      conta: ${vazio.margem.conta}`)
  console.log(`      janela: ${vazio.margem.de.toISOString().slice(0, 10)} → ${vazio.margem.ate.toISOString().slice(0, 10)} · ${vazio.margem.diasComReceita}/${vazio.margem.diasDaJanela} dias com receita`)
  console.log(`   categorias oferecidas no seletor: ${vazio.disponiveis.length}`)

  // ─────────── 2. O VERDE: o caminho inteiro, com ROLLBACK ───────────
  console.log('\n══════ 2. O CAMINHO INTEIRO (marcar → planejar → a casa num olhar) ══════')
  const MES = '2026-10'
  const ALVOS: { nome: string; plano: number }[] = [
    { nome: 'Aluguel', plano: 8500 },
    { nome: 'Salários', plano: 46000 },
    { nome: 'Energia Elétrica', plano: 2000 },
    { nome: 'Contabilidade', plano: 1621 },
    { nome: 'Água e Esgoto', plano: 1100 },
    { nome: 'internet', plano: 160 },
    { nome: 'Software de Gestão', plano: 1800 },
    { nome: 'FGTS', plano: 9000 },
    { nome: 'gas', plano: 5000 },
  ]

  try {
    await prisma.$transaction(async (tx) => {
      // ⚠️ o Proxy: quem chamar `$transaction` dentro daqui recebe o MESMO tx (Prisma não aninha)
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
      for (const a of ALVOS) {
        const c = cats.find((x) => x.name.toLowerCase() === a.nome.toLowerCase())
        if (!c) { console.log(`   ⚠️ categoria «${a.nome}» não existe nesta empresa — pulada`); continue }
        await marcarComoFixa(CO, c.id, u.id, db)
        await definirPlanejado(CO, c.id, MES, a.plano, u.id, db)
      }

      const t = await lerCustosFixos(CO, MES, new Date(), db)
      console.log(`\n   ⭐ A CASA CUSTA ${t.casaCustaMes == null ? 'a apurar' : brl(t.casaCustaMes)}/mês`)
      console.log(`   ⭐ POR DIA ABERTO ${t.porDiaAberto.valor == null ? 'a apurar' : brl(t.porDiaAberto.valor)} · ${t.porDiaAberto.dias} dias no mês`)
      console.log(`   ⭐ PONTO DE EQUILÍBRIO ${t.pontoDeEquilibrio.porDia == null ? `a apurar (${t.pontoDeEquilibrio.porque})` : `${brl(t.pontoDeEquilibrio.porDia)}/dia`}`)
      if (t.pontoDeEquilibrio.conta) console.log(`      conta: ${t.pontoDeEquilibrio.conta}`)

      console.log(`\n   ${'categoria'.padEnd(24)} ${'planejado'.padStart(13)} ${'realizado'.padStart(13)}  situação`)
      for (const l of t.linhas) {
        console.log(
          `   ${l.nome.slice(0, 23).padEnd(24)} ${(l.planejado == null ? '—' : brl(l.planejado)).padStart(13)}`
          + ` ${brl(l.realizado).padStart(13)}  [${l.situacao.tom}] ${l.situacao.texto}`,
        )
      }

      const soma = t.linhas.reduce((s, l) => s + (l.planejado ?? 0), 0)
      const fecha = Math.abs(soma - (t.casaCustaMes ?? 0)) < 0.01
      console.log(`\n   ⛔ Σ(linhas planejado) ${brl(soma)} × cartão ${brl(t.casaCustaMes ?? 0)} → ${fecha ? '⭐ BATE' : '⛔ NÃO BATE'}`)
      console.log(`   Σ realizado ${brl(t.totalRealizado)} · % pago ${t.pctPago == null ? 'a apurar' : `${Math.round(t.pctPago * 100)}%`}`)
      console.log(`   lacuna do cartão de crédito: ${t.comprasNoCartao ? `${t.comprasNoCartao.n} compra(s) no mês — dita na tela` : 'nenhuma compra no mês'}`)

      // ─────────── 3. O AVISO DO SININHO (dentro do mesmo rollback) ───────────
      console.log('\n══════ 3. O SININHO (setor financeiro, >20% do plano) ══════')
      const r = await produzirAvisosDeFinanceiro(CO, new Date(), db)
      console.log(`   gravados ${r.gravados} · reabertos ${r.reabertos} · resolvidos ${r.resolvidos} · recusados pela língua do balcão ${r.recusados.length}`)
      for (const x of r.recusados) console.log(`      ⛔ recusado: ${x.motivo} → "${x.titulo}"`)
      const avisos = await db.aviso.findMany({
        where: { companyId: CO, origem: 'CUSTO_FIXO_ACIMA_DO_PLANO' },
        select: { setor: true, severidade: true, titulo: true, corpo: true, oQueFazer: true, acaoRotulo: true, acaoHref: true },
      })
      for (const a of avisos) {
        console.log(`   [${a.setor} · ${a.severidade}] ${a.titulo}`)
        console.log(`      ${a.corpo}`)
        console.log(`      → ${a.oQueFazer}`)
        console.log(`      [${a.acaoRotulo} →] ${a.acaoHref}`)
        const v = avaliarLinguaDoBalcao({ ...a, companyId: CO, origem: 'x', alvo: 'y' } as never)
        if (!v.ok) console.log(`      ⛔ a lei do balcão recusaria: ${v.motivo}`)
      }

      throw new Error('__ROLLBACK__')
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== '__ROLLBACK__') throw e
  }

  // ─────────── 4. A PÁGINA E O BUNDLE, nos 2 viewports e nos 2 temas ───────────
  console.log('\n══════ 4. A TELA (2 viewports × 2 temas) ══════')
  const exigidas: [string, string][] = [
    ['o título', 'Custos fixos'],
    ['a sublinha serifada', 'antes de vender o primeiro lanche'],
    ['o cartão da casa', 'A casa custa'],
    ['o por dia aberto', 'Por dia aberto'],
    ['o ponto de equilíbrio', 'Ponto de equilíbrio'],
    ['o "a apurar" honesto', 'a apurar'],
    ['a lista', 'Planejado × realizado'],
    ['o gesto de marcar', 'marcar categoria como fixa'],
    ['o rodapé', '% pago'],
    ['o colapso', 'ver todas'],
    ['a porta do recorrente guardada', '/recorrentes'],
    ['o estado de falha com saída', 'tentar de novo'],
  ]
  const tokens = ['--fam-indigo-bg', '--fam-azul-bg', '--fam-verde-bg', '--fam-coral-bg', '--fam-ambar-bg', '--fam-cinza-bg', '--prod-surface-1']

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
    const meu = baixados.filter((x) => presente(x.t, 'antes de vender o primeiro lanche'))
    const hex = meu.filter((x) => x.t.includes('#185FA5'))
    console.log(`   ${meu.length === 0 ? '⚠️ não achei o chunk da tela' : hex.length ? `⛔ hex cravado no chunk da tela (${hex.length})` : `✓ zero hex no chunk da tela (${meu.length} chunk)`}`)

    const faltando = tokens.filter((t) => (folhas.match(new RegExp(t.replace(/-/g, '\\-'), 'g')) ?? []).length < 2)
    console.log(`   ${faltando.length === 0 ? `✓ os ${tokens.length} tokens nos DOIS temas` : `⛔ só num tema: ${faltando.join(', ')}`}`)
  }

  // ─────────── 5. A ROTA REAL, com a sessão do dono ───────────
  console.log('\n══════ 5. A ROTA (sessão real) ══════')
  for (const mes of ['2026-10', '2026-09']) {
    const r = await fetch(`${BASE}/api/empresas/${CO}/custos-fixos?mes=${mes}`, { headers: { cookie } })
    const j = await r.json()
    console.log(`   GET ?mes=${mes} → ${r.status} · linhas ${j.linhas?.length ?? '—'} · disponíveis ${j.disponiveis?.length ?? '—'} · margem ${j.margem?.pct == null ? `a apurar (${j.margem?.porque})` : `${(j.margem.pct * 100).toFixed(1)}%`}`)
  }
  // ⛔ a recusa ENSINA: planejar categoria que não está na lista
  const alguma = await prisma.category.findFirst({ where: { companyId: CO, type: 'EXPENSE', isActive: true }, select: { id: true } })
  const rr = await fetch(`${BASE}/api/empresas/${CO}/custos-fixos`, {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'PLANEJAR', categoryId: alguma?.id, mes: '2026-10', valor: 1 }),
  })
  const jr = await rr.json()
  console.log(`   POST PLANEJAR sem marcar → ${rr.status} · code ${jr.code}`)
  console.log(`      "${jr.erro}"`)

  const depois = {
    marcacoes: await prisma.custoFixoCategoria.count({ where: { companyId: CO } }),
    planos: await prisma.custoFixoPlanejado.count({ where: { companyId: CO } }),
    avisos: await prisma.aviso.count({ where: { companyId: CO } }),
  }
  const zero = antes.marcacoes === depois.marcacoes && antes.planos === depois.planos && antes.avisos === depois.avisos
  console.log(`\nmarcações ${antes.marcacoes} → ${depois.marcacoes} · planos ${antes.planos} → ${depois.planos} · avisos ${antes.avisos} → ${depois.avisos}`)
  console.log(zero ? '⭐ ZERO ESCRITA — o dado do dono intacto' : '⛔ algo gravou')
}

main().catch((e) => { console.error('⛔', e); process.exit(1) }).finally(() => prisma.$disconnect())
