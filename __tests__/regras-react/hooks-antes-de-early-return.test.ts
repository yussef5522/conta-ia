// REGRA DOS HOOKS — guard estrutural pra TODA página cliente (25/08).
//
// Mordeu DUAS vezes com o mesmo desenho:
//   21/08 — ordem de produção: `useMemo` depois do early-return → "This page couldn't load"
//   25/08 — tela de vendas: 3 useState + 1 useEffect depois do `if (!data) return` → idem
// Nos dois casos o hook NOVO foi colado perto de onde ele era usado, e onde ele era usado
// já estava depois do return. Corrigir o arquivo não impede o terceiro caso — por isso
// este guard varre TODAS as páginas cliente (REGRA 5: vira impossível, não combinado).
//
// O artefato É o arquivo .tsx, mesma justificativa do guard das migrations de estoque.
// Detecta no CORPO do componente (indentação de 2 espaços): early return primeiro,
// hook depois. `if (!x) return` dentro de callback/useMemo não conta — lá é legítimo.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = join(process.cwd(), 'app')
const HOOK_NO_CORPO = /^ {2}(?:const\s+[^=]+=\s*)?(useState|useEffect|useMemo|useCallback|useRef|useReducer|useSort)\s*[(<]/
const RETURN_NO_CORPO = /^ {2}if\s*\(.*\)\s*return\b/
const COMPONENTE = /^(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w*)/

function tsxClientes(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...tsxClientes(p))
    else if (e.endsWith('.tsx') && readFileSync(p, 'utf-8').includes("'use client'")) out.push(p)
  }
  return out
}

interface Violacao { arquivo: string; componente: string; linhaReturn: number; linhaHook: number; hook: string }

function violacoes(arquivo: string): Violacao[] {
  const linhas = readFileSync(arquivo, 'utf-8').split('\n')
  const marcas: { i: number; nome: string }[] = []
  linhas.forEach((l, i) => { const m = COMPONENTE.exec(l); if (m) marcas.push({ i, nome: m[1] }) })

  const out: Violacao[] = []
  marcas.forEach((mk, k) => {
    const fim = k + 1 < marcas.length ? marcas[k + 1].i : linhas.length
    let posReturn: number | null = null
    for (let j = mk.i; j < fim; j++) {
      if (posReturn === null && RETURN_NO_CORPO.test(linhas[j])) posReturn = j
      if (posReturn !== null && HOOK_NO_CORPO.test(linhas[j])) {
        out.push({
          arquivo: arquivo.slice(RAIZ.length + 1), componente: mk.nome,
          linhaReturn: posReturn + 1, linhaHook: j + 1, hook: linhas[j].trim().slice(0, 60),
        })
        break
      }
    }
  })
  return out
}

describe('Regra dos Hooks — nenhum hook depois de early return', () => {
  const arquivos = tsxClientes(RAIZ)

  it('achou páginas cliente pra checar (não passa por estar vazio)', () => {
    expect(arquivos.length).toBeGreaterThan(50)
  })

  it('NENHUM componente registra hook depois de um early return', () => {
    const todas = arquivos.flatMap(violacoes)
    const legivel = todas.map((v) => `${v.arquivo} → ${v.componente}(): return na linha ${v.linhaReturn}, hook na ${v.linhaHook} (${v.hook})`)
    expect(legivel).toEqual([])
  })

  it('o detector PEGA o padrão (senão o teste acima passa por cegueira)', () => {
    // simula o arquivo exato que quebrou: hooks no corpo, depois do return
    const fake = [
      'function Tela() {',
      '  const [a, setA] = useState(null)',
      '  if (!a) return <div />',
      '  const [b, setB] = useState(null)',
      '}',
    ]
    let posReturn: number | null = null
    let pegou = false
    fake.forEach((l, j) => {
      if (posReturn === null && RETURN_NO_CORPO.test(l)) posReturn = j
      else if (posReturn !== null && HOOK_NO_CORPO.test(l)) pegou = true
    })
    expect(pegou).toBe(true)
  })

  it('NÃO acusa `if (!x) return` dentro de callback (lá é legítimo)', () => {
    // dentro de useMemo o return tem indentação maior — não é o corpo do componente
    expect(RETURN_NO_CORPO.test('    if (!data) return []')).toBe(false)
    expect(RETURN_NO_CORPO.test('  if (!data) return []')).toBe(true)
  })
})
