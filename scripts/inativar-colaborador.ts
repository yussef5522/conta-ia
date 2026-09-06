// ⭐ INATIVAR UM COLABORADOR DE PRODUÇÃO (06/09/2026).
//
// **O CASO:** o "Cristian" colaborador (cadastrado em 21/08, sem PIN) existe porque naquele
// dia o cadastro de gente era uma lista solta de nomes. Hoje o Cristian **só gerencia** — ele
// tem login de `GERENTE_ESTOQUE` e não põe a mão na produção. Um colaborador sem PIN e sem
// dono aparece pra sempre na Equipe como pendência ("sem PIN — não consegue entrar"), e
// pendência falsa é como o dono aprende a ignorar a lista.
//
// ⛔⛔ INATIVAR, NUNCA APAGAR: o colaborador é o que ASSINA etapa de produção. Apagar deixaria
// etapas antigas apontando pro nada — e é por isso que o guard abaixo aborta se houver
// qualquer trabalho pendurado. Inativar é reversível e mantém o rastro; é a mesma disciplina
// do fornecedor duplicado (desativa com a nota, não some).
//
//   npx tsx scripts/inativar-colaborador.ts --nome="Cristian" [--apply]

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { inativarColaborador, trabalhoPendurado, motivoParaNaoInativar } from '@/lib/equipe/inativar-colaborador'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix — REGRA 8
const APLICAR = process.argv.includes('--apply')
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=') ?? ''

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)
  const nome = arg('nome').trim()
  const id = arg('id').trim()
  if (!nome && !id) throw new Error('Informe --nome="<nome>" ou --id=<id>')

  const candidatos = await prisma.stockColaborador.findMany({
    where: { companyId: COMPANY, ...(id ? { id } : { nome }) },
    select: { id: true, nome: true, ativo: true, criadoEm: true },
  })
  if (!candidatos.length) { console.log(`\n  Nenhum colaborador "${nome || id}" nesta empresa.\n`); return }
  // ⛔ dois com o mesmo nome é ambiguidade, e palpite aqui inativa a pessoa errada
  if (candidatos.length > 1) {
    console.log(`\n  ⛔ ${candidatos.length} colaboradores com esse nome — rode com --id=<id>:`)
    for (const c of candidatos) console.log(`     ${c.id} · ativo=${c.ativo} · criado ${c.criadoEm.toISOString().slice(0, 10)}`)
    return
  }
  const c = candidatos[0]

  console.log(`\n=== INATIVAR COLABORADOR — ${APLICAR ? 'APLICANDO' : 'PREVIEW'} ===\n`)
  console.log(`  "${c.nome}" · ${c.id} · ativo=${c.ativo} · criado ${c.criadoEm.toISOString().slice(0, 16)}`)
  if (!c.ativo) { console.log('\n  Já está inativo — nada a fazer.\n'); return }

  // ⭐ O GUARD É O DA LIB — o mesmo que a tela usa. Repetir aqui criaria duas réguas, e a
  // que diverge é sempre a que deixa passar (REGRA 4).
  const t = await trabalhoPendurado(COMPANY, c.id, prisma)
  console.log(`  etapas em andamento : ${t.etapasEmAndamento}`)
  console.log(`  tarefas designadas  : ${t.designadasAbertas}`)
  console.log(`  conclusões dele     : ${t.conclusoes}`)
  console.log(`  etapas já feitas    : ${t.etapasFeitas}  (não impedem — o rastro fica)`)
  const motivo = motivoParaNaoInativar(t, c.nome)
  if (motivo) throw new Error(`⛔ ABORTADO: ${motivo}`)
  console.log('\n  ⭐ nada pendurado — inativar é seguro e reversível.')

  if (!APLICAR) { console.log('\n⛔ NADA FOI GRAVADO. Rode com --apply.\n'); return }

  await inativarColaborador(COMPANY, c.id, prisma)

  const depois = await prisma.stockColaborador.findUnique({ where: { id: c.id }, select: { ativo: true } })
  console.log(`\n✓ "${c.nome}" inativo (ativo=${depois!.ativo})`)
  console.log('✓ o registro FICA: reativar é um clique na tela de Equipe, e o histórico dele não some.\n')
}

main().finally(() => prisma.$disconnect())
