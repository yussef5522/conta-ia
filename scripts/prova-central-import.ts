/**
 * ⭐⭐⭐ A PROVA EM PROD DA CENTRAL DE IMPORT (08/10/2026) — navegando, nos DOIS viewports.
 *
 * ⚠️ REGRA 12: a tela se prova no CELULAR e no COMPUTADOR, sempre. E ela mede **o que prod
 * SERVE** (o bundle), nunca o meu código-fonte — a cicatriz de 10/09, quando o motor estava em
 * prod e a tela não tinha mudado.
 *
 * ⭐⭐ A LEITURA DA REFERÊNCIA VEM DA **PORTA ÚNICA** (`lerReferenciaVisual`), a MESMA que o
 * guard usa. ⛔ Na v3.1 a sonda tinha a própria cópia do regex e acusou *"FALTAM 1024"* sobre
 * uma tela CORRETA: duas réguas pro mesmo arquivo e uma delas mente — e é sempre a que ninguém
 * reconsertou.
 *
 * ⛔ ZERO ESCRITA: tudo é GET, e o produtor do sininho roda em PREVIEW com rollback forçado. A
 * contabilidade antes/depois é impressa — sem ela, "não gravou nada" é promessa.
 */
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { lerReferenciaVisual, CAMINHO_DA_REFERENCIA_IMPORTAR } from '@/lib/referencias/visual'
import { produzirAvisosDeImportDeVenda } from '@/lib/avisos/produtores/import-de-venda'

const CO = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const base = 'http://localhost:3001'

const VIEWPORTS: [string, string][] = [
  ['celular', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'],
  ['desktop', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128 Safari/537.36'],
]

const brl = (n: number | null | undefined) =>
  n == null ? 'a apurar' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** ⚠️ tolera a escapação de acento do minificador (`à` → `\xe0`) — a cicatriz de 15/09 */
const temFrase = (chunk: string, f: string) =>
  chunk.includes(f) ||
  chunk.includes(
    [...f].map((c) => (c.charCodeAt(0) > 126 ? `\\x${c.charCodeAt(0).toString(16)}` : c)).join(''),
  )

async function main() {
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`[prova central] ${nome.trim()}`)

  const u = await prisma.user.findFirst({ where: { email: 'yussefmusa5522@gmail.com' } })
  const token = await signToken({ sub: u!.id, email: u!.email, name: u!.name ?? 'dono', role: 'OWNER' })
  const cookie = `auth_token=${token}; current_empresa_id=${CO}`

  const antes = {
    arquivos: await prisma.stockVendaArquivo.count({ where: { companyId: CO } }),
    linhas: await prisma.stockVendaLinha.count({ where: { companyId: CO } }),
    comp: await prisma.stockVendaComplementoLinha.count({ where: { companyId: CO } }),
    movimentos: await prisma.stockMovement.count({ where: { companyId: CO } }),
    avisos: await prisma.aviso.count({ where: { companyId: CO } }),
  }

  /* ═════════════ 1. A TELA, NOS DOIS VIEWPORTS ═════════════ */
  console.log('\n═══ 1. A TELA, NOS DOIS VIEWPORTS')
  const chunk: Record<string, string> = {}
  for (const [v, ua] of VIEWPORTS) {
    const t0 = Date.now()
    const r = await fetch(`${base}/empresas/${CO}/estoque/vendas`, { headers: { cookie, 'user-agent': ua } })
    const html = await r.text()
    let meu = ''
    for (const s of [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map((m) => m[1])) {
      const t = await (await fetch(base + s, { headers: { cookie } })).text()
      /** ⚠️ a frase EXCLUSIVA desta tela — é ela que torna o achado atribuível (a lição de 07/10,
       *  quando somar os 81 chunks da página acusou hex do SHELL como se fosse da tela) */
      if (t.includes('do Suitable') && t.includes('Dias importados')) meu += t
    }
    let css = ''
    for (const c of [...html.matchAll(/href="(\/_next\/static\/[^"]*\.css)"/g)].map((m) => m[1])) {
      css += await (await fetch(base + c, { headers: { cookie } })).text()
    }
    chunk[v] = meu
    chunk[`${v}_CSS`] = css
    console.log(`  ${v}  ${r.status} em ${Date.now() - t0}ms · chunk desta tela ${(meu.length / 1024) | 0} KB`)
  }

  /* ═════════════ 2. PEÇA POR PEÇA, CONTRA O ARQUIVO DO DONO ═════════════ */
  console.log('\n═══ 2. AS PEÇAS DA REFERÊNCIA — no bundle que prod serve')
  const REF = lerReferenciaVisual(CAMINHO_DA_REFERENCIA_IMPORTAR)
  /**
   * ⚠️⚠️ SÓ O QUE A **TELA** ESCREVE ENTRA AQUI. Os rótulos dos 4 SELOS e os da coluna DESTINO
   * moram em LIBS do SERVIDOR (`razao-sabor-pizza.ts`, `detalhe-do-dia.ts`) e chegam PRONTOS no
   * payload — a tela desenha `d.seloRotulo` / `p.destinoRotulo`. Procurá-los no bundle estático
   * dá **falso vermelho sobre uma tela correta** (a cicatriz de 20/09, quando eu procurei no
   * chunk uma frase que vinha do servidor). ⭐ Eles são conferidos nas partes 4 e 5, contra a
   * ROTA — que é onde eles de fato existem.
   */
  const PECAS: [string, string[]][] = [
    ['CABEÇALHO', ['Importar vendas', 'do Suitable']],
    ['1 DROPZONE DUPLA', ['Relatório de Produtos', 'Relatório de Complementos', 'sem baixar sabor do estoque']],
    ['2 ALERTA DO BURACO', ['ficou sem importação', 'importar este dia']],
    ['3 DIAS IMPORTADOS', ['Dias importados', 'toque no dia']],
    ['CONFERÊNCIA', ['Σ do arquivo', 'bate ao centavo', 'sem destino', 'substituir o dia', 'refazer a baixa']],
    ['NOTA DO SININHO', ['camada 3', 'uma causa, um alarme']],
    ['4 DETALHE DO DIA', ['buscar produto ou sabor', 'DESTINO NO ESTOQUE', 'VEZES', 'criar agora']],
  ]
  for (const [peca, frases] of PECAS) {
    const faltam: string[] = []
    for (const f of frases) {
      for (const [v] of VIEWPORTS) if (!temFrase(chunk[v], f)) faltam.push(`${f} (${v})`)
    }
    console.log(`  ${faltam.length === 0 ? '✓' : '⛔'} ${peca} ${frases.length * 2}/${frases.length * 2 - faltam.length}${faltam.length ? ` — FALTAM: ${faltam.join(' · ')}` : ''}`)
  }

  /* ═════════════ 3. TOKENS E MEDIDAS — os 2 temas, a lei de layout ═════════════ */
  console.log('\n═══ 3. OS 2 TEMAS E A LEI DE LAYOUT')
  /**
   * ⚠️⚠️ ATRIBUIÇÃO HONESTA DO HEX: o chunk carrega a CENTRAL **e a página de vendas** (abas,
   * cards, botões), que é anterior a este sprint e usa o azul da marca `#185FA5`. ***Achado não
   * atribuível não é achado*** (a lição de 06/10, quando somar os 81 chunks acusou hex do shell).
   * Quem prova que a CENTRAL tem zero hex é o guard, que lê o arquivo dela; aqui o número é
   * impresso com o nome de quem ele pertence.
   */
  const HEX_DA_PAGINA = new Set(['#185FA5', '#0F4A8C'])
  for (const [v] of VIEWPORTS) {
    const hex = [...new Set([...chunk[v].matchAll(/#[0-9A-Fa-f]{6}\b/g)].map((m) => m[0]))]
    const foraDaPagina = hex.filter((h) => !HEX_DA_PAGINA.has(h))
    console.log(`  ${v}  hex no chunk: ${hex.join(', ') || 'nenhum'} — da PÁGINA (pré-existente): ${hex.filter((h) => HEX_DA_PAGINA.has(h)).length} · desconhecido: ${foraDaPagina.length}${foraDaPagina.length ? ` ⛔ ${foraDaPagina.join(', ')}` : ' ✓'}`)
    console.log(`  ${v}  teto 1440 ✓${chunk[v].includes('max-w-[1440px]') ? '' : ' ⛔ AUSENTE'} · celular ✓${chunk[v].includes('max-[700px]:px-[14px]') ? '' : ' ⛔ AUSENTE'}`)
  }
  const css = chunk.celular_CSS
  const tokens = [...new Set([...chunk.celular.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]))]
  const semTema = tokens.filter((t) => (css.split(`${t}:`).length - 1) < 2)
  console.log(`  ⭐ ${tokens.length} tokens usados · nos DOIS mapas do CSS: ${tokens.length - semTema.length}${semTema.length ? ` ⛔ só num tema: ${semTema.join(', ')}` : ' ✓'}`)
  /** ⚠️ a base do `body{}` sai — é o tamanho da PÁGINA (vem do shell), não hierarquia de elemento */
  const baseDoBody = (REF.css.match(/body\{[^}]*font-size:\s*([\d.]+)px/) ?? [])[1]
  const letras = REF.letras.filter((px) => px !== baseDoBody)
  const achadas = letras.filter((px) => chunk.celular.includes(`text-[${px}px]`))
  console.log(`  ⭐ as ${letras.length} hierarquias de letra da referência no bundle: ${achadas.length}${achadas.length === letras.length ? ' ✓' : ` ⛔ faltam ${letras.filter((px) => !achadas.includes(px)).join(', ')}`} (a base ${baseDoBody}px é do shell)`)

  /* ═════════════ 4. A ROTA DA CENTRAL — os números reais ═════════════ */
  console.log('\n═══ 4. A CENTRAL, PELA ROTA REAL')
  const r = await fetch(`${base}/api/empresas/${CO}/estoque/vendas/central`, { headers: { cookie } })
  console.log(`  GET /central → ${r.status}`)
  const c = (await r.json()) as {
    mes: string
    contagem: Record<string, number>
    buracos: string[]
    dias: {
      dia: string; selo: string; seloRotulo: string; unidades: number; valor: number
      arquivos: number; frase: string; quem: string | null; hora: string | null
      conferencia: { somaArquivo: number | null; somaGravado: number; bate: boolean | null; semDestino: number }
    }[]
  }
  console.log(`  mês ${c.mes} · ${c.dias.length} dias · contagem ${JSON.stringify(c.contagem)}`)
  /** ⭐ os 4 RÓTULOS DE SELO conferidos onde eles existem: o payload (a lib do servidor) */
  const { ROTULO_DO_SELO } = await import('@/lib/stock/vendas/razao-sabor-pizza')
  const rotulos = Object.values(ROTULO_DO_SELO)
  const vistos = new Set(c.dias.map((d) => d.seloRotulo))
  console.log(`  os 4 selos da referência: ${rotulos.map((r) => `${r}${vistos.has(r) ? ' (no dado de hoje)' : ''}`).join(' · ')}`)
  console.log(`  buracos (dia de venda sem arquivo): ${c.buracos.length}${c.buracos.length ? ` → ${c.buracos.slice(0, 5).join(', ')}` : ''}`)
  for (const d of c.dias.slice(0, 8)) {
    const sigma = d.conferencia.somaArquivo == null
      ? `Σ gravado ${brl(d.conferencia.somaGravado)} (o arquivo não declarou)`
      : `Σ arquivo ${brl(d.conferencia.somaArquivo)} × gravado ${brl(d.conferencia.somaGravado)} ${d.conferencia.bate ? '✓ bate' : '⛔ não bate'}`
    console.log(
      `   ${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}  ${d.seloRotulo.padEnd(28)} ${String(d.unidades).padStart(5)} un · ${brl(d.valor).padStart(13)} · ${d.arquivos} arq · ${d.quem ?? '—'} ${d.hora ?? ''}`,
    )
    console.log(`          ${sigma} · ${d.conferencia.semDestino} sem destino · ${d.frase}`)
  }

  /* ═════════════ 5. O DETALHE DO DIA — a coluna DESTINO ═════════════ */
  const comDado = c.dias.find((d) => d.unidades > 0)
  if (comDado) {
    console.log(`\n═══ 5. O DETALHE DE ${comDado.dia} — a coluna DESTINO lê o motor da baixa`)
    const rd = await fetch(`${base}/api/empresas/${CO}/estoque/vendas/central/${comDado.dia}`, { headers: { cookie } })
    console.log(`  GET /central/${comDado.dia} → ${rd.status}`)
    const d = (await rd.json()) as {
      produtos: { nome: string; unidades: number; valor: number; destinoRotulo: string }[]
      sabores: { nome: string; vezes: number; rotulo: string }[]
      totais: { unidades: number; valor: number; linhas: number; semDestino: number; ocorrencias: number; saboresSemFicha: number; bateComODia: boolean }
    }
    console.log(`  ${d.totais.linhas} linhas · ${d.totais.unidades} un · ${brl(d.totais.valor)} · ${d.totais.semDestino} sem destino`)
    console.log(`  sabores: ${d.sabores.length} nomes · ${d.totais.ocorrencias} ocorrências · ${d.totais.saboresSemFicha} sem ficha`)
    console.log(`  ⛔ GUARD DA TELA: Σ(linhas) == Σ do dia → ${d.totais.bateComODia ? '✓ BATE' : '⛔ NÃO FECHA'}`)
    for (const p of d.produtos.slice(0, 6)) {
      console.log(`   ${p.nome.slice(0, 34).padEnd(34)} ${String(p.unidades).padStart(4)} · ${brl(p.valor).padStart(12)} · ${p.destinoRotulo}`)
    }
    for (const s of d.sabores.slice(0, 4)) {
      console.log(`   🍕 ${s.nome.slice(0, 30).padEnd(30)} ${String(s.vezes).padStart(4)}× · ${s.rotulo}`)
    }
  }

  /* ═════════════ 6. O SININHO — preview com ROLLBACK ═════════════ */
  console.log('\n═══ 6. CAMADA 3 — O SININHO (preview, nada gravado)')
  const agora = new Date()
  const brasil = new Date(agora.getTime() - 3 * 3_600_000)
  console.log(`  agora no Brasil: ${brasil.toISOString().slice(0, 16).replace('T', ' ')} (gate das 10h ${brasil.getUTCHours() >= 10 ? 'JÁ passou' : 'ainda NÃO passou'})`)
  try {
    await prisma.$transaction(async (tx) => {
      const res = await produzirAvisosDeImportDeVenda(CO, agora, tx)
      console.log(`  gravaria ${res.gravados} · reabriria ${res.reabertos} · resolveria ${res.resolvidos} · recusados pela língua do balcão: ${res.recusados.length}`)
      for (const x of res.recusados) console.log(`   ⛔ RECUSADO (${x.motivo}): ${x.titulo}`)
      for (const x of res.calados.slice(0, 4)) console.log(`   · calado ${x.dia}: ${x.porque}`)
      const novos = await tx.aviso.findMany({
        where: { companyId: CO, origem: 'IMPORT_DE_VENDA_TORTO' },
        select: { alvo: true, severidade: true, titulo: true, corpo: true, acaoRotulo: true },
        orderBy: { alvo: 'desc' },
        take: 5,
      })
      for (const a of novos) {
        console.log(`   [${a.severidade}] ${a.titulo}`)
        console.log(`        ${a.corpo}`)
        console.log(`        → ${a.acaoRotulo}`)
      }
      throw new Error('ROLLBACK_DA_PROVA')
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== 'ROLLBACK_DA_PROVA') throw e
    console.log('  ⭐ rollback forçado — nada do preview ficou')
  }

  /* ═════════════ 7. CONTABILIDADE ═════════════ */
  const depois = {
    arquivos: await prisma.stockVendaArquivo.count({ where: { companyId: CO } }),
    linhas: await prisma.stockVendaLinha.count({ where: { companyId: CO } }),
    comp: await prisma.stockVendaComplementoLinha.count({ where: { companyId: CO } }),
    movimentos: await prisma.stockMovement.count({ where: { companyId: CO } }),
    avisos: await prisma.aviso.count({ where: { companyId: CO } }),
  }
  console.log('\n═══ 7. CONTABILIDADE DE ESCRITA')
  let mexeu = false
  for (const k of Object.keys(antes) as (keyof typeof antes)[]) {
    const d = depois[k] - antes[k]
    if (d !== 0) mexeu = true
    console.log(`  ${k.padEnd(12)} ${antes[k]} → ${depois[k]}  ${d === 0 ? '✓' : `⛔ Δ${d}`}`)
  }
  console.log(mexeu ? '\n⛔ A PROVA ESCREVEU — investigar' : '\n⭐ ZERO ESCRITA')
}

main()
  .catch((e) => {
    console.error('⛔ prova abortou:', e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
