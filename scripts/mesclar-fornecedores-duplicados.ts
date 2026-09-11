// ⭐⭐⭐ MESCLA DOS FORNECEDORES DUPLICADOS (10/09/2026) — PREVIEW por padrão.
//
// **O contexto:** a Caçula tem **11 fornecedores cadastrados 2× com nome IDÊNTICO**, e foi
// isso que matava o reconhecimento na conciliação (`FRIGORIFICO SILVA … - Pagamento` não
// virava card, com 6 contas abertas). A leitura já os trata como um desde 10/09; isto aqui
// resolve no DADO.
//
// ⛔⛔ A RÉGUA DE QUEM SOBREVIVE, e ela é a do estoque (04/09) — *"fusão errada de
// fornecedor é pior que duplicata visível"*:
//   1. **os dois com CNPJ DIFERENTE → NÃO MESCLA.** Nem com nome idêntico: matriz e filial
//      têm o mesmo nome e são empresas distintas. (Na prática o `@@unique([companyId,cnpj])`
//      já impede dois iguais; o par real é "um com CNPJ, outro sem".)
//   2. **sobrevive quem TEM CNPJ** — é o cadastro que a nota fiscal alimenta e o único que
//      a ponte do estoque sabe casar.
//   3. **empate (nenhum tem CNPJ) → sobrevive quem tem MAIS movimento**, e o desempate
//      final é o mais ANTIGO (o que o resto do sistema já vinha apontando).
//
// ⚠️ NADA É APAGADO: o absorvido é **desativado** com o rastro escrito nas `notes` — o
// mesmo desenho da costura da RM2 (04/09). Apagar cadastro de fornecedor perde a história
// de quem já apontou pra ele.
//
// ⛔ `--aplicar` só depois do OK do dono, e com `pg_dump` na mão.

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const CO = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const APLICAR = process.argv.includes('--aplicar')
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const soDigitos = (x: string | null) => (x ?? '').replace(/\D/g, '')
const chave = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

interface Carga {
  transacoes: number
  contasAbertas: number
  valorAberto: number
  conciliadas: number
  regras: number
  recorrentes: number
  pontesDoEstoque: number
}

async function cargaDe(id: string): Promise<Carga> {
  const [transacoes, abertas, conciliadas, regras, recorrentes, pontes] = await Promise.all([
    prisma.transaction.count({ where: { supplierId: id } }),
    prisma.transaction.findMany({
      where: { supplierId: id, lifecycle: { in: ['PAYABLE', 'RECEIVABLE'] }, status: 'PENDING', paymentDate: null },
      select: { amount: true },
    }),
    prisma.transaction.count({ where: { supplierId: id, reconciledWithId: { not: null } } }),
    prisma.aiLearningRule.count({ where: { supplierId: id } }),
    prisma.recurringSchedule.count({ where: { supplierId: id } }),
    /**
     * ⚠️ A AMARRA DA PONTE ESTOQUE→FINANCEIRO (`stock_payable_link.supplierId`).
     *
     * ⛔ Medido antes de escrever: o `StockSupplier` **NÃO** aponta pro cadastro do
     * financeiro — o módulo de estoque é isolado e casa por CNPJ. Quem guarda o ponteiro
     * é a AMARRA, e ela precisa acompanhar o sobrevivente: é o registro que responde
     * *"esta conta veio de qual nota, e de qual fornecedor"*.
     */
    prisma.stockPayableLink.count({ where: { supplierId: id } }),
  ])
  return {
    transacoes, contasAbertas: abertas.length,
    valorAberto: Math.round(abertas.reduce((s, a) => s + Math.abs(a.amount), 0) * 100) / 100,
    conciliadas, regras, recorrentes, pontesDoEstoque: pontes,
  }
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, CO)
  const fs = await prisma.supplier.findMany({
    where: { companyId: CO, isActive: true },
    select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, createdAt: true, notes: true },
    orderBy: { createdAt: 'asc' },
  })

  const grupos = new Map<string, typeof fs>()
  for (const f of fs) {
    const k = chave(f.nomeFantasia ?? f.razaoSocial)
    grupos.set(k, [...(grupos.get(k) ?? []), f])
  }
  const dups = [...grupos.entries()].filter(([, v]) => v.length > 1)

  console.log(`${APLICAR ? '⚠️  APLICANDO' : '👁  PREVIEW (nada será gravado)'} · empresa ${CO}`)
  console.log(`${fs.length} fornecedores ativos · ${dups.length} nomes duplicados\n`)

  let totalMovido = 0
  let recusados = 0

  for (const [nome, v] of dups) {
    const cargas = new Map<string, Carga>()
    for (const f of v) cargas.set(f.id, await cargaDe(f.id))

    const comCnpj = v.filter((f) => soDigitos(f.cnpj).length === 14)
    const cnpjsDistintos = new Set(comCnpj.map((f) => soDigitos(f.cnpj)))

    console.log(`━━ ${nome}`)
    for (const f of v) {
      const c = cargas.get(f.id)!
      console.log(`   [${f.id.slice(-6)}] CNPJ ${f.cnpj ?? '—'.padEnd(18)} · criado ${f.createdAt.toISOString().slice(0, 10)}`)
      console.log(`        ${c.transacoes} tx · ${c.contasAbertas} em aberto (${brl(c.valorAberto)}) · ${c.conciliadas} conciliadas`
        + ` · ${c.regras} regra(s) · ${c.recorrentes} recorrente(s) · ${c.pontesDoEstoque} amarra(s) do estoque`)
    }

    // ⛔ RECUSA 1: dois CNPJs diferentes = empresas diferentes com o mesmo nome
    if (cnpjsDistintos.size > 1) {
      console.log('   ⛔ NÃO MESCLA: CNPJs DIFERENTES — matriz e filial têm o mesmo nome.\n')
      recusados++
      continue
    }

    const sobrevivente = comCnpj.length
      ? comCnpj[0]
      : [...v].sort((a, b) => {
          const ca = cargas.get(a.id)!, cb = cargas.get(b.id)!
          return (cb.transacoes - ca.transacoes) || (a.createdAt.getTime() - b.createdAt.getTime())
        })[0]
    const absorvidos = v.filter((f) => f.id !== sobrevivente.id)
    const porque = comCnpj.length ? 'tem CNPJ' : 'mais movimento'

    console.log(`   ⭐ SOBREVIVE [${sobrevivente.id.slice(-6)}] (${porque})`)
    for (const a of absorvidos) {
      const c = cargas.get(a.id)!
      const leva = [
        c.transacoes ? `${c.transacoes} transação(ões)` : null,
        c.contasAbertas ? `${c.contasAbertas} conta(s) em aberto ${brl(c.valorAberto)}` : null,
        c.regras ? `${c.regras} regra(s) aprendida(s)` : null,
        c.recorrentes ? `${c.recorrentes} recorrente(s)` : null,
        c.pontesDoEstoque ? `${c.pontesDoEstoque} amarra(s) da ponte do estoque` : null,
      ].filter(Boolean)
      console.log(`   → [${a.id.slice(-6)}] carrega junto: ${leva.length ? leva.join(' · ') : 'NADA (cadastro vazio)'}`)
      totalMovido += c.transacoes
    }

    if (APLICAR) {
      for (const a of absorvidos) {
        await prisma.$transaction(async (tx) => {
          await tx.transaction.updateMany({ where: { supplierId: a.id }, data: { supplierId: sobrevivente.id } })
          await tx.aiLearningRule.updateMany({ where: { supplierId: a.id }, data: { supplierId: sobrevivente.id } })
          await tx.recurringSchedule.updateMany({ where: { supplierId: a.id }, data: { supplierId: sobrevivente.id } })
          await tx.stockPayableLink.updateMany({ where: { supplierId: a.id }, data: { supplierId: sobrevivente.id } })
          // ⚠️ DESATIVA, não apaga — e o rastro fica escrito (desenho da costura da RM2)
          await tx.supplier.update({
            where: { id: a.id },
            data: {
              isActive: false,
              notes: `${a.notes ? a.notes + ' · ' : ''}mesclado em ${sobrevivente.id} (nome idêntico) em ${new Date().toISOString().slice(0, 10)}`,
            },
          })
        })
      }
      console.log('   ✓ aplicado')
    }
    console.log()
  }

  console.log(`RESUMO: ${dups.length - recusados} par(es) a mesclar · ${recusados} recusado(s) por CNPJ diferente`)
  console.log(`        ${totalMovido} transação(ões) mudam de cadastro`)
  if (!APLICAR) console.log('\n⚠️  PREVIEW — nada gravado. Pra aplicar: --aplicar (com pg_dump antes)')
}

main().finally(() => prisma.$disconnect())
