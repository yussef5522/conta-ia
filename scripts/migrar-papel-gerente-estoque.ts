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

  // ⭐ O SEED cria os papéis de sistema como GLOBAIS (`companyId: null`). Então, depois de
  // rodar o seed, a migração deixa de ser "renomear" e passa a ser **MOVER as pessoas** pro
  // papel global e apagar o custom. Os dois caminhos existem porque os dois estados existem:
  // empresa que ainda não rodou o seed (renomeia) e empresa que já rodou (move).
  const doSistema = await prisma.role.findFirst({
    where: { name: NOME_NOVO, OR: [{ companyId: COMPANY }, { companyId: null }] },
    include: { permissions: { include: { permission: { select: { key: true } } } } },
  })

  if (doSistema && doSistema.id !== antigo.id) {
    const chavesSistema = doSistema.permissions.map((p) => p.permission.key).sort()
    console.log(`\n  ⭐ o papel de SISTEMA já existe (${doSistema.id}, ${doSistema.companyId ? 'da empresa' : 'global'})`)
    console.log(`     chaves: ${chavesSistema.join(', ')}`)
    // ⛔ mover não pode TIRAR acesso de ninguém: se o papel de sistema não cobrir tudo que o
    // custom cobria, a pessoa perderia poder no meio de um sprint e ninguém veria.
    const perderia = chavesHoje.filter((k) => !chavesSistema.includes(k))
    if (perderia.length) throw new Error(`⛔ ABORTADO: mover tiraria ${perderia.join(', ')} de quem está no papel.`)
    console.log(`\n  PLANO: mover ${quem.length} pessoa(s) pro papel de sistema e apagar o custom`)
    console.log(`     ganha no caminho: ${chavesSistema.filter((k) => !chavesHoje.includes(k)).join(', ') || '(nada)'}`)

    if (!APLICAR) { console.log('\n⛔ NADA FOI GRAVADO. Rode com --apply.\n'); return }

    await prisma.$transaction(async (tx) => {
      await tx.userCompanyRole.updateMany({ where: { roleId: antigo.id }, data: { roleId: doSistema.id } })
      // ⚠️ convite pendente apontando pro papel velho iria pro lugar errado depois de apagado
      await tx.companyInvite.updateMany({ where: { roleId: antigo.id }, data: { roleId: doSistema.id } })
      await tx.rolePermission.deleteMany({ where: { roleId: antigo.id } })
      await tx.role.delete({ where: { id: antigo.id } })
    })
    const depois = await prisma.userCompanyRole.findMany({
      where: { roleId: doSistema.id, companyId: COMPANY },
      include: { user: { select: { email: true } }, role: { select: { name: true } } },
    })
    console.log(`\n✓ ${depois.length} pessoa(s) agora em "${NOME_NOVO}":`)
    for (const d of depois) console.log(`    ${d.user.email}`)
    console.log(`✓ papel custom "${NOME_ANTIGO}" removido\n`)
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
