// ⭐⭐ O RETROATIVO DO TABLET — E A BOA NOTÍCIA É QUE ELE NÃO GRAVA NADA (08/09/2026).
//
// **O PEDIDO DO DONO:** *"e o retroativo pra Carlise (destravar o estado dela agora, com
// preview)"*.
//
// ⭐⭐ **NÃO HÁ CIRURGIA DE DADO A FAZER, e este script existe pra PROVAR isso** em vez de eu
// afirmar. O estado da etapa dela **sempre esteve certo** no banco: a ordem está CONCLUIDA e o
// encerramento está registrado em `stock_etapa_encerrada` — a derivação única já respondia
// `ENCERRADA_SEM_FINALIZAR` antes de eu tocar em qualquer linha. **Quem mentia era o LEITOR**,
// e leitor se conserta com deploy, não com UPDATE.
//
// ⛔ Escrever aqui seria pior que inútil: carimbar `finalizadoEm` pra "destravar" inventaria
// um horário que ninguém mediu e jogaria tempo falso dentro das médias — exatamente o que o
// NULL existe pra impedir. O retroativo certo é o código novo, e a prova é este relatório.
//
// ⚠️ READ-ONLY de verdade: nenhuma escrita, nenhuma transação. Roda no SERVIDOR (REGRA 8b —
// medir isso no SQLite do Mac devolveria zero em silêncio e eu concluiria o contrário).
//
//   npx tsx scripts/destravar-tablet-preview.ts

import { prisma } from '@/lib/db'
import { exigirEmpresaNesteBanco } from '@/lib/scripts/prova-banco'
import { etapasEmAndamentoDoColaborador } from '@/lib/stock/producao/em-andamento'

const COMPANY_ID = 'cmq17yapb00gnrndlh33sctbo' // Caçula Mix — REGRA 8: por ID, nunca por nome

async function main() {
  await exigirEmpresaNesteBanco(prisma, COMPANY_ID)

  const pessoas = await prisma.stockColaborador.findMany({
    where: { companyId: COMPANY_ID, ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })

  console.log(`\n${pessoas.length} pessoa(s) ativa(s) na equipe.\n`)
  console.log('quem estaria TRANCADO pela régua CRUA × quem está ocupado DE VERDADE:\n')

  let destravados = 0
  for (const p of pessoas) {
    // ⛔ a régua velha do tablet — a que produziu a mensagem que trancou a Carlise
    const pelaColuna = await prisma.stockOrdemEtapa.findMany({
      where: {
        companyId: COMPANY_ID, executorId: p.id,
        iniciadoEm: { not: null }, finalizadoEm: null,
      },
      select: { id: true, nome: true, iniciadoEm: true },
    })
    // ⭐ a derivação única — a resposta certa
    const deVerdade = await etapasEmAndamentoDoColaborador(COMPANY_ID, p.id, prisma)

    const trancava = pelaColuna.length > 0 && deVerdade.length === 0
    if (trancava) destravados++

    const marca = trancava ? '⭐ DESTRAVA' : deVerdade.length ? '   ocupada ' : '   livre   '
    console.log(`${marca} ${p.nome.padEnd(18)} régua crua: ${pelaColuna.length}  ·  de verdade: ${deVerdade.length}`)

    if (trancava) {
      for (const e of pelaColuna) {
        const enc = await prisma.stockEtapaEncerrada.findFirst({
          where: { companyId: COMPANY_ID, etapaId: e.id }, select: { motivo: true },
        })
        const ger = await prisma.stockEtapaFinalizadaGerente.findFirst({
          where: { companyId: COMPANY_ID, etapaId: e.id }, select: { id: true },
        })
        const porque = ger ? 'FINALIZADA_PELO_GERENTE' : enc ? `ENCERRADA_SEM_FINALIZAR (${enc.motivo})` : '⚠️ SEM RASTRO'
        console.log(`            └─ “${e.nome}” de ${e.iniciadoEm?.toISOString().slice(0, 16)} → ${porque}`)
      }
    }
    if (deVerdade.length) {
      for (const e of deVerdade) console.log(`            └─ “${e.nome}” está mesmo em andamento — continua travando, e é o certo`)
    }
  }

  console.log(`\n⭐ ${destravados} pessoa(s) destravada(s) pelo deploy — sem uma linha escrita no banco.`)
  console.log('⛔ nenhuma escrita foi feita: o estado já estava certo; quem mentia era o leitor.\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
