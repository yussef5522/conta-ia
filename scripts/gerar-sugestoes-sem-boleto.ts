// Gera as sugestões "A DEFINIR" das notas que foram confirmadas SEM boleto (03/09/2026).
//
// ⛔ O BURACO: `confirmarConferencia` criava uma sugestão por DUPLICATA — e nota paga em
// pix/dinheiro combinado não tem duplicata. Resultado medido em prod: **21 notas ·
// R$ 8.588,75** passaram pelo estoque e nunca chegaram ao Contas a Pagar. O dinheiro sai e
// não aparece no fluxo de caixa. A fonte já foi corrigida; aqui é o passado.
//
// ⭐ POR QUE VALE A PENA OLHAR UMA A UMA (palavras do dono): *"se já paguei, defino a data e
// fecho o rastro; se alguma NÃO foi paga, é fornecedor esperando sem eu saber — e é esse o
// caso que este sprint existe pra pegar."*
//
// ⚠️ NÃO INVENTA DATA: as sugestões nascem com `dVenc = null` e o F5 as cobra até o dono
// definir. E NÃO cria conta no financeiro — isso só acontece quando ele definir a data.
//
// USO:  npx tsx scripts/gerar-sugestoes-sem-boleto.ts [--aplicar]

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'

const COMPANY = 'cmq17yapb00gnrndlh33sctbo' // Cacula Mix
const APLICAR = process.argv.includes('--aplicar')
const round2 = (n: number) => Math.round((n + 1e-9) * 100) / 100

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY)

  const notas = await prisma.stockNfe.findMany({
    where: { companyId: COMPANY, status: 'CONFIRMADA' },
    select: { id: true, chave: true, vNF: true, dataEmissao: true },
  })
  const [dups, sugestoes, emits] = await Promise.all([
    prisma.stockNfeDup.findMany({ where: { companyId: COMPANY }, select: { nfeId: true } }),
    prisma.stockPayableSuggestion.findMany({ where: { companyId: COMPANY }, select: { nfeId: true } }),
    prisma.stockNfeEmit.findMany({ where: { companyId: COMPANY }, select: { nfeId: true, xNome: true, cnpj: true } }),
  ])
  const comDup = new Set(dups.map((d) => d.nfeId))
  const comSugestao = new Set(sugestoes.map((s) => s.nfeId))
  const emit = new Map(emits.map((e) => [e.nfeId, e]))

  // ⛔ só as que NÃO têm duplicata E NÃO têm sugestão: rodar de novo não pode duplicar
  const alvo = notas.filter((n) => !comDup.has(n.id) && !comSugestao.has(n.id))

  console.log('\n=== NOTAS CONFIRMADAS SEM BOLETO E SEM SUGESTÃO ===')
  for (const n of alvo) {
    const e = emit.get(n.id)
    console.log(`  ${n.dataEmissao?.toISOString().slice(0, 10) ?? '—'} · R$ ${round2(n.vNF ?? 0).toFixed(2).padStart(9)} · ${e?.xNome ?? '(fornecedor sem nome no XML)'}`)
  }
  const total = round2(alvo.reduce((s, n) => s + (n.vNF ?? 0), 0))
  console.log(`\nnotas: ${alvo.length} · total R$ ${total.toFixed(2)}`)
  console.log('cada uma vira uma parcela "A DEFINIR" (sem data, sem conta no financeiro) e o F5 cobra até você definir.')
  if (!alvo.length || !APLICAR) { console.log(APLICAR ? '' : '\n(sem --aplicar: NADA foi tocado)'); return }

  const antesContas = await prisma.transaction.count({ where: { bankAccount: { companyId: COMPANY } } })
  const criadas = await prisma.$transaction(async (tx) => {
    let n = 0
    for (const nota of alvo) {
      const e = emit.get(nota.id)
      await tx.stockPayableSuggestion.create({
        data: {
          companyId: COMPANY, nfeId: nota.id, chave: nota.chave,
          supplierCnpj: e?.cnpj ?? null, supplierNome: e?.xNome ?? null,
          nDup: null, dVenc: null, valor: round2(nota.vNF ?? 0),
        },
      })
      n++
    }
    return n
  })
  const depoisContas = await prisma.transaction.count({ where: { bankAccount: { companyId: COMPANY } } })

  console.log(`\n=== FEITO === ${criadas} sugestões "A DEFINIR" criadas`)
  // ⛔ a decisão (a) do dono: NADA nasce no financeiro sem data
  if (depoisContas !== antesContas) throw new Error(`⛔ o número de transações mudou (${antesContas} → ${depoisContas}). Restaure o dump.`)
  console.log(`transações no financeiro: ${antesContas} antes, ${depoisContas} depois (inalterado, como tem que ser)`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
