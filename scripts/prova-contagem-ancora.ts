/**
 * ⭐⭐⭐ RED-THEN-GREEN NAVEGANDO — "a contagem é a ÂNCORA" no dado REAL de prod (05/10/2026).
 *
 * ⛔⛔ **ZERO ESCRITA, e por construção:** tudo roda dentro de um `$transaction` que é
 * **forçado a dar rollback** no fim. O `contarLinha` abre a própria transação, então o `tx`
 * entra por um **Proxy** cujo `$transaction` devolve o MESMO `tx` (Prisma não aninha) — é o
 * mesmo truque da prova da modal de conclusão (05/10).
 *
 * ⚠️ **O QUE ISTO PROVA E O QUE NÃO PROVA:** prova a decisão inteira — a pergunta do motivo, a
 * valoração pelo último custo conhecido, o resíduo em linha própria, o saldo virando o contado,
 * o custo médio renascendo, o rastro e o aviso do sininho — pela MESMA função que a rota chama
 * (`contarLinha`; a rota é casca fina + o tradutor de erro). **Não** prova o clique do dono:
 * abrir a sessão e contar é gesto dele (REGRA 2), e pro 2º item eu não tenho o número da
 * prateleira — *saldo não se chuta*.
 *
 * USO (no servidor):  npx tsx scripts/prova-contagem-ancora.ts
 */
import type { PrismaClient } from '@prisma/client'
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { contarLinha, ContagemError } from '../lib/stock/contagem'
import { saldoItem, custoMedioPorItem } from '../lib/stock/saldo'
import { produzirAvisosDeEstoque, ORIGEM } from '../lib/avisos/produtores/estoque'

const CO = 'cmq17yapb00gnrndlh33sctbo'
const FERMENTO = 'cmttb7w1p0003o9db38fdqthf'
/** ⭐ o 2º item é pra provar que a lei é GERAL, não um fix do fermento (ordem do dono) */
const ESPELHO = 'cmtjl9vgb0015qd709brdgtmi' // porcao chuleta — negativo nos DOIS (qtd e R$)

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const n3 = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })

const ROLLBACK = new Error('ROLLBACK FORÇADO')

async function main() {
  /** ⛔ REGRA 8b — prova contra QUAL banco antes de medir */
  const nome = await exigirEmpresaNesteBanco(prisma, CO)
  console.log(`\n⭐ empresa: ${nome} (${CO})`)

  const movsAntes = await prisma.stockMovement.count({ where: { companyId: CO } })
  const rastroAntes = await prisma.stockContagemNegativo.count({ where: { companyId: CO } })
  const sessoesAntes = await prisma.stockContagem.count({ where: { companyId: CO } })
  console.log(`ANTES → movimentos ${movsAntes} · rastro do negativo ${rastroAntes} · sessões ${sessoesAntes}`)

  try {
    await prisma.$transaction(
      async (txReal) => {
        /** ⚠️ Prisma não aninha `$transaction` — o Proxy devolve o MESMO tx pra o `contarLinha` */
        const tx = new Proxy(txReal, {
          get(t, p) {
            if (p === '$transaction') return (fn: (c: unknown) => unknown) => fn(tx)
            return (t as unknown as Record<string, unknown>)[p as string]
          },
        }) as unknown as PrismaClient

        const sessao = await tx.stockContagem.create({
          data: { companyId: CO, tipo: 'ROTINA', status: 'ABERTA' },
        })
        console.log(`\nsessão de contagem aberta (dentro do rollback): ${sessao.id}`)

        for (const [rotulo, itemId, contado] of [
          ['FERMENTO (o caso do dono: "eu tenho 6 KG na prateleira")', FERMENTO, 6],
          ['PORCAO CHULETA (o 2º negativo — a lei é GERAL)', ESPELHO, 9],
        ] as const) {
          const item = await tx.stockItem.findFirstOrThrow({ where: { id: itemId }, select: { nome: true, unidadeControle: true } })
          const antes = await saldoItem(tx, CO, itemId)
          const cmAntes = (await custoMedioPorItem(tx, CO)).get(itemId)
          console.log(`\n══════ ${rotulo} ══════`)
          console.log(`«${item.nome}» ANTES → saldo ${n3(antes.saldo)} ${item.unidadeControle} · valor ${brl(antes.valor)} · custo médio ${cmAntes == null ? 'NULL (o saldo.ts se recusa a dividir negativo por negativo)' : brl(cmAntes)}`)

          /** ⛔ O VERMELHO: contar SEM o motivo → PERGUNTA (409), ledger INTOCADO */
          const movsNoMeio = await tx.stockMovement.count({ where: { companyId: CO, itemId } })
          try {
            await contarLinha(
              { companyId: CO, contagemId: sessao.id, itemId, qtdContada: contado, confirmarFreio: true, viuSistema: true, observacao: null },
              tx,
            )
            console.log('  ⛔⛔ ENTROU SEM MOTIVO — a pergunta não aconteceu')
          } catch (e) {
            const code = e instanceof ContagemError ? e.code : null
            const opcoes = (e as ContagemError & { motivos?: { codigo: string }[] }).motivos ?? []
            console.log(`  ⛔ SEM MOTIVO → ${code} (não é recusa, é PERGUNTA)`)
            console.log(`     "${(e as Error).message}"`)
            console.log(`     opções que descem do servidor: ${opcoes.map((m) => m.codigo).join(' · ') || '(nenhuma!)'}`)
            const depois = await tx.stockMovement.count({ where: { companyId: CO, itemId } })
            console.log(`     ledger intocado? ${depois === movsNoMeio ? '✓ sim' : `⛔ NÃO (${movsNoMeio} → ${depois})`}`)
          }

          /** ⭐ O VERDE: com o motivo, ENTRA */
          const r = await contarLinha(
            {
              companyId: CO, contagemId: sessao.id, itemId, qtdContada: contado,
              confirmarFreio: true, viuSistema: true, observacao: null,
              motivoDoNegativo: 'FICHA_ERRADA',
            },
            tx,
          )
          const dep = await saldoItem(tx, CO, itemId)
          const cmDep = (await custoMedioPorItem(tx, CO)).get(itemId)
          console.log(`  ⭐ COM O MOTIVO → ENTROU`)
          console.log(`     divergência ${n3(r.valoracao.divergencia)} · base ${r.valoracao.base} · custo usado ${brl(r.valoracao.custoUnitario)}`)
          console.log(`     ajuste de quantidade: ${brl(r.valoracao.custoTotal)} · resíduo em LINHA PRÓPRIA: ${brl(r.valoracao.residuo)} (${r.residuoMovementId ? 'gravado' : 'nenhum'})`)
          console.log(`     DEPOIS → saldo ${n3(dep.saldo)} ${item.unidadeControle} · valor ${brl(dep.valor)} · custo médio ${cmDep == null ? 'NULL' : brl(cmDep)}`)
          console.log(`     o dinheiro deixou de ser negativo? ${dep.valor >= 0 ? '✓ sim' : '⛔ NÃO'} · o saldo virou o contado? ${Math.abs(dep.saldo - contado) < 0.01 ? '✓ sim' : '⛔ NÃO'}`)

          const rastro = await tx.stockContagemNegativo.findFirst({ where: { contagemId: sessao.id, itemId } })
          console.log(`     rastro: saldoAntes ${rastro ? n3(rastro.saldoAntes) : '—'} · valorAntes ${rastro ? brl(rastro.valorAntes) : '—'} · motivo ${rastro?.motivo ?? '—'} · base ${rastro?.baseDoCusto ?? '—'}`)
        }

        /** ⭐⭐ O AVISO DE INVESTIGAÇÃO — o negativo não morre calado */
        console.log('\n══════ O SININHO ══════')
        const av = await produzirAvisosDeEstoque(CO, new Date(), tx)
        console.log(`gravados ${av.gravados} · reabertos ${av.reabertos} · calados ${av.calados.length} · recusados pela língua do balcão ${av.recusados.length}`)
        for (const c of av.calados) console.log(`  (calado) ${c.item}: ${c.porque}`)
        for (const c of av.recusados) console.log(`  ⛔ RECUSADO: ${c.titulo} — ${c.motivo}`)
        const avisos = await tx.aviso.findMany({ where: { companyId: CO, origem: ORIGEM } })
        for (const a of avisos) {
          console.log(`  ⭐ [${a.setor} · ${a.severidade}] ${a.titulo}`)
          console.log(`     ${a.corpo}`)
          console.log(`     → ${a.acaoRotulo}: ${a.acaoHref}`)
        }

        /** ⭐ AS FICHAS VOLTAM A TER CUSTO (a pergunta do dono) */
        const comps = await tx.stockFichaComponente.findMany({ where: { itemId: FERMENTO }, select: { fichaVersaoId: true, quantidade: true } })
        const cm = (await custoMedioPorItem(tx, CO)).get(FERMENTO)
        console.log(`\n══════ AS FICHAS QUE USAM FERMENTO ══════`)
        console.log(`componentes apontando pro fermento: ${comps.length} · custo médio agora: ${cm == null ? 'NULL' : brl(cm)}`)
        if (comps.length && cm != null) {
          const q = comps[0].quantidade
          console.log(`  exemplo: ${n3(q)} KG × ${brl(cm)} = ${brl(q * cm)} — a ficha deixou de dizer "a definir"`)
        }

        throw ROLLBACK
      },
      { timeout: 120_000 },
    )
  } catch (e) {
    if (e !== ROLLBACK) throw e
  }

  const movsDepois = await prisma.stockMovement.count({ where: { companyId: CO } })
  const rastroDepois = await prisma.stockContagemNegativo.count({ where: { companyId: CO } })
  const sessoesDepois = await prisma.stockContagem.count({ where: { companyId: CO } })
  console.log(`\nDEPOIS → movimentos ${movsDepois} · rastro ${rastroDepois} · sessões ${sessoesDepois}`)
  const limpo = movsDepois === movsAntes && rastroDepois === rastroAntes && sessoesDepois === sessoesAntes
  console.log(limpo ? '⭐ ZERO ESCRITA — o ledger do dono está intacto (rollback forçado)' : '⛔⛔ ALGO GRAVOU — conferir à mão')
}

main()
  .catch((e) => {
    console.error('⛔', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
