// Smoke autenticado — prova que withdrawal-context devolve lucroContext em prod.
import { PrismaClient } from '@prisma/client'
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())
import { signToken } from '../lib/auth'
const prisma = new PrismaClient()
const CO = 'cmq17yapb00gnrndlh33sctbo'
const USER = 'cmp9e4kgz00007wajsn05e9mg'
async function main() {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: USER }, select: { id: true, email: true, name: true } })
  const token = await signToken({ sub: u.id, email: u.email, name: u.name, role: (u as any).role ?? 'ADMIN' })
  const r = await fetch(`http://localhost:3001/api/empresas/${CO}/withdrawal-context`, {
    headers: { cookie: `auth_token=${token}; current_empresa_id=${CO}` },
  })
  console.log('HTTP', r.status)
  const d = await r.json()
  console.log('lucroContext:', JSON.stringify(d.lucroContext, null, 2))
  console.log('socios:', d.socios?.length, '· profiles:', d.profiles?.length)
  const rr = await fetch(`http://localhost:3001/api/empresas/${CO}/retiradas-orfas`, {
    headers: { cookie: `auth_token=${token}; current_empresa_id=${CO}` },
  })
  console.log('retiradas-orfas count:', (await rr.json()).count)
  process.exit(0)
}
main().finally(() => prisma.$disconnect())
