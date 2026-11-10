// SUITAPI — PROVA-SOMBRA diária (SÓ LEITURA: GET na API + SELECT no banco; zero escrita no banco).
// Pra cada dia D: reconstrói un + R$ por produto pelos details da API (régua em
// lib/suit/regua-sombra.ts) e compara com o import XLS de D. Grava UMA linha por dia em
// /var/lib/conta-ia/suit-prova-semana.state:  "D BATE ..." | "D DIVERGE ..." | "D AGUARDANDO-XLS" | "D ERRO-..."
//
// Cron (manhã):  npx tsx scripts/suit-prova-sombra.ts            → os 3 dias mais recentes sem veredito
// Manual:        npx tsx scripts/suit-prova-sombra.ts --dia 2026-11-08 [--dia ...]
// Combinado com o dono: 7 BATE seguidos → bloco da troca de fonte (XLS → API).

import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { exigirEmpresaNesteBanco, BancoErradoError } from '../lib/scripts/prova-banco'
import { criarClienteSuitLeitura, SuitErro } from '../lib/suit/cliente-leitura'
import {
  agregarApi, agregarXls, veredito, lerState, mesclarState, diasPendentes, sequenciaBate, somarDias,
} from '../lib/suit/regua-sombra'

const CACULA = 'cmq17yapb00gnrndlh33sctbo' // a loja da credencial SuitAPI (provado: 07/11 bateu ao centavo)
const INICIO_PROVA = '2026-11-08' // a semana da prova-sombra começa aqui (decisão do dono)
const STATE = process.env.SUIT_PROVA_STATE ?? '/var/lib/conta-ia/suit-prova-semana.state'

function agoraBrasil(): string {
  // "YYYY-MM-DDTHH:mm:ss" no fuso de São Paulo — só pra escolher QUAIS dias olhar
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  )
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`
}

function lerArquivo(caminho: string): string {
  try { return readFileSync(caminho, 'utf8') } catch { return '' }
}

function gravarLinha(linha: string) {
  mkdirSync(dirname(STATE), { recursive: true })
  const tmp = `${STATE}.tmp`
  writeFileSync(tmp, mesclarState(lerArquivo(STATE), linha), { mode: 0o644 })
  renameSync(tmp, STATE) // atômico: o state nunca fica pela metade
}

async function xlsDoDia(db: PrismaClient, dia: string) {
  // o import guarda `data` como meio-dia do dia (15:00Z); a janela é o DIA DO BRASIL inteiro
  const imps = await db.stockVendaImport.findMany({
    where: {
      companyId: CACULA, status: 'CONFIRMADO',
      data: { gte: new Date(`${dia}T03:00:00Z`), lt: new Date(`${somarDias(dia, 1)}T03:00:00Z`) },
    },
    select: { id: true },
  })
  if (imps.length === 0) return null
  if (imps.length > 1) throw new Error(`XLS-DUPLO: ${imps.length} imports confirmados no dia`)
  return db.stockVendaLinha.findMany({
    where: { companyId: CACULA, importId: imps[0].id },
    select: { nomeSuitable: true, quantidade: true, valorTotal: true },
  })
}

async function main() {
  const args = process.argv.slice(2)
  const manuais = args.flatMap((a, i) => (a === '--dia' && args[i + 1] ? [args[i + 1]] : []))
  const agora = agoraBrasil()
  const dias = manuais.length ? manuais : diasPendentes(lerState(lerArquivo(STATE)), agora, INICIO_PROVA, 3)
  console.log(`[suit-sombra ${agora}] dias: ${dias.join(', ') || '(nenhum pendente)'}`)
  if (dias.length === 0) return

  const db = new PrismaClient({ log: [] })
  try {
    await exigirEmpresaNesteBanco(db, CACULA)
    const suit = criarClienteSuitLeitura()
    for (const dia of dias) {
      const t0 = Date.now()
      let linha: string
      const xls = await xlsDoDia(db, dia).catch((e: Error) => {
        if (e.message.startsWith('XLS-DUPLO')) return e
        throw e
      })
      if (xls instanceof Error) {
        linha = `${dia} ERRO-XLS ${xls.message}`
      } else if (xls === null) {
        linha = `${dia} AGUARDANDO-XLS`
      } else {
        try {
          const pedidos = await suit.pedidosDoDia(dia)
          linha = veredito(dia, agregarApi(pedidos), agregarXls(xls))
        } catch (e) {
          // ERRO não é veredito: o cron tenta de novo amanhã. Só a mensagem do SuitErro (sem segredo).
          linha = `${dia} ERRO-API ${e instanceof SuitErro ? e.message : (e as Error).name}`
        }
      }
      gravarLinha(linha)
      console.log(`  ${linha}  (${Math.round((Date.now() - t0) / 1000)}s)`)
    }
    console.log(`  requisições: ${suit.requisicoes()} · BATE seguidos: ${sequenciaBate(lerState(lerArquivo(STATE)))}/7`)
  } finally {
    await db.$disconnect()
  }
}

// ⛔ o catch NÃO imprime a mensagem crua: exceção do Prisma vaza a URI do banco com a senha
main().catch((e) => {
  if (e instanceof BancoErradoError || e instanceof SuitErro) console.error(`[suit-sombra] ${e.message}`)
  else console.error(`[suit-sombra] erro: ${(e as Error)?.name ?? 'desconhecido'} (mensagem suprimida)`)
  process.exit(1)
})
