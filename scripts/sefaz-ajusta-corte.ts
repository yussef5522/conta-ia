// ESTOQUE FASE 0 — ajusta a DATA DE CORTE e reclassifica as notas (HISTORICA vs fila).
// USO:  npx tsx scripts/sefaz-ajusta-corte.ts <companyId> <YYYY-MM-DD>

import { PrismaClient } from '@prisma/client'
import { setDataCorte } from '../lib/stock/sefaz/corte'

const prisma = new PrismaClient()
const companyId = process.argv[2]
const corteArg = process.argv[3]

async function main() {
  if (!companyId || !corteArg) {
    console.error('uso: npx tsx scripts/sefaz-ajusta-corte.ts <companyId> <YYYY-MM-DD>')
    process.exit(1)
  }
  const corte = new Date(`${corteArg}T00:00:00`)
  const r = await setDataCorte(companyId, corte, prisma)
  console.log(`DATA DE CORTE = ${corteArg} (nota emitida antes = HISTÓRICA)`)
  console.log(`total ${r.total} · históricas ${r.historicas} · na fila (AGUARDANDO_MERCADORIA) ${r.novas}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error('erro:', (e as Error).message); process.exit(1) })
