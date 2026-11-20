// ⛔⛔ A 5ª PROVA DO GATE — o commit no ar é o esperado? — testada EXECUTANDO (19/11/2026).
//
// O CASO: o deploy da lista em lote deu 4/4 VERDE com o commit VELHO no ar (push feito, `git pull`
// esquecido no servidor). ⭐ REGRA 3: aqui o `scripts/gate-commit.sh` RODA de verdade contra
// repositórios git reais num diretório temporário — um `origin` (bare), o "servidor" (clone) e um
// "mac" (outro clone) que empurra o commit que o servidor não puxou. Nada toca o serviço.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, symlinkSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const GATE = join(process.cwd(), 'scripts/gate-commit.sh')
let raiz = ''
let servidor = ''
let mac = ''

const git = (cwd: string, ...a: string[]) =>
  execFileSync('git', a, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } }).trim()

function commitar(cwd: string, msg: string) {
  writeFileSync(join(cwd, 'arquivo.txt'), msg)
  git(cwd, 'add', '.')
  git(cwd, 'commit', '-q', '-m', msg)
  return git(cwd, 'rev-parse', 'HEAD')
}

function gate(fase: string, esperado = '') {
  try {
    const out = execFileSync('bash', [GATE, fase, servidor, ...(esperado ? [esperado] : [])], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
    return { ok: true, out: out.trim() }
  } catch (e) {
    const err = e as { stdout: string; stderr: string }
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}`.trim() }
  }
}

/** o build SERVIDO: `.next` → `.next-build-<stamp>-<curto>` com o COMMIT dentro */
function servir(shaDoDiretorio: string, commitNoArquivo: string | null) {
  const curto = git(servidor, 'rev-parse', '--short', shaDoDiretorio)
  const dir = `.next-build-20261119-000000-${curto}`
  rmSync(join(servidor, '.next'), { force: true })
  mkdirSync(join(servidor, dir), { recursive: true })
  if (commitNoArquivo) writeFileSync(join(servidor, dir, 'COMMIT'), `${commitNoArquivo}\n`)
  symlinkSync(dir, join(servidor, '.next'))
}

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 'gate-commit-'))
  const origin = join(raiz, 'origin.git')
  git(raiz, 'init', '-q', '--bare', '-b', 'main', origin)
  mac = join(raiz, 'mac')
  git(raiz, 'clone', '-q', origin, mac)
  git(mac, 'checkout', '-q', '-b', 'main')
  commitar(mac, 'v1')
  git(mac, 'push', '-q', 'origin', 'main')
  servidor = join(raiz, 'servidor')
  git(raiz, 'clone', '-q', origin, servidor)
})
afterEach(() => rmSync(raiz, { recursive: true, force: true }))

describe('fase ANTES — recusa buildar o commit errado', () => {
  it('servidor em dia com o origin → verde, e devolve o hash completo', () => {
    const r = gate('antes')
    expect(r.ok).toBe(true)
    expect(r.out).toBe(git(servidor, 'rev-parse', 'HEAD'))
  })

  it('⛔ O CASO DE 19/11: push feito, pull esquecido → VERMELHO com a frase clara', () => {
    const velho = git(servidor, 'rev-parse', 'HEAD')
    const novo = commitar(mac, 'v2')
    git(mac, 'push', '-q', 'origin', 'main')
    const r = gate('antes')
    expect(r.ok).toBe(false)
    expect(r.out).toContain(`commit no ar ${velho.slice(0, 8)} ≠ esperado ${novo.slice(0, 8)} — faltou pull?`)
  })

  it('⛔ DEPLOY_ESPERADO que o servidor nem conhece (não puxou) → VERMELHO', () => {
    const novo = commitar(mac, 'v2')
    const r = gate('antes', novo)
    expect(r.ok).toBe(false)
    expect(r.out).toContain('faltou pull?')
  })

  it('DEPLOY_ESPERADO igual ao HEAD → verde', () => {
    expect(gate('antes', git(servidor, 'rev-parse', 'HEAD')).ok).toBe(true)
  })

  it('⛔ sem como saber o esperado (origin inalcançável, sem DEPLOY_ESPERADO) → VERMELHO, nunca "está certo"', () => {
    git(servidor, 'remote', 'set-url', 'origin', join(raiz, 'nao-existe.git'))
    const r = gate('antes')
    expect(r.ok).toBe(false)
    expect(r.out).toContain('DEPLOY_ESPERADO')
  })
})

describe('fase DEPOIS — o build SERVIDO é do commit esperado', () => {
  it('COMMIT e diretório do build batem → verde', () => {
    const sha = git(servidor, 'rev-parse', 'HEAD')
    servir(sha, sha)
    expect(gate('depois', sha).ok).toBe(true)
  })

  it('⛔ o build servido diz outro commit → VERMELHO com a frase clara', () => {
    const velho = git(servidor, 'rev-parse', 'HEAD')
    const novo = commitar(servidor, 'v2-local')
    servir(novo, velho)
    const r = gate('depois', novo)
    expect(r.ok).toBe(false)
    expect(r.out).toContain(`commit no ar ${velho.slice(0, 8)} ≠ esperado ${novo.slice(0, 8)} — faltou pull?`)
  })

  it('⛔ o symlink aponta pro diretório de outro commit → VERMELHO', () => {
    const velho = git(servidor, 'rev-parse', 'HEAD')
    const novo = commitar(servidor, 'v2-local')
    servir(velho, novo)
    const r = gate('depois', novo)
    expect(r.ok).toBe(false)
    expect(r.out).toContain('não é do commit esperado')
  })

  it('⛔ build sem COMMIT (deploy antigo) → VERMELHO: "não sei" não vira "está certo"', () => {
    const sha = git(servidor, 'rev-parse', 'HEAD')
    servir(sha, null)
    const r = gate('depois', sha)
    expect(r.ok).toBe(false)
    expect(r.out).toContain('.next/COMMIT ausente')
  })
})

describe('o deploy.sh USA as duas fases, na ordem certa (lido sem comentário)', () => {
  const src = readFileSync(join(process.cwd(), 'scripts/deploy.sh'), 'utf-8').replace(/^\s*#.*$/gm, '')
  const pos = (s: string) => { const i = src.indexOf(s); expect(i, s).toBeGreaterThan(-1); return i }
  it('antes do build: confere; depois de buildar: grava o COMMIT; no fim: a 5/5 antes do DEPLOY OK', () => {
    expect(pos('bash scripts/gate-commit.sh antes')).toBeLessThan(pos('npm run build'))
    expect(pos('> "$ALVO/COMMIT"')).toBeGreaterThan(pos('npm run build'))
    expect(pos('> "$ALVO/COMMIT"')).toBeLessThan(pos('mv -Tf .next.novo .next'))
    expect(pos('bash scripts/gate-commit.sh depois')).toBeGreaterThan(pos('ok "4/5 banco'))
    expect(pos('bash scripts/gate-commit.sh depois')).toBeLessThan(pos('DEPLOY OK'))
    expect(src).toContain('ok "5/5 commit no ar = esperado')
  })
})
