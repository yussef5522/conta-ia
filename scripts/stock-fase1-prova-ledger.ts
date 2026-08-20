// ESTOQUE FASE 1 item 1 — PROVA da CAMADA 1 contra o Postgres REAL (o trigger e o
// CHECK são Postgres-only; o dev sqlite tem o equivalente, mas o "impossível" vale em
// prod). Tenta de propósito o que o banco tem que RECUSAR + o caso de arredondamento
// que tem que ACEITAR. Roda no deploy. Não deixa lixo (usa companyId de teste + limpa).
//
// USO: npx tsx scripts/stock-fase1-prova-ledger.ts

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const CID = '__PROVA_LEDGER__'
const IID = '__PROVA_ITEM__'

async function esperaRecusa(label: string, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn()
    console.log(`  ❌ ${label}: o banco ACEITOU (deveria recusar!)`)
    return false
  } catch {
    console.log(`  ✅ ${label}: recusado pelo banco (como esperado)`)
    return true
  }
}
async function esperaAceita(label: string, fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn()
    console.log(`  ✅ ${label}: aceito (como esperado)`)
    return true
  } catch (e) {
    console.log(`  ❌ ${label}: RECUSADO indevidamente — ${(e as Error).message.slice(0, 80)}`)
    return false
  }
}

async function main() {
  await prisma.stockMovement.deleteMany({ where: { companyId: CID } }).catch(() => {})
  console.log('=== PROVA CAMADA 1 (Postgres) — stock_movement imutável + CHECK ===')

  // 1. base: um movimento válido pra tentar mexer
  const mov = await prisma.stockMovement.create({ data: { companyId: CID, itemId: IID, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 5, custoTotal: 50, origem: 'MANUAL' } })
  const oks: boolean[] = []

  oks.push(await esperaRecusa('UPDATE de movimento', () => prisma.$executeRawUnsafe(`UPDATE stock_movement SET quantidade = 99 WHERE id = '${mov.id}'`)))
  oks.push(await esperaRecusa('DELETE de movimento', () => prisma.$executeRawUnsafe(`DELETE FROM stock_movement WHERE id = '${mov.id}'`)))
  oks.push(await esperaRecusa('INSERT quantidade 0', () => prisma.stockMovement.create({ data: { companyId: CID, itemId: IID, tipo: 'ENTRADA_NF', quantidade: 0, custoUnitario: 5, custoTotal: 0, origem: 'MANUAL' } })))
  oks.push(await esperaRecusa('INSERT custoTotal torto (10×5=50, gravou 99)', () => prisma.stockMovement.create({ data: { companyId: CID, itemId: IID, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 5, custoTotal: 99, origem: 'MANUAL' } })))
  oks.push(await esperaAceita('INSERT arredondamento real 0,333×10,00=3,33', () => prisma.stockMovement.create({ data: { companyId: CID, itemId: IID, tipo: 'ENTRADA_NF', quantidade: 0.333, custoUnitario: 10.0, custoTotal: 3.33, origem: 'MANUAL' } })))

  // limpeza — o estorno NÃO dá (imutável); apaga direto só o de teste desabilitando o trigger
  await prisma.$executeRawUnsafe(`ALTER TABLE stock_movement DISABLE TRIGGER USER`).catch(() => {})
  await prisma.stockMovement.deleteMany({ where: { companyId: CID } }).catch(() => {})
  await prisma.$executeRawUnsafe(`ALTER TABLE stock_movement ENABLE TRIGGER USER`).catch(() => {})

  const todas = oks.every(Boolean)
  console.log(todas ? '\n🟢 CAMADA 1 PROVADA — o ledger é imutável e o CHECK morde.' : '\n🔴 FALHOU — camada 1 não está garantindo. NÃO confiar.')
  await prisma.$disconnect()
  process.exit(todas ? 0 : 1)
}
main().catch((e) => { console.error('erro:', (e as Error).message); process.exit(1) })
