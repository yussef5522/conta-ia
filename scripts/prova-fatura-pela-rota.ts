// ⭐ PROVA PELA ROTA REAL — upload do PDF, sessão assinada, sem digitar total (09/09/2026).
//
// **O dono:** *"Red-then-green: este PDF pela ROTA real achando o 4.491,18 sem eu digitar
// nada."* É o único caminho que prova o conserto: o `previewFaturaPF` recebe o texto já
// extraído, e o bug morava justamente na EXTRAÇÃO que a rota faz (poppler do servidor).
//
// ⛔ READ-ONLY: só o `preview`, nunca o `confirmar`. Importar é gesto do dono.

import { readFileSync } from 'node:fs'
import { prisma } from '@/lib/db'
import { signToken } from '../lib/auth'

const BASE = 'http://127.0.0.1:3001'
const PDF = process.argv[2] ?? '/tmp/f.pdf'
const EMAIL = 'yussefmusa5522@gmail.com'

async function main() {
  const u = await prisma.user.findFirstOrThrow({ where: { email: EMAIL } })
  const perfil = await prisma.userPersonalProfile.findFirstOrThrow({
    where: { userId: u.id, role: 'OWNER' },
    select: { profileId: true, profile: { select: { name: true } } },
  })
  const cartoes = await prisma.creditCard.findMany({
    where: { profileId: perfil.profileId },
    select: { id: true, name: true, lastDigits: true, bankName: true },
  })
  console.log(`perfil: ${perfil.profile.name} · cartões: ${cartoes.map((c) => `${c.name}(${c.lastDigits})`).join(', ')}`)
  // ⚠️ resolve por ID, e o id vem do banco — nunca por nome (REGRA 8)
  const cartao = cartoes.find((c) => c.lastDigits === '2971') ?? cartoes[0]
  if (!cartao) { console.log('⛔ nenhum cartão PF cadastrado'); return }
  console.log(`usando o cartão ${cartao.name} (${cartao.lastDigits}) · id ${cartao.id}`)

  const token = await signToken({
    sub: u.id, email: u.email, name: u.name,
    role: (u as never as { role: string }).role ?? 'ADMIN',
  })
  const fd = new FormData()
  fd.append('file', new Blob([readFileSync(PDF)], { type: 'application/pdf' }), 'fatura.pdf')
  fd.append('modo', 'preview')

  const r = await fetch(
    `${BASE}/api/perfis/${perfil.profileId}/cartoes/${cartao.id}/importar-fatura`,
    { method: 'POST', headers: { cookie: `auth_token=${token}` }, body: fd },
  )
  console.log(`\nPOST /importar-fatura (modo=preview, SEM total digitado) → ${r.status}`)
  const j = await r.json()
  const p = j.preview
  if (!p) { console.log(JSON.stringify(j).slice(0, 400)); return }
  console.log(`   banco: ${p.banco}`)
  console.log(`   ok: ${p.ok} · erro: ${p.erro ?? '—'} · causa: ${p.causa ?? '—'}`)
  console.log(`   origem do total: ${p.origemTotal ?? '—'}`)
  console.log(`   ⭐ totalDeclarado: ${p.totalDeclarado}`)
  console.log(`   lançamentos: ${p.linhas?.length} · despesas ${p.conferencia?.despesasCalculado} · declarado ${p.conferencia?.despesasDeclarado}`)
  console.log(`   saldo calculado ${p.conferencia?.saldoCalculado} × declarado ${p.conferencia?.saldoDeclarado} · fecha ${p.conferencia?.fecha}`)
  console.log(`   portadores: ${JSON.stringify(p.portadores)} · vencimento ${p.vencimento} · ref ${p.referencia}`)
  console.log(`   próximas faturas (declaradas, fora do import): ${p.proximasFaturas?.total}`)
  console.log(`   novas ${p.novas} · já existem ${p.jaExistem}`)
}

main().finally(() => prisma.$disconnect())
