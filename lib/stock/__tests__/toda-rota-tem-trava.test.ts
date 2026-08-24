// ESTOQUE Fase 3 Parte 1 — GUARD ESTRUTURAL: nenhuma rota de estoque sem trava.
//
// Os 50 handlers de hoje estão travados. O que NÃO está resolvido por eles é o handler
// nº 51: rota nova nasce sem lock e ninguém percebe até alguém de fora usar. Este teste é
// a barreira (REGRA 5 — disciplina vira impossibilidade): o artefato É o arquivo de rota,
// mesma justificativa do guard de isolamento das migrations.
//
// Ele NÃO substitui `enforcement-estoque.integration.test.ts`, que executa os handlers de
// verdade contra o banco — este aqui garante COBERTURA, aquele garante COMPORTAMENTO.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = join(process.cwd(), 'app', 'api', 'empresas', '[id]', 'estoque')
const CHAVES_VALIDAS = ['stock.view', 'stock.operate', 'stock.manage']

function rotas(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...rotas(p))
    else if (e === 'route.ts') out.push(p)
  }
  return out
}

interface Handler { arquivo: string; verbo: string; perms: string[] }

function handlers(): Handler[] {
  const out: Handler[] = []
  for (const f of rotas(RAIZ)) {
    const src = readFileSync(f, 'utf-8')
    const marcas = [...src.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\s*\(/g)]
      .map((m) => ({ pos: m.index!, verbo: m[1] }))
    for (let i = 0; i < marcas.length; i++) {
      const corpo = src.slice(marcas[i].pos, i + 1 < marcas.length ? marcas[i + 1].pos : src.length)
      const perms = [...corpo.matchAll(/(?:guardStock|requireStock)\(request, companyId, '([a-z.]+)'\)/g)].map((m) => m[1])
      out.push({ arquivo: f.slice(RAIZ.length + 1), verbo: marcas[i].verbo, perms: [...new Set(perms)] })
    }
  }
  return out
}

describe('toda rota de estoque tem trava', () => {
  const hs = handlers()

  it('achou handlers pra checar (o teste não passa por estar vazio)', () => {
    expect(hs.length).toBeGreaterThanOrEqual(50)
  })

  it.each(hs.map((h) => [`${h.arquivo} ${h.verbo}`, h] as const))('%s exige uma chave de estoque', (_, h) => {
    expect(h.perms.length, `${h.arquivo} ${h.verbo} não chama guardStock/requireStock`).toBeGreaterThan(0)
    for (const p of h.perms) expect(CHAVES_VALIDAS, `chave inválida em ${h.arquivo} ${h.verbo}`).toContain(p)
  })

  it('o check ANTIGO (userCompany.findFirst) não voltou pra nenhuma rota de estoque', () => {
    const comCheckAntigo = rotas(RAIZ).filter((f) => readFileSync(f, 'utf-8').includes('userCompany.findFirst'))
    expect(comCheckAntigo.map((f) => f.slice(RAIZ.length + 1))).toEqual([])
  })

  it('GET é sempre stock.view (ler nunca exige operar/gerenciar)', () => {
    const errados = hs.filter((h) => h.verbo === 'GET' && h.perms.some((p) => p !== 'stock.view'))
    expect(errados.map((h) => `${h.arquivo} ${h.verbo} → ${h.perms.join(',')}`)).toEqual([])
  })

  it('nenhuma escrita (POST/PATCH/PUT/DELETE) se contenta com stock.view', () => {
    const errados = hs.filter((h) => h.verbo !== 'GET' && h.perms.includes('stock.view'))
    expect(errados.map((h) => `${h.arquivo} ${h.verbo} → ${h.perms.join(',')}`)).toEqual([])
  })
})
