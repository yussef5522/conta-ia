// ⭐ REMOVER UMA CONTA DE LOGIN criada por engano (06/09/2026).
//
// **O CASO:** o dono criou `carlise@gmail.com` com papel de executor **porque não achava a
// tela de cadastro** (o bug do link escondido). Com a Equipe no ar, a Carlise entra pelo
// caminho certo — nome + PIN, sem conta. Esta conta é resíduo do contorno.
//
// ⛔⛔ E A PERGUNTA DO DONO É A CERTA — *"remover não apaga nada de produção?"*. O script
// **re-mede na hora de aplicar** e ABORTA se achar qualquer coisa pendurada. Não basta eu ter
// medido antes: entre a medição e o `--apply` alguém pode ter trabalhado.
//
// ⭐ O RASTRO DE AUDITORIA FICA: `AuditLog.userId` é `SetNull` on delete e a linha guarda
// snapshot de nome e e-mail. Apagar a conta não apaga a história dela.
//
//   npx tsx scripts/remover-conta-de-login.ts --email=<conta> [--apply]

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix — REGRA 8
const APLICAR = process.argv.includes('--apply')
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=') ?? ''

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)
  const email = arg('email').trim().toLowerCase()
  if (!email) throw new Error('Informe --email=<conta a remover>')

  const u = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, createdAt: true } })
  if (!u) { console.log(`\n  Conta ${email} não existe — nada a fazer.\n`); return }

  console.log(`\n=== REMOVER CONTA DE LOGIN — ${APLICAR ? 'APLICANDO' : 'PREVIEW'} ===\n`)
  console.log(`  ${u.email} · "${u.name}" · criada ${u.createdAt.toISOString().slice(0, 16)}`)

  const papeis = await prisma.userCompanyRole.findMany({
    where: { userId: u.id }, include: { role: { select: { name: true } }, company: { select: { name: true } } },
  })
  for (const p of papeis) console.log(`  papel ${p.role.name} em "${p.company.name}"`)

  // ⛔⛔ AS TRAVAS — cada uma é uma razão pra NÃO apagar, e ela ABORTA em vez de perguntar.
  const colab = await prisma.stockColaborador.findFirst({
    where: { companyId: COMPANY, nome: { equals: u.name } }, select: { id: true, nome: true },
  })
  const trabalho = colab
    ? await prisma.stockOrdemEtapa.count({ where: { companyId: COMPANY, OR: [{ executorId: colab.id }, { colaboradorId: colab.id }] } })
    : 0
  const conclusoes = colab ? await prisma.stockProducaoConclusao.count({ where: { companyId: COMPANY, colaboradorId: colab.id } }) : 0

  const criou = {
    movimentos: await prisma.stockMovement.count({ where: { criadoPorId: u.id } }),
    itens: await prisma.stockItem.count({ where: { criadoPorId: u.id } }),
    ordens: await prisma.stockProductionOrder.count({ where: { criadoPorId: u.id } }),
    conclusoes: await prisma.stockProducaoConclusao.count({ where: { criadoPorId: u.id } }),
    pins: await prisma.stockColaboradorPin.count({ where: { criadoPorId: u.id } }),
    convites: await prisma.companyInvite.count({ where: { invitedById: u.id } }),
    importsOfx: await prisma.ofxImport.count({ where: { userId: u.id } }).catch(() => 0),
  }
  console.log(`\n  colaborador de produção com este nome: ${colab ? colab.id : 'NÃO existe'}`)
  console.log(`  etapas de produção · conclusões: ${trabalho} · ${conclusoes}`)
  console.log(`  criou: ${Object.entries(criou).map(([k, v]) => `${k}=${v}`).join(' · ')}`)

  const impedimentos: string[] = []
  if (trabalho > 0) impedimentos.push(`${trabalho} etapa(s) de produção`)
  if (conclusoes > 0) impedimentos.push(`${conclusoes} conclusão(ões)`)
  for (const [k, v] of Object.entries(criou)) if (v > 0) impedimentos.push(`${v} ${k}`)
  if (impedimentos.length) {
    throw new Error(`⛔ ABORTADO: esta conta tem trabalho pendurado (${impedimentos.join(', ')}). Remover apagaria rastro.`)
  }

  // ⭐ o rastro de auditoria FICA (SetNull + snapshot de nome/e-mail na própria linha)
  const logs = await prisma.auditLog.count({ where: { userId: u.id } })
  console.log(`\n  ⭐ ${logs} registro(s) de auditoria — ficam, com o nome e o e-mail guardados na linha`)
  console.log('  ⛔ nada de produção pendurado: a remoção é só do acesso.')

  if (!APLICAR) { console.log('\n⛔ NADA FOI REMOVIDO. Rode com --apply.\n'); return }

  await prisma.$transaction(async (tx) => {
    // ⚠️ o vínculo sai explicitamente (não confio em cascade pra decidir o que apagar)
    await tx.userCompanyRole.deleteMany({ where: { userId: u.id } })
    await tx.userCompany.deleteMany({ where: { userId: u.id } })
    await tx.user.delete({ where: { id: u.id } })
  })

  const sobrou = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  const logsDepois = await prisma.auditLog.count({ where: { userEmail: email } })
  console.log(`\n✓ conta removida (existe agora: ${sobrou ? 'SIM ⛔' : 'não'})`)
  console.log(`✓ auditoria preservada: ${logsDepois} registro(s) com o e-mail dela\n`)
}

main().finally(() => prisma.$disconnect())
