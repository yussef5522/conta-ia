// FASE 0 PASSO 6 (26/10/2026) — O FURO DO E-MAIL.
//
// ⛔⛔ O DEFEITO: `POST /api/alerts/send-now` aceitava QUALQUER usuário logado e
// disparava `runAlertsJob`, que varre `user.findMany({ emailAlertsEnabled: true })`
// — os usuários da PLATAFORMA INTEIRA. Qualquer cliente podia mandar e-mail pra
// todos os outros clientes.
//
// ⭐ REGRA 3 — este teste EXECUTA o handler real contra o mock da sessão. Grep no
// fonte não distingue "a trava existe" de "a trava está escrita num comentário",
// e era exatamente um comentário mentiroso que guardava esta rota até hoje
// ("Restrição: só ADMIN do gerenciador pode chamar", com o corpo aceitando todos).
//
// ⭐⭐ E A ASSERÇÃO QUE IMPORTA NÃO É O STATUS — É `runAlertsJob` NÃO TER SIDO
// CHAMADO. Um 403 depois de o e-mail já ter saído seria o pior dos mundos: a
// recusa na tela e a enxurrada na caixa de todo mundo.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mockSession = vi.fn()
const mockLoadGerenciador = vi.fn()
const mockRunAlertsJob = vi.fn()

vi.mock('@/lib/admin-auth/session', () => ({
  getAdminSession: () => mockSession(),
  loadGerenciador: (id: string) => mockLoadGerenciador(id),
}))

vi.mock('@/lib/email/alerts-job', () => ({
  runAlertsJob: (opts: unknown) => mockRunAlertsJob(opts),
}))

// importação tardia pra pegar os mocks
const { POST } = await import('@/app/api/alerts/send-now/route')

function pedido(body: unknown = { force: true, dryRun: false }) {
  return new NextRequest('http://localhost/api/alerts/send-now', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const OWNER = { id: 'g1', email: 'dono@caixaos.com.br', name: 'Yussef', role: 'OWNER' }
const SESSAO = { gerenciadorId: 'g1', email: OWNER.email, name: OWNER.name, role: 'OWNER' }

beforeEach(() => {
  vi.clearAllMocks()
  mockRunAlertsJob.mockResolvedValue({ emailsSent: 0, emailsSkippedNoData: 0 })
})

describe('POST /api/alerts/send-now — exige papel de administrador', () => {
  // ⭐⭐ O RED-THEN-GREEN DO DONO: "sem papel → 403".
  it('SEM sessão de admin → 403, e NADA é enviado', async () => {
    mockSession.mockResolvedValue(null)

    const res = await POST(pedido())
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.code).toBe('FORBIDDEN_RBAC')
    // ⛔ a prova que vale: o job NEM FOI CHAMADO
    expect(mockRunAlertsJob).not.toHaveBeenCalled()
  })

  // ⚠️ É 403 e não 401 DE PROPÓSITO: quem bate aqui de app.caixaos.com.br é um
  // usuário comum LOGADO (o cookie admin_session é domain-scoped pro admin.*).
  // 401 diria "sua sessão expirou" a quem está com a sessão ótima, mandando o dono
  // caçar um problema de login que não existe.
  it('a recusa NÃO é 401 (o usuário está logado; o que falta é o PAPEL)', async () => {
    mockSession.mockResolvedValue(null)
    const res = await POST(pedido())
    expect(res.status).not.toBe(401)
  })

  it('a recusa ENSINA onde o gesto mora, em vez de só negar', async () => {
    mockSession.mockResolvedValue(null)
    const body = await (await POST(pedido())).json()
    expect(body.erro).toContain('admin.caixaos.com.br')
    expect(body.erro).toContain('todos os usuários')
  })

  // ⚠️ A trava do gerenciador SUSPENSO com JWT ainda válido — é por isso que a
  // rota lê o gerenciador FRESCO do banco em vez de confiar no token.
  it('sessão válida com gerenciador INATIVO → 401, e nada é enviado', async () => {
    mockSession.mockResolvedValue(SESSAO)
    mockLoadGerenciador.mockResolvedValue({ ...OWNER, active: false })

    const res = await POST(pedido())

    expect(res.status).toBe(401)
    expect(mockRunAlertsJob).not.toHaveBeenCalled()
  })

  it('gerenciador que SUMIU do banco → 401, e nada é enviado', async () => {
    mockSession.mockResolvedValue(SESSAO)
    mockLoadGerenciador.mockResolvedValue(null)

    const res = await POST(pedido())

    expect(res.status).toBe(401)
    expect(mockRunAlertsJob).not.toHaveBeenCalled()
  })

  it('⭐ GREEN — gerenciador ATIVO dispara, e as opções chegam no job', async () => {
    mockSession.mockResolvedValue(SESSAO)
    mockLoadGerenciador.mockResolvedValue({ ...OWNER, active: true })
    mockRunAlertsJob.mockResolvedValue({ emailsSent: 3, emailsSkippedNoData: 1 })

    const res = await POST(pedido({ force: true, dryRun: true }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.result.emailsSent).toBe(3)
    expect(mockRunAlertsJob).toHaveBeenCalledWith({ force: true, dryRun: true })
  })

  // ⚠️ OPERADOR passa: disparar manualmente envia EXATAMENTE os e-mails que o cron
  // das 08:00 já envia — é operação de rotina, não credencial de pagamento (que é
  // o motivo do OWNER-only em /admin/asaas/*). Registrado como decisão; se o dono
  // quiser estreitar pra OWNER, este teste inverte com o motivo escrito.
  it('OPERADOR ativo também dispara (é operação de rotina, não configuração)', async () => {
    mockSession.mockResolvedValue({ ...SESSAO, role: 'OPERADOR' })
    mockLoadGerenciador.mockResolvedValue({ ...OWNER, role: 'OPERADOR', active: true })

    const res = await POST(pedido())

    expect(res.status).toBe(200)
    expect(mockRunAlertsJob).toHaveBeenCalledTimes(1)
  })

  // ⚠️ corpo torto não vira default silencioso — e, acima de tudo, não dispara.
  it('campo com tipo errado → recusa do zod, e nada é enviado', async () => {
    mockSession.mockResolvedValue(SESSAO)
    mockLoadGerenciador.mockResolvedValue({ ...OWNER, active: true })

    const res = await POST(pedido({ dryRun: 'sim' }))

    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(mockRunAlertsJob).not.toHaveBeenCalled()
  })
})

// ⛔⛔ O GUARD ESTRUTURAL DO FURO: a frase que a rota carregava como trava.
// Ela era um COMENTÁRIO, e o corpo dizia o contrário ("aceita qualquer user
// logado"). Se alguém reescrever a rota e a trava voltar a ser prosa, isto morde.
describe('o furo não volta como comentário', () => {
  it('a rota CONSOME o padrão de admin da casa, e não aceita user comum', async () => {
    const { readFileSync } = await import('fs')
    const fonte = readFileSync('app/api/alerts/send-now/route.ts', 'utf-8')
    // sem comentários: o arquivo DOCUMENTA o defeito removido e não pode se absolver
    const codigo = fonte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n')

    expect(codigo).toContain('getAdminSession(')
    expect(codigo).toContain('loadGerenciador(')
    // ⛔ o token de usuário comum não pode voltar a ser a credencial desta rota
    expect(codigo).not.toContain('verifyToken')
    expect(codigo).not.toContain('auth_token')
  })
})
