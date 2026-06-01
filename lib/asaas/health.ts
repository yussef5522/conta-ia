// Sprint Asaas FATIA 3A (31/05/2026) — Health check.
// Confirma que a chave funciona + o ambiente está correto chamando
// um endpoint IDEMPOTENTE (GET /myAccount/status — não cria nada).

import { asaasRequest, getAsaasEnv, type FetchLike } from './client'
import {
  AsaasApiError,
  AsaasConfigError,
  AsaasNetworkError,
} from './errors'
import type { AsaasAccountStatus, AsaasEnv } from './types'

export type HealthCheckResult =
  | {
      connected: true
      env: AsaasEnv
      accountStatus: AsaasAccountStatus
    }
  | {
      connected: false
      env: AsaasEnv | 'unknown'
      error: {
        kind: 'config' | 'auth' | 'http' | 'network'
        message: string
      }
    }

/**
 * Faz GET /myAccount/status. Retorna shape estruturado pra UI.
 *
 * 🛡️ NUNCA expõe a chave nos errors retornados.
 */
export async function checkAsaasConnection(
  deps: { env?: Record<string, string | undefined>; fetch?: FetchLike } = {},
): Promise<HealthCheckResult> {
  let env: AsaasEnv
  try {
    env = getAsaasEnv(deps.env)
  } catch (err) {
    return {
      connected: false,
      env: 'unknown',
      error: {
        kind: 'config',
        message:
          err instanceof AsaasConfigError ? err.message : 'Configuração inválida',
      },
    }
  }

  try {
    const status = await asaasRequest<AsaasAccountStatus>(
      '/myAccount/status',
      { method: 'GET' },
      deps,
    )
    return { connected: true, env, accountStatus: status }
  } catch (err) {
    if (err instanceof AsaasApiError) {
      // 401/403 do Asaas = chave errada OU env errado
      const kind = err.statusCode === 401 || err.statusCode === 403 ? 'auth' : 'http'
      return {
        connected: false,
        env,
        error: {
          kind,
          message:
            kind === 'auth'
              ? 'Chave inválida ou ambiente errado. Confirme ASAAS_API_KEY e ASAAS_ENV.'
              : err.firstErrorDescription(),
        },
      }
    }
    if (err instanceof AsaasNetworkError) {
      return {
        connected: false,
        env,
        error: { kind: 'network', message: err.message },
      }
    }
    // Inesperado — não vaza detalhe
    return {
      connected: false,
      env,
      error: { kind: 'http', message: 'Erro inesperado' },
    }
  }
}
