// ⛔⛔⛔ OS 3 MOCKS DA PRODUÇÃO SÃO A RÉGUA (13/09/2026)
//
// **O dono:** *"copia pra `docs/mocks/` e versiona, com guard de tokens como o da
// Conciliação — o mock é a RÉGUA: igual primeiro, melhoria só com meu pedido."*
//
// ⭐ É o irmão de `visual-bate-com-o-mock.test.ts`, e existe pelo MESMO motivo: enquanto o
// mock vivia em `~/Downloads`, *"igual ao mock"* era memória minha — e memória foi o que
// falhou nas três voltas da tela de Conciliação. Versionado, ele é **dado**.
//
// ⚠️ ESTRUTURAL E ASSUMIDO COMO TAL: sem jsdom não dá pra renderizar e medir pixel. O que
// morde é provar que **os valores que a tela usa são os que o arquivo manda**.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')

const mockRelatorios = ler('docs/mocks/producao-relatorios-mock.html')
const mockPlacar = ler('docs/mocks/hoje-placar-mock.html')
const mockHoje = ler('docs/mocks/hoje-aovivo-mock.html')

const telaRelatorios = ler('app/(dashboard)/empresas/[id]/estoque/producao/relatorios/page.tsx')
const telaPlacar = ler('components/estoque/placar-da-equipe.tsx')
const telaHoje = ler('app/(dashboard)/empresas/[id]/estoque/producao/hoje/page.tsx')

/** ⚠️ COMENTÁRIO NÃO É TELA — sem isto o guard morderia a própria documentação. */
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')

/** os tokens do `:root{}` do mock, lidos do ARQUIVO (nunca digitados aqui) */
function tokensDo(mock: string): string[] {
  const root = mock.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  return [...root.matchAll(/#[0-9a-fA-F]{3,8}/g)].map((m) => m[0].toLowerCase())
}

describe('⭐⭐ os mocks da produção estão VERSIONADOS', () => {
  it('os três arquivos existem no repo — é isso que transforma "igual ao mock" em dado', () => {
    for (const m of [mockRelatorios, mockPlacar, mockHoje]) expect(m.length).toBeGreaterThan(500)
  })
})

describe('⭐ RELATÓRIOS — a tela usa as cores e medidas do arquivo', () => {
  const tokens = tokensDo(mockRelatorios)
  const tela = semComentarios(telaRelatorios).toLowerCase()

  it('o :root do mock tem os tokens que a tela precisa', () => {
    // se o mock perder um token, o teste abaixo passaria por vacuidade — este impede isso
    expect(tokens.length).toBeGreaterThanOrEqual(12)
  })

  /**
   * ⚠️⚠️ A 1ª VERSÃO DESTE GUARD NÃO MORDIA (REGRA 11, pego na reposição): ele conferia
   * que a cor aparecia **em algum lugar do arquivo** — e trocar o roxo no objeto de tokens
   * passava verde, porque o MESMO roxo também está no degradê da barra do gráfico. O que
   * morde é conferir a DECLARAÇÃO do token, que é de onde a tela inteira lê.
   */
  const declarado = (nome: string): string | null =>
    semComentarios(telaRelatorios).match(new RegExp(`${nome}:\\s*'(#[0-9a-fA-F]{3,8})'`))?.[1]?.toLowerCase() ?? null

  it.each([
    ['roxo', '#534ab7'], ['roxoFraco', '#eeecfa'], ['verde', '#177245'], ['verdeFraco', '#e6f4ec'],
    ['ambar', '#b45309'], ['ambarFraco', '#fdf3e3'], ['line', '#e8e6e0'], ['sub', '#6b7280'],
    ['ink', '#1f2430'], ['slate', '#475569'], ['slateFraco', '#eef2f6'], ['bg', '#faf9f6'], ['card', '#fff'],
  ])('o token %s vale %s — o valor que o ARQUIVO manda', (nome, cor) => {
    expect(tokens, `${cor} sumiu do MOCK`).toContain(cor)
    expect(declarado(nome), `o token ${nome} da tela não é o do mock`).toBe(cor)
  })

  it.each([
    ['raio do painel', 'rounded-[16px]'],
    ['raio do card de stat', 'rounded-[14px]'],
    ['rótulo de stat em 10,5px', 'text-[10.5px]'],
    ['nota de rodapé em 11,5px', 'text-[11.5px]'],
    ['tabela em 13,5px', 'text-[13.5px]'],
    ['avatar de 26px', 'h-[26px]'],
    ['largura máxima de 900px', 'max-w-[900px]'],
  ])('a medida do mock — %s', (_rotulo, medida) => {
    expect(semComentarios(telaRelatorios)).toContain(medida)
  })

  it.each([
    'Relatórios de Produção',
    'tempo, rendimento e custo por tarefa e por pessoa — derivado dos lotes reais',
    'trocar tarefa',
    'Lotes no período',
    'Tempo médio',
    'Rendimento',
    'Custo médio',
    'Tempo médio por dia',
    'Quem fez essa tarefa',
    'Unidades por pessoa',
    'Geral do período',
    'Horas de cozinha',
    'Top tarefa',
    'sem tempo (pelo gerente)',
  ])('o texto do mock aparece na tela: "%s"', (texto) => {
    expect(mockRelatorios, `"${texto}" sumiu do MOCK`).toContain(texto)
    expect(semComentarios(telaRelatorios), `"${texto}" está no mock e não na tela`).toContain(texto)
  })

  it('⭐ os FILTROS do mock estão todos lá', () => {
    for (const f of ['hoje', 'últimos 7 dias', 'mês', 'escolher datas', 'pessoa:']) {
      expect(mockRelatorios).toContain(f)
      expect(semComentarios(telaRelatorios)).toContain(f)
    }
  })

  it('a nota de honestidade do rodapé é a do mock, palavra por palavra', () => {
    const nota = 'comparação com a média da tarefa, sem pódio · tempo a apurar fica fora das médias e é dito · lote cancelado fora pelo estado'
    expect(mockRelatorios).toContain(nota)
    expect(semComentarios(telaRelatorios)).toContain(nota)
  })
})

describe('⭐ PLACAR — a tela usa as cores do arquivo', () => {
  const tokens = tokensDo(mockPlacar)
  const tela = semComentarios(telaPlacar).toLowerCase()

  const declaradoP = (nome: string): string | null =>
    semComentarios(telaPlacar).match(new RegExp(`${nome}:\\s*'(#[0-9a-fA-F]{3,8})'`))?.[1]?.toLowerCase() ?? null

  it.each([
    ['roxo', '#534ab7'], ['roxoFraco', '#eeecfa'], ['verde', '#177245'],
    ['verdeFraco', '#e6f4ec'], ['ambar', '#b45309'], ['ambarFraco', '#fdf3e3'],
  ])('o token %s do placar vale %s', (nome, cor) => {
    expect(tokens, `${cor} sumiu do MOCK`).toContain(cor)
    expect(declaradoP(nome), `o token ${nome} do placar não é o do mock`).toBe(cor)
  })
  void tela

  it('⭐ FIXO NO DIA — o placar não tem chips de período', () => {
    // ⚠️ DIVERGÊNCIA REGISTRADA E RESOLVIDA A FAVOR DO PEDIDO ESCRITO: o rodapé do mock
    // menciona chips (hoje · 7 dias · mês), mas a ordem do dono é *"FIXO NO DIA (sem chips
    // de período — período livre mora nos Relatórios)"*. Ter as duas janelas na mesma tela
    // faria a mesma pergunta ter duas respostas.
    const render = semComentarios(telaPlacar)
    expect(render).not.toMatch(/7 dias|últimos 7|período/i)
    expect(render).toContain('Placar da equipe · hoje')
  })

  it('as regras do rodapé estão escritas — quem lê o âmbar precisa saber o que ele mede', () => {
    const render = semComentarios(telaPlacar)
    expect(render).toContain('3+ lotes')
    expect(render).toContain('convite')
  })
})

describe('⭐ HOJE — o formato pedido→entregue e o selo de rendimento', () => {
  const render = semComentarios(telaHoje)

  it('a paleta do selo de rendimento veio do mock', () => {
    for (const cor of ['#e6f4ec', '#177245', '#fdf3e3', '#b45309']) {
      expect(tokensDo(mockHoje).concat(tokensDo(mockRelatorios))).toContain(cor)
      expect(render.toLowerCase()).toContain(cor)
    }
  })

  it('⭐ os NÚMEROS antes do % — "pedido N → entregue M", com o % como selo', () => {
    expect(render).toContain('pedido')
    expect(render).toContain('entregue')
    // ⛔ e o "sem meta" nunca vira 100%
    expect(render).toContain('sem meta registrada')
  })
})
