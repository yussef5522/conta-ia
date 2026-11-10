// SUITAPI — A GUARDA (substitui scripts/suit-prova-sombra.ts, aposentado).
//   --batimento      cron a cada 5 min: o laço parou há > 15 min → aviso pro dono (sem API)
//   --dia AAAA-MM-DD na mão: a guarda (a/b/c) de um dia, gravando em suit-guarda.state
// ⛔ Só GET na API (porta única). A guarda na mão toma a MESMA trava do laço.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { exigirEmpresaNesteBanco } from '../lib/scripts/prova-banco'
import { criarClienteSuitLeitura } from '../lib/suit/cliente-leitura'
import { guardarDia, linhaDoState, verificarBatimento } from '../lib/suit/guarda'
import { mesclarState } from '../lib/suit/regua-sombra'
import { tentarTravar, soltar } from '../lib/suit/trava-arquivo'

const CACULA = 'cmq17yapb00gnrndlh33sctbo'
const DIR = process.env.SUIT_STATE_DIR ?? '/var/lib/conta-ia'
const BATIMENTO = `${DIR}/suit-sync.batimento`
const STATE_GUARDA = `${DIR}/suit-guarda.state`
const TRAVA = `${DIR}/suit.lock`
const ler = (c: string) => { try { return readFileSync(c, 'utf8') } catch { return '' } }

function nomeDoErro(e: unknown): string {
  const n = (e as Error)?.name ?? 'erro'
  return ['SuitErro', 'SuitEscritaVetadaError', 'BancoErradoError', 'AvisoMudoError'].includes(n) ? `${n}: ${(e as Error).message}` : `${n} (mensagem suprimida)`
}

async function main() {
  const args = process.argv.slice(2)
  const db = new PrismaClient({ log: [] })
  try {
    await exigirEmpresaNesteBanco(db, CACULA)
    if (args.includes('--batimento')) {
      const txt = ler(BATIMENTO).trim()
      const ultimo = txt ? new Date(txt) : null
      const r = await verificarBatimento(db, CACULA, ultimo && !Number.isNaN(ultimo.getTime()) ? ultimo : null, new Date())
      if (r === 'PARADO') console.log(`[suit-guarda ${new Date().toISOString()}] batimento PARADO (último: ${txt || 'nunca'}) → aviso`)
      return
    }
    const i = args.indexOf('--dia')
    const dia = i >= 0 ? args[i + 1] : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw Object.assign(new Error('use --dia AAAA-MM-DD ou --batimento'), { name: 'SuitErro' })
    if (!tentarTravar(TRAVA)) throw Object.assign(new Error('o laço está no meio de um ciclo — rode de novo em 1 min'), { name: 'SuitErro' })
    try {
      const r = await guardarDia(db, criarClienteSuitLeitura(), CACULA, dia, new Date())
      const linha = linhaDoState(r)
      mkdirSync(dirname(STATE_GUARDA), { recursive: true })
      writeFileSync(`${STATE_GUARDA}.tmp`, mesclarState(ler(STATE_GUARDA), linha), { mode: 0o644 })
      renameSync(`${STATE_GUARDA}.tmp`, STATE_GUARDA)
      console.log(linha)
      console.log(`requisições: ${r.requisicoes}`)
    } finally {
      soltar(TRAVA)
    }
  } finally {
    await db.$disconnect()
  }
}

main().catch((e) => {
  console.error(`[suit-guarda] ${nomeDoErro(e)}`)
  process.exit(1)
})
