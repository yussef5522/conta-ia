// SUITAPI — PROVA DOS COMPLEMENTOS PELA ESTEIRA REAL (DRY-RUN, zero escrita).
//   npx tsx scripts/suit-complementos-prova.ts --dia 2026-11-08 [--dia ...]
// Pra cada dia QUE JÁ TEM o XLS de complementos gravado: gera as linhas pela régua (espelho, ou a
// API por GET quando o dia não está no espelho — nada é gravado) e compara com o que o XLS gravou,
// NOME A NOME, ao centavo. Depois passa os DOIS conjuntos pelo plano de baixa da esteira
// (`previewLinhasDeComplemento`, só leitura) e compara o que cada um baixaria.
// ⛔ Dias já importados NÃO se reprocessam: isto só LÊ.
import { PrismaClient } from '@prisma/client'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { criarClienteSuitLeitura, type PedidoCru } from '../lib/suit/cliente-leitura'
import { janelaOperacional } from '../lib/suit/sync'
import { linhasDeComplementoDaRegua, lerDoEspelho, deCrus, complementosGravados } from '../lib/suit/complementos'
import { previewLinhasDeComplemento } from '../lib/stock/vendas/import-complementos'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const brl = (c: number) => 'R$ ' + (c / 100).toFixed(2).replace('.', ',')

async function main() {
  const a = process.argv.slice(2)
  const dias = a.flatMap((x, i) => (x === '--dia' && a[i + 1] ? [a[i + 1]] : []))
  const db = new PrismaClient({ log: [] })
  try {
    await exigirEmpresaNesteBanco(db, CACULA)
    let cliente: ReturnType<typeof criarClienteSuitLeitura> | null = null
    for (const dia of dias) {
      const g = await complementosGravados(db, CACULA, dia)
      if (!g.linhas.length) { console.log(`${dia} SEM XLS de complementos gravado — nada a provar`); continue }
      let pedidos = await lerDoEspelho(db, CACULA, dia)
      let fonte = `espelho (${pedidos.length} pedidos)`
      if (!pedidos.length) {
        cliente ??= criarClienteSuitLeitura()
        const { from, to } = janelaOperacional(dia)
        const crus: PedidoCru[] = []
        for (const { id } of await cliente.listar(from, to)) { const d = await cliente.detalhe(id); if (d) crus.push(d) }
        pedidos = deCrus(crus)
        fonte = `API por GET (${crus.length} pedidos, ${cliente.requisicoes()} req acumuladas)`
      }
      const r = linhasDeComplementoDaRegua(pedidos)
      const gm = new Map<string, [number, number]>()
      for (const l of g.linhas) { const c = gm.get(l.nomeSuitable) ?? [0, 0]; c[0] += l.ocorrencias; c[1] += Math.round(l.valorTotal * 100); gm.set(l.nomeSuitable, c) }
      const rm = new Map(r.linhas.map((l) => [l.produto, [l.quantidade, Math.round(l.valorTotal * 100)] as [number, number]]))
      const nomes = [...new Set([...gm.keys(), ...rm.keys()])]
      const difs = nomes.filter((k) => { const x = rm.get(k) ?? [0, 0]; const y = gm.get(k) ?? [0, 0]; return x[0] !== y[0] || x[1] !== y[1] })
      const gOcc = [...gm.values()].reduce((t, v) => t + v[0], 0)
      const gCent = [...gm.values()].reduce((t, v) => t + v[1], 0)
      // a esteira real (plano de baixa), com as linhas de cada produtor — só leitura
      const pr = await previewLinhasDeComplemento(CACULA, dia, r.linhas, db)
      const px = await previewLinhasDeComplemento(CACULA, dia, g.linhas.map((l) => ({ produto: l.nomeSuitable, quantidade: l.ocorrencias, valorTotal: l.valorTotal })), db)
      const chave = (p: typeof pr) => JSON.stringify((p.plano?.agregada ?? []).map((x) => [x.nome, x.qtd]).sort())
      const planoIgual = chave(pr) === chave(px)
      console.log(`${dia} ${difs.length === 0 && planoIgual ? 'BATE' : 'DIVERGE'} · régua ${r.linhas.length} linhas/${r.ocorrencias} occ/${brl(r.totalCent)} × XLS ${gm.size} linhas/${gOcc} occ/${brl(gCent)} · nomes≠ ${difs.length} · plano de baixa ${planoIgual ? 'IDÊNTICO' : 'DIFERENTE'} (${pr.plano?.agregada.length ?? 0} itens) · fonte: ${fonte}`)
      if (difs.length) console.log(`   ${difs.slice(0, 5).map((k) => `${k}: régua ${rm.get(k) ?? '-'} × xls ${gm.get(k) ?? '-'}`).join(' | ')}`)
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((e) => {
  const n = (e as Error)?.name ?? 'erro'
  console.error(`[suit-complementos-prova] ${/^(Suit|Banco)/.test(n) ? `${n}: ${(e as Error).message}` : `${n} (mensagem suprimida)`}`)
  process.exit(1)
})
