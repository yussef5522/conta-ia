// REGRA 1 — "OU GRAVA TUDO, OU NADA GRAVA" (29/08/2026).
//
// Prova E2E das marcações do import dentro da transação do confirm. Roda contra Postgres
// SCRATCH (o `runImportV2` grava `statement_lines` por SQL cru com `gen_random_uuid()` —
// tabela que nem está no schema Prisma; no SQLite do dev ele não roda de jeito nenhum).
// Mesmo padrão de `e2e-skip-decisions.ts` e `stock-fase1-prova-ledger.ts`.
//
//   DATABASE_URL=<scratch> RECONCILE_V2=true npx tsx scripts/e2e-marcacoes-atomicas.ts
//
// ⚠️ RECUSA subir se o banco não tiver `scratch`/`test` no nome — a suíte já roda contra
// produção uma vez (08/08) e não roda de novo.
//
// AS DUAS METADES DO CONTRATO:
//   A. confirm COM marcações  → linhas gravadas E marcadas, sem 2ª fase
//   B. marcação inválida NO MEIO → NADA gravado (nem linhas soltas sem marca)
//
// A metade B é a que importa: antes, "mecanismo consertado + toast" ainda deixava a marca
// sumir quando o `apply-marks` falhasse (rede, 500, aba fechada) — e o dono ficava com
// transações cruas sem saber. O CENÁRIO C reproduz esse mundo antigo pra mostrar a
// diferença (red-then-green sobre o COMPORTAMENTO, não sobre o código).

import { PrismaClient } from '@prisma/client'
import { runImportV2 } from '../lib/reconciliation/import-orchestrator'
import { aplicarMarcacao } from '../lib/ofx-v3/aplicar-marcacao'
import { dedupHashOFX } from '../lib/ofx/dedup'

const prisma = new PrismaClient()

const LINHAS = [
  { fitid: 'A1', amt: -500.0, memo: 'PAGAMENTO FATURA CARTAO' },
  { fitid: 'A2', amt: -120.5, memo: 'FORNECEDOR ABC' },
  { fitid: 'A3', amt: -33.33, memo: 'TARIFA' },
]
const DATA = new Date('2026-07-03T00:00:00Z')

const OFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>341<ACCTID>A<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260701<DTEND>20260705
${LINHAS.map((l) => `<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260703<TRNAMT>${l.amt}<FITID>${l.fitid}<MEMO>${l.memo}</STMTTRN>`).join('\n')}
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1000.00<DTASOF>20260705</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

const hashOf = (l: (typeof LINHAS)[number]) =>
  dedupHashOFX({ datePosted: DATA, type: 'DEBIT', amount: Math.abs(l.amt), memo: l.memo, fitid: l.fitid })

type Marca = { ofxHash: string; kind: string; params?: Record<string, unknown> }

let falhou = false
const linha = (ok: boolean, texto: string) => {
  if (!ok) falhou = true
  console.log(`   ${ok ? '✅' : '❌'} ${texto}`)
}

/** Empresa+conta novas por cenário — cada um começa do zero. */
async function cenarioNovo(nome: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const user = await prisma.user.create({ data: { name: 'T', email: `atom${stamp}@x.com`, password: 'x' } })
  const company = await prisma.company.create({ data: { cnpj: `A${stamp}`, name: nome } })
  const conta = await prisma.bankAccount.create({ data: { companyId: company.id, name: 'c1' } })
  const cartao = await prisma.businessCreditCard.create({
    data: { companyId: company.id, name: 'cartao', creditLimit: 10000, closingDay: 10, dueDay: 20 },
  })
  const categoria = await prisma.category.create({
    data: { companyId: company.id, name: 'Fornecedores', type: 'EXPENSE' },
  })
  return { user, company, conta, cartao, categoria }
}

const importar = (contaId: string, userId: string, marks: Marca[]) =>
  prisma.$transaction(
    (tx) =>
      runImportV2(tx as never, {
        bankAccountId: contaId,
        rawOfx: OFX,
        userId,
        fileName: 'atomico.ofx',
        marks,
      } as never),
    { timeout: 30000 },
  )

const contarTudo = async (contaId: string) => ({
  tx: await prisma.transaction.count({ where: { bankAccountId: contaId } }),
  linhas: Number(
    (
      (await prisma.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM statement_lines WHERE "bankAccountId" = $1`,
        contaId,
      )) as Array<{ n: number }>
    )[0].n,
  ),
  imports: await prisma.ofxImport.count({ where: { bankAccountId: contaId } }),
})

// ─────────────────────────────────────────────────────────────────────────────
// A. confirm COM marcações → tudo aplicado, sem 2ª fase
// ─────────────────────────────────────────────────────────────────────────────
async function cenarioA() {
  console.log('\n=== A. confirm COM marcações → tudo aplicado na mesma transação ===')
  const { user, conta, cartao, categoria } = await cenarioNovo('ATOMICO-A')

  const r = (await importar(conta.id, user.id, [
    { ofxHash: hashOf(LINHAS[0]), kind: 'PAGAMENTO_CARTAO', params: { cardId: cartao.id } },
    { ofxHash: hashOf(LINHAS[1]), kind: 'DESPESA', params: { categoryId: categoria.id } },
  ])) as { marcacoesAplicadas: { aplicadas: number; puladas: number } }

  linha(r.marcacoesAplicadas.aplicadas === 2, `2 marcações aplicadas (veio ${r.marcacoesAplicadas.aplicadas})`)

  const pagamento = await prisma.transaction.findFirstOrThrow({ where: { bankAccountId: conta.id, amount: 500 } })
  linha(pagamento.isCardPayment === true, 'a linha do cartão nasceu isCardPayment=true')
  linha(pagamento.businessCreditCardId === cartao.id, 'e já vinculada ao cartão escolhido na revisão')

  const despesa = await prisma.transaction.findFirstOrThrow({ where: { bankAccountId: conta.id, amount: 120.5 } })
  linha(despesa.categoryId === categoria.id, 'a linha de despesa nasceu categorizada')
  linha(despesa.status === 'RECONCILED' && despesa.cashCoded, 'e RECONCILED + cashCoded, sem 2ª fase')

  const c = await contarTudo(conta.id)
  linha(c.tx === 3, `as 3 linhas do arquivo entraram (veio ${c.tx})`)
}

// ─────────────────────────────────────────────────────────────────────────────
// B. marcação inválida NO MEIO → NADA gravado
// ─────────────────────────────────────────────────────────────────────────────
async function cenarioB() {
  console.log('\n=== B. falha no meio → NADA gravado (nem linha solta sem marca) ===')
  const { user, conta, categoria } = await cenarioNovo('ATOMICO-B')

  let estourou = false
  try {
    // a 1ª marcação é VÁLIDA e roda; a 2ª aponta pra um cartão que não existe
    await importar(conta.id, user.id, [
      { ofxHash: hashOf(LINHAS[1]), kind: 'DESPESA', params: { categoryId: categoria.id } },
      { ofxHash: hashOf(LINHAS[0]), kind: 'PAGAMENTO_CARTAO', params: { cardId: 'cartao-que-nao-existe' } },
    ])
  } catch (e) {
    estourou = true
    console.log(`   (o import estourou, como tem que estourar: ${(e as Error).message.slice(0, 60)})`)
  }
  linha(estourou, 'marcação inválida derruba o import')

  const c = await contarTudo(conta.id)
  // ⚠️ o ponto do teste: nem a linha da 1ª marcação (que era VÁLIDA) sobrou
  linha(c.tx === 0, `ZERO transações gravadas (veio ${c.tx})`)
  linha(c.linhas === 0, `ZERO statement_lines gravadas (veio ${c.linhas})`)
  linha(c.imports === 0, `ZERO registros de import (veio ${c.imports})`)
}

// ─────────────────────────────────────────────────────────────────────────────
// C. o mundo ANTIGO (2 fases) — o vermelho que o fix apaga
// ─────────────────────────────────────────────────────────────────────────────
async function cenarioC() {
  console.log('\n=== C. contraste: 2 fases (import → marcar depois), a falha do jeito antigo ===')
  const { user, conta } = await cenarioNovo('ATOMICO-C')

  // fase 1: import SEM marcações (como era antes: a tela marcava depois)
  await importar(conta.id, user.id, [])

  // fase 2: a marcação falha (cartão inválido = o que a rede/500/aba fechada causava)
  const alvo = await prisma.transaction.findFirstOrThrow({ where: { bankAccountId: conta.id, amount: 500 } })
  let estourou = false
  try {
    await aplicarMarcacao(alvo as never, 'PAGAMENTO_CARTAO' as never, { cardId: 'nao-existe' }, 'x', user.id, prisma)
  } catch {
    estourou = true
  }

  const c = await contarTudo(conta.id)
  const depois = await prisma.transaction.findFirstOrThrow({ where: { id: alvo.id } })
  linha(estourou, 'a 2ª fase falha igual')
  linha(
    c.tx === 3 && depois.isCardPayment === false && depois.businessCreditCardId === null,
    `⚠️ e as 3 linhas FICAM gravadas, a do cartão CRUA (tx=${c.tx}, cartão=${depois.businessCreditCardId ?? 'null'}) — o estado pela metade que o fix elimina`,
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// D. marcação cuja linha não virou transação → pula, não derruba
// ─────────────────────────────────────────────────────────────────────────────
async function cenarioD() {
  console.log('\n=== D. marcação órfã (linha virou duplicata/futura/SKIP) → pula, não derruba ===')
  const { user, conta, categoria } = await cenarioNovo('ATOMICO-D')

  const r = (await importar(conta.id, user.id, [
    { ofxHash: 'hash-de-linha-que-nao-entrou', kind: 'DESPESA', params: { categoryId: categoria.id } },
  ])) as { marcacoesAplicadas: { aplicadas: number; puladas: number } }

  linha(r.marcacoesAplicadas.puladas === 1, `1 marcação pulada (veio ${r.marcacoesAplicadas.puladas})`)
  linha(r.marcacoesAplicadas.aplicadas === 0, 'nenhuma aplicada')
  const c = await contarTudo(conta.id)
  linha(c.tx === 3, `e o import seguiu normal: 3 tx (veio ${c.tx})`)
}

// ─────────────────────────────────────────────────────────────────────────────
// E. depois de uma falha dá pra reimportar limpo (não ficou lixo travando)
// ─────────────────────────────────────────────────────────────────────────────
async function cenarioE() {
  console.log('\n=== E. depois da falha, reimportar limpo ===')
  const { user, conta, cartao } = await cenarioNovo('ATOMICO-E')

  try {
    await importar(conta.id, user.id, [
      { ofxHash: hashOf(LINHAS[0]), kind: 'PAGAMENTO_CARTAO', params: { cardId: 'inexistente' } },
    ])
  } catch {
    /* esperado */
  }
  const r = (await importar(conta.id, user.id, [
    { ofxHash: hashOf(LINHAS[0]), kind: 'PAGAMENTO_CARTAO', params: { cardId: cartao.id } },
  ])) as { marcacoesAplicadas: { aplicadas: number } }

  linha(r.marcacoesAplicadas.aplicadas === 1, 'o reimport aplica a marcação')
  const c = await contarTudo(conta.id)
  linha(c.tx === 3, `3 tx, sem duplicata do arquivo abortado (veio ${c.tx})`)
}

async function main() {
  const url = process.env.DATABASE_URL ?? ''
  const nomeDoBanco = url.split('/').pop()?.split('?')[0] ?? ''
  if (!/scratch|test/i.test(nomeDoBanco)) {
    throw new Error(`banco "${nomeDoBanco}" não parece scratch/test — recusando (nunca mais rodar em prod)`)
  }
  if (process.env.RECONCILE_V2 !== 'true') throw new Error('RECONCILE_V2=true faltando (é o caminho vivo)')
  console.log(`\n⭐ REGRA 1 — ATOMICIDADE DAS MARCAÇÕES DO IMPORT · banco: ${nomeDoBanco}`)

  await cenarioA()
  await cenarioB()
  await cenarioC()
  await cenarioD()
  await cenarioE()

  console.log(
    falhou
      ? '\n❌ FALHOU — a atomicidade não está de pé\n'
      : '\n✅ PASSOU — ou grava tudo, ou nada grava\n',
  )
  process.exit(falhou ? 1 : 0)
}
main().finally(() => prisma.$disconnect())
