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
