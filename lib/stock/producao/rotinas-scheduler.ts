// ⭐⭐ R25 — O DISPARO DO VIRAR DO DIA (13/11/2026). 00:01 de Brasília, todo dia: semeia as rotinas
// de hoje em todas as empresas. ⚠️ É UM dos dois disparos: se este falhar (app reiniciando à
// meia-noite), a primeira leitura do dia semeia (`garantirSemeaduraDeHoje` nas rotas da Janela, do
// Painel, do Ao vivo e das Rotinas). A idempotência mora no índice único (rotinaId, dia) — os dois
// disparos podem rodar juntos sem duplicar.
// PM2 fork (1 instância), como o agendador de recorrência.
import cron from 'node-cron'
import { semearHojeEmTodas } from './rotinas-do-banco'

export const CRON_DAS_ROTINAS = '1 0 * * *'
const TZ = 'America/Sao_Paulo'
let started = false

export function startRotinasScheduler() {
  if (started) return
  started = true
  cron.schedule(CRON_DAS_ROTINAS, async () => {
    try {
      const r = await semearHojeEmTodas(new Date())
      console.log(`[Rotinas] semeadura do dia: ${r.criadas} tarefas em ${r.empresas} empresas`)
    } catch (e) {
      // ⛔ nunca a mensagem inteira (a exceção do Prisma pode carregar a URI do banco)
      console.error('[Rotinas] semeadura do dia FALHOU:', (e as Error)?.name)
    }
  }, { timezone: TZ })
  console.log(`[Rotinas] agendador iniciado — cron="${CRON_DAS_ROTINAS}" tz="${TZ}"`)
}
