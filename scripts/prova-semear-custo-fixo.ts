/**
 * ⭐⭐ SEMEAR O PLANO E O SELETOR COM ✓ — EM PROD, COM ROLLBACK FORÇADO (06/10/2026).
 *
 * ⛔ Nada é gravado: os gestos rodam dentro de uma transação desfeita no fim. O plano é
 * AFIRMAÇÃO do dono — semear por ele seria declarar o número dele.
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { signToken } from '../lib/auth'
import { lerCustosFixos } from '../lib/custos-fixos/leitura'
import { marcarComoFixa } from '../lib/custos-fixos/gestos'
import { previaDaSemente, semear } from '../lib/custos-fixos/semear'
import { filtrarPorBusca } from '../lib/busca-texto'
import { formatBRL } from '../lib/format/money'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const BASE = 'http://127.0.0.1:3001'
const CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

/** as que o dono marcaria — a lista do item 2 do pedido dele */
const FIXAS = ['Aluguel', 'Salários', 'Energia Elétrica', 'Água e Esgoto', 'internet',
  'Contabilidade', 'Software de Gestão', 'FGTS', 'gas', 'Seguro Predial',
  'MONITORAMENTO E SEGURANCA', 'MANUTENCAO EQUIPAMENTOS']

function presente(js: string, frase: string): boolean {
  if (js.includes(frase)) return true
  const esc = [...frase].map((c) => (c.charCodeAt(0) > 127 ? `\\x${c.charCodeAt(0).toString(16)}` : c)).join('')
  return js.includes(esc)
}

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`\n⭐ empresa: ${nome}`)
  const u = await prisma.user.findFirstOrThrow({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({ sub: u.id, email: u.email, name: u.name, role: (u as never as { role: string }).role ?? 'ADMIN' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  const antes = {
    marcacoes: await prisma.custoFixoCategoria.count({ where: { companyId: CO } }),
    planos: await prisma.custoFixoPlanejado.count({ where: { companyId: CO } }),
  }

  // ─────────── 1. O SELETOR: universo inteiro, ✓, e a busca da casa ───────────
  console.log('\n══════ 1. O SELETOR (busca da casa + ✓) ══════')
  const t0 = await lerCustosFixos(CO, '2026-10')
  console.log(`   universo de despesa no seletor: ${t0.disponiveis.length} · já fixas: ${t0.disponiveis.filter((d) => d.jaFixa).length}`)
  for (const termo of ['agua', 'ÁGUA', 'energia', 'eletrica', 'frete', 'sistema gestao', 'xyz']) {
    const r = filtrarPorBusca(t0.disponiveis, termo, (c) => `${c.nome} ${c.qualificador ?? ''}`)
    console.log(`   "${termo}".padEnd → ${r.length} · ${r.slice(0, 3).map((c) => c.nome + (c.qualificador ? ` [${c.qualificador}]` : '')).join(' · ') || '(nada)'}`)
  }
  // ⛔ o contrafactual: a régua ANTIGA (includes cru) não acha "Água e Esgoto" por "agua"
  const cru = t0.disponiveis.filter((c) => c.nome.toLowerCase().includes('agua'))
  console.log(`   ⛔ com \`includes\` cru, "agua" acha: ${cru.length} (a régua da casa acha ${filtrarPorBusca(t0.disponiveis, 'agua', (c) => c.nome).length})`)

  // ─────────── 2. SEMEAR: prévia → confirmar, com ROLLBACK ───────────
  console.log('\n══════ 2. SEMEAR O PLANO DE OUTUBRO COM O REALIZADO DE SETEMBRO ══════')
  try {
    await prisma.$transaction(async (tx) => {
      const db = new Proxy(tx, {
        get(t, p) {
          if (p === '$transaction') return (fn: (c: unknown) => unknown) => fn(db)
          return (t as never as Record<string | symbol, unknown>)[p]
        },
      }) as never as typeof prisma

      const cats = await db.category.findMany({
        where: { companyId: CO, type: 'EXPENSE', isActive: true }, select: { id: true, name: true },
      })
      let marcadas = 0
      for (const n of FIXAS) {
        const c = cats.find((x) => x.name.toLowerCase() === n.toLowerCase())
        if (!c) { console.log(`   ⚠️ «${n}» não existe nesta empresa`); continue }
        await marcarComoFixa(CO, c.id, u.id, db)
        marcadas++
      }
      console.log(`   ${marcadas} categorias marcadas como fixas (nenhum plano ainda)`)

      // ⭐ o botão da LINHA: a tela já mostra o número que ele preencheria
      const tela = await lerCustosFixos(CO, '2026-10', new Date(), db)
      console.log(`\n   referência: ${tela.mesReferencia} · parcial? ${tela.referenciaEhParcial}`)
      console.log(`   ${'categoria'.padEnd(28)} ${'plano'.padStart(12)} ${'o botão preencheria'.padStart(21)}`)
      for (const l of tela.linhas.slice(0, 8)) {
        console.log(`   ${l.nome.slice(0, 27).padEnd(28)} ${(l.planejado == null ? '—' : formatBRL(l.planejado)).padStart(12)} ${(l.realizadoReferencia > 0 ? formatBRL(l.realizadoReferencia) : '— sem botão').padStart(21)}`)
      }

      // ⭐ a PRÉVIA do lote (nada gravado ainda)
      const p = await previaDaSemente(CO, '2026-10', tela.mesReferencia, false, new Date(), db)
      const planosDepoisDaPrevia = await db.custoFixoPlanejado.count({ where: { companyId: CO } })
      console.log(`\n   PRÉVIA: ${p.quantas} entram · ${formatBRL(p.soma)} no total · ${p.jaTemPlano} já tinham plano · ${p.semRealizado} sem realizado`)
      console.log(`   ⛔ planos gravados depois da PRÉVIA: ${planosDepoisDaPrevia} (tem que ser 0)`)
      for (const l of p.linhas.filter((x) => !x.vai)) console.log(`      fora: ${l.nome} — ${l.porque}`)

      // ⭐ CONFIRMAR: grava exatamente a lista da prévia
      const r = await semear(CO, '2026-10', tela.mesReferencia, false, u.id, new Date(), db)
      console.log(`\n   CONFIRMADO: ${r.aplicados} planos gravados (a prévia prometia ${p.quantas})`)

      const depois = await lerCustosFixos(CO, '2026-10', new Date(), db)
      console.log(`   ⭐ A CASA CUSTA ${depois.casaCustaMes == null ? 'a apurar' : formatBRL(depois.casaCustaMes)}/mês`)
      console.log(`   ⭐ POR DIA ABERTO ${depois.porDiaAberto.valor == null ? 'a apurar' : formatBRL(depois.porDiaAberto.valor)}`)
      console.log(`   ⭐ PONTO DE EQUILÍBRIO ${depois.pontoDeEquilibrio.porDia == null ? 'a apurar' : `${formatBRL(depois.pontoDeEquilibrio.porDia)}/dia`}`)
      const soma = depois.linhas.reduce((s, l) => s + (l.planejado ?? 0), 0)
      console.log(`   ⛔ Σ(linhas) ${formatBRL(soma)} × cartão ${formatBRL(depois.casaCustaMes ?? 0)} → ${Math.abs(soma - (depois.casaCustaMes ?? 0)) < 0.01 ? '⭐ BATE' : '⛔ NÃO BATE'}`)
      console.log(`   linhas ainda sem plano: ${depois.semPlano.n} (as que não tiveram gasto em setembro)`)

      // ⭐ e rodar de novo não duplica nem muda
      const r2 = await semear(CO, '2026-10', tela.mesReferencia, false, u.id, new Date(), db)
      const n = await db.custoFixoPlanejado.count({ where: { companyId: CO, mes: '2026-10' } })
      console.log(`   ⭐ 2ª rodada: aplicou ${r2.aplicados} · total de planos ${n} (idempotente)`)

      throw new Error('__ROLLBACK__')
    })
  } catch (e) { if (!(e instanceof Error) || e.message !== '__ROLLBACK__') throw e }

  // ─────────── 3. A TELA (2 viewports) ───────────
  console.log('\n══════ 3. A TELA (2 viewports × 2 temas) ══════')
  const exigidas: [string, string][] = [
    ['o botão da linha', 'usar o realizado de'],
    ['o lote', 'preencher todos com o realizado de'],
    ['a escolha da referência', 'semear o plano com o realizado de'],
    ['o aviso de referência parcial', 'ainda está correndo'],
    ['o antes → depois da prévia', 'e salvar'],
    ['o toggle de substituir', 'substituir também os que já têm plano'],
    ['o porquê de quem fica fora', 'ver o porquê'],
    ['o lembrete de que o número é dele', 'o número é seu'],
    ['o ✓ do seletor', 'já são fixas'],
    ['o convite a desmarcar', 'clique no ✓ pra tirar da lista'],
  ]
  for (const [vp, ua] of [['celular', CELULAR], ['desktop', DESKTOP]] as const) {
    const t = Date.now()
    const r = await fetch(`${BASE}/empresas/${CO}/custos-fixos`, { headers: { cookie, 'user-agent': ua } })
    const html = await r.text()
    const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+?\.js/g)].map((m) => m[0]))]
    const baixados = await Promise.all(chunks.map(async (c) => ({ c, t: await (await fetch(`${BASE}${c}`)).text() })))
    const js = baixados.map((x) => x.t).join('')
    console.log(`\n── ${vp.toUpperCase()} · PAGE ${r.status} em ${Date.now() - t}ms · JS ${(js.length / 1024).toFixed(0)} KB`)
    let ok = 0
    for (const [rot, frase] of exigidas) { if (presente(js, frase)) ok++; else console.log(`   ⛔ ${rot} ("${frase}")`) }
    console.log(`   ✓ ${ok}/${exigidas.length} peças no bundle`)
    const meu = baixados.filter((x) => presente(x.t, 'antes de vender o primeiro lanche'))
    console.log(`   ${meu.some((x) => x.t.includes('#185FA5')) ? '⛔ hex cravado' : `✓ zero hex no chunk da tela (${meu.length} chunk)`}`)
  }

  // ─────────── 4. A ROTA: a prévia pela porta real não grava ───────────
  console.log('\n══════ 4. A ROTA (sessão real) ══════')
  const prev = await fetch(`${BASE}/api/empresas/${CO}/custos-fixos`, {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'SEMEAR', mes: '2026-10', confirmar: false }),
  })
  const jp = await prev.json()
  console.log(`   POST SEMEAR confirmar:false → ${prev.status} · prévia: ${jp.previa ? `${jp.previa.quantas} entram, ref ${jp.previa.mesReferencia}` : 'nenhuma'} · aplicados ${jp.aplicados}`)
  console.log(`   GET ?mes=2026-10&ref=2026-08 → ${(await fetch(`${BASE}/api/empresas/${CO}/custos-fixos?mes=2026-10&ref=2026-08`, { headers: { cookie } })).status}`)

  const depois = {
    marcacoes: await prisma.custoFixoCategoria.count({ where: { companyId: CO } }),
    planos: await prisma.custoFixoPlanejado.count({ where: { companyId: CO } }),
  }
  const zero = antes.marcacoes === depois.marcacoes && antes.planos === depois.planos
  console.log(`\nmarcações ${antes.marcacoes} → ${depois.marcacoes} · planos ${antes.planos} → ${depois.planos}`)
  console.log(zero ? '⭐ ZERO ESCRITA — o plano continua sendo o número dele' : '⛔ algo gravou')
}

main().catch((e) => { console.error('⛔', e); process.exit(1) }).finally(() => prisma.$disconnect())
