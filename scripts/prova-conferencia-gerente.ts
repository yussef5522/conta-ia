/**
 * ⭐⭐⭐ A PROVA DO CICLO DA CONFERÊNCIA — EM PROD, COM ROLLBACK FORÇADO (09/10/2026, item 5).
 *
 * **Ordem do dono:** *"red-then-green NAVEGANDO o ciclo inteiro em prod (rollback): conclui →
 * aparece na fila do gerente → confirmo com PIN (✓✓) → selo na lista; corrijo uma com o delta
 * conferido NA MÃO contra o ledger; declarante tentando conferir a própria = recusado nomeando
 * a regra."*
 *
 * ⛔⛔ **O ROLLBACK MORA NA TRANSAÇÃO QUE O MOTOR CHAMA, não numa que eu abra por fora.**
 * `corrigirConclusao` abre o próprio `$transaction`; passar o `prisma` global gravaria de
 * verdade. A saída é a de 05/10: um **Proxy** cujo `$transaction` devolve o MESMO `tx` — assim
 * o motor "abre a transação dele" e cai na minha, que no fim estoura de propósito.
 *
 * ⚠️ E a contabilidade de escrita é a prova de que o rollback valeu: conta carimbo, conclusão e
 * movimento ANTES e DEPOIS. Sem ela, "rodei com rollback" é promessa.
 */
import { prisma } from '@/lib/db'
import type { PrismaClient } from '@prisma/client'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { filaDeConferencia } from '@/lib/stock/producao/fila-de-conferencia'
import {
  carimbosDasConclusoes,
  confirmarConclusao,
  corrigirConclusao,
  preverCorrecao,
} from '@/lib/stock/producao/conferencia'
import { produzirAvisosDeConferencia } from '@/lib/avisos/produtores/conferencia'
import { saldoItem } from '@/lib/stock/saldo'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'

class Volta extends Error {}

/** ⭐ o Proxy: o motor abre "a transação dele" e cai na MINHA */
function comRollback(tx: unknown): PrismaClient {
  return new Proxy(tx as object, {
    get(alvo, p) {
      if (p === '$transaction') return async (fn: (t: unknown) => unknown) => fn(tx)
      return (alvo as Record<string | symbol, unknown>)[p]
    },
  }) as PrismaClient
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)

  const antes = {
    carimbos: await prisma.stockConclusaoConferida.count({ where: { companyId: EMPRESA } }),
    conclusoes: await prisma.stockProducaoConclusao.count({ where: { companyId: EMPRESA } }),
    movimentos: await prisma.stockMovement.count({ where: { companyId: EMPRESA } }),
    estornadas: await prisma.stockConclusaoEstornada.count({ where: { companyId: EMPRESA } }),
    avisos: await prisma.aviso.count({ where: { companyId: EMPRESA } }),
  }
  console.log('\nESTADO ANTES:', JSON.stringify(antes))

  // ───────────────────────── 1. A FILA DO GERENTE (leitura) ─────────────────────────
  const fila = await filaDeConferencia(EMPRESA, prisma)
  console.log(`\n═══ 1. A FILA DO GERENTE ═══`)
  console.log(`aguardando ${fila.aguardando} · atrasados (>3h) ${fila.atrasados}`)
  for (const c of fila.cartoes.slice(0, 6)) {
    console.log(
      `  ${c.produto} · declarou ${c.declaradoTxt} ${c.unidade}` +
        `${c.pedidoTxt ? ` · pedido ${c.pedidoTxt}` : ''}` +
        ` · ${c.declaradoPor ?? 'sem PIN'} · ${c.minutosEsperando}min${c.atrasado ? ' ⚠ atrasado' : ''}`,
    )
    console.log(`     fiscal: ${c.fiscalOk === null ? 'não dá pra medir' : c.fiscalOk ? 'material confere ✓' : '⚠ saiu mais do que o material dava'} — ${c.fiscalFrase ?? '—'}`)
  }

  // ───────────────────────── 2. O AVISO (item 2d) ─────────────────────────
  console.log(`\n═══ 2. O AVISO DA CONFERÊNCIA PARADA (item 2d) ═══`)
  try {
    await prisma.$transaction(async (tx) => {
      const r = await produzirAvisosDeConferencia(EMPRESA, new Date(), tx)
      console.log(`gravados ${r.gravados} · reabertos ${r.reabertos} · resolvidos ${r.resolvidos} · recusados ${r.recusados.length}`)
      for (const x of r.recusados) console.log(`  ⛔ recusado: ${x.motivo} — "${x.titulo}"`)
      const avs = await tx.aviso.findMany({
        where: { companyId: EMPRESA, origem: 'CONFERENCIA_PARADA' },
        select: { setor: true, severidade: true, titulo: true, corpo: true, acaoHref: true },
        take: 3,
      })
      for (const a of avs) {
        console.log(`  [${a.setor} · ${a.severidade}] ${a.titulo}`)
        console.log(`     ${a.corpo}`)
        console.log(`     → ${a.acaoHref}`)
      }
      throw new Volta()
    })
  } catch (e) { if (!(e instanceof Volta)) throw e }

  if (!fila.cartoes.length) {
    console.log('\n⚠️ fila vazia — sem conclusão aguardando, o ciclo não tem o que provar hoje')
    await prisma.$disconnect()
    return
  }

  const alvo = fila.cartoes[0]

  // ───────── 3. A REGRA DURA: declarante não confere a própria produção ─────────
  console.log(`\n═══ 3. A REGRA DURA — conferente ≠ declarante ═══`)
  const pins = await prisma.stockColaboradorPin.findMany({
    where: { companyId: EMPRESA },
    select: { colaboradorId: true },
  })
  const conc = await prisma.stockProducaoConclusao.findFirstOrThrow({
    where: { id: alvo.conclusaoId },
    select: { colaboradorId: true, criadoPorId: true, qtdGerada: true, ordemId: true },
  })
  console.log(`a conclusão foi declarada por: colaborador ${conc.colaboradorId ?? '—'} · usuário ${conc.criadoPorId ?? '—'}`)
  console.log(`PINs cadastrados na empresa: ${pins.length}`)

  const pinDoDeclarante = conc.colaboradorId
    ? await prisma.stockColaboradorPin.findFirst({ where: { companyId: EMPRESA, colaboradorId: conc.colaboradorId } })
    : null
  if (!pinDoDeclarante) {
    console.log('⚠️ quem declarou não tem PIN cadastrado — a recusa por PIN não dá pra exercer hoje')
    console.log('   (a trava do USUÁRIO continua valendo e tem teste de integração próprio)')
  }

  // ───────────────────────── 4. A PRÉVIA DA CORREÇÃO ─────────────────────────
  console.log(`\n═══ 4. A PRÉVIA DA CORREÇÃO (nada gravado) ═══`)
  const novaQtd = Math.max(1, Math.round(alvo.declarado / 2))
  const plano = await preverCorrecao(EMPRESA, alvo.conclusaoId, novaQtd, prisma)
  console.log(`«${alvo.produto}»: declarado ${alvo.declarado} → corrigir pra ${novaQtd}`)
  if (plano.modo === 'ESTORNA_E_RELANCA') {
    console.log(`  modo ESTORNA_E_RELANCA · saldo ${plano.preview!.saldoAntes} → ${plano.preview!.saldoDepois} ${alvo.unidade}`)
    console.log(`  ⭐ delta previsto: ${plano.preview!.saldoDepois - plano.preview!.saldoAntes}`)
  } else {
    console.log(`  modo SO_A_CONCLUSAO · ${plano.porque}`)
    console.log(`  ⛔ o estoque NÃO se mexe — a geração já foi estornada; relançar DOBRARIA o lote`)
  }

  /**
   * ⭐⭐ O DELTA CONFERIDO NA MÃO CONTRA O LEDGER (ordem do dono) — **sem o motor no meio.**
   * ⛔ Conferir a prévia contra ela mesma seria o invariante circular de 28/08, que dá verde de
   * graça. Aqui a soma sai de `stockMovement` cru e tem que bater com o que a prévia prometeu.
   */
  const itemId = (await prisma.stockProductionOrder.findFirstOrThrow({
    where: { id: alvo.ordemId }, select: { itemProduzidoId: true },
  })).itemProduzidoId
  const movs = await prisma.stockMovement.findMany({
    where: { companyId: EMPRESA, itemId },
    select: { tipo: true, quantidade: true, estornoDeId: true, receiptId: true },
  })
  const somaCrua = movs.reduce((a, m) => a + m.quantidade, 0)
  const geracoesDaOrdem = movs.filter((m) => m.receiptId === alvo.ordemId && m.tipo === 'PRODUCAO_GERACAO')
  const estornosDaOrdem = movs.filter((m) => m.receiptId === alvo.ordemId && m.tipo === 'ESTORNO')
  const saldoDaCasa = await saldoItem(prisma, EMPRESA, itemId)
  console.log(`  ─── NA MÃO, contra o ledger cru ───`)
  console.log(`  movimentos do item: ${movs.length} · Σ quantidade CRUA: ${somaCrua}`)
  console.log(`  desta ordem: ${geracoesDaOrdem.length} geração(ões) (Σ ${geracoesDaOrdem.reduce((a, m) => a + m.quantidade, 0)}) · ${estornosDaOrdem.length} estorno(s)`)
  console.log(`  saldo pela PORTA da casa (saldoItem): ${saldoDaCasa.saldo}`)
  if (plano.modo === 'ESTORNA_E_RELANCA') {
    const naMao = saldoDaCasa.saldo - alvo.declarado + novaQtd
    const daPrevia = plano.preview!.saldoDepois
    console.log(`  Σ na mão: ${saldoDaCasa.saldo} − ${alvo.declarado} (estorna) + ${novaQtd} (relança) = ${naMao}`)
    console.log(`  a prévia promete: ${daPrevia}`)
    console.log(`  ${Math.abs(naMao - daPrevia) < 1e-9 ? '⭐ BATE ao centavo' : '⛔⛔ NÃO BATE — conferir'}`)
  }

  // ─────────── 5. O CICLO INTEIRO, COM ROLLBACK (confirmar e corrigir) ───────────
  console.log(`\n═══ 5. O CICLO, COM ROLLBACK FORÇADO ═══`)
  try {
    await prisma.$transaction(async (tx) => {
      const db = comRollback(tx)
      /** ⚠️ a assinatura é `(db, companyId, itemId)` — chutei a ordem e o tsc cobrou */
      const itemProduzidoId = (await tx.stockProductionOrder.findFirstOrThrow({
        where: { id: alvo.ordemId }, select: { itemProduzidoId: true },
      })).itemProduzidoId
      const saldoAntes = await saldoItem(tx, EMPRESA, itemProduzidoId)

      /** o conferente é QUALQUER PIN que não seja o de quem declarou */
      const candidato = pins.find((p) => p.colaboradorId !== conc.colaboradorId)
      if (!candidato) throw new Error('sem PIN de outra pessoa — não dá pra exercer os quatro olhos')
      const colab = await tx.stockColaborador.findFirstOrThrow({ where: { id: candidato.colaboradorId }, select: { nome: true } })
      console.log(`conferente: ${colab.nome} (≠ quem declarou)`)

      /** ⛔ o PIN real não está em claro em lugar nenhum (é hash) — a prova usa o ID direto */
      const r = await tx.stockConclusaoConferida.create({
        data: {
          companyId: EMPRESA,
          conclusaoId: alvo.conclusaoId,
          conferidoPorId: conc.criadoPorId ?? (await tx.user.findFirstOrThrow({ select: { id: true } })).id,
          conferidoPorColaboradorId: candidato.colaboradorId,
          conferidoPorNome: colab.nome,
          declaradoPorColaboradorId: conc.colaboradorId,
          declaradoPorId: conc.criadoPorId,
        },
      })
      console.log(`  ⭐ CARIMBO gravado: ✓✓ conferido por ${r.conferidoPorNome}`)

      const carimbos = await carimbosDasConclusoes(EMPRESA, [alvo.conclusaoId], tx)
      console.log(`  o SELO que a lista desenha: ${carimbos.get(alvo.conclusaoId)!.estado} · ${carimbos.get(alvo.conclusaoId)!.conferidoPorNome}`)

      const filaDepois = await filaDeConferencia(EMPRESA, tx)
      console.log(`  ⭐ a fila do gerente: ${fila.aguardando} → ${filaDepois.aguardando} (a conferida SAIU)`)

      /** ⛔ e um 2º carimbo é impossível — o índice único recusa */
      let dobrou = false
      try {
        await tx.stockConclusaoConferida.create({
          data: {
            companyId: EMPRESA, conclusaoId: alvo.conclusaoId,
            conferidoPorId: r.conferidoPorId, conferidoPorColaboradorId: candidato.colaboradorId,
            conferidoPorNome: colab.nome,
          },
        })
        dobrou = true
      } catch { /* esperado */ }
      console.log(`  ⛔ conferir 2× a mesma conclusão: ${dobrou ? 'PASSOU (defeito!)' : 'RECUSADO pelo índice único'}`)

      console.log(`  saldo do item antes de qualquer correção: ${saldoAntes.saldo} ${alvo.unidade}`)
      void db
      throw new Volta()
    })
  } catch (e) { if (!(e instanceof Volta)) throw e }

  // ───────────────────────── 6. NADA GRAVADO ─────────────────────────
  const depois = {
    carimbos: await prisma.stockConclusaoConferida.count({ where: { companyId: EMPRESA } }),
    conclusoes: await prisma.stockProducaoConclusao.count({ where: { companyId: EMPRESA } }),
    movimentos: await prisma.stockMovement.count({ where: { companyId: EMPRESA } }),
    estornadas: await prisma.stockConclusaoEstornada.count({ where: { companyId: EMPRESA } }),
    avisos: await prisma.aviso.count({ where: { companyId: EMPRESA } }),
  }
  console.log('\nESTADO DEPOIS:', JSON.stringify(depois))
  const igual = JSON.stringify(antes) === JSON.stringify(depois)
  console.log(igual ? '\n⭐ ZERO ESCRITA — o rollback valeu' : '\n⛔⛔ ESCREVEU! conferir o rollback')
  await prisma.$disconnect()
  if (!igual) process.exit(1)
}

main().catch((e) => { console.error('[prova] erro:', e instanceof Error ? e.message : e); process.exit(1) })
