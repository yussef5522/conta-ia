// ⭐ Sonda READ-ONLY: quem é o réu da baixa de 18/09? (REGRA 8b: prova o banco antes de medir)
import { PrismaClient } from '@prisma/client'
import { montarPlanoReprocesso } from '../lib/stock/vendas/baixa-venda'
import { saldosDaEmpresa } from '../lib/stock/saldo'
import { avaliarResiduo, custoParaBaixar } from '../lib/stock/residuo-de-centavos'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'

const EMPRESA = 'cmq17yapb00gnrndlh33sctbo'
const DIA = process.argv[2] ?? '2026-09-18'
const db = new PrismaClient()

async function main() {
  await exigirEmpresaNesteBanco(db, EMPRESA)

  const r = await montarPlanoReprocesso(EMPRESA, DIA, db)
  if (!r) { console.log(`sem linhas gravadas em ${DIA}`); return }

  const saldos = await saldosDaEmpresa(db, EMPRESA)
  const estado = new Map(saldos.map((s) => [s.itemId, s]))
  const round2 = (n: number) => Math.round(n * 100) / 100

  console.log(`\n=== BAIXA DE ${DIA} ===`)
  console.log(`${r.plano.agregada.length} itens agregados · ${r.estornaItens} movimentos a estornar\n`)

  const barrados: string[] = []
  const ajusta: string[] = []
  for (const a of r.plano.agregada) {
    const at = estado.get(a.itemId)
    const cheio = custoParaBaixar(at?.valor ?? 0, at?.saldo ?? 0)
    const custoTotal = round2(-a.qtd * cheio)
    const v = avaliarResiduo({
      saldoAntes: at?.saldo ?? 0, valorAntes: at?.valor ?? 0,
      qtdDaBaixa: a.qtd, valorDaBaixa: Math.abs(custoTotal),
    })
    const linha = `«${a.nome}» hoje ${at?.saldo ?? 0} un / R$ ${(at?.valor ?? 0).toFixed(2)} · baixa ${a.qtd} (R$ ${Math.abs(custoTotal).toFixed(2)}) → saldo ${v.saldoDepois} / R$ ${v.valorDepois.toFixed(2)} [teto ${v.teto.toFixed(2)}]`
    if (v.decisao === 'RECUSA') barrados.push(linha)
    else if (v.decisao === 'AJUSTA_RESIDUO') ajusta.push(linha)
  }

  console.log(`⛔ BARRADOS (${barrados.length}):`)
  barrados.forEach((l) => console.log('   ' + l))
  console.log(`\n⭐ AJUSTE DE RESÍDUO (${ajusta.length}):`)
  ajusta.forEach((l) => console.log('   ' + l))
  console.log(`\n✓ seguem normal: ${r.plano.agregada.length - barrados.length - ajusta.length}`)

  // ⚠️ e o suspeito do dono, resolvido por ID depois de achar o nome
  const cands = await db.stockItem.findMany({ where: { companyId: EMPRESA, nome: { contains: 'file para xis' } }, select: { id: true, nome: true } })
  for (const c of cands) {
    const s = estado.get(c.id)
    console.log(`\nsuspeito do dono: «${c.nome}» saldo ${s?.saldo ?? 0} · valor R$ ${(s?.valor ?? 0).toFixed(2)}`)
  }
}

main().finally(() => db.$disconnect())
