/**
 * ⭐⭐ O ESPIÃO DE CONSULTAS — conta as idas ao banco POR MODELO, delegando tudo pro Prisma real.
 *
 * ⚠️ É a única forma honesta de medir N+1 sem depender de tempo de parede: o que o N+1 custa é
 * **round-trip**, e round-trip se CONTA, não se cronometra. Teste em milissegundo passa ou falha
 * pela máquina de quem roda — a contagem não.
 *
 * ⛔ Nasceu dentro de `lista-de-fichas-em-lote.integration.test.ts` (28/09/2026, o N+1 das 189
 * fichas) e saiu pra cá em 20/10, quando o segundo N+1 apareceu (a lista de dias de complementos,
 * ~12 s com 42 dias). **Copiar o espião seria a 2ª régua de "o que conta como ida ao banco"** — e
 * duas divergiriam no primeiro `$`-método novo, com um guard medindo o que o outro ignora.
 */
import type { PrismaClient, Prisma } from '@prisma/client'

export interface Espiao {
  /** passe ESTE db pra a função sob medição */
  db: PrismaClient & Prisma.TransactionClient
  /** `modelo.operacao` de cada ida ao banco, na ordem */
  chamadas: string[]
  /** quantas vezes cada `modelo.operacao` foi chamado */
  porModelo(): Record<string, number>
}

export function espiaoDeConsultas(real: PrismaClient): Espiao {
  const chamadas: string[] = []
  const proxy = new Proxy(real as unknown as Record<string, unknown>, {
    get(alvo, modelo: string) {
      const delegate = alvo[modelo]
      // ⚠️ `$transaction`, `$connect` e cia passam direto: não são modelo, e embrulhá-los
      // quebraria o client em vez de medi-lo.
      if (typeof modelo !== 'string' || modelo.startsWith('$') || delegate == null || typeof delegate !== 'object') {
        return delegate
      }
      return new Proxy(delegate as Record<string, unknown>, {
        get(d, op: string) {
          const fn = d[op]
          if (typeof fn !== 'function') return fn
          return (...args: unknown[]) => {
            chamadas.push(`${modelo}.${op}`)
            return (fn as (...a: unknown[]) => unknown).apply(d, args)
          }
        },
      })
    },
  })
  return {
    db: proxy as unknown as PrismaClient & Prisma.TransactionClient,
    chamadas,
    porModelo: () => chamadas.reduce<Record<string, number>>((m, c) => ({ ...m, [c]: (m[c] ?? 0) + 1 }), {}),
  }
}
