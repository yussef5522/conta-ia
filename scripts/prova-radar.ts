// ⭐⭐ PROVA DO RADAR — o red-then-green que o dono pediu, NAVEGANDO (20/09/2026).
//
// ⛔ READ-ONLY nas contagens e no ledger: o Radar só LÊ. A única escrita possível é o SEED
// das listas, que é o primeiro acesso dele à tela — e é idempotente.
//
// ⚠️ A prova é do BUNDLE que prod serve + da ROTA real com sessão assinada, nos DOIS
// viewports (REGRA 12). Medir no meu código-fonte não prova o que a tela entrega.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { signToken } from '../lib/auth'
import type { RadarDoEstoque, LinhaDoRadar } from '@/lib/stock/radar/fechamento'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const BASE = 'http://127.0.0.1:3001'
const CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const q = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

function mostrar(l: LinhaDoRadar) {
  const v = l.veredito === 'SEM_CONTAGEM' ? 'falta contar'
    : l.veredito === 'BATEU' ? '✓ bateu'
      : `${l.faltouValor! < 0 ? 'faltou' : 'sobrou'} ${brl(Math.abs(l.faltouValor!))}`
  const hist = l.historico.map((h) => h.valor == null ? '·' : h.valor < 0 ? '▼' : '▲').join('')
  const ult = l.ultimoVeredito ? ` ⟨${l.ultimoVeredito.dia.slice(5)}: ${brl(l.ultimoVeredito.valor)}⟩` : ''
  console.log(`   ${v.padEnd(22)} ${l.nome}  [sistema ${q(l.saldoSistema)} · ${brl(l.valorSistema)}]${ult} ${hist}`)
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const u = await prisma.user.findFirstOrThrow({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({ sub: u.id, email: u.email, name: u.name, role: (u as never as { role: string }).role ?? 'ADMIN' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  // ── 1. A TELA abre nos dois aparelhos, e o BUNDLE tem o desenho ───────────────
  for (const [nome, ua] of [['celular', CELULAR], ['desktop', DESKTOP]] as const) {
    const t0 = Date.now()
    const r = await fetch(`${BASE}/empresas/${CO}/estoque/radar`, { headers: { cookie, 'user-agent': ua }, redirect: 'manual' })
    const html = await r.text()
    const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]))]
    const js = (await Promise.all(chunks.map(async (c) => (await fetch(`${BASE}${c}`)).text()))).join('')
    console.log(`\nPAGE /estoque/radar (${nome}) → ${r.status} em ${Date.now() - t0}ms · ${Math.round(js.length / 1024)} KB`)
    console.log(`   ⭐ "OS CAROS" e "PORÇÕES"          : ${js.includes('OS CAROS') && js.includes('PORÇÕES')}`)
    console.log(`   ⭐ a conta de padeiro               : ${js.includes('DEVIA TER') && js.includes('CONTAMOS')}`)
    console.log(`   ⭐ "falta contar hoje"              : ${js.includes('falta contar hoje')}`)
    console.log(`   ⭐ o rodapé honesto                 : ${js.includes('não é fechamento contábil')}`)
    console.log(`   ⭐ REGRA 12 (empilha no celular)    : ${js.includes('min-[900px]:grid-cols-2')}`)
    /**
     * ⚠️ ERRO DE SONDA CORRIGIDO (20/09): a 1ª versão procurava `prefers-color-scheme` e
     * deu FALSO VERMELHO — a string vem do chunk VENDOR (a sonda lê o bundle inteiro da
     * página), e a única ocorrência na minha tela é a PALAVRA no comentário. ⭐ O que dá
     * pra medir aqui é o que importa: a PALETA ESCURA do mock não chegou na tela.
     */
    const escuras = ['#101119', '#191b25', '#eceef6', '#8b80f0']
    console.log(`   ⛔ tema claro (a paleta escura não vazou): ${escuras.every((c) => !js.includes(c))}`)
  }

  // ── 2. A ROTA — o placar com dado real, e a conta somando o veredito ─────────
  const ler = async (periodo: string) => {
    const r = await fetch(`${BASE}/api/empresas/${CO}/estoque/radar?periodo=${periodo}`, { headers: { cookie } })
    return { status: r.status, j: await r.json() as RadarDoEstoque & { janela: { rotulo: string; de: string; ate: string } } }
  }

  for (const p of ['ONTEM_HOJE', 'SETE_DIAS', 'MES']) {
    const { status, j } = await ler(p)
    console.log(`\nROTA periodo=${p} → ${status} · janela "${j.janela.rotulo}" (${j.janela.de} a ${j.janela.ate})`)
    console.log(`   PLACAR: ${j.placar.tom} ${brl(j.placar.valor)} · ${j.placar.itensContados} de ${j.placar.itensNasListas} contados`
      + (j.placar.maiorOfensor ? ` · maior: ${j.placar.maiorOfensor}` : ''))
    if (j.placar.foraDasListasItens > 0) {
      console.log(`   FORA DAS LISTAS: ${j.placar.foraDasListasItens} itens · ${brl(Math.abs(j.placar.foraDasListasValor))}`)
    }
    if (p === 'ONTEM_HOJE') {
      console.log('   os caros:'); j.caros.slice(0, 6).forEach(mostrar)
      console.log('   porções:'); j.porcoes.slice(0, 6).forEach(mostrar)

      // ⛔⛔ O GUARD DO DONO, MEDIDO EM PROD: Σ(conta) == veredito == placar
      let somaVereditos = 0, contasQueFecham = 0, contasComConta = 0
      for (const l of [...j.caros, ...j.porcoes]) {
        somaVereditos += l.faltouValor ?? 0
        if (!l.conta) continue
        contasComConta++
        const baldes = l.conta.baldes.reduce((s, b) => s + b.qtd, 0)
        if (Math.abs(l.conta.tinha + baldes - l.conta.deviaTer) < 0.005) contasQueFecham++
      }
      console.log(`\n   ⛔ Σ(vereditos) = ${brl(Math.abs(somaVereditos))} × placar = ${brl(j.placar.valor)}`
        + ` → ${Math.abs(Math.abs(somaVereditos) - j.placar.valor) < 0.005 ? 'BATE ✓' : 'DIVERGE ⛔'}`)
      console.log(`   ⛔ contas de padeiro que FECHAM: ${contasQueFecham} de ${contasComConta}`)
    }
  }

  // ── 3. ⭐ O 1º CASO REAL: a PORÇÃO CALABRESA 85g (saldo −7, custo 0) ─────────
  const alvo = await prisma.stockItem.findFirst({
    where: { companyId: CO, nome: { contains: 'CALABRESA 85' } },
    select: { id: true, nome: true, unidadeControle: true },
  })
  if (alvo) {
    const { calcularFechamentoDoDia } = await import('@/lib/stock/radar/fechamento')
    const r = await calcularFechamentoDoDia(
      { companyId: CO, de: '2026-08-12', ate: new Date().toISOString().slice(0, 10), caros: [], porcoes: [alvo.id] },
      prisma,
    )
    const l = r.porcoes[0]!
    console.log(`\n⭐ O 1º CASO REAL — ${alvo.nome}`)
    console.log(`   veredito: ${l.veredito}${l.faltouValor != null ? ` · ${brl(l.faltouValor)}` : ''}`)
    if (l.conta) {
      const c = l.conta
      console.log(`   janela: ${c.desde ?? '(1ª contagem)'} → ${c.ate}${c.diasDaJanela != null ? ` (${c.diasDaJanela}d)` : ''}`)
      console.log(`   tinha        ${q(c.tinha)} ${alvo.unidadeControle}`)
      for (const b of c.baldes) console.log(`   ${b.rotulo.padEnd(22)} ${b.qtd >= 0 ? '+' : '−'} ${q(Math.abs(b.qtd))}${b.ressalva ? `  ⚠️ ${b.ressalva}` : ''}`)
      console.log(`   ${c.contamos == null ? 'DEVE TER AGORA' : 'DEVIA TER   '} ${q(c.deviaTer)}`)
      console.log(`   CONTAMOS     ${c.contamos == null ? '— falta contar' : q(c.contamos)}`)
      console.log(`   FALTOU       ${c.faltou == null ? '— falta contar' : `${q(c.faltou)} · ${brl(c.faltouValor!)}`}`)
      if (c.naoExplicado !== 0) console.log(`   ⚠️ não explicado: ${q(c.naoExplicado)}`)
    } else {
      console.log('   (sem contagem no período — o Radar não inventa variância)')
    }
    const saldo = await prisma.stockMovement.aggregate({
      where: { companyId: CO, itemId: alvo.id, tipo: { not: 'PRODUCAO_CONSUMO' } },
      _sum: { quantidade: true, custoTotal: true },
    })
    console.log(`   saldo hoje no ledger: ${q(saldo._sum.quantidade ?? 0)} · valor ${brl(saldo._sum.custoTotal ?? 0)}`)
  }

  // ── 4. as listas semeadas ────────────────────────────────────────────────────
  const listas = await prisma.stockRadarWatchlist.groupBy({ by: ['lista'], where: { companyId: CO }, _count: true })
  console.log('\nLISTAS:', listas.map((l) => `${l.lista}=${l._count}`).join(' · '))
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
