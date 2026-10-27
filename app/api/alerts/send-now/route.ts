// Sprint 4.0.4 — endpoint manual pra disparar runAlertsJob.
// FASE 0 PASSO 6 (26/10/2026) — O FURO FECHADO.
//
// ⛔⛔ O QUE ESTE ENDPOINT FAZ, medido antes de escrever a trava: `runAlertsJob`
// busca `prisma.user.findMany({ where: { emailAlertsEnabled: true } })` — ou seja,
// ele varre os usuários da PLATAFORMA INTEIRA e dispara e-mail pra cada um. Não há
// filtro por empresa nem por quem pediu.
//
// ⛔ ATÉ HOJE ELE ACEITAVA QUALQUER LOGADO. O comentário aqui dizia "só ADMIN do
// gerenciador pode chamar" — e descrevia uma trava QUE NÃO EXISTIA: o corpo da
// função tinha, escrito, "Pra MVP: aceita qualquer user logado (smoke test)".
// Comentário que promete ser a trava sem ser a trava é pior que comentário nenhum.
//
// ⭐ A TRAVA É O PADRÃO (B) DA CASA (o mesmo de app/api/admin/asaas/health):
//   getAdminSession() → loadGerenciador(session.gerenciadorId) → papel.
//
// ⚠️ POR QUE SEM SESSÃO ADMIN É 403 E NÃO 401 (divergência deliberada do padrão B,
// com o motivo escrito): nas rotas de `/api/admin/*` a ausência de sessão significa
// "não está logado no painel", e ali 401 é honesto. ESTA rota é alcançável de
// `app.caixaos.com.br` por um usuário comum logado — o cookie `admin_session` é
// `domain: admin.caixaos.com.br` (getAdminCookieOptions), então ele simplesmente
// não chega aqui. Responder 401 a quem está com a sessão ótima diria "sua sessão
// expirou", mandando o dono caçar um problema de login que não existe. 403 diz a
// verdade: você está autenticado, este gesto não é seu.
//
// ⚠️ E GERENCIADOR INATIVO CONTINUA 401 (padrão B intacto): ali o JWT é válido mas
// a conta foi suspensa — a sessão é que deixou de valer.
//
// ⭐ QUALQUER GERENCIADOR ATIVO PASSA (OPERADOR incluído), e não só OWNER:
// disparar este job manualmente envia EXATAMENTE os e-mails que o cron das 08:00
// já envia — é operação de rotina, não configuração. O `role !== 'OWNER'` de
// `/admin/asaas/*` existe porque lá se toca em CREDENCIAL DE PAGAMENTO, que é
// outra coisa. ⚠️ Se o dono quiser estreitar pra OWNER, é uma linha (trocar o
// `ativo` pelo check de papel abaixo).
//
// Body opcional: { dryRun?: boolean, force?: boolean, baseUrl?: string }

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleApiError } from '@/lib/api/handle-error'
import { runAlertsJob } from '@/lib/email/alerts-job'
import { getAdminSession, loadGerenciador } from '@/lib/admin-auth/session'

const bodySchema = z.object({
  dryRun: z.boolean().optional(),
  force: z.boolean().optional(),
  baseUrl: z.string().url().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession()
    if (!session) {
      return NextResponse.json(
        {
          erro:
            'Este disparo é do painel administrativo — ele envia e-mail pra todos os ' +
            'usuários da plataforma. Entre em admin.caixaos.com.br pra usá-lo.',
          code: 'FORBIDDEN_RBAC',
        },
        { status: 403 },
      )
    }

    // ⚠️ Fresco do banco, nunca do JWT: protege o caso "gerenciador suspenso com
    // token ainda válido" (a razão de existir do loadGerenciador).
    const gerenciador = await loadGerenciador(session.gerenciadorId)
    if (!gerenciador || !gerenciador.active) {
      return NextResponse.json({ erro: 'Gerenciador inativo' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const opts = bodySchema.parse(body)

    const result = await runAlertsJob(opts)
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    return handleApiError(error)
  }
}
