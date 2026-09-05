// ⭐⭐ PREENCHER O CNPJ DE UM FORNECEDOR NOS DOIS LADOS (04/09/2026).
//
// Pedido do dono, e o motivo é o que importa: *"sem CNPJ essa dúvida volta a cada duplicata."*
// Está certo — sem CNPJ a única régua de unificação é o NOME, e nome é o que diverge
// ("rm2" × "RM2 COMERCIO DE MATERIAIS PARA INFORMATICA LTDA"). **Com CNPJ, os dois lados se
// reconhecem sozinhos** e o seletor mostra uma linha só.
//
// ⛔ SEM `--apply` NÃO GRAVA. Resolve por ID (REGRA 8) e prova o banco (REGRA 8b).
//
//   npx tsx scripts/preencher-cnpj-fornecedor.ts --cnpj=00.000.000/0001-00 \
//     --fin=cmq8g05kk00bnuuadk1wmu8q0 --stock=cmtncqmka021l109f83l152qj [--apply]

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { isValidCnpj } from '@/lib/validation/cpf-cnpj'
import { exibirCNPJ } from '@/lib/format/cnpj'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix
const APLICAR = process.argv.includes('--apply')
const arg = (nome: string) => process.argv.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1] ?? ''

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  const cnpj = arg('cnpj').replace(/\D/g, '')
  const finId = arg('fin')
  const stockId = arg('stock')

  // ⛔ CNPJ INVÁLIDO NÃO ENTRA: número errado aqui é pior que campo vazio — ele PARECE
  // prova e passa a unir fornecedores que não são o mesmo (a fusão errada que o dono proibiu).
  if (!isValidCnpj(cnpj)) throw new Error(`CNPJ inválido: "${arg('cnpj')}" — confira o dígito verificador.`)
  if (!finId && !stockId) throw new Error('Informe --fin=<id do financeiro> e/ou --stock=<id do estoque>.')

  const [fin, stock, colideFin, colideStock] = await Promise.all([
    finId ? prisma.supplier.findFirst({ where: { id: finId, companyId: COMPANY }, select: { id: true, razaoSocial: true, cnpj: true } }) : null,
    stockId ? prisma.stockSupplier.findFirst({ where: { id: stockId, companyId: COMPANY }, select: { id: true, razaoSocial: true, cnpj: true } }) : null,
    // ⚠️ as duas tabelas têm @@unique([companyId, cnpj]): gravar em cima de outro dono do
    // mesmo CNPJ estouraria — melhor dizer QUEM é antes de tentar.
    prisma.supplier.findFirst({ where: { companyId: COMPANY, cnpj }, select: { id: true, razaoSocial: true } }),
    prisma.stockSupplier.findFirst({ where: { companyId: COMPANY, cnpj }, select: { id: true, razaoSocial: true } }),
  ])

  if (finId && !fin) throw new Error(`Fornecedor ${finId} não existe no financeiro desta empresa.`)
  if (stockId && !stock) throw new Error(`Fornecedor ${stockId} não existe no estoque desta empresa.`)
  if (colideFin && colideFin.id !== finId) throw new Error(`No financeiro o CNPJ ${exibirCNPJ(cnpj)} já é de "${colideFin.razaoSocial}" (${colideFin.id}). Se for a mesma empresa, o caso é de COSTURA, não de preenchimento.`)
  if (colideStock && colideStock.id !== stockId) throw new Error(`No estoque o CNPJ ${exibirCNPJ(cnpj)} já é de "${colideStock.razaoSocial}" (${colideStock.id}). Idem: costura, não preenchimento.`)

  console.log(`\n=== CNPJ ${exibirCNPJ(cnpj)} — ${APLICAR ? 'APLICANDO' : 'PREVIEW (nada será gravado)'} ===`)
  if (fin) console.log(`  [financeiro] ${fin.razaoSocial}: ${fin.cnpj ?? '— (vazio)'} → ${exibirCNPJ(cnpj)}`)
  if (stock) console.log(`  [estoque]    ${stock.razaoSocial}: ${stock.cnpj ?? '— (vazio)'} → ${exibirCNPJ(cnpj)}`)
  // ⚠️ sobrescrever um CNPJ que JÁ existe é outra conversa (pode ser erro de digitação
  // antigo, pode ser empresa trocada) — avisa alto em vez de fazer calado.
  for (const [lado, atual] of [['financeiro', fin?.cnpj], ['estoque', stock?.cnpj]] as const) {
    if (atual && atual !== cnpj) console.log(`  ⚠️ ATENÇÃO: o ${lado} JÁ tinha ${exibirCNPJ(atual)} — isto SOBRESCREVE.`)
  }

  if (!APLICAR) {
    console.log('\n⛔ NADA FOI GRAVADO. Rode com --apply pra executar.\n')
    return
  }

  await prisma.$transaction(async (tx) => {
    if (fin) await tx.supplier.update({ where: { id: fin.id }, data: { cnpj } })
    if (stock) await tx.stockSupplier.update({ where: { id: stock.id }, data: { cnpj } })
  })

  const { listarFornecedoresUnificados } = await import('@/lib/stock/fornecedores-unificados')
  const lista = await listarFornecedoresUnificados(COMPANY, prisma)
  const agora = lista.filter((f) => f.cnpj?.replace(/\D/g, '') === cnpj)
  console.log(`\n✓ gravado. No seletor este CNPJ aparece em ${agora.length} linha(s):`)
  for (const f of agora) console.log(`  · ${f.razaoSocial} [${f.origem}]`)
  console.log(agora.length === 1 ? '  ⭐ uma linha só — os dois lados se reconheceram pelo CNPJ.\n' : '')
}

main().finally(() => prisma.$disconnect())
