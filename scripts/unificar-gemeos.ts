// ⭐⭐ (16/11/2026) A UNIFICAÇÃO MECÂNICA DOS GÊMEOS — só grupos IGUAIS sob a régua, prateleira física.
// USO (servidor, /opt/conta-ia):  npx tsx scripts/unificar-gemeos.ts             (dry-run: só lê)
//                                 npx tsx scripts/unificar-gemeos.ts --aplicar   (a escrita autorizada)
// ⛔ Antes do --aplicar: pg_dump -Fc conferido por tamanho e contagem de tabelas (autorização do dono).
// A regra mora em lib/stock/itens/unificar-gemeos.ts (testada em lib/stock/itens/__tests__/gemeos.integration.test.ts).
import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { gruposDeGemeos, unificarGrupo } from '@/lib/stock/itens/unificar-gemeos'

const CACULA = 'cmq17yapb00gnrndlh33sctbo' // REGRA 8: por ID
const aplicar = process.argv.includes('--aplicar')

async function main() {
  await exigirEmpresaNesteBanco(prisma, CACULA)
  const { grupos, outrasPrateleiras } = await gruposDeGemeos(CACULA, prisma)
  const movAntes = await prisma.stockMovement.count({ where: { companyId: CACULA } })
  console.log(`[gemeos] ${grupos.length} grupos na mesma prateleira (${grupos.filter((g) => g.mecanico).length} mecânicos) · ${outrasPrateleiras.length} nomes iguais em prateleiras diferentes (desenho, não gêmeo)`)
  for (const g of grupos) console.log(`  ${g.mecanico ? 'MECÂNICO' : 'DONO    '} · ${g.membros.map((m) => `"${m.nome}" (${m.categoria} ${m.unidadeControle}, ${m.movimentos} mov, saldo ${m.saldo})`).join(' + ')} → "${g.canonico.nome}"${g.motivo ? ` · ${g.motivo}` : ''}`)
  for (const o of outrasPrateleiras) console.log(`  OUTRA PRATELEIRA · ${o.membros.map((m) => `"${m.nome}" ${m.categoria} ${m.unidadeControle}`).join(' × ')}`)
  if (!aplicar) { console.log('[gemeos] DRY-RUN — nada gravado'); return }
  for (const g of grupos.filter((x) => x.mecanico)) {
    const p = await unificarGrupo(CACULA, g, null, prisma)
    console.log(`[gemeos] UNIFICADO "${p.absorvidos.join('", "')}" → "${p.canonico}" · saldo ${p.saldoAntes} → ${p.saldoDepois} · movimentos vivos ${p.vivosAntes} → ${p.vivosDepois} · ${p.bate ? 'BATE' : '⛔ NÃO BATE'}`)
    if (!p.bate) process.exit(1)
  }
  const movDepois = await prisma.stockMovement.count({ where: { companyId: CACULA } })
  console.log(`[gemeos] razão: ${movAntes} → ${movDepois} linhas (Δ ${movDepois - movAntes} = estorno + cópia de cada movimento vivo absorvido; nada apagado)`)
}
main().then(() => process.exit(0)).catch((e) => { console.error('FALHOU:', e instanceof Error ? `${e.name}: ${e.message.replace(/postgres\S+/g, '[uri]').slice(0, 200)}` : 'erro'); process.exit(1) })
