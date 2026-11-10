// SUITAPI — materializar UM dia na mão (ordem explícita do dono). DRY-RUN por padrão.
//   npx tsx scripts/suit-materializar.ts --dia 2026-11-09 [--substituir-xls] [--confirmar]
// Sempre: sync COMPLETO do dia (o espelho) e o comparativo Suit × o que a esteira tem hoje.
// Só com --confirmar entrega à esteira. --substituir-xls = o dia JÁ tem arquivo e o dono mandou
// trocar pelo da Suit (a esteira estorna as baixas do arquivo e faz as novas). Toma a trava do laço.
import { PrismaClient } from '@prisma/client'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { criarClienteSuitLeitura } from '../lib/suit/cliente-leitura'
import { sincronizarJanela, sincronizarLancamentos, janelaOperacional } from '../lib/suit/sync'
import { materializarDia, linhasDoDia, exigirDiaFechado, exigirFusoDaCasa } from '../lib/suit/materializar'
import { tentarTravar, soltar } from '../lib/suit/trava-arquivo'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const TRAVA = `${process.env.SUIT_STATE_DIR ?? '/var/lib/conta-ia'}/suit.lock`
const brl = (c: number) => (c < 0 ? '−' : '') + 'R$ ' + (Math.abs(c) / 100).toFixed(2).replace('.', ',')
const nomeDoErro = (e: unknown) => {
  const n = (e as Error)?.name ?? 'erro'
  return /^(Suit|Dia|Banco)/.test(n) ? `${n}: ${(e as Error).message}` : `${n} (mensagem suprimida)`
}

async function main() {
  const a = process.argv.slice(2)
  const dia = a[a.indexOf('--dia') + 1] ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw Object.assign(new Error('use --dia AAAA-MM-DD'), { name: 'SuitErro' })
  const confirmar = a.includes('--confirmar')
  const substituirXls = a.includes('--substituir-xls')
  exigirFusoDaCasa()
  exigirDiaFechado(dia, new Date())
  const db = new PrismaClient({ log: [] })
  if (!tentarTravar(TRAVA)) throw Object.assign(new Error('o laço está no meio de um ciclo — rode de novo em 1 min'), { name: 'SuitErro' })
  try {
    await exigirEmpresaNesteBanco(db, CACULA)
    const cliente = criarClienteSuitLeitura()
    const { from, to } = janelaOperacional(dia)
    const s = await sincronizarJanela(db, cliente, CACULA, from, to, new Date(), true)
    await sincronizarLancamentos(db, cliente, CACULA, dia, new Date())
    const api = await linhasDoDia(db, CACULA, dia)
    const imp = await db.stockVendaImport.findUnique({ where: { companyId_data: { companyId: CACULA, data: new Date(`${dia}T12:00:00`) } }, select: { id: true, criadoEm: true } })
    const hoje = imp ? await db.stockVendaLinha.findMany({ where: { companyId: CACULA, importId: imp.id }, select: { nomeSuitable: true, quantidade: true, valorTotal: true } }) : []
    const hojeCent = hoje.reduce((t, l) => t + Math.round(l.valorTotal * 100), 0)
    const hojeUn = hoje.reduce((t, l) => t + l.quantidade, 0)
    console.log(`${dia} SUIT: ${api.pedidos} pedidos · ${api.linhas.length} linhas · ${api.unidades} un · ${brl(api.totalCent)} (sync: ${s.listados} listados, ${s.sumidos} sumidos)`)
    console.log(`${dia} ESTEIRA HOJE: ${imp ? `${hoje.length} linhas · ${hojeUn} un · ${brl(hojeCent)} (import de ${imp.criadoEm.toISOString()})` : 'sem import'} · diferença ${brl(api.totalCent - hojeCent)} / ${api.unidades - hojeUn} un`)
    const m = new Map(hoje.map((l) => [l.nomeSuitable, l]))
    const difs = api.linhas.map((l) => ({ p: l.produto, dUn: l.quantidade - (m.get(l.produto)?.quantidade ?? 0), dC: Math.round(l.valorTotal * 100) - Math.round((m.get(l.produto)?.valorTotal ?? 0) * 100) }))
      .concat(hoje.filter((l) => !api.linhas.some((x) => x.produto === l.nomeSuitable)).map((l) => ({ p: l.nomeSuitable, dUn: -l.quantidade, dC: -Math.round(l.valorTotal * 100) })))
      .filter((d) => d.dUn || d.dC).sort((x, y) => Math.abs(y.dC) - Math.abs(x.dC))
    console.log(`  ${difs.length} produto(s) diferem; maiores: ${difs.slice(0, 5).map((d) => `${d.p} ${d.dUn > 0 ? '+' : ''}${d.dUn}un ${brl(d.dC)}`).join(' | ') || '—'}`)
    if (!confirmar) { console.log('  DRY-RUN — nada entregue à esteira (use --confirmar)'); return }
    const r = await materializarDia(db, CACULA, dia, new Date(), { substituirXls })
    console.log(`  ENTREGUE: ${JSON.stringify(r)}`)
    console.log(`  requisições: ${cliente.requisicoes()}`)
  } finally {
    soltar(TRAVA)
    await db.$disconnect()
  }
}

main().catch((e) => { console.error(`[suit-materializar] ${nomeDoErro(e)}`); process.exit(1) })
