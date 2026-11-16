// ⭐⭐ FASE 1 (16/11/2026) — destravar o dia gravado PELA METADE pela REGRA DA CONTAGEM.
// USO (servidor, /opt/conta-ia):  npx tsx scripts/destravar-dia-parado.ts 2026-11-15            (dry-run: só lê)
//                                 npx tsx scripts/destravar-dia-parado.ts 2026-11-15 --aplicar  (a escrita autorizada)
// ⛔ Antes do --aplicar: pg_dump -Fc conferido por tamanho e contagem de tabelas (autorização do dono).
// A regra mora em lib/stock/vendas/destravar-dia-parado.ts (testada em lib/suit/__tests__/dia-parado.integration.test.ts).
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { planoDoDiaParado, destravarDiaParadoPelaContagem } from '@/lib/stock/vendas/destravar-dia-parado'
import { conferirBaixaDoDia } from '@/lib/stock/vendas/guarda-da-baixa'
import { diaEmSaoPaulo } from '@/lib/datas/dia-sao-paulo'

const CACULA = 'cmq17yapb00gnrndlh33sctbo' // REGRA 8: por ID
const dia = process.argv[2]
const aplicar = process.argv.includes('--aplicar')

async function main() {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia ?? '')) throw new Error('informe o dia: AAAA-MM-DD')
  await exigirEmpresaNesteBanco(prisma, CACULA)
  const antes = await conferirBaixaDoDia(CACULA, dia, prisma)
  const movAntes = await prisma.stockMovement.count({ where: { companyId: CACULA } })
  const p = await planoDoDiaParado(CACULA, dia, prisma)
  const un = (xs: { qtd: number }[]) => xs.reduce((t, x) => t + x.qtd, 0)
  console.log(`[destravar] ${dia} · buraco ANTES: ${antes.furos.filter((f) => f.buraco > 0).length} itens · R$ ${antes.totalRs.toFixed(2)}`)
  console.log(`[destravar] a baixar: ${p.aplicar.length} itens (${un(p.aplicar)} un) · cobertos por contagem: ${p.cobertos.length} itens (${un(p.cobertos)} un)`)
  for (const c of p.cobertos) console.log(`  coberto · ${c.nome} · ${c.qtd} · ${c.tipo} em ${c.contadoEm.slice(0, 16)}Z`)
  if (!aplicar) { console.log('[destravar] DRY-RUN — nada gravado'); return }
  const r = await destravarDiaParadoPelaContagem(CACULA, dia, diaEmSaoPaulo(new Date()), prisma)
  const movDepois = await prisma.stockMovement.count({ where: { companyId: CACULA } })
  const depois = await conferirBaixaDoDia(CACULA, dia, prisma)
  const cobertos = new Set(r.cobertos.map((c) => c.itemId))
  const novosEmCoberto = await prisma.stockMovement.count({ where: { companyId: CACULA, receiptId: r.importId, tipo: 'BAIXA_VENDA', itemId: { in: [...cobertos] } } })
  const forasDaRegra = depois.furos.filter((f) => !cobertos.has(f.itemId))
  console.log(`[destravar] APLICADO · movimentos criados ${r.movimentos} (contagem ${movAntes} → ${movDepois}, Δ ${movDepois - movAntes}) · baixa em item coberto: ${novosEmCoberto}`)
  console.log(`[destravar] buraco DEPOIS: ${depois.furos.length} itens, todos cobertos por contagem? ${forasDaRegra.length === 0 ? 'SIM' : `NÃO — ${forasDaRegra.map((f) => f.nome).join(', ')}`}`)
  const row = await prisma.suitDiaMaterializado.findUnique({ where: { companyId_dia: { companyId: CACULA, dia } }, select: { status: true, motivo: true } })
  console.log(`[destravar] dia → ${row?.status} · "${row?.motivo}"`)
}
main().then(() => process.exit(0)).catch((e) => { console.error('FALHOU:', e instanceof Error ? `${e.name}: ${e.message.replace(/postgres\S+/g, '[uri]').slice(0, 200)}` : 'erro'); process.exit(1) })
