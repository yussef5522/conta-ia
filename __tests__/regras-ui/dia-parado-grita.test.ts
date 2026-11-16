// ⭐⭐ (16/11/2026) A PERGUNTA DA TRAVA GRITA ONDE O DONO OLHA — Painel (dashboard), Painel da produção,
// central de Vendas e Vendas ao vivo montam a MESMA faixa (porta única), com o botão de responder ALI.
// Telas lidas SEM comentário. O comportamento (retém o dia, avisa, tranca a contagem, a resposta
// materializa) é provado por EXECUÇÃO em lib/suit/__tests__/dia-parado.integration.test.ts.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const semComentario = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const TELAS = [
  ['Painel (dashboard)', 'app/(dashboard)/dashboard/page.tsx', '<FaixaDiaParado empresaId={empresaAtual.id} />'],
  ['Painel da produção', 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx', '<FaixaDiaParado empresaId={id} />'],
  ['central de Vendas', 'app/(dashboard)/empresas/[id]/estoque/vendas/page.tsx', '<FaixaDiaParado empresaId={id} />'],
  ['Vendas ao vivo', 'app/(dashboard)/empresas/[id]/estoque/vendas/suit/page.tsx', '<FaixaDiaParado empresaId={id} />'],
] as const

describe('a faixa do dia parado está nas 4 telas', () => {
  it.each(TELAS)('%s monta a faixa', (_n, arq, uso) => {
    expect(semComentario(ler(arq))).toContain(uso)
  })
  it('a faixa diz a frase do dono e tem o botão de responder e o de revisar', () => {
    const f = semComentario(ler('components/estoque/faixa-dia-parado.tsx'))
    expect(f).toContain('parado esperando tua resposta — confirmar ou revisar')
    expect(f).toMatch(/method: 'POST'[^\n]*dia: d\.dia/)
    expect(f).toContain('revisar as vendas do dia')
  })
  it('o carimbo do Ao vivo não diz "contagem liberada" em dia parado', () => {
    const t = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/vendas/suit/page.tsx'))
    expect(t).toMatch(/d\.fechado\.parado\s*\?\s*<span[^>]*>⚠ dia parado esperando sua resposta · contagem trancada/)
  })
})
