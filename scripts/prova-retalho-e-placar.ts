/**
 * ⭐⭐⭐ A PROVA DAS DUAS PARTES — RETALHO (1) + CARTÃO-PLACAR (2), em prod (09/10/2026).
 *
 * ⛔⛔ **ROLLBACK FORÇADO no ciclo:** `criarOrdem` e a conclusão escrevem; a prova roda tudo
 * dentro de um `$transaction` que **sempre** volta atrás. ⚠️ E o POST pela ROTA fica FORA dele
 * de propósito — *o fetch vai pro processo do SERVIDOR, com conexão própria, e o rollback NÃO o
 * desfaz* (a cicatriz de 07/10, quando uma linha de chips ficou gravada em prod). Por isso o
 * único POST que a prova faz é o que tem que ser **RECUSADO**.
 *
 * ⭐ E o ciclo compara o MESMO lote com e sem retalho — é o red-then-green do dono:
 * *"pedido 200 + 9,2 kg (= +46) → esperado ~246 → declarou 246 = confere ✓"*.
 */
import { prisma } from '@/lib/db'
import type { PrismaClient } from '@prisma/client'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { signToken } from '@/lib/auth'
import { criarOrdem, explodirSeparacao } from '@/lib/stock/producao/ordens'
import { fiscalDeOrdens } from '@/lib/stock/producao/fiscal-dos-lotes'
import { filaDeConferencia, ordenarCartoes } from '@/lib/stock/producao/fila-de-conferencia'
import { configDeRetalho, fraseDoRetalho, PESO_DA_METADE_G } from '@/lib/stock/producao/retalho'
import { produzirAvisosDeRetalho } from '@/lib/avisos/produtores/retalho'
import { checkProducaoInvariants } from '@/lib/stock/producao/producao-invariants'

const EMPRESA = process.env.EMPRESA_ID ?? 'cmq17yapb00gnrndlh33sctbo'
const base = process.env.BASE ?? 'http://localhost:3001'
const NOME = process.env.RETALHO_NOME ?? 'metade de bolinha massa de pizza'

const CELULAR = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'

class Volta extends Error {}
/** ⚠️ o Proxy de sempre: `criarOrdem` abre o próprio `$transaction` — sem ele, o rollback vaza */
function comRollback(tx: unknown): PrismaClient {
  return new Proxy(tx as object, {
    get(t, p) {
      if (p === '$transaction') return async (fn: (x: unknown) => unknown) => fn(tx)
      return (t as Record<string | symbol, unknown>)[p]
    },
  }) as PrismaClient
}

async function main() {
  await exigirEmpresaNesteBanco(prisma, EMPRESA)
  const antes = {
    ordens: await prisma.stockProductionOrder.count({ where: { companyId: EMPRESA } }),
    retalhos: await prisma.stockOrdemRetalho.count({ where: { companyId: EMPRESA } }),
    movimentos: await prisma.stockMovement.count({ where: { companyId: EMPRESA } }),
    conclusoes: await prisma.stockProducaoConclusao.count({ where: { companyId: EMPRESA } }),
    avisos: await prisma.aviso.count({ where: { companyId: EMPRESA } }),
    cfgRetalho: await prisma.stockFichaRetalho.count({ where: { companyId: EMPRESA } }),
  }
  console.log('ESTADO ANTES:', JSON.stringify(antes))

  /** ⭐⭐ INVARIANTES ANTES (item 5 do dono: "P1-P8 provadas antes/depois") */
  const pAntes = await checkProducaoInvariants(prisma)
  /** ⚠️ o campo é `invariante`, não `code` — chutei o nome e o tsc cobrou */
  const porCodigo = (fs: { invariante: string }[]) => {
    const m: Record<string, number> = {}
    for (const f of fs) m[f.invariante] = (m[f.invariante] ?? 0) + 1
    return m
  }
  console.log('INVARIANTES P ANTES:', JSON.stringify(porCodigo(pAntes)))

  // ──────────────── 1. O RETRATO: quem aceita retalho ────────────────
  console.log(`\n═══ 1. O RETRATO — quem aceita retalho ═══`)
  const item = await prisma.stockItem.findFirst({
    where: { companyId: EMPRESA, nome: { contains: NOME } }, select: { id: true, nome: true, unidadeControle: true },
  })
  if (!item) throw new Error(`não achei o item «${NOME}»`)
  const ficha = await prisma.stockFicha.findFirstOrThrow({
    where: { companyId: EMPRESA, itemProduzidoId: item.id, ativo: true }, select: { id: true, versaoAtual: true },
  })
  const ativas = await prisma.stockFicha.count({ where: { companyId: EMPRESA, ativo: true } })
  const ligadas = await prisma.stockFichaRetalho.count({ where: { companyId: EMPRESA, aceitaRetalho: true } })
  const cfg = (await configDeRetalho(EMPRESA, [ficha.id], prisma)).get(ficha.id)
  console.log(`«${item.nome}» [${item.unidadeControle}] · ficha ${ficha.id} v${ficha.versaoAtual}`)
  console.log(`  config: ${cfg ? `aceita=${cfg.aceita} · peso da metade=${cfg.pesoUnidadeG} g` : 'NENHUMA'}`)
  console.log(`  ⭐ fichas ATIVAS na empresa: ${ativas} · com retalho LIGADO: ${ligadas} (as outras ${ativas - ligadas} não mudam nada)`)

  // ──────────────── 2. A ROTA DA PERGUNTA ────────────────
  console.log(`\n═══ 2. A ROTA DA PERGUNTA — e ela se cala na receita não marcada ═══`)
  const dono = await prisma.user.findFirstOrThrow({
    where: { userCompanyRoles: { some: { companyId: EMPRESA, role: { name: 'OWNER' } } } },
    select: { id: true, email: true, name: true },
  })
  const ck = `auth_token=${await signToken({ sub: dono.id, email: dono.email, name: dono.name ?? 'x', role: 'OWNER' })}; current_empresa_id=${EMPRESA}`

  const r1 = await fetch(`${base}/api/empresas/${EMPRESA}/estoque/producao/retalho?ficha=${ficha.id}`, { headers: { cookie: ck } })
  console.log(`  a MASSA → HTTP ${r1.status} · ${(await r1.text()).slice(0, 180)}`)
  const outra = await prisma.stockFicha.findFirst({
    where: { companyId: EMPRESA, ativo: true, id: { not: ficha.id } }, select: { id: true },
  })
  if (outra) {
    const r2 = await fetch(`${base}/api/empresas/${EMPRESA}/estoque/producao/retalho?ficha=${outra.id}`, { headers: { cookie: ck } })
    console.log(`  outra receita → HTTP ${r2.status} · ${(await r2.text()).slice(0, 120)} ⭐ sem peso e sem último kg`)
  }

  // ──────────────── 3. A FRASE CURTA ────────────────
  console.log(`\n═══ 3. A FRASE CURTA (o exemplo e o caso real) ═══`)
  for (const kg of [1, 9.2, 25]) {
    console.log(`  pedido 200 + ${kg} kg → "${fraseDoRetalho({ pedido: 200, kg, pesoUnidadeG: cfg?.pesoUnidadeG ?? PESO_DA_METADE_G, unidade: item.unidadeControle })}"`)
  }

  // ──────────────── 4. O CICLO, COM ROLLBACK FORÇADO ────────────────
  console.log(`\n═══ 4. O CICLO — pedido 200 + 9,2 kg → declarou 246 (ROLLBACK) ═══`)
  try {
    await prisma.$transaction(async (tx) => {
      const db = comRollback(tx)
      const esc = 200 / (await tx.stockFichaVersao.findFirstOrThrow({
        where: { companyId: EMPRESA, fichaId: ficha.id, versao: ficha.versaoAtual }, select: { loteBase: true },
      })).loteBase

      const semR = await criarOrdem({ companyId: EMPRESA, fichaId: ficha.id, escalaReceitas: esc, pedidoUnidades: 200, dataProducao: new Date(), userId: dono.id }, db)
      const comR = await criarOrdem({ companyId: EMPRESA, fichaId: ficha.id, escalaReceitas: esc, pedidoUnidades: 200, retalhoKg: 9.2, dataProducao: new Date(), userId: dono.id }, db)
      console.log(`  duas ordens de 200: sem retalho ${semR.ordemId} · com 9,2 kg ${comR.ordemId}`)

      /** ⭐⭐ A SEPARAÇÃO NÃO MUDA — a lei de 03/10 */
      const sa = await explodirSeparacao(EMPRESA, semR.ordemId, tx as unknown as PrismaClient)
      const sb = await explodirSeparacao(EMPRESA, comR.ordemId, tx as unknown as PrismaClient)
      const ma = sa.linhas.map((l) => `${l.nome}=${l.qtdPlanejada}`).join(' · ')
      const mb = sb.linhas.map((l) => `${l.nome}=${l.qtdPlanejada}`).join(' · ')
      console.log(`  separação SEM retalho: ${ma}`)
      console.log(`  separação COM retalho: ${mb}`)
      console.log(`  ⭐ IDÊNTICA: ${ma === mb ? 'SIM' : '⛔ MUDOU (defeito!)'}`)

      /** o consumo real = o do pedido (a cozinha tirou o material de 200) + declarou 246 */
      for (const o of [semR.ordemId, comR.ordemId]) {
        for (const l of sa.linhas) {
          if (l.qtdPlanejada <= 0) continue
          await tx.stockMovement.create({
            data: {
              companyId: EMPRESA, itemId: l.itemId, tipo: 'PRODUCAO_CONSUMO',
              quantidade: -l.qtdPlanejada, custoUnitario: l.custoMedio ?? 0,
              custoTotal: -(l.qtdPlanejada * (l.custoMedio ?? 0)), receiptId: o, origem: 'MANUAL',
            },
          })
        }
        await tx.stockProducaoConclusao.create({
          data: { companyId: EMPRESA, ordemId: o, qtdGerada: 246, escalaConsumida: esc, rendimento: 0, custoLoteReal: 0, custoUnitarioReal: 0 },
        })
        await tx.stockProductionOrder.update({ where: { id: o }, data: { estado: 'CONCLUIDA' } })
      }

      const fis = await fiscalDeOrdens(EMPRESA, [semR.ordemId, comR.ordemId], tx as unknown as PrismaClient)
      const fa = fis.get(semR.ordemId)!
      const fb = fis.get(comR.ordemId)!
      console.log(`  ⛔ SEM retalho: permitido ~${fa.permitido} · bônus ${fa.bonusDeRetalho} · impossível ${fa.impossivel}  ← o alarme FALSO`)
      console.log(`  ⭐ COM retalho: permitido ~${fb.permitido} · bônus ${fb.bonusDeRetalho} · impossível ${fb.impossivel}  ← CONFERE`)

      const fila = await filaDeConferencia(EMPRESA, tx as unknown as PrismaClient)
      const meu = fila.cartoes.filter((c) => [semR.ordemId, comR.ordemId].includes(c.ordemId))
      for (const c of meu) {
        const comRet = c.ordemId === comR.ordemId
        console.log(`  CARTÃO ${comRet ? '(com retalho)' : '(sem retalho) '}: declarou ${c.declaradoTxt} / ${c.esperadoTxt ? `~${c.esperadoTxt}` : `${c.pedidoTxt} ped.`} · ${c.fiscalOk === false ? `⚠ ${c.fiscalResumo}` : `✓ ${c.fiscalResumo}`}${c.retalhoKg ? ` · retalho ${c.retalhoKg} kg` : ''}`)
      }

      /** ⭐⭐ A ORDEM DA FILA: suspeitas primeiro */
      const ord = ordenarCartoes(fila.cartoes)
      console.log(`  ⭐ a fila ordenada: ${ord.slice(0, 5).map((c) => `${c.fiscalOk === false ? '⚠' : '·'}${c.minutosEsperando}min`).join(' ')}`)
      const primeiraOk = ord.findIndex((c) => c.fiscalOk !== false)
      const ultimaSusp = ord.map((c) => c.fiscalOk === false).lastIndexOf(true)
      console.log(`  ⛔ nenhuma suspeita DEPOIS de uma normal: ${ultimaSusp < 0 || primeiraOk < 0 || ultimaSusp < primeiraOk ? 'SIM ✓' : '⛔ FURADO'}`)

      /** ⚠️ e a sanidade: 25 kg avisa */
      await tx.stockOrdemRetalho.updateMany({ where: { companyId: EMPRESA, ordemId: comR.ordemId }, data: { kg: 25 } })
      const av = await produzirAvisosDeRetalho(EMPRESA, new Date(), tx as unknown as PrismaClient)
      console.log(`  ⚠️ com 25 kg → avisos gravados ${av.gravados} · recusados pela língua do balcão ${av.recusados.length}`)
      const a = await tx.aviso.findFirst({ where: { companyId: EMPRESA, origem: 'RETALHO_ALTO' }, select: { setor: true, severidade: true, titulo: true, corpo: true } })
      if (a) console.log(`     [${a.setor} · ${a.severidade}] ${a.titulo}\n     ${a.corpo}`)

      throw new Volta()
    })
  } catch (e) { if (!(e instanceof Volta)) throw e }

  // ──────────────── 5. A TRAVA DO SERVIDOR (pela ROTA, e ela RECUSA) ────────────────
  console.log(`\n═══ 5. A TRAVA — retalho em receita NÃO marcada, pela rota real ═══`)
  if (outra) {
    const r = await fetch(`${base}/api/empresas/${EMPRESA}/estoque/producao/ordens`, {
      method: 'POST', headers: { cookie: ck, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fichaId: outra.id, escalaReceitas: 1, dataProducao: new Date().toISOString().slice(0, 10), retalhoKg: 5 }),
    })
    console.log(`  HTTP ${r.status} ${r.status === 422 ? '⭐ RECUSADO' : '⛔ ACEITOU (defeito!)'} · ${(await r.text()).slice(0, 170)}`)
  }

  // ──────────────── 6. AS TELAS, NOS DOIS VIEWPORTS ────────────────
  console.log(`\n═══ 6. AS TELAS — celular e desktop (REGRA 12) ═══`)
  const PECAS = [
    ['a pergunta do retalho', 'Tem retalho de ontem?'],
    ['o lembrete da última vez', 'da última vez:'],
    ['a frase curta', 'no total'],
    ['a separação não muda, e a tela diz', 'o material que sai da câmara'],
    ['a assinatura, UMA linha no cabeçalho', 'assina no teu nome'],
    ['o botão de dedo', 'h-[42px] w-[42px]'],
    ['o aria-label do ✓', 'conferir '],
    ['o veredito curto', 'sem material'],
  ] as const

  for (const [rotulo, ua] of [['CELULAR', CELULAR], ['DESKTOP', DESKTOP]] as const) {
    const t0 = Date.now()
    const r = await fetch(`${base}/empresas/${EMPRESA}/estoque/producao`, { headers: { cookie: ck, 'user-agent': ua } })
    const html = await r.text()
    const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map((m) => m[0]))]
    let js = ''
    for (const c of chunks) js += await (await fetch(base + c, { headers: { cookie: ck } })).text()
    console.log(`\n  ${rotulo} /estoque/producao → HTTP ${r.status} em ${Date.now() - t0}ms · ${(js.length / 1024).toFixed(0)} KB`)
    for (const [nome, frase] of PECAS) console.log(`    ${js.includes(frase) || html.includes(frase) ? '✓' : '⛔'} ${nome}`)
    /** ⛔⛔ a FRASE LONGA do fiscal não pode estar no cartão (a REGRA 11 do dono) */
    const longa = ['a receita permite', 'limitado por'].filter((k) => js.includes(k))
    console.log(`    ${longa.length ? `⚠️ frases longas no bundle: ${longa.join(' · ')} (a casa delas é a página da ordem)` : '⭐ nenhuma frase longa de fiscal no bundle'}`)
  }

  // ──────────────── 7. NADA GRAVADO + INVARIANTES ────────────────
  const depois = {
    ordens: await prisma.stockProductionOrder.count({ where: { companyId: EMPRESA } }),
    retalhos: await prisma.stockOrdemRetalho.count({ where: { companyId: EMPRESA } }),
    movimentos: await prisma.stockMovement.count({ where: { companyId: EMPRESA } }),
    conclusoes: await prisma.stockProducaoConclusao.count({ where: { companyId: EMPRESA } }),
    avisos: await prisma.aviso.count({ where: { companyId: EMPRESA } }),
    cfgRetalho: await prisma.stockFichaRetalho.count({ where: { companyId: EMPRESA } }),
  }
  console.log('\nESTADO DEPOIS:', JSON.stringify(depois))
  console.log(JSON.stringify(antes) === JSON.stringify(depois) ? '⭐ ZERO ESCRITA — o rollback valeu' : '⛔ ALGO FOI GRAVADO')

  const pDepois = await checkProducaoInvariants(prisma)
  console.log('INVARIANTES P DEPOIS:', JSON.stringify(porCodigo(pDepois)))
  console.log(JSON.stringify(porCodigo(pAntes)) === JSON.stringify(porCodigo(pDepois))
    ? '⭐ P1-P8 IDÊNTICOS — o retalho não tocou invariante nenhum'
    : '⛔ INVARIANTE SE MOVEU')
  await prisma.$disconnect()
}

main().catch((e) => { console.error('[prova] erro:', e instanceof Error ? e.message : e); process.exit(1) })
