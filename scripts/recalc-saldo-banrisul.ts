import { PrismaClient } from '@prisma/client'
import { recalcularSaldoConta } from '../lib/balance/recalcular'

const BANRISUL = 'cmq17z90v00qxrndl02kfn4iz'
const prisma = new PrismaClient()

async function main() {
  const r = await recalcularSaldoConta(prisma, BANRISUL)
  console.log(JSON.stringify(r, null, 2))
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
