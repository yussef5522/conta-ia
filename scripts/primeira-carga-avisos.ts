/**
 * ⭐⭐⭐ A PRIMEIRA CARGA DA CENTRAL DE AVISOS (04/10/2026).
 *
 * **Ordem do dono:** *"os achados vivos de hoje viram avisos — pra a central nascer útil, não
 * vazia."*
 *
 * ⛔⛔ **ESTE SCRIPT NÃO TRADUZ NADA: ele RODA O PRODUTOR.** A tentação era escrever as frases
 * dos achados de hoje aqui (CHEDDAR, frango frito, ordem parada) — e isso criaria **duas
 * verdades**: o texto da carga e o texto do cron de amanhã, que divergiriam no primeiro ajuste.
 * É a doença dos 7 detectores de par em forma de alarme. **A primeira carga é o produtor
 * rodando uma vez.**
 *
 * ⚠️ PREVIEW por padrão (`--aplicar` grava), e **REGRA 8b**: prova contra qual banco está antes
 * de medir — `findMany` num banco que não conhece a empresa devolve lista vazia sem erro, e
 * *zero silencioso é indistinguível de "não tem"* (o erro que quase me fez reportar
 * "os 4 mapeamentos sumiram" em 02/09).
 *
 * USO:
 *   npx tsx scripts/primeira-carga-avisos.ts --empresa=<companyId>            # preview
 *   npx tsx scripts/primeira-carga-avisos.ts --empresa=<companyId> --aplicar  # grava
 */
import { prisma } from '../lib/db'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { produzirAvisosDeProducao } from '../lib/avisos/produtores/producao'
import { avisosAbertos } from '../lib/avisos/central'
import { ROTULO_DO_SETOR } from '../lib/avisos/tipos'

async function main() {
  const args = process.argv.slice(2)
  const empresaId = args.find((a) => a.startsWith('--empresa='))?.split('=')[1]
  const aplicar = args.includes('--aplicar')

  if (!empresaId) {
    console.error('⛔ falta --empresa=<companyId>')
    process.exit(1)
  }

  /** ⛔ REGRA 8b — e ele IMPRIME contra qual banco mediu */
  const nome = await exigirEmpresaNesteBanco(prisma, empresaId)
  console.log(`\n⭐ empresa: ${nome} (${empresaId})`)

  const antes = await avisosAbertos(empresaId)
  console.log(`avisos em aberto ANTES: ${antes.length}`)

  if (!aplicar) {
    /**
     * ⚠️ O preview roda o produtor numa TRANSAÇÃO que é DESFEITA no fim — é o único jeito
     * honesto de prever o texto exato que vai pra tela sem reimplementar o produtor (que é
     * justamente o que este script existe pra não fazer).
     */
    console.log('\n── PREVIEW (nada gravado) ──')
    try {
      await prisma.$transaction(async (tx) => {
        /** ⛔ o client TRANSACIONAL vai pro produtor: com o global, as escritas sairiam FORA da
         *  transação e este "preview" gravaria de verdade. */
        const r = await produzirAvisosDeProducao(empresaId, tx)
        const depois = await avisosAbertos(empresaId, tx)
        console.log(`gravaria ${r.gravados} · reabriria ${r.reabertos} · resolveria ${r.resolvidos}`)
        for (const x of r.recusados) console.log(`  ⛔ RECUSADO pela lei do balcão: ${x.motivo} — "${x.titulo}"`)
        console.log(`\nA CENTRAL FICARIA COM ${depois.length} AVISO(S):`)
        for (const a of depois) {
          console.log(`\n  [${a.severidade}] ${ROTULO_DO_SETOR[a.setor]} · ${a.origem}/${a.alvo}`)
          console.log(`  ${a.titulo}`)
          console.log(`  ${a.corpo}`)
          console.log(`  O que fazer: ${a.oQueFazer}`)
          if (a.acaoRotulo) console.log(`  [${a.acaoRotulo}] → ${a.acaoHref}`)
        }
        throw new Error('__ROLLBACK_DO_PREVIEW__')
      })
    } catch (e) {
      if (!(e instanceof Error) || e.message !== '__ROLLBACK_DO_PREVIEW__') throw e
      console.log('\n⭐ rollback feito — NADA foi gravado. Rode com --aplicar pra valer.')
    }
    const conferir = await avisosAbertos(empresaId)
    console.log(`avisos em aberto DEPOIS do preview: ${conferir.length} (tem que ser ${antes.length})`)
    return
  }

  console.log('\n── APLICANDO ──')
  const r = await produzirAvisosDeProducao(empresaId)
  const depois = await avisosAbertos(empresaId)
  console.log(`gravados ${r.gravados} · reabertos ${r.reabertos} · resolvidos ${r.resolvidos}`)
  for (const x of r.recusados) console.log(`  ⛔ RECUSADO: ${x.motivo} — "${x.titulo}"`)
  console.log(`\nA CENTRAL TEM AGORA ${depois.length} AVISO(S):`)
  for (const a of depois) {
    console.log(`  [${a.severidade}] ${ROTULO_DO_SETOR[a.setor]} · ${a.titulo}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
