// Smoke: POST autenticado do OFX real no preview → prova que as 4 futuras saem
// da lista oferecida (vão pra `futuras`), não como importáveis.
import { PrismaClient } from '@prisma/client'
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { signToken } from '../lib/auth'
import { readFileSync } from 'fs'

const prisma = new PrismaClient()
const CONTA = 'cmq17z90v00qxrndl02kfn4iz'
const CO = 'cmq17yapb00gnrndlh33sctbo'
const USER = 'cmp9e4kgz00007wajsn05e9mg'

async function main() {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: USER }, select: { id: true, email: true, name: true } })
  const token = await signToken({ sub: u.id, email: u.email, name: u.name, role: (u as any).role ?? 'ADMIN' })
  const ofx = readFileSync('__tests__/fixtures/Extrato_20260809.ofx')
  const fd = new FormData()
  fd.append('file', new Blob([ofx]), 'Extrato_20260809.ofx')
  const r = await fetch(`http://localhost:3001/api/contas-bancarias/${CONTA}/importar-ofx?preview=true`, {
    method: 'POST',
    headers: { cookie: `auth_token=${token}; current_empresa_id=${CO}` },
    body: fd,
  })
  console.log('HTTP', r.status)
  const d: any = await r.json()
  const futuras = d.futuras ?? []
  console.log('futuras (esperado 4):', futuras.length)
  for (const f of futuras) console.log('  ', f.date, f.memo, f.signedAmount)
  const check = d.ledgerBalCheck ?? null
  if (check) {
    console.log('ledger bate:', check.bate, '· diff:', check.diff)
    console.log('maisProvavel:', check.hipoteses?.find((h: any) => h.maisProvavel)?.tipo)
  }
  console.log('novasGenuinas oferecidas:', d.classificacao?.contagens?.novasGenuinas ?? d.novas ?? '(legacy/vazio)')
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
