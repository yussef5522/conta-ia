/**
 * ⭐⭐ RETROATIVO — carimba as linhas que o gesto resolveu antes do fix de 27/09/2026.
 *
 * **O dono (item 2):** *"varre as transações JÁ vinculadas a empréstimo/fatura/aporte/
 * transferência que estão sem categoria/pendentes e carimba (as 2 do C41033828 e o resto dos
 * 22 que for dessa família) — **preview antes: quantas, quais**."*
 *
 * ⚠️ **PREVIEW É O PADRÃO.** Sem `--aplicar` ele **não escreve nada** — a régua da casa pra todo
 * script que toca dado real, desde o dedup de VendaDiaria de 26/08.
 *
 * ⭐ **Ele passa pela PORTA ÚNICA** (`carimbarSeTemVinculo`), nunca por um `updateMany` próprio:
 * um `where` escrito aqui seria a segunda definição de *"quem tem vínculo"* e divergiria do
 * gesto no primeiro caso de borda — a doença dos 7 detectores de par.
 *
 * ⭐ **E é IDEMPOTENTE:** a porta devolve `carimbou: false` pra quem já está `RECONCILED`, então
 * rodar de novo não muda nada além de gastar leitura.
 *
 * Uso:
 *   npx tsx scripts/carimbar-vinculos-retroativo.ts <companyId>            # preview
 *   npx tsx scripts/carimbar-vinculos-retroativo.ts <companyId> --aplicar  # grava
 */
import { PrismaClient } from '@prisma/client'
import { carimbarSeTemVinculo, SELECT_DO_VINCULO, paraSelo } from '../lib/conciliacao/carimbar-vinculo'
import { seloDoSistema } from '../lib/conciliacao/selo-do-sistema'

const db = new PrismaClient()
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function main() {
  const companyId = process.argv[2]
  const aplicar = process.argv.includes('--aplicar')
  if (!companyId) throw new Error('uso: npx tsx scripts/carimbar-vinculos-retroativo.ts <companyId> [--aplicar]')

  // ⛔ REGRA 8b — provar em QUAL banco estamos antes de medir; zero silencioso é
  // indistinguível de "não tem", e foi assim que eu quase reportei perda de dado em 02/09.
  const emp = await db.company.findUnique({ where: { id: companyId }, select: { name: true, cnpj: true } })
  if (!emp) throw new Error(`a empresa ${companyId} NÃO existe neste banco — medição abortada`)
  console.log(`banco: a empresa «${emp.name}» (${emp.cnpj}) existe aqui ✓`)
  console.log(aplicar ? '\n⚠️  MODO APLICAR — vai gravar\n' : '\n👁  PREVIEW — nada será gravado\n')

  /**
   * ⚠️ O universo é **`status != RECONCILED` com ALGUM vínculo** — e a lista de vínculos tem que
   * ser a mesma do `seloDoSistema`. Por isso a peneira aqui é LARGA (qualquer um dos vínculos) e
   * quem **decide** é a porta: filtro estreito no script viraria a 2ª régua.
   */
  const candidatas = await db.transaction.findMany({
    where: {
      bankAccount: { companyId },
      status: { not: 'RECONCILED' },
      OR: [
        { loanInstallmentPaid: { isNot: null } },
        { loanInstallmentPayments: { some: {} } },
        { businessCreditCardId: { not: null } },
        { investmentContribution: { isNot: null } },
        { loanDisbursement: { isNot: null } },
        { transferGroupId: { not: null } },
      ],
    },
    select: { ...SELECT_DO_VINCULO, date: true, amount: true, description: true, categoryId: true },
    orderBy: { date: 'asc' },
  })

  const porFamilia = new Map<string, { n: number; valor: number; exemplos: string[] }>()
  let ignoradas = 0
  for (const t of candidatas) {
    const selo = seloDoSistema(paraSelo(t as never))
    if (!selo) continue
    // ⚠️ IGNORED é decisão do dono e não se sobrescreve — a porta recusa, e aqui só se conta
    if (t.status === 'IGNORED') { ignoradas++; continue }
    const g = porFamilia.get(selo.curto) ?? { n: 0, valor: 0, exemplos: [] }
    g.n++; g.valor += t.amount
    if (g.exemplos.length < 5) {
      g.exemplos.push(`${t.date.toISOString().slice(0, 10)} ${brl(t.amount).padStart(14)} st:${t.status} cat:${t.categoryId ? 'sim' : 'NULA'} «${t.description.slice(0, 44)}»`)
    }
    porFamilia.set(selo.curto, g)
  }

  console.log('═══ O QUE VAI SER CARIMBADO (status → RECONCILED) ═══')
  let totN = 0, totV = 0
  for (const [fam, g] of porFamilia) {
    console.log(`\n  ${fam} — ${g.n} lançamento(s) · ${brl(g.valor)}`)
    for (const e of g.exemplos) console.log(`     ${e}`)
    if (g.n > g.exemplos.length) console.log(`     … e ${g.n - g.exemplos.length} outra(s)`)
    totN += g.n; totV += g.valor
  }
  console.log(`\n  ⭐ TOTAL: ${totN} lançamento(s) · ${brl(totV)}`)
  if (ignoradas) console.log(`  ⚠️  ${ignoradas} estão IGNORED — decisão do dono, NÃO se toca`)
  /**
   * ⭐⭐ **A CATEGORIA NÃO É TOCADA — e o script DIZ isso**, porque é a pergunta que o dono faria
   * ao ler "carimbar". O rótulo da tela é DERIVADO do vínculo (`seloDoSistema`); o que se grava é
   * o **estado da fila**. Ver o porquê em `lib/conciliacao/selo-do-sistema.ts`.
   */
  console.log('  ⛔ nenhuma categoria é criada nem gravada — o rótulo é derivado do vínculo')

  if (!aplicar) {
    console.log('\n👁  PREVIEW — nada foi gravado. Rode com --aplicar pra valer.')
    await db.$disconnect()
    return
  }

  let carimbadas = 0
  for (const t of candidatas) {
    const r = await carimbarSeTemVinculo(db, t.id, companyId)
    if (r.carimbou) carimbadas++
  }
  console.log(`\n✓ APLICADO: ${carimbadas} carimbada(s)`)

  // ⭐ conferência DEPOIS, pelo mesmo caminho: sobrou alguma?
  const sobrou = await db.transaction.count({
    where: {
      bankAccount: { companyId },
      status: 'PENDING',
      OR: [
        { loanInstallmentPaid: { isNot: null } },
        { loanInstallmentPayments: { some: {} } },
        { businessCreditCardId: { not: null } },
        { investmentContribution: { isNot: null } },
        { loanDisbursement: { isNot: null } },
        { transferGroupId: { not: null } },
      ],
    },
  })
  console.log(`⛔ ainda PENDING com vínculo: ${sobrou} ${sobrou === 0 ? '✓' : '← conferir'}`)
  await db.$disconnect()
}

main().catch((e) => { console.error('ERRO:', e instanceof Error ? e.message : e); process.exit(1) })
