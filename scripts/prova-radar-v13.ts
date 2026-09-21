/**
 * ⭐ PROVA EM PROD DO RADAR v1.3 — o red-then-green que o dono pediu, navegando.
 *
 * *"Coca aparece na revenda com 'faltou 2 un · R$ 3,31', rodapé soma os faltantes por
 * unidade, adiciono FANTA UVA 2L na revenda e ela entra."*
 *
 * ⚠️ REGRA 8b — prova em qual banco está ANTES de medir. Zero silencioso é
 * indistinguível de "não tem", e já me fez reportar perda de dado que não existia.
 *
 * ⚠️ REGRA 12 — os DOIS viewports. O dono opera no celular.
 */
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { calcularFechamentoDoDia, totalDaSecao, type LinhaDoRadar } from '@/lib/stock/radar/fechamento'
import { janelaDoPeriodo } from '@/lib/stock/radar/periodo'
import { listasDoRadar } from '@/lib/stock/radar/watchlist'
import { prisma } from '@/lib/db'

const EMPRESA = 'cmq17yapb00gnrndlh33sctbo' // caçula mix

const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`
const qtd = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',')

/** ⛔ a MESMA composição da tela — se eu remontasse aqui, provaria outra coisa */
function rodape(linhas: LinhaDoRadar[]) {
  const t = totalDaSecao(linhas)
  const porUn = (m: Record<string, number>) =>
    Object.entries(m).map(([u, q]) => `${qtd(q)} ${u.toLowerCase()}`).join(' e ')
  const faltou = Object.keys(t.faltouPorUnidade).length
    ? `faltaram no total: ${porUn(t.faltouPorUnidade)} · ${brl(t.faltouValor)}` : 'nada faltou'
  const sobrou = Object.keys(t.sobrouPorUnidade).length
    ? ` — sobraram: ${porUn(t.sobrouPorUnidade)} · ${brl(t.sobrouValor)}` : ''
  const fora = t.itensSemContagem ? ` · ${t.itensSemContagem} ainda sem contagem (fora do total)` : ''
  return { texto: faltou + sobrou + fora, t }
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)

  const j = janelaDoPeriodo('ONTEM_HOJE')
  const listas = await listasDoRadar(EMPRESA, prisma)

  console.log(`\n⭐ RADAR v1.3 — ${j.rotulo} (${j.de} → ${j.ate})`)
  console.log(`   listas: caros ${listas.caros.length} · revenda ${listas.revenda.length} · porções ${listas.porcoes.length}`)

  const r = await calcularFechamentoDoDia(
    { companyId: EMPRESA, de: j.de, ate: j.ate, caros: listas.caros, revenda: listas.revenda, porcoes: listas.porcoes },
    prisma,
  )

  const secoes = [
    ['💰 OS CAROS', r.caros],
    ['🥤 REVENDA', r.revenda],
    ['🍳 PORÇÕES', r.porcoes],
  ] as const

  for (const [titulo, linhas] of secoes) {
    console.log(`\n── ${titulo} ──`)
    for (const l of linhas) {
      const un = l.unidadeControle.toLowerCase()
      const ver =
        l.faltou == null || l.faltouValor == null
          ? 'falta contar'
          : l.faltou < 0
            ? `faltou ${qtd(Math.abs(l.faltou))} ${un} · ${brl(Math.abs(l.faltouValor))}`
            : l.faltou > 0
              ? `sobrou ${qtd(l.faltou)} ${un} · ${brl(l.faltouValor)}`
              : '✓ bateu'
      console.log(`   ${l.nome.padEnd(32).slice(0, 32)} ${ver.padStart(30)}   [sistema ${qtd(l.saldoSistema)} ${un}]`)
    }
    const { texto } = rodape(linhas)
    console.log(`   └─ ${texto}`)
  }

  // ⛔⛔ Σ das três seções == placar. Se divergir, a tela mostra duas verdades.
  const soma = [r.caros, r.revenda, r.porcoes].reduce((a, ls) => a + totalDaSecao(ls).faltouValor, 0)
  const sobra = [r.caros, r.revenda, r.porcoes].reduce((a, ls) => a + totalDaSecao(ls).sobrouValor, 0)
  console.log(`\n⛔ Σ(seções) faltou ${brl(soma)} · sobrou ${brl(sobra)}`)
  console.log(`   placar do dia: ${brl(r.placar.valor)} · bate: ${Math.abs(soma + sobra - r.placar.valor) < 0.02 ? '✓ SIM' : '⛔ NÃO'}`)

  // ⭐ a Coca na revenda, o caso que o dono nomeou
  const coca = r.revenda.find((l) => /coca/i.test(l.nome))
  console.log(`\n⭐ a Coca está na REVENDA? ${coca ? `SIM — ${coca.nome}` : '⛔ NÃO'}`)
  console.log(`   e nos CAROS (não deveria)? ${r.caros.some((l) => /coca/i.test(l.nome)) ? '⛔ SIM' : '✓ não'}`)
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
