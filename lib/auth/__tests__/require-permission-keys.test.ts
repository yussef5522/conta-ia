import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PERMISSIONS } from '../permissions'

// Guard contra reincidência (04/08/2026): o endpoint deteccao-pendentes usou
// `requirePermission('transaction.read')` — permissão INEXISTENTE (a correta é
// `transaction.view`). Como o dono tem lista explícita (sem wildcard), o endpoint
// dava 403 e o cliente engolia → nenhum botão aparecia. Este teste varre TODAS as
// chamadas requirePermission e garante que a string existe na lista de permissões.

const DEFINED = new Set(PERMISSIONS.map((p) => p.key))
const ROOT = join(__dirname, '..', '..', '..') // raiz do repo
const SCAN_DIRS = ['app', 'lib']
const SKIP = new Set(['node_modules', '.next', '__tests__', 'dist'])

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (/\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

// Captura ctx.requirePermission('x') E o estilo options { requirePermission: 'x' }
const RE = /requirePermission\s*(?:\(\s*|:\s*)['"]([a-zA-Z0-9_.*]+)['"]/g

describe('requirePermission — toda string existe na lista de permissões', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)))

  it(`varre ${SCAN_DIRS.join('/')} e não acha permissão indefinida`, () => {
    const offenders: Array<{ key: string; file: string }> = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      let m: RegExpExecArray | null
      RE.lastIndex = 0
      while ((m = RE.exec(src)) !== null) {
        const key = m[1]
        // wildcards são válidos por design (permissionMatches trata)
        if (key === '*' || key.includes('*')) continue
        if (!DEFINED.has(key)) offenders.push({ key, file: file.replace(ROOT + '/', '') })
      }
    }
    if (offenders.length > 0) {
      const msg = offenders.map((o) => `  "${o.key}" em ${o.file}`).join('\n')
      throw new Error(`Permissões indefinidas em requirePermission (não estão em PERMISSIONS):\n${msg}\nPermissões válidas de transaction: ${[...DEFINED].filter((k) => k.startsWith('transaction')).join(', ')}`)
    }
    expect(offenders).toEqual([])
  })

  it('sanidade: encontrou chamadas requirePermission pra varrer', () => {
    let count = 0
    for (const file of files) {
      RE.lastIndex = 0
      const src = readFileSync(file, 'utf8')
      while (RE.exec(src) !== null) count++
    }
    expect(count).toBeGreaterThan(20)
  })
})
