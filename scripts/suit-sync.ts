// SUITAPI — O LAÇO (serviço pm2 `conta-ia-suit-sync`). A cada 2 min: espelha a Suit (só GET),
// fecha o dia às 03:10 BRT pela esteira de sempre e roda a guarda da manhã (07h BRT) pra D-1.
//
//   pm2 start "npx tsx scripts/suit-sync.ts" --name conta-ia-suit-sync --cwd /opt/conta-ia \
//       --output /var/log/conta-ia-suit-sync.log --error /var/log/conta-ia-suit-sync.log
//
// Batimento: /var/lib/conta-ia/suit-sync.batimento (ISO do último ciclo bom) — o cron
// `suit-guarda.ts --batimento` (a cada 5 min) avisa o dono se passar de 15 min.
// State da guarda: /var/lib/conta-ia/suit-guarda.state (uma linha por dia).
// ⛔ O catch NUNCA imprime mensagem crua (exceção do Prisma vaza a URI do banco com a senha).

import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { exigirEmpresaNesteBanco, BancoErradoError } from '../lib/scripts/prova-banco'
import { criarClienteSuitLeitura, SuitErro, SuitEscritaVetadaError } from '../lib/suit/cliente-leitura'
import { cicloDoLaco } from '../lib/suit/laco'
import { linhaDoState } from '../lib/suit/guarda'
import { exigirFusoDaCasa, DiaAbertoError, DiaForaDoCorteError, DiaJaTemImportError } from '../lib/suit/materializar'
import { lerState, mesclarState } from '../lib/suit/regua-sombra'
import { tentarTravar, soltar } from '../lib/suit/trava-arquivo'

const CACULA = 'cmq17yapb00gnrndlh33sctbo' // a loja da credencial SuitAPI
const INTERVALO_MS = 2 * 60_000
const DIR = process.env.SUIT_STATE_DIR ?? '/var/lib/conta-ia'
export const BATIMENTO = `${DIR}/suit-sync.batimento`
export const STATE_GUARDA = `${DIR}/suit-guarda.state`
export const TRAVA = `${DIR}/suit.lock`

const ler = (c: string) => { try { return readFileSync(c, 'utf8') } catch { return '' } }
function gravarAtomico(caminho: string, conteudo: string) {
  mkdirSync(dirname(caminho), { recursive: true })
  writeFileSync(`${caminho}.tmp`, conteudo, { mode: 0o644 })
  renameSync(`${caminho}.tmp`, caminho)
}
export function nomeDoErro(e: unknown): string {
  if (e instanceof SuitErro || e instanceof SuitEscritaVetadaError || e instanceof BancoErradoError ||
      e instanceof DiaAbertoError || e instanceof DiaForaDoCorteError || e instanceof DiaJaTemImportError) return `${e.name}: ${e.message}`
  return `${(e as Error)?.name ?? 'erro'} (mensagem suprimida)`
}
const agoraTxt = () => new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' })

async function main() {
  exigirFusoDaCasa()
  const db = new PrismaClient({ log: [] })
  await exigirEmpresaNesteBanco(db, CACULA)
  const cliente = criarClienteSuitLeitura()
  console.log(`[suit-sync ${agoraTxt()}] laço ligado · ciclo ${INTERVALO_MS / 1000}s · pid ${process.pid}`)
  let parar = false
  // ⚠️ o mesmo resultado de fechamento a cada 2 min é ruído: loga só quando MUDA
  const ultimoFechamento = new Map<string, string>()
  process.on('SIGINT', () => { parar = true })
  process.on('SIGTERM', () => { parar = true })
  while (!parar) {
    const t0 = Date.now()
    if (!tentarTravar(TRAVA)) {
      console.log(`[suit-sync ${agoraTxt()}] trava ocupada (guarda na mão?) — pulo este ciclo`)
    } else {
      try {
        const r0 = cliente.requisicoes()
        const c = await cicloDoLaco(db, cliente, CACULA, new Date(), (dia) => !!lerState(ler(STATE_GUARDA)).get(dia), nomeDoErro)
        for (const f of c.complementos) {
          const txt = JSON.stringify(f.resultado)
          if (ultimoFechamento.get(`c:${f.dia}`) !== txt) console.log(`[suit-sync ${agoraTxt()}] COMPLEMENTOS ${f.dia} → ${txt}`)
          ultimoFechamento.set(`c:${f.dia}`, txt)
        }
        for (const f of c.fechados) {
          const txt = JSON.stringify(f.resultado)
          if (ultimoFechamento.get(f.dia) !== txt) console.log(`[suit-sync ${agoraTxt()}] FECHAMENTO ${f.dia} → ${txt}`)
          ultimoFechamento.set(f.dia, txt)
        }
        if (c.guarda) {
          const linha = linhaDoState(c.guarda)
          gravarAtomico(STATE_GUARDA, mesclarState(ler(STATE_GUARDA), linha))
          console.log(`[suit-sync ${agoraTxt()}] GUARDA ${linha}`)
        }
        const v = c.vivo
        if (v.novos || v.atualizados || v.sumidos) console.log(`[suit-sync ${agoraTxt()}] vivo: ${v.listados} listados · +${v.novos} novos · ${v.atualizados} mudaram · ${v.sumidos} sumiram · ${cliente.requisicoes() - r0} req`)
        gravarAtomico(BATIMENTO, new Date().toISOString() + '\n')
      } catch (e) {
        console.error(`[suit-sync ${agoraTxt()}] ciclo falhou: ${nomeDoErro(e)}`)
        if (e instanceof SuitEscritaVetadaError) { soltar(TRAVA); throw e } // ⛔ tentativa de escrita derruba o serviço
      } finally {
        soltar(TRAVA)
      }
    }
    const espera = Math.max(5_000, INTERVALO_MS - (Date.now() - t0))
    for (let t = 0; t < espera && !parar; t += 1000) await new Promise((r) => setTimeout(r, 1000))
  }
  await db.$disconnect()
  console.log(`[suit-sync ${agoraTxt()}] laço desligado`)
}

main().catch((e) => {
  console.error(`[suit-sync] parou: ${nomeDoErro(e)}`)
  process.exit(1)
})
