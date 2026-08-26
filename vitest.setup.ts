// Setup do vitest — roda ANTES de qualquer arquivo de teste.
//
// Única função: impedir que a suíte encoste em banco real. Ver
// `lib/testing/guard-banco-de-teste.ts` pro porquê (30 perfis e 18 cartões criados em
// produção em 08/08/2026 por um `npx vitest` rodado dentro do servidor).
//
// ⚠️ Lê o `.env` na mão de propósito: o projeto NÃO tem `dotenv` como dependência (o
// Next carrega env por conta própria). Puxar um pacote novo só pro guard seria trocar
// uma trava simples por uma dependência a manter — e o guard precisa ser a coisa mais
// difícil de quebrar do repositório.
//
// ⚠️ E lê o arquivo ANTES de olhar `process.env`: o Prisma vai carregar o `.env` quando
// o primeiro teste de integração instanciar o client, então é o VALOR DO ARQUIVO que
// decide o destino real — checar só `process.env` daria verde num shell limpo.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertBancoDeTeste } from './lib/testing/guard-banco-de-teste'

function lerDatabaseUrlDoEnv(): string | undefined {
  try {
    const txt = readFileSync(resolve(process.cwd(), '.env'), 'utf-8')
    for (const linha of txt.split('\n')) {
      const t = linha.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      if (t.slice(0, i).trim() !== 'DATABASE_URL') continue
      return t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    // sem .env (CI limpo) — cai no process.env
  }
  return undefined
}

assertBancoDeTeste(lerDatabaseUrlDoEnv() ?? process.env.DATABASE_URL)
