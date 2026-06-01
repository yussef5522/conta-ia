// Sprint Asaas FATIA 3A (31/05/2026) — Config singleton.
//
// 🛡️ Princípios:
//   - DEFAULT ASAAS_ENV=sandbox (defesa: nunca toca produção por engano)
//   - Falha CEDO com mensagem clara se faltar chave (em vez de tentar
//     chamar a API com chave vazia e gerar 401 confuso)
//   - URL base derivada DETERMINÍSTICA do env (sem possibilidade de
//     URL hardcoded em outro lugar)

import { AsaasConfigError } from './errors'
import type { AsaasConfig, AsaasEnv } from './types'

const SANDBOX_URL = 'https://api-sandbox.asaas.com/v3'
const PRODUCTION_URL = 'https://api.asaas.com/v3'

// Melhoria B (01/06/2026): warn no boot se a chave estiver vazia.
// O check roda 1 vez por processo (flag module-level) pra não spammar
// logs em cada request. NÃO bloqueia o app (rotas que não usam Asaas
// continuam funcionando) — só sinaliza nos logs PM2 que algo está
// errado antes do primeiro cliente clicar Pix/Cartão.
let _bootCheckDone = false
function runBootCheck(): void {
  if (_bootCheckDone) return
  _bootCheckDone = true
  const key = (process.env.ASAAS_API_KEY ?? '').trim()
  const env = (process.env.ASAAS_ENV ?? 'sandbox').trim().toLowerCase()
  if (!key) {
    console.error(
      '🚨 [asaas/config] ASAAS_API_KEY vazia ou ausente. Endpoints de checkout vão falhar.',
      { env, hint: 'Se o valor começa com "$", aspas simples NÃO bastam — escape com "\\$". Ver .env.example.' },
    )
  }
}

/**
 * Lê config do process.env. Lança AsaasConfigError com mensagem
 * acionável se algo estiver inválido.
 *
 * ⚠️ NÃO faça caching desta função em module scope — se Yussef
 * trocar o .env e dar pm2 reload, queremos a nova config no próximo
 * call.
 */
/** Subset de ProcessEnv que precisamos. Aceita partial pra testes. */
export type AsaasEnvSource = Record<string, string | undefined>

export function loadAsaasConfig(
  envOverride?: AsaasEnvSource,
): AsaasConfig {
  // Boot check (1x por processo) só quando lemos do process.env real.
  // Em testes (com envOverride), pulamos pra não poluir.
  if (!envOverride) runBootCheck()
  const env = envOverride ?? (process.env as AsaasEnvSource)

  const apiKey = (env.ASAAS_API_KEY ?? '').trim()
  if (!apiKey) {
    throw new AsaasConfigError(
      'ASAAS_API_KEY não configurada. Veja docs/sprints/asaas-3a-audit.md §11.',
    )
  }

  const rawEnv = (env.ASAAS_ENV ?? 'sandbox').trim().toLowerCase()
  if (rawEnv !== 'sandbox' && rawEnv !== 'production') {
    throw new AsaasConfigError(
      `ASAAS_ENV inválido. Use 'sandbox' ou 'production' (recebido: '${rawEnv}').`,
    )
  }

  const asaasEnv: AsaasEnv = rawEnv
  const baseUrl = asaasEnv === 'production' ? PRODUCTION_URL : SANDBOX_URL

  return { apiKey, env: asaasEnv, baseUrl }
}
