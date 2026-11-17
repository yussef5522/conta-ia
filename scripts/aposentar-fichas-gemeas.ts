// ⭐⭐ (17/11/2026) APOSENTAR AS 3 FICHAS GÊMEAS MORTAS — xis e pizzas (comparação de 16/11: idênticas).
// USO (servidor, /opt/conta-ia):  npx tsx scripts/aposentar-fichas-gemeas.ts             (dry-run: só lê)
//                                 npx tsx scripts/aposentar-fichas-gemeas.ts --aplicar   (a escrita autorizada)
// ⛔ Antes do --aplicar: pg_dump -Fc conferido por tamanho e contagem de tabelas (autorização do dono).
// A regra mora em lib/stock/producao/ficha-gemea.ts (testada em lib/stock/producao/__tests__/ficha-gemea.integration.test.ts).
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { aposentarFichaGemea } from '@/lib/stock/producao/ficha-gemea'
import { preverExclusaoDaFicha } from '@/lib/stock/producao/excluir-ficha'
import { montarCtx, montarPlanoDeLinhas } from '@/lib/stock/vendas/baixa-venda'
import { custoDeUmaUnidade } from '@/lib/stock/cardapio/hub'
import { custoMedioPorItem } from '@/lib/stock/saldo'

const CACULA = 'cmq17yapb00gnrndlh33sctbo' // REGRA 8: por ID
// [morta, canônica] — IDs medidos em prod em 17/11 (sonda só-leitura)
const PARES: [string, string][] = [
  ['cmtl15qry000211zeky37kjsx', 'cmtjb822c00756j3nt5y710m2'], // "XIS - COMPLETO" → "XIS COMPLETO"
  ['cmtxft8wx02ask53jxecrh29b', 'cmtl2fllb0009o3c6r0t41bf7'], // "Pizza Grande (35cm)" → "PIZZA GRANDE 35CM"
  ['cmtxfsldt02amk53je2p9388g', 'cmtl2exen0002o3c65016iabz'], // "Pizza Família (45cm)" → "PIZZA FAMILIA 45CM"
]
const aplicar = process.argv.includes('--aplicar')

async function custos(): Promise<string[]> {
  const [ctx, custoDe] = await Promise.all([montarCtx(CACULA, prisma), custoMedioPorItem(prisma, CACULA)])
  return PARES.map(([, c]) => { const r = custoDeUmaUnidade({ tipo: 'FICHA', fichaId: c }, ctx, custoDe); return `${r.custo?.toFixed(2) ?? '?'}${r.completo ? '' : '(parcial)'}` })
}

/** ⛔ TODOS os vínculos de venda cujo destino é ficha que não existe ou não está ativa */
async function vinculosPraFichaMorta(): Promise<string[]> {
  const ativas = new Set((await prisma.stockFicha.findMany({ where: { companyId: CACULA, ativo: true }, select: { id: true } })).map((f) => f.id))
  const [p, c, g] = await Promise.all([
    prisma.stockVendaProdutoMap.findMany({ where: { companyId: CACULA, alvoTipo: 'FICHA' }, select: { nomeSuitable: true, fichaId: true } }),
    prisma.stockVendaComplementoMap.findMany({ where: { companyId: CACULA, alvoTipo: 'FICHA' }, select: { nomeSuitable: true, fichaId: true } }),
    prisma.stockVendaGrafiaAgrupada.findMany({ where: { companyId: CACULA }, select: { nomeSuitable: true, fichaId: true } }),
  ])
  return [...p.map((x) => ({ ...x, t: 'produto' })), ...c.map((x) => ({ ...x, t: 'complemento' })), ...g.map((x) => ({ ...x, t: 'grafia' }))]
    .filter((x) => !x.fichaId || !ativas.has(x.fichaId)).map((x) => `${x.t}:"${x.nomeSuitable}"`)
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, CACULA)
  const custoAntes = await custos()
  const mortosAntes = await vinculosPraFichaMorta()
  console.log(`[gemeas] custo/un canônicas ANTES: ${custoAntes.join(' · ')} · vínculos pra ficha inativa/inexistente: ${mortosAntes.length}${mortosAntes.length ? ` (${mortosAntes.join(', ')})` : ''}`)
  for (const [m] of PARES) {
    const p = await preverExclusaoDaFicha(CACULA, m, prisma)
    console.log(`[gemeas] "${p.nome}" → ${p.caso} · lotes ${p.lotes} · nomes do PDV ligados ${p.mapeadaNoPdv}`)
  }
  if (!aplicar) { console.log('[gemeas] DRY-RUN — nada gravado'); return }
  for (const [m, c] of PARES) {
    const r = await aposentarFichaGemea({ companyId: CACULA, mortaFichaId: m, canonicaFichaId: c, userId: null }, prisma)
    console.log(`[gemeas] "${r.morta}" → "${r.canonica}" · ${r.exclusao.caso} · reapontados produto[${r.reapontados.produto.join(';')}] complemento[${r.reapontados.complemento.join(';')}] grafia[${r.reapontados.grafia.join(';')}] · ${r.exclusao.efeito}`)
  }
  const custoDepois = await custos()
  const mortosDepois = await vinculosPraFichaMorta()
  console.log(`[gemeas] custo/un canônicas DEPOIS: ${custoDepois.join(' · ')} · ${custoAntes.join() === custoDepois.join() ? 'INTACTO' : '⛔ MUDOU'}`)
  console.log(`[gemeas] vínculos pra ficha inativa/inexistente DEPOIS: ${mortosDepois.length}${mortosDepois.length ? ` (${mortosDepois.join(', ')})` : ''}`)
  // ⭐ a grafia velha cai na canônica (dry-run do plano — não grava)
  const plano = await montarPlanoDeLinhas(CACULA, '2026-11-17', ['XIS - COMPLETO', 'Pizza Grande (35cm)', 'Pizza Família (45cm)'].map((produto) => ({ produto, quantidade: 1, valorTotal: 0 })), null, prisma)
  for (const p of plano.produtos) console.log(`[gemeas] venda "${p.nome}" → ficha "${p.alvoNome}" (${PARES.some(([, c]) => c === p.fichaId) ? 'CANÔNICA' : '⛔ outra'})`)
  if (plano.pendentes.length) console.log(`[gemeas] ⛔ pendentes: ${plano.pendentes.map((p) => p.nome).join(', ')}`)
}
// ⛔ máscara de credencial: só erro de DOMÍNIO imprime a mensagem (a do Prisma pode vazar a URI)
main().then(() => process.exit(0)).catch((e) => { const dom = e instanceof Error && ['FichaGemeaError', 'ExcluirFichaError'].includes(e.name); console.error('FALHOU:', dom ? `${e.name}: ${e.message}` : (e instanceof Error ? e.name : 'erro')); process.exit(1) })
