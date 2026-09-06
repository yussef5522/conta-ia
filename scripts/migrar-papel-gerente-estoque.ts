// ⭐ O PAPEL CUSTOM "gerente de estoque" VIRA PAPEL DE SISTEMA (06/09/2026).
//
// **O QUE EXISTE HOJE EM PROD:** um papel criado à mão na Caçula, chamado `gerente de estoque`,
// com exatamente `stock.view · stock.operate · stock.manage`. É o papel certo — mas por ser
// custom ele **não nasce em empresa nova** e não tem guard nenhum: nada impede alguém de
// acrescentar `transaction.view` nele um dia, e a fronteira "estoque sem financeiro" cairia
// em silêncio.
//
// ⭐ A MIGRAÇÃO É DE **NOME E GARANTIA**, NÃO DE ACESSO: quem está nele continua exatamente
// onde estava. O papel é renomeado pra `GERENTE_ESTOQUE`, o seed passa a mantê-lo, e o teste
// canônico trava que ele não tem uma única chave de financeiro.
//
// ⚠️ `stock.executar` entra junto (o seed dá `stock.*`): gerente também aperta iniciar/
// finalizar no tablet quando põe a mão na massa. É ampliação DENTRO do módulo dele.
//
//   npx tsx scripts/migrar-papel-gerente-estoque.ts [--apply]

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { DEFAULT_ROLES, expandPermissions } from '@/lib/auth/permissions'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix — REGRA 8
const APLICAR = process.argv.includes('--apply')
const NOME_ANTIGO = 'gerente de estoque'
const NOME_NOVO = 'GERENTE_ESTOQUE'

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)
  console.log(`\n=== PAPEL GERENTE DE ESTOQUE — ${APLICAR ? 'APLICANDO' : 'PREVIEW'} ===\n`)

  const antigo = await prisma.role.findFirst({
    where: { companyId: COMPANY, name: NOME_ANTIGO },
    include: { permissions: { include: { permission: { select: { key: true } } } } },
  })
  if (!antigo) {
    console.log(`  Não existe papel "${NOME_ANTIGO}" nesta empresa — nada a migrar.`)
    console.log('  (o seed cria o GERENTE_ESTOQUE do zero; rode `npx tsx scripts/seed-rbac.ts`)\n')
    return
  }

  const chavesHoje = antigo.permissions.map((p) => p.permission.key).sort()
  const chavesAlvo = expandPermissions([...DEFAULT_ROLES.GERENTE_ESTOQUE.permissions]).sort()
  const quem = await prisma.userCompanyRole.findMany({
    where: { roleId: antigo.id }, include: { user: { select: { email: true, name: true } } },
  })

  console.log(`  papel   "${antigo.name}" (${antigo.id})`)
  console.log(`  hoje    ${chavesHoje.join(', ')}`)
  console.log(`  alvo    ${chavesAlvo.join(', ')}`)
  const ganha = chavesAlvo.filter((k) => !chavesHoje.includes(k))
  const perde = chavesHoje.filter((k) => !chavesAlvo.includes(k))
  console.log(`  ganha   ${ganha.join(', ') || '(nada)'}`)
  console.log(`  perde   ${perde.join(', ') || '(nada)'}`)
  console.log(`\n  quem está neste papel: ${quem.length}`)
  for (const q of quem) console.log(`    ${q.user.email} (${q.user.name})`)

  // ⛔ A LINHA VERMELHA: migrar não pode abrir financeiro pra ninguém. Se o alvo tiver uma
  // chave de financeiro, o script ABORTA — não é papel de estoque, e o dono não pediu isso.
  const FINANCEIRO = /^(transaction|bank_account|dre|report|category)\./
  const vazou = chavesAlvo.filter((k) => FINANCEIRO.test(k))
  if (vazou.length) throw new Error(`⛔ ABORTADO: o alvo tem chave de financeiro (${vazou.join(', ')}).`)

  const colisao = await prisma.role.findFirst({ where: { companyId: COMPANY, name: NOME_NOVO } })
  if (colisao && colisao.id !== antigo.id) {
    console.log(`\n  ⚠️ já existe um "${NOME_NOVO}" nesta empresa (${colisao.id}).`)
    console.log('     Neste caso a migração é MOVER as pessoas pra ele, não renomear — e isso')
    console.log('     é decisão do dono, não do script. Nada foi feito.\n')
    return
  }

  if (!APLICAR) { console.log('\n⛔ NADA FOI GRAVADO. Rode com --apply.\n'); return }

  await prisma.$transaction(async (tx) => {
    await tx.role.update({
      where: { id: antigo.id },
      data: { name: NOME_NOVO, description: DEFAULT_ROLES.GERENTE_ESTOQUE.description },
    })
    // as chaves que faltam entram; nenhuma sai (o dono pediu "sem mudar o acesso dela")
    for (const key of ganha) {
      const perm = await tx.permission.findUnique({ where: { key }, select: { id: true } })
      if (!perm) continue
      await tx.rolePermission.create({ data: { roleId: antigo.id, permissionId: perm.id } })
    }
  })

  const depois = await prisma.role.findUnique({
    where: { id: antigo.id },
    include: { permissions: { include: { permission: { select: { key: true } } } } },
  })
  console.log(`\n✓ papel agora "${depois!.name}" com ${depois!.permissions.length} chaves`)
  console.log(`✓ ${depois!.permissions.map((p) => p.permission.key).sort().join(', ')}`)
  console.log(`✓ ${quem.length} pessoa(s) seguem no papel, sem mudança de vínculo\n`)
}

main().finally(() => prisma.$disconnect())
