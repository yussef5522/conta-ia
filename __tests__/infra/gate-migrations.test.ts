// ⛔⛔ O GATE DE MIGRATIONS — testado EXECUTANDO, com um `prisma` falso (02/09/2026).
//
// ⚠️ POR QUE ESTE TESTE EXISTE: a 1ª versão do gate vivia inline no `deploy.sh` e **mentiu
// em prod**. Ela era `npx prisma migrate status | grep -q "…não aplicada…"`, e com
// `set -o pipefail` o pipeline vale o exit code do PRISMA (1 quando há pendente) mesmo com o
// grep casando → o `if` leu FALSO e o deploy anunciou **"schema do banco em dia"** com a
// tabela faltando. O app foi ao ar lendo `stock_venda_complemento_nome` inexistente.
//
// ⭐ REGRA 3: este teste **roda o script de verdade**, com um `npx` falso no PATH simulando
// os dois estados do Prisma. Grep no fonte do `deploy.sh` não distinguiria a versão que
// funciona da que mente — foi exatamente o que aconteceu.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, chmodSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let dir = ''

/** cria um `npx` falso que imita o prisma no estado pedido */
function fakeNpx(estado: 'em-dia' | 'pendente' | 'deploy-falha') {
  const bin = join(dir, 'bin')
  mkdirSync(bin, { recursive: true })
  // ⚠️ o falso imita o que foi MEDIDO do prisma real:
  //   pendente → texto no STDOUT e **exit 1**   ·   em dia → texto no stdout e exit 0
  const sh = `#!/usr/bin/env bash
if [[ "$*" == *"migrate deploy"* ]]; then
  ${estado === 'deploy-falha'
    ? 'echo "Error: P3009 migration failed"; exit 1'
    : 'echo "No pending migrations to apply."; exit 0'}
fi
if [[ "$*" == *"migrate status"* ]]; then
  ${estado === 'pendente'
    ? 'echo "Following migration have not yet been applied:"; echo "20260902160000_x"; exit 1'
    : 'echo "Database schema is up to date!"; exit 0'}
fi
exit 0
`
  const p = join(bin, 'npx')
  writeFileSync(p, sh)
  chmodSync(p, 0o755)
  return bin
}

function rodarGate(estado: 'em-dia' | 'pendente' | 'deploy-falha') {
  const bin = fakeNpx(estado)
  try {
    const out = execFileSync('bash', [join(process.cwd(), 'scripts/gate-migrations.sh'), dir], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true, out }
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string }
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}`, status: err.status }
  }
}

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'gate-mig-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

describe('⛔⛔ o gate que mentiu em prod', () => {
  it('⛔⛔ MIGRATION PENDENTE REPROVA — o caso real de 02/09', () => {
    const r = rodarGate('pendente')
    expect(r.ok, 'o gate deixou passar com migration pendente — foi o bug de 02/09').toBe(false)
    expect(r.out).toMatch(/ainda há migration pendente/)
    // ⚠️ e ENSINA por que rollback não resolve: o que falta é schema, não artefato
    expect(r.out).toMatch(/NÃO troco o symlink/)
  })

  it('⭐ banco em dia PASSA', () => {
    const r = rodarGate('em-dia')
    expect(r.ok).toBe(true)
    expect(r.out).toMatch(/schema do banco em dia/)
  })

  it('⛔ `migrate deploy` que falha derruba o gate, sem trocar nada', () => {
    const r = rodarGate('deploy-falha')
    expect(r.ok).toBe(false)
    expect(r.out).toMatch(/migrate deploy FALHOU/)
  })

  it('⛔⛔ o gate ANTIGO passaria no caso pendente — a prova do bug', () => {
    // reproduz a linha exata que estava no deploy.sh, com o MESMO `set -o pipefail`
    const bin = fakeNpx('pendente')
    const antigo = `set -euo pipefail
if npx prisma migrate status 2>/dev/null | grep -q "have not yet been applied"; then
  echo "PEGOU"
else
  echo "schema do banco em dia"
fi`
    const out = execFileSync('bash', ['-c', antigo], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf-8',
    })
    // ⚠️ ele diz "em dia" COM migration pendente: o grep casa, mas o pipefail devolve o
    // exit 1 do prisma e o `if` lê falso.
    expect(out.trim()).toBe('schema do banco em dia')
  })
})
