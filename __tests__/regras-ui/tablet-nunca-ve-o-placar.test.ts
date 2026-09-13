// ⛔⛔⛔ O TABLET DA COZINHA NUNCA MOSTRA O PLACAR (13/09/2026)
//
// **O dono, palavra por palavra:** *"⛔ SÓ na tela do dono/gerente — o TABLET DA COZINHA
// NUNCA mostra o placar (guard disso: a rota do tablet não recebe esses dados)."*
//
// ⭐ E a régua é a que ele mesmo escreveu: **a trava é no que a ROTA DEVOLVE, não no que a
// tela desenha.** Esconder no componente seria combinado; não mandar o dado é
// impossibilidade (REGRA 5) — e é o que sobrevive ao dia em que alguém montar outra tela
// de cozinha por cima da mesma rota.
//
// ⚠️ POR QUE ISSO IMPORTA e não é preciosismo: *"o âmbar é convite pra olhar, não
// veredito"* — e um convite desses na tela de quem está com a mão na massa, ao lado do
// nome das colegas, vira outra coisa. A comparação é conversa de gestão.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')

const TABLET_ROTAS = 'app/api/empresas/[id]/estoque/producao/minhas-tarefas'
const TABLET_TELA = 'app/cozinha/[empresaId]/page.tsx'

function arquivosDe(dir: string): string[] {
  const out: string[] = []
  for (const nome of readdirSync(join(raiz, dir))) {
    const p = join(dir, nome)
    if (statSync(join(raiz, p)).isDirectory()) out.push(...arquivosDe(p))
    else if (nome.endsWith('.ts') || nome.endsWith('.tsx')) out.push(p)
  }
  return out
}

/** ⚠️ comentário não é código — sem isto o guard morderia a própria explicação */
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

/** o que o tablet NÃO pode conhecer: a comparação entre pessoas */
const PROIBIDO = [
  'placarDaEquipe', 'PlacarDaEquipe', 'vsMediaPct', 'DesempenhoDaPessoa',
  'relatorioDaTarefa', 'unidadesPorPessoa', 'geralDoPeriodo', 'diaAoVivo',
]

describe('⛔⛔ a ROTA do tablet não recebe dado de placar', () => {
  const rotas = arquivosDe(TABLET_ROTAS)

  it('achei as rotas do tablet (senão o guard passaria por vacuidade)', () => {
    expect(rotas.length).toBeGreaterThanOrEqual(4)
  })

  it.each(PROIBIDO)('nenhuma rota do tablet importa/usa `%s`', (simbolo) => {
    for (const r of rotas) {
      expect(semComentarios(ler(r)), `${r} passou a conhecer ${simbolo}`).not.toContain(simbolo)
    }
  })

  it('⭐ e nenhuma rota do tablet toca o módulo de desempenho', () => {
    for (const r of rotas) {
      expect(semComentarios(ler(r)), `${r} importa o módulo de desempenho`)
        .not.toMatch(/producao\/(desempenho|relatorios|dia-ao-vivo|lotes)/)
    }
  })
})

describe('⛔ a TELA do tablet também não desenha placar', () => {
  const tela = semComentarios(ler(TABLET_TELA))

  it.each(PROIBIDO)('a tela da cozinha não usa `%s`', (simbolo) => {
    expect(tela).not.toContain(simbolo)
  })

  it('⭐ ela só conversa com as rotas de `minhas-tarefas`', () => {
    const chamadas = [...tela.matchAll(/\/api\/empresas\/\$\{[^}]+\}\/estoque\/([^`'"?]+)/g)].map((m) => m[1])
    expect(chamadas.length).toBeGreaterThan(0)
    for (const c of chamadas) {
      expect(c, `a tela do tablet chama ${c}, que não é do tablet`).toMatch(/^producao\/minhas-tarefas\//)
    }
  })
})

describe('⭐ e o placar VIVE — na tela de gestão, atrás de stock.manage', () => {
  // ⚠️ um guard que só provasse a AUSÊNCIA aprovaria o dia em que o placar sumisse de todo
  // lugar — e aí não seria fronteira de papel, seria perda. (a lição da conferência de
  // saldo que mudou de casa, 10/09)
  const hoje = ler('app/(dashboard)/empresas/[id]/estoque/producao/hoje/page.tsx')
  const rotaHoje = ler('app/api/empresas/[id]/estoque/producao/dia-ao-vivo/route.ts')
  const rotaRel = ler('app/api/empresas/[id]/estoque/producao/relatorios/route.ts')

  it('o HOJE desenha o placar', () => {
    expect(semComentarios(hoje)).toContain('PlacarDaEquipe')
  })

  it('as duas rotas de gestão exigem stock.manage', () => {
    for (const [nome, src] of [['dia-ao-vivo', rotaHoje], ['relatorios', rotaRel]] as const) {
      expect(semComentarios(src), `${nome} afrouxou a trava`).toContain("'stock.manage'")
    }
  })
})
