// ⭐⭐⭐ CARTÕES v3 — BACKFILL DAS FATURAS E DAS PARCELAS FUTURAS (24/11/2026).
//
// AUTORIZAÇÃO NOMINAL do dono (sprint "CARTÕES NÍVEL MUNDO"): UMA escrita pontual em prod —
// materializar as faturas históricas e as parcelas futuras das compras vivas a partir do que JÁ
// está importado. Idempotente; contagens antes/depois; nada se apaga nem se reimporta.
//
// ⭐ PELA MESMA PORTA DO IMPORT (`registrarFatura` + `projetarParcelas`) — uma cópia aqui seria a
// 2ª régua de "que parcela falta". A simulação conta pelo MESMO plano puro (`planoDeParcelas`).
//
// Uso (no servidor):  npx tsx scripts/backfill-faturas-cartao.ts            → SIMULAÇÃO (não grava)
//                     npx tsx scripts/backfill-faturas-cartao.ts --aplicar  → grava
// ⛔ Saída: só contagens e R$ — nenhum nome de estabelecimento, nenhuma descrição (LGPD).

import { PrismaClient } from '@prisma/client'
import { registrarFatura, projetarParcelas, planoDeParcelas, lerEntradaDoPlano } from '../lib/credit-card-pj/materializar'
import { lerCarteira } from '../lib/credit-card-pj/carteira'
import { diaDoBrasil } from '../lib/margem/dia'

const APLICAR = process.argv.includes('--aplicar')
const db = new PrismaClient({ log: [] })

async function contagens() {
  const [faturas, parcelas, pendentes, soma] = await Promise.all([
    db.faturaCartaoPJ.count(),
    db.parcelaFuturaPJ.count(),
    db.parcelaFuturaPJ.count({ where: { realizadaTxId: null, canceladaEm: null } }),
    db.parcelaFuturaPJ.aggregate({ where: { realizadaTxId: null, canceladaEm: null }, _sum: { valor: true } }),
  ])
  return { faturas, parcelas, pendentes, comprometido: Math.round((soma._sum.valor ?? 0) * 100) / 100 }
}

async function main() {
  const cards = await db.businessCreditCard.findMany({ select: { id: true, companyId: true, closingDay: true, dueDay: true, bankName: true, lastInvoiceMonth: true, lastInvoiceTotalToPay: true, lastInvoiceAvailableLimit: true } })
  // ⛔ REGRA 8b — zero silencioso é "banco errado", não "não tem"
  if (cards.length === 0) throw new Error('⛔ nenhum cartão PJ neste banco — banco errado? abortado sem gravar')
  const transacoes = await db.transaction.count({ where: { businessCreditCardId: { not: null } } })
  console.log(`modo: ${APLICAR ? 'APLICAR (grava)' : 'SIMULAÇÃO (não grava)'} · cartões: ${cards.length} · linhas de cartão: ${transacoes}`)
  const antes = await contagens()
  console.log('ANTES ', JSON.stringify(antes))

  let faturasNovas = 0
  let parcelasNovas = 0
  let realizadas = 0
  let canceladas = 0
  let vivas = 0
  let previsto = 0
  for (const c of cards) {
    const meses = (await db.transaction.findMany({
      where: { businessCreditCardId: c.id, isCardPayment: false, invoiceMonth: { not: null } },
      distinct: ['invoiceMonth'], select: { invoiceMonth: true },
    })).map((m) => m.invoiceMonth!).sort()
    for (const mes of meses) {
      const daUltima = c.lastInvoiceMonth === mes
      if (APLICAR) {
        const r = await registrarFatura(db, {
          companyId: c.companyId, cardId: c.id, mes, closingDay: c.closingDay, dueDay: c.dueDay, origem: 'BACKFILL',
          totalDeclarado: daUltima ? c.lastInvoiceTotalToPay : null, disponivelDeclarado: daUltima ? c.lastInvoiceAvailableLimit : null,
        })
        if (r.criada) faturasNovas++
      } else if (!(await db.faturaCartaoPJ.findUnique({ where: { cardId_mes: { cardId: c.id, mes } }, select: { id: true } }))) {
        faturasNovas++
      }
    }
    const e = await lerEntradaDoPlano(db, c.id)
    const plano = planoDeParcelas(c.id, e.linhas, e.existentes, e.mesMaisRecente)
    vivas += plano.vivas
    previsto += plano.valorPrevisto
    if (APLICAR) {
      const r = await projetarParcelas(db, c.companyId, c.id)
      parcelasNovas += r.criadas; realizadas += r.realizadas; canceladas += r.canceladas
    } else {
      parcelasNovas += plano.novas.length; realizadas += plano.realizar.length; canceladas += plano.cancelar.length
    }
  }
  console.log('PLANO ', JSON.stringify({ faturasNovas, parcelasNovas, realizadas, canceladas, comprasVivas: vivas, comprometido: Math.round(previsto * 100) / 100 }))
  const depois = await contagens()
  console.log('DEPOIS', JSON.stringify(depois))

  // ⭐ o retrato do ciclo, pela MESMA leitura da página (estados por empresa, só contagem)
  const hoje = diaDoBrasil(new Date())
  const estados: Record<string, number> = {}
  for (const companyId of [...new Set(cards.map((c) => c.companyId))]) {
    const cart = await lerCarteira(companyId, hoje, db)
    for (const k of cart.cartoes) for (const f of k.faturas) estados[f.estado] = (estados[f.estado] ?? 0) + 1
  }
  console.log('ESTADOS', JSON.stringify(estados))
}

main()
  .catch((e) => { console.log('FALHOU:', e instanceof Error && e.message.startsWith('⛔') ? e.message : '(mensagem suprimida)'); process.exitCode = 1 })
  .finally(() => db.$disconnect())
