/**
 * ⭐⭐⭐ O PAINEL DE PRODUÇÃO BATE COM A LEI v9 — docs/producao-referencia.html ("Produção —
 * referência v9 APROVADA", M7 com o pente do dono, 13/11/2026).
 *
 * ⛔ ARQUIVO DE REFERÊNCIA = LEI: este guard ABRE o arquivo e tira dele a ORDEM das seções, as
 * grades e as medidas. A tela troca os hex do mock pelos tokens da casa (`--prod-*`), mas grade,
 * medidas, rótulos e frases são 1:1. Arquivos lidos SEM comentário (o arquivo que documenta o
 * defeito não pode ser o que o absolve). O comportamento da linha da tarefa é provado RENDERIZADO
 * em lib/stock/producao/__tests__/painel-v9-tarefa-na-lista.test.tsx.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const semComentario = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
const LEI = ler('docs/producao-referencia.html')
const PAINEL = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'))
const LISTAS = semComentario(ler('components/estoque/listas-do-painel.tsx'))
const CONF = semComentario(ler('components/estoque/conferencia-do-dia.tsx'))
const TAREFA = semComentario(ler('components/estoque/tarefas-do-dia.tsx'))
const CSS_LEI = LEI.slice(LEI.indexOf('/* ─── M7 · Painel do escritório'), LEI.indexOf('</style>'))
const AMOSTRA = LEI.slice(LEI.indexOf('<div class="ecra" id="e-esc"'), LEI.indexOf('<script>', LEI.indexOf('<div class="ecra" id="e-esc"')))
const JSX = PAINEL.slice(PAINEL.indexOf('return (\n    <div data-tela="producao-home"'), PAINEL.indexOf('function NovaOrdem'))
const CSS_TELA = PAINEL.slice(PAINEL.indexOf('const CSS = `'))
const TUDO = PAINEL + LISTAS + CONF + TAREFA

describe('a lei v9 mora no repo', () => {
  it('o arquivo é a v9 APROVADA, com G1–G12 + M1–M7', () => {
    expect(LEI).toContain('<title>Produção — referência v9 APROVADA</title>')
    expect(LEI).toMatch(/G1–G12 \(preservação\) \+ M1–M7/)
    for (const m of ['a)', 'b)', 'c)', 'd)', 'e)', 'f)', 'g)', 'h)']) expect(LEI).toContain(`     ${m} `)
  })
})

describe('M7 · a ORDEM da tela é a ordem da amostra da lei', () => {
  it('título → chips → KPIs → filtros → zona de criar → Conferência → Em aberto → Concluídas', () => {
    const lei = ['pp-topo', 'pp-chips', 'pp-kpis', 'pp-filtros', 'pp-zcriar', 'Conferência do dia', 'Em aberto', 'Concluídas'].map((m) => AMOSTRA.indexOf(m))
    expect(lei.every((x, i) => x >= 0 && (i === 0 || x > lei[i - 1])), 'a amostra da lei tem essa ordem').toBe(true)
    const tela = ['className="pp-topo"', 'className="pp-chips"', 'className="pp-kpis"', 'className="pp-filtros"', 'className="pp-zcriar"', '<ConferenciaDoDia', '<ListaAbertas', '<ListaConcluidas'].map((m) => JSX.indexOf(m))
    expect(tela.every((x, i) => x >= 0 && (i === 0 || x > tela[i - 1])), `ordem na tela: ${tela.join(',')}`).toBe(true)
  })
})

describe('M7.b · nada escrito solto: o subtítulo MORREU', () => {
  it('o topo é só o título "Produção"', () => {
    const topo = JSX.slice(JSX.indexOf('className="pp-topo"'), JSX.indexOf('className="pp-chips"'))
    expect(topo).toMatch(/^className="pp-topo"><h1 className="pp-h1">Produção<\/h1><\/div>/)
    expect(PAINEL).not.toMatch(/className="editorial|a cozinha já produziu|dataPorExtenso/)
    expect(AMOSTRA, 'a amostra também não tem subtítulo').not.toMatch(/class="pp-sub"/)
  })
})

describe('M7.f · a Sugestão de produção SAIU do painel', () => {
  it('nem seção, nem estado, nem o "produzir" da sugestão', () => {
    expect(TUDO).not.toMatch(/Sugestão de produção|sugestoes|produzirSugestao|origem: 'SUGESTAO'/)
  })
})

describe('M7.g · UM caminho de criar: os dois cartões fixos, nenhum outro botão', () => {
  it('a zona de criar tem a Nova ordem e a Nova tarefa, sem condição de "aberto"', () => {
    const zona = JSX.slice(JSX.indexOf('className="pp-zcriar"'), JSX.indexOf('<ConferenciaDoDia'))
    expect(zona).toMatch(/<NovaOrdem id=\{id\} fichaInicial=\{fichaDaUrl\}/)
    expect(zona).toMatch(/<NovaTarefa id=\{id\}/)
    expect(PAINEL, 'o cartão oculto que abria pelo botão voltou').not.toMatch(/\{novo && <NovaOrdem|setNovo/)
  })
  it('um POST de ordem e um POST de tarefa na tela inteira — e nenhum "+ Nova ordem"', () => {
    expect((TUDO.match(/estoque\/producao\/ordens`, \{\s*method: 'POST'/g) ?? []).length, 'criar ordem').toBe(1)
    expect((TUDO.match(/estoque\/producao\/tarefas`, \{\s*method: 'POST'/g) ?? []).length, 'criar tarefa').toBe(1)
    expect(TUDO).not.toMatch(/\+ Nova ordem|>\s*Nova ordem\s*</)
    expect((TUDO.match(/'Criar ordem →'/g) ?? []).length).toBe(1)
    expect((TUDO.match(/'Criar tarefa'/g) ?? []).length).toBe(1)
    expect(TUDO, 'o atalho antigo de "setores e equipe" no formulário (o chip Equipe já leva lá)').not.toMatch(/setores e equipe/)
  })
  it('lado a lado, empilham no celular — medidas da lei', () => {
    expect(CSS_LEI).toContain('.pp-zcriar{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}')
    expect(CSS_LEI).toContain('@media(max-width:760px){ .pp-zcriar{grid-template-columns:1fr} }')
    expect(CSS_TELA).toContain('.pp-zcriar{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}')
    expect(CSS_TELA).toContain('@media(max-width:760px){ .pp-zcriar{grid-template-columns:1fr} }')
  })
})

describe('M7.a/c · grades e medidas saem do arquivo da lei, 1:1', () => {
  it('as grades (conferência c4, concluídas d4, aberto e3, KPIs) e a tipografia S16', () => {
    const medidas = [
      /\.pp-head\{display:grid;gap:10px;font-size:([\d.]+px);font-weight:800;letter-spacing:\.07em/,
      /\.pp-row\.c4\{grid-template-columns:([^}]+)\}/,
      /\.pp-row\.d4\{grid-template-columns:([^}]+)\}/,
      /\.pp-row\.e3\{grid-template-columns:([^;]+);/,
      /\.pp-kpis\{display:grid;grid-template-columns:([^;]+);/,
      /\.pp-kpi \.r\{display:block;font-size:(\d+px);font-weight:800/,
      /\.pp-kpi b\{display:block;font-size:(\d+px);font-weight:800/,
      /\.pp-h1\{font-size:(\d+px);font-weight:800/,
      /\.pp-nm\{font-weight:(700);font-size:13\.5px/,
      /\.pp-num\{font-weight:800;font-size:14px;text-align:(right);font-variant-numeric:tabular-nums/,
      /\.pp-ok\{width:(38px);height:38px/,
    ]
    for (const re of medidas) {
      const m = CSS_LEI.match(re)
      expect(m, `a lei tem ${re}`).not.toBeNull()
      expect(CSS_TELA.match(re)?.[1], `a tela usa ${m![1]} (${re})`).toBe(m![1])
    }
  })
  it('cabecinhas da lei nas duas grades', () => {
    expect(AMOSTRA).toContain('<span>LOTE</span><span class="r">FEZ / PED.</span><span class="r">VEREDITO</span>')
    expect(CONF).toContain('<span>LOTE</span><span className="r">FEZ / PED.</span><span className="r">VEREDITO</span>')
    expect(AMOSTRA).toContain('<span>LOTE</span><span class="r">CUSTO</span><span class="r">FEZ / PED.</span><span class="r">CONFERÊNCIA</span>')
    expect(LISTAS).toContain('<span>LOTE</span><span className="r">CUSTO</span><span className="r">FEZ / PED.</span><span className="r">CONFERÊNCIA</span>')
  })
  it('os 4 KPIs com os rótulos da lei', () => {
    for (const r of ['em aberto', 'na bancada', 'rendimento do dia']) {
      expect(AMOSTRA).toContain(`<span class="r">${r}</span>`)
      expect(PAINEL).toContain(`<span className="r">${r}</span>`)
    }
    expect(PAINEL, 'o 3º segue o filtro (vassoura M5)').toContain('<span className="r">{rotuloDasConcluidas(periodo, custom)}</span>')
  })
})

describe('M7.b · a prosa da Conferência mora no ⓘ', () => {
  it('a frase da assinatura aparece UMA vez, dentro do pop do ⓘ — e é a frase da lei', () => {
    const frase = 'assina no teu nome · quem fez não confere a própria · ✓ confere com um toque · ✎ corrige pedindo o número certo e o motivo · tarefa não entra aqui: não tem número a conferir'
    expect(AMOSTRA).toContain(frase)
    expect((CONF.match(/assina no teu nome/g) ?? []).length).toBe(1)
    expect(CONF).toContain(`{info && <span className="pp-pop" data-testid="conferencia-info">${frase}</span>}`)
    expect(CONF).toMatch(/className="pp-i" aria-label="como funciona a conferência"/)
  })
  it('⛔ TAREFA nunca entra na Conferência: a fila não conhece tarefa', () => {
    expect(semComentario(ler('lib/stock/producao/fila-de-conferencia.ts'))).not.toMatch(/stockTarefa|tarefa/i)
  })
})

describe('M7.e · a tarefa nas listas: a linha dela não TEM campo pra R$/un, % nem conferência', () => {
  it('a linha concluída da tarefa desenha só selo, nome, apoio e duração', () => {
    const t = LISTAS.slice(LISTAS.indexOf('data-testid="tarefa-concluida"'), LISTAS.indexOf('const c = v.c'))
    expect(t).toMatch(/\{t\.selo\}[\s\S]*\{t\.nome\}[\s\S]*\{t\.apoio\}[\s\S]*\{t\.duracao\}/)
    expect(t).not.toMatch(/formatBRL|\/un|pil|SeloDaConferencia|pedid/)
  })
  it('a linha aberta da tarefa: instrução à direita, nunca pedido', () => {
    const t = LISTAS.slice(LISTAS.indexOf('data-testid="tarefa-aberta"'), LISTAS.indexOf('</section>', LISTAS.indexOf('data-testid="tarefa-aberta"')))
    expect(t).toContain('{t.instrucao ?? \'\'}')
    expect(t).not.toMatch(/pedid|esperad|fmtPedido|unidadeProduzido/)
  })
})

describe('E1/S18 · área útil do app e celular', () => {
  it('nenhum teto de largura herdado do mock, e nenhum hex no CSS da tela', () => {
    expect(AMOSTRA).toMatch(/max-width:780px/) // o mock tem — a tela não herda
    expect(CSS_TELA.replace(/@media\(max-width:\d+px\)/g, ''), 'teto de largura numa regra da tela').not.toMatch(/max-width/)
    expect(CSS_TELA.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([])
  })
  it('no celular a grade vira 2ª linha com rótulo (a cabecinha some, o número leva o nome)', () => {
    expect(CSS_TELA).toMatch(/@media\(max-width:640px\)\{[\s\S]*\.pp-head\.c4,\.pp-head\.d4\{display:none\}[\s\S]*\[data-r\]::before\{content:attr\(data-r\)/)
  })
})
