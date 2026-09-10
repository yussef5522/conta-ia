// ⭐⭐ PROVA "REGRA 2" — o dono abre /conciliacao e OS CARDS ESTÃO LÁ (10/09/2026).
//
// ⛔ O defeito era de TELA, não de motor: o card existia e ninguém chegava nele. Então a
// prova não pode ser "a função devolve certo" — tem que ser **o que a tela carrega ao
// abrir**: a PÁGINA responde, o BUNDLE que ela serve tem o card e não tem mais a frase
// antiga, e a ROTA que ela chama no load devolve os cards com as notas e a conta viva.
//
// ⛔ READ-ONLY: só GET. Conciliar é gesto do dono.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { signToken } from '../lib/auth'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const BASE = 'http://127.0.0.1:3001'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (s: string) => new Date(s).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

/** ⚠️ o celular do dono: a tela é a MESMA, o que muda é o viewport — provo os dois UAs */
const CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const u = await prisma.user.findFirstOrThrow({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({ sub: u.id, email: u.email, name: u.name, role: (u as never as { role: string }).role ?? 'ADMIN' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  // 1. A PÁGINA abre — nos dois aparelhos
  for (const [nome, ua] of [['celular', CELULAR], ['desktop', DESKTOP]] as const) {
    const r = await fetch(`${BASE}/conciliacao?empresaId=${CO}`, {
      headers: { cookie, 'user-agent': ua }, redirect: 'manual',
    })
    console.log(`PAGE /conciliacao (${nome}) → ${r.status}`)
  }

  // 2. O BUNDLE que a página serve: tem o card, não tem a frase antiga
  const html = await (await fetch(`${BASE}/conciliacao?empresaId=${CO}`, { headers: { cookie } })).text()
  const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0])
  let temCard = false, temFraseAntiga = false, temEscondido = false
  for (const c of [...new Set(chunks)]) {
    const js = await (await fetch(`${BASE}${c}`)).text()
    if (js.includes('soma crava com o pagamento')) temCard = true
    if (js.includes('nomeiam um fornecedor')) temFraseAntiga = true
    if (js.includes('escolher na mão') && js.includes('abrindo…')) temEscondido = true
  }
  console.log(`\nBUNDLE servido (${chunks.length} chunks)`)
  console.log(`   ⭐ texto dos cards novos presente: ${temCard}`)
  console.log(`   ⛔ frase antiga ("nomeiam um fornecedor"): ${temFraseAntiga}`)
  console.log(`   ⛔ botão do segundo clique ("abrindo…"): ${temEscondido}`)

  // ⭐⭐ 3. O VISUAL DO MOCK NO BUNDLE SERVIDO — não no meu código, no que prod entrega
  const { MOCK } = await import('@/components/conciliacao/mock-tokens')
  const doMock: [string, string][] = [
    ['roxo', MOCK.roxo], ['roxo-fraco', MOCK.roxoFraco], ['chão frio', MOCK.frio],
    ['linha do card', MOCK.line], ['âmbar-fraco', MOCK.ambarFraco], ['coral-fraco', MOCK.coralFraco],
    ['slate-fraco', MOCK.slateFraco], ['verde', MOCK.verde], ['fundo', MOCK.bg],
  ]
  const juntos = (await Promise.all([...new Set(chunks)].map(async (c) =>
    (await fetch(`${BASE}${c}`)).text()))).join('')
  console.log('\n⭐ O VISUAL DO MOCK, NO BUNDLE QUE PROD SERVE:')
  for (const [nome, cor] of doMock) {
    console.log(`   ${juntos.includes(cor) ? '✓' : '⛔'} ${nome.padEnd(14)} ${cor}`)
  }
  for (const [nome, marca] of [
    ['checkbox 19px', "19px"], ['rodapé borda 2px', '2px solid'], ['botão opaco .35', '.35'],
    ['seta ▶', '▶'], ['raio do card 16px', 'rounded-[16px]'], ['botão raio 12px', 'rounded-[12px]'],
    ['menos U+2212', '− '],
    ['título "Pra tua mão"', 'Pra tua mão'],
    ['botão "não é isso"', 'não é isso'],
    ['grupo "A vencer (…)"', 'A vencer (o pagamento pode'],
    ['instrução do mock', 'Marca as notas que esse pagamento cobriu'],
  ] as [string, string][]) {
    console.log(`   ${juntos.includes(marca) ? '✓' : '⛔'} ${nome}`)
  }

  // 3. A ROTA que a tela chama NO LOAD (sem extratoId, sem URL secreta)
  const r = await fetch(`${BASE}/api/conciliacao/escolher-na-mao?empresaId=${CO}`, { headers: { cookie } })
  const { cards } = await r.json() as { cards: {
    linha: { id: string; descricao: string; valor: number; data: string; conta: string | null }
    fornecedorId: string; fornecedorNome: string
    vencidas: { descricao: string; emAberto: number; vencimento: string; sugerida: boolean; foraDaJanela: boolean }[]
    aVencer: { descricao: string; emAberto: number; vencimento: string; sugerida: boolean; foraDaJanela: boolean }[]
    atalho: { resumo: string; ambiguo: boolean } | null
  }[] }
  console.log(`\nGET /api/conciliacao/escolher-na-mao?empresaId=… → ${r.status} · ${cards.length} linhas`)

  // ⭐ o AGRUPAMENTO é da lib — a tela desenha o que sai daqui
  const { agruparPorFornecedor } = await import('@/lib/conciliacao/agrupar-escolha')
  const grupos = agruparPorFornecedor(cards.map((c) => ({
    ...c,
    linha: { ...c.linha, data: new Date(c.linha.data) },
    vencidas: c.vencidas.map((n) => ({ ...n, vencimento: new Date(n.vencimento) })),
    aVencer: c.aVencer.map((n) => ({ ...n, vencimento: new Date(n.vencimento) })),
  })) as never)

  console.log(`\n⭐ A FILA COMO ELA CABE NA TELA — ${grupos.length} cards COLAPSADOS:`)
  for (const g of grupos) {
    console.log(`   ▸ ${g.fornecedorNome.slice(0, 34).padEnd(34)} ${String(g.linhas.length).padStart(2)} pagamento(s) · ${brl(g.total).padStart(12)} · desde ${dia(String(g.linhas[0].linha.data))}`)
  }

  // ⭐ ABRINDO O IVAN — a 1ª linha (a mais antiga), como o dono pediu
  const ivan = grupos.find((g) => g.fornecedorNome.toUpperCase().includes('IVAN'))
  if (!ivan) { console.log('\n⚠️ nenhum grupo do Ivan na fila'); return }
  const l = ivan.linhas[0]
  const marcadas = [...l.vencidas, ...l.aVencer].filter((n) => n.sugerida)
  const soma = Math.round(marcadas.reduce((s, n) => s + n.emAberto, 0) * 100) / 100
  console.log(`\n⭐ ABRO O ${ivan.fornecedorNome} → pagamento 1 de ${ivan.linhas.length}`)
  console.log(`   linha do extrato: − ${brl(l.linha.valor)} · ${dia(String(l.linha.data))} · ${l.linha.conta}`)
  for (const n of [...l.vencidas, ...l.aVencer]) {
    console.log(`     [${n.sugerida ? 'x' : ' '}] ${brl(n.emAberto).padStart(11)} · ${n.descricao.slice(0, 40).padEnd(40)} ${n.vencida ? 'venceu' : 'vence '} ${dia(String(n.vencimento))}${n.foraDaJanela ? '   (escondida: fora da janela)' : ''}`)
  }
  console.log(`   RODAPÉ VIVO: selecionado ${brl(soma)} · ${soma > l.linha.valor ? `passou ${brl(soma - l.linha.valor)}` : `faltam ${brl(Math.round((l.linha.valor - soma) * 100) / 100)}`}`)

  // ⛔ a prova do que o dono pediu: nenhuma nota em dois cards ABERTOS
  const abertos = grupos.map((g) => g.linhas[0])
  const donos = new Map<string, number>()
  for (const c of abertos) for (const n of [...c.vencidas, ...c.aVencer]) {
    donos.set(n.descricao, (donos.get(n.descricao) ?? 0) + 1)
  }
  const repetidas = [...donos].filter(([, n]) => n > 1)
  console.log(`\n⛔ notas aparecendo em mais de um card ABERTO: ${repetidas.length}`)

  const janela = cards.flatMap((c) => c.aVencer).filter((n) => n.foraDaJanela).length
  console.log(`⭐ notas "a vencer" escondidas atrás de "mostrar mais": ${janela}`)
}

main().finally(() => prisma.$disconnect())
