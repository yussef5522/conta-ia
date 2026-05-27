// Hotfix 5.0.2.2 — Regression guard contra bug de cookie name errado.
//
// CONTEXTO: o cookie real do app é `auth_token` (constante `COOKIE_NAME`
// em `lib/auth.ts`), MAS 4 server components estavam lendo
// `cookies().get('token')` — que sempre retorna undefined, dispara
// `redirect('/login')`, e o middleware bounceia pro /dashboard porque
// detecta a sessão válida. Sintoma: clicar em "Importar Excel" leva
// pro dashboard.
//
// Este teste varre TODOS os server components do dashboard e bloqueia
// o anti-padrão `cookies().get('token')` (com aspas simples ou duplas).
// Se alguém adicionar de novo, o teste falha e força revisão.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const APP_DIR = join(__dirname, '..', 'app')

function walkPageFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      walkPageFiles(full, acc)
    } else if (entry === 'page.tsx' || entry === 'layout.tsx') {
      acc.push(full)
    }
  }
  return acc
}

const PAGE_FILES = walkPageFiles(APP_DIR)

describe('Server Components — cookie name (regression guard)', () => {
  it('Nenhum server component lê cookies().get("token") — deve usar COOKIE_NAME', () => {
    const offenders: { file: string; line: number; snippet: string }[] = []

    for (const file of PAGE_FILES) {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split('\n')
      lines.forEach((line, idx) => {
        // Padrão errado: cookies().get('token') ou .get("token")
        // Aceita o sufixo .value? — independe, o que importa é o literal 'token'
        const match = line.match(/cookies\(\)[\s\S]*?\.get\((['"])token\1\)/)
        if (match) {
          offenders.push({
            file: file.replace(APP_DIR, 'app'),
            line: idx + 1,
            snippet: line.trim(),
          })
        }
      })
    }

    if (offenders.length > 0) {
      const msg = offenders
        .map((o) => `  ${o.file}:${o.line}\n    ${o.snippet}`)
        .join('\n')
      throw new Error(
        `Encontrei ${offenders.length} server component(s) lendo o cookie ERRADO. ` +
          `Use COOKIE_NAME importado de '@/lib/auth' em vez de 'token':\n${msg}`,
      )
    }

    expect(offenders).toEqual([])
  })

  it('Pelo menos um server component USA COOKIE_NAME (sanity)', () => {
    // Garante que o teste acima não vira falso positivo se ninguém usar cookies()
    let foundCorrectUsage = false
    for (const file of PAGE_FILES) {
      const content = readFileSync(file, 'utf-8')
      if (
        content.includes('COOKIE_NAME') &&
        content.includes('cookies()')
      ) {
        foundCorrectUsage = true
        break
      }
    }
    expect(foundCorrectUsage).toBe(true)
  })
})
