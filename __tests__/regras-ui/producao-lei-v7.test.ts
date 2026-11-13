/**
 * ⭐⭐ PRODUÇÃO — A LEI v7 NA TELA (docs/producao-referencia.html, 12/11/2026).
 *
 * Guard ESTRUTURAL do USO (arquivos lidos SEM comentário — o arquivo que documenta o defeito não
 * pode ser o que o absolve), complementar aos testes de comportamento em
 * lib/stock/producao/__tests__/tarefa-tipo-proprio.integration.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const semComentario = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
const LEI = ler('docs/producao-referencia.html')
const COZINHA = semComentario(ler('app/cozinha/[empresaId]/page.tsx'))
const ORDEM = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx'))
const PAINEL = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'))
const MESA = semComentario(ler('components/estoque/mesa-da-cozinha.tsx'))
const HOJE = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/producao/hoje/page.tsx'))
const ETAPAS = semComentario(ler('components/estoque/etapas-da-ordem.tsx'))
const TAREFAS = semComentario(ler('components/estoque/tarefas-do-dia.tsx'))
const FINALIZAR = semComentario(ler('app/api/empresas/[id]/estoque/producao/minhas-tarefas/finalizar/route.ts'))

describe('a lei mora no repo', () => {
  // ⚠️ REAPONTADO em 13/11: a v9 SUBSTITUI a v7 no repo (contém G1–G12 + M1–M7); as regras v7 abaixo seguem valendo
  it('o arquivo é a v9 APROVADA (que contém a v7)', () => {
    expect(LEI).toContain('<title>Produção — referência v9 APROVADA</title>')
  })
})

describe('M3 · o texto da sobra MORREU (e nada entra no lugar)', () => {
  it('a tela do lote não promete o ajuste que não existe', () => {
    expect(COZINHA).not.toMatch(/Sobrou material/)
    expect(COZINHA).not.toMatch(/ajustando a sobra/)
    expect(LEI).not.toMatch(/>\s*Sobrou material/) // a amostra da lei também não tem
  })
})

describe('M1/M2 · o cartão da cozinha (tokens e textos 1:1 com a lei)', () => {
  it('lista e cronômetro desenham o MESMO miolo, com alvo, colega e o cartão TAREFA', () => {
    expect(COZINHA.match(/<MioloDoCartao t=\{/g)).toHaveLength(2)
    expect(COZINHA).toContain("t.tipo === 'TAREFA'")
    expect(COZINHA).toContain('>TAREFA</span>')
    expect(COZINHA).toContain('alvoDoCartao(t)')
    expect(COZINHA).toMatch(/com <b className="text-slate-100">\{t\.colega\}<\/b>/)
    expect(COZINHA).toContain('text-amber-400" data-testid="instrucao"')
    // ⛔ o "{N} receitas" solto (sem o alvo) não volta
    expect(COZINHA).not.toMatch(/\{(t|emAndamento)\.escalaReceitas\} receitas/)
  })
  it('a lei tem os mesmos textos', () => {
    expect(LEI).toContain('<div class="alvo"><b>100 UN</b> · 2 receitas</div>')
    expect(LEI).toContain('<div class="dupla">com <b>Edmar</b></div>')
    expect(LEI).toContain('<span class="selo-tarefa">TAREFA</span>')
    expect(LEI).toContain('placeholder="o que fazer? ex.: ABRIR LATAS DE MILHO"')
  })
  /** ⚠️⚠️ REAPONTADO pela lei v9 M7 (13/11, docs/producao-referencia.html) — a CARA mudou por ordem do dono; a régua de fundo segue. */
  it('o escritório tem o cartão "Nova tarefa" com os textos da lei', () => {
    expect(PAINEL).toContain('<NovaTarefa id={id}')
    for (const t of ['Nova tarefa', 'placeholder="o que fazer? ex.: ABRIR LATAS DE MILHO"', 'placeholder="instrução, ex.: 3 LATAS"', '<option value="">quem faz?</option>', 'liberada pra equipe', "'Criar tarefa'"]) {
      expect(TAREFAS).toContain(t)
    }
  })
  it('a rota do tablet recusa lote em tarefa antes de qualquer escrita', () => {
    expect(FINALIZAR).toMatch(/if \(ehTarefa && parsed\.data\.qtdGerada != null\) return NextResponse\.json/)
  })
})

describe('M5 · a vassoura do dossiê', () => {
  it('"{escala}× a receita" saiu do subtítulo da Ordem', () => {
    expect(ORDEM).not.toMatch(/escalaReceitas\}× a receita/)
  })
  it('"Concluídas" segue o filtro', () => {
    expect(PAINEL).toContain('<span className="r">{rotuloDasConcluidas(periodo, custom)}</span>')
    expect(PAINEL).not.toMatch(/>concluídas hoje<|rotulo="Concluídas hoje"/)
  })
  it('links mortos consertados: fila do Radar e "cadastrar equipe"', () => {
    expect(MESA).not.toContain('/estoque/producao/conferencia`')
    expect(MESA).toContain('/estoque/producao#conferencia-do-dia`')
    expect(HOJE).not.toContain('href={`/empresas/${id}/equipe`}')
    expect(HOJE).toContain('href="/equipe?filtro=cozinha"')
  })
  it('controles de designar/plano/gestos somem pra quem não pode', () => {
    expect(ETAPAS).toContain("const podeDesignar = !carregandoPerm && pode('stock.operate')")
    expect(ETAPAS).toContain("const podeGerir = !carregandoPerm && pode('stock.manage')")
    expect(ETAPAS).toContain('{podeDesignar && e.participantes.length < 2 && (')
    expect(ETAPAS).toContain(') : podeDesignar && (')
    expect(ETAPAS).toContain('{podeGerir && e.participantes.length === 0 && (')
    expect(ETAPAS).toContain('{podeGerir && <span className="flex items-center gap-1.5">')
    expect(ETAPAS).toContain('{podeGerir && <label')
  })
})
