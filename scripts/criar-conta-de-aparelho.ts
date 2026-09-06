// ⭐⭐ CONTA DE APARELHO — a regra da casa que nasceu do incidente de 06/09.
//
// > **"Aparelho compartilhado tem conta de APARELHO, nunca sessão de pessoa."** (dono, 06/09)
//
// ⛔ POR QUE ISTO EXISTE: o tablet da cozinha precisa de uma sessão pra a janela `/cozinha`
// abrir — o PIN identifica QUEM apertou o botão, mas quem diz QUAL EMPRESA é o aparelho. Se
// essa sessão for a **do dono**, a cozinheira aperta INICIAR normalmente… e basta digitar
// outro endereço pra estar no financeiro. O PIN não protege nada disso.
//
// ⚠️ E não é hipótese: no mesmo dia, o link de um convite aberto num navegador logado caía no
// dashboard daquela sessão. Aparelho compartilhado com sessão de gente é a porta.
//
// ⭐ A CONTA DO APARELHO TEM `stock.executar` E **MAIS NADA** — a chave mais fraca do sistema.
// Mesmo que alguém navegue pra qualquer lugar, não há o que ver.
//
//   npx tsx scripts/criar-conta-de-aparelho.ts --email=cozinha@cacula --senha=<forte> [--apply]

import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix — REGRA 8
const APLICAR = process.argv.includes('--apply')
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=') ?? ''
const PAPEL = 'EXECUTOR_PRODUCAO'

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)
  const email = arg('email').trim().toLowerCase()
  const senha = arg('senha')
  if (!email) throw new Error('Informe --email=<conta do aparelho>')
  // ⚠️ senha de aparelho fica ANOTADA num tablet de cozinha, lugar exposto — então ela tem
  // que ser longa o bastante pra não ser adivinhada por quem passa perto.
  if (!APLICAR && !senha) console.log('⚠️  (preview sem --senha; pra aplicar informe uma senha de 16+ caracteres)')
  if (APLICAR && senha.length < 16) throw new Error('⛔ A senha do aparelho precisa de 16+ caracteres.')

  const papel = await prisma.role.findFirst({
    where: { name: PAPEL, OR: [{ companyId: COMPANY }, { companyId: null }] },
    include: { permissions: { include: { permission: { select: { key: true } } } } },
  })
  if (!papel) throw new Error(`⛔ Papel ${PAPEL} não existe. Rode o seed do RBAC antes.`)
  const chaves = papel.permissions.map((p) => p.permission.key).sort()

  console.log(`\n=== CONTA DE APARELHO — ${APLICAR ? 'APLICANDO' : 'PREVIEW'} ===\n`)
  console.log(`  e-mail  ${email}`)
  console.log(`  papel   ${PAPEL} · ${chaves.join(', ')}`)

  // ⛔ A LINHA VERMELHA: uma conta que fica logada PRA SEMPRE num aparelho de área comum não
  // pode ter nada além da janela de tarefas. Qualquer chave a mais e o script aborta.
  if (chaves.length !== 1 || chaves[0] !== 'stock.executar') {
    throw new Error(`⛔ ABORTADO: ${PAPEL} tem ${chaves.length} chave(s) (${chaves.join(', ')}). Conta de aparelho só pode ter stock.executar.`)
  }

  const existente = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } })
  if (existente) {
    const vinculo = await prisma.userCompanyRole.findFirst({
      where: { userId: existente.id, companyId: COMPANY }, include: { role: { select: { name: true } } },
    })
    console.log(`\n  ⚠️ já existe conta com esse e-mail (${existente.id})`)
    console.log(`     papel nesta empresa: ${vinculo?.role.name ?? '(nenhum)'}`)
    console.log('     Nada foi feito — trocar papel de conta existente é decisão do dono.\n')
    return
  }

  console.log('\n  vai criar: conta nova + vínculo com a empresa nesse papel')
  console.log('  ⚠️ ela NÃO é uma pessoa: não recebe convite, não aparece como colaborador,')
  console.log('     e não tem nada além da janela /cozinha.')

  if (!APLICAR) { console.log('\n⛔ NADA FOI GRAVADO. Rode com --apply e --senha.\n'); return }

  const { userId } = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email,
        name: 'Tablet da cozinha',
        password: await bcrypt.hash(senha, 12),
      },
      select: { id: true },
    })
    await tx.userCompanyRole.create({ data: { userId: u.id, companyId: COMPANY, roleId: papel.id } })
    return { userId: u.id }
  })

  // ⭐ confere o que ficou: a conta tem EXATAMENTE a chave da janela, e nada mais
  const conferido = await prisma.userCompanyRole.findFirst({
    where: { userId, companyId: COMPANY },
    include: { role: { include: { permissions: { include: { permission: { select: { key: true } } } } } } },
  })
  console.log(`\n✓ conta ${email} criada (${userId})`)
  console.log(`✓ papel ${conferido!.role.name} · chaves: ${conferido!.role.permissions.map((p) => p.permission.key).join(', ')}`)
  console.log('\n  Deixe o tablet logado nesta conta PRA SEMPRE, e nunca logue como dono nele.\n')
}

main().finally(() => prisma.$disconnect())
