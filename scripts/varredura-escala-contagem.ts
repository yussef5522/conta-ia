// ⭐⭐ VARREDURA DE IRMÃOS DORMINDO — contagens com assinatura de troca de escala (20/09).
//
// **A ordem do dono (item 3):** *"contagens CONFIRMADAS com razão >100× do saldo que nunca
// foram recontadas depois — lista pra mim (o creme de leite era um; tem mais?)"*.
//
// ⛔ READ-ONLY. Cirurgia de dado é decisão dele; aqui só se OLHA.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { acharTrocaDeEscala } from '@/lib/stock/escala'

const CO = process.argv[2] ?? 'cmq17yapb00gnrndlh33sctbo'
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dia = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)

/**
 * ⚠️⚠️ **O DEGRAU ">100×" DO PEDIDO NÃO PEGAVA O CASO QUE O MOTIVOU** — medido: o creme de
 * leite é `16600 / 177 = 93,8×`, e ficaria de fora por 6 décimos. ⭐ A régua que pega é a
 * **ASSINATURA** (`acharTrocaDeEscala`): fator 10/100/1000 com o palpite caindo perto do
 * saldo — a MESMA do freio novo, então a varredura e o freio não têm como discordar.
 */
const RAZAO_MINIMA = 10

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const linhas = await prisma.stockContagemItem.findMany({
    where: { companyId: CO },
    select: {
      itemId: true, contadoEm: true, saldoSistema: true, qtdContada: true,
      divergencia: true, valorDivergencia: true, contadoPorNome: true, freioConfirmado: true,
    },
    orderBy: { contadoEm: 'asc' },
  })
  const itens = new Map((await prisma.stockItem.findMany({
    where: { companyId: CO }, select: { id: true, nome: true, unidadeControle: true },
  })).map((i) => [i.id, i]))

  // ⭐ a última contagem de cada item — é ela que diz se alguém RECONTOU depois
  const ultimaPorItem = new Map<string, Date>()
  for (const l of linhas) ultimaPorItem.set(l.itemId, l.contadoEm)

  const suspeitas = linhas.filter((l) => {
    const it = itens.get(l.itemId)
    if (!(l.saldoSistema > 0) || l.qtdContada / l.saldoSistema < RAZAO_MINIMA) return false
    return acharTrocaDeEscala(l.qtdContada, l.saldoSistema, {
      unidadeInteira: (it?.unidadeControle ?? '').toUpperCase() === 'UN',
      unidade: it?.unidadeControle,
    }) !== null
  })

  console.log(`\n⭐ VARREDURA — ${linhas.length} linhas de contagem · com assinatura de escala: ${suspeitas.length}\n`)
  if (suspeitas.length === 0) { console.log('   nenhuma. ⭐ (o creme de leite era o único, ou já foi resolvido)'); return }

  let fantasmaVivo = 0
  for (const l of suspeitas) {
    const it = itens.get(l.itemId)
    const recontou = (ultimaPorItem.get(l.itemId)?.getTime() ?? 0) > l.contadoEm.getTime()
    const escala = acharTrocaDeEscala(l.qtdContada, l.saldoSistema, {
      unidadeInteira: (it?.unidadeControle ?? '').toUpperCase() === 'UN',
      unidade: it?.unidadeControle,
    })
    const saldo = await prisma.stockMovement.aggregate({
      where: { companyId: CO, itemId: l.itemId, tipo: { not: 'PRODUCAO_CONSUMO' } },
      _sum: { quantidade: true, custoTotal: true },
    })
    console.log(`${recontou ? '✓ RECONTADO DEPOIS' : '⛔ NUNCA RECONTADO'} — ${it?.nome ?? l.itemId}`)
    console.log(`   ${dia(l.contadoEm)} · sistema ${l.saldoSistema} → contou ${l.qtdContada} · ${brl(l.valorDivergencia)}`
      + ` · ${l.contadoPorNome ?? '—'}${l.freioConfirmado ? ' [freio confirmado]' : ''}`)
    if (escala) console.log(`   ⭐ assinatura de escala: provável ${escala.provavel} (${escala.fator}×)`)
    console.log(`   saldo HOJE: ${saldo._sum.quantidade} · ${brl(saldo._sum.custoTotal ?? 0)}`)
    if (!recontou) fantasmaVivo += saldo._sum.custoTotal ?? 0
    console.log('')
  }
  console.log(`⛔ VALOR AINDA DE PÉ nos NUNCA RECONTADOS: ${brl(fantasmaVivo)}`)
  console.log('   (o gesto é do dono: recontar pela tela — nada aqui foi alterado)')
}

main().catch((e) => { console.error(e.message); process.exit(1) }).finally(() => prisma.$disconnect())
