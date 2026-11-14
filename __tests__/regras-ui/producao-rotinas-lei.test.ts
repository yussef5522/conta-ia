// ⭐⭐ A TELA ROTINAS E A JANELA BATEM COM A LEI (docs/rotinas-referencia.html, v1 APROVADA, R25–R31, 13/11/2026).
//
// ⛔ ARQUIVO DE REFERÊNCIA = LEI: este guard ABRE a referência e compara com as telas — tokens --esc-* POR
// VALOR (globals.css), chips, rótulos do cartão "Nova rotina", opções do "Repete", colunas da lista, ações,
// o ⓘ, as frases da amostra da Janela e os dois viewports (REGRA 12). Telas lidas SEM comentário (o arquivo
// que documenta não pode ser o que absolve). A LÓGICA (semeadura, tique, atraso, exclusão) é provada por
// EXECUÇÃO em lib/stock/producao/__tests__/rotinas.integration.test.ts e leis-r-pinos.test.ts.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const semComentario = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
const norm = (s: string) => s.replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const LEI = ler('docs/rotinas-referencia.html')
const LEI_SEM_COMENTARIO = LEI.replace(/<!--[\s\S]*?-->/g, '')
const TELA = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/producao/rotinas/page.tsx'))
const JANELA = semComentario(ler('app/cozinha/[empresaId]/page.tsx'))
const PAINEL_NOVA = semComentario(ler('components/estoque/tarefas-do-dia.tsx'))
const texto = (src: string) => norm(src.replace(/\{' '\}/g, ' ').replace(/&quot;/g, '"'))

const bloco = (classe: string) => {
  const m = LEI_SEM_COMENTARIO.match(new RegExp(`<div class="${classe}"[^>]*>([\\s\\S]*?)</div>`))
  expect(m, `a lei não tem .${classe}`).toBeTruthy()
  return m![1]
}
const filhos = (html: string, tag: string) => [...html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map((x) => norm(x[1]))

describe('a lei é a certa', () => {
  it('título exato', () => {
    expect(LEI).toContain('<title>ROTINAS (produção) — referência v1 APROVADA</title>')
  })
})

describe('tokens --esc-* POR VALOR', () => {
  it('cada --esc-* da lei tem o MESMO valor no :root da casa', () => {
    const css = ler('app/globals.css')
    const raiz = css.slice(css.indexOf('--esc-bg: #f3f5fa') - 200)
    const b = raiz.slice(raiz.indexOf(':root {'), raiz.indexOf('}', raiz.indexOf(':root {')))
    const tokens = [...LEI.match(/:root\{([\s\S]*?)\}/)![1].matchAll(/(--esc-[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)]
    expect(tokens.length).toBeGreaterThan(12)
    for (const [, k, v] of tokens) expect(b.match(new RegExp(`${k}:\\s*(#[0-9a-f]{6})`))?.[1], k).toBe(v.toLowerCase())
  })
})

describe('TELA ROTINAS × lei', () => {
  it('acende o próprio chip', () => {
    expect(TELA).toContain('<ChipsDaProducao empresaId={id} aba="rotinas" />')
  })
  it('cartão "Nova rotina": os rótulos da lei, o botão e o "+ item"', () => {
    const zr = LEI_SEM_COMENTARIO.slice(LEI_SEM_COMENTARIO.indexOf('<div class="zr">'), LEI_SEM_COMENTARIO.indexOf('<div class="itens">'))
    const rotulos = filhos(zr, 'label')
    expect(rotulos).toEqual(['Nome', 'Repete', 'Até · opcional', 'Quem faz'])
    for (const r of rotulos) expect(TELA, r).toContain(`>${r}</label>`)
    expect(TELA).toContain('Nova rotina')
    expect(TELA).toContain("'Criar rotina'")
    expect(TELA).toContain('>+ item</button>')
  })
  it('"Repete": as 4 opções da lei, na ordem', () => {
    const sel = LEI_SEM_COMENTARIO.match(/<label>Repete<\/label><select>([\s\S]*?)<\/select>/)![1]
    const opcoes = filhos(sel, 'option')
    const daTela = [...TELA.matchAll(/\{ tipo: '(\w+)', rotulo: '([^']+)' \}/g)].map((m) => m[2])
    expect(daTela).toEqual(opcoes)
  })
  it('"Quem faz": "livre — quem pegar" primeiro (R28)', () => {
    expect(LEI_SEM_COMENTARIO).toContain('<option>livre — quem pegar</option>')
    expect(TELA).toMatch(/<option value="LIVRE">livre — quem pegar<\/option>\s*\{pessoas\.map/)
  })
  it('lista: as colunas da lei, na ordem, e as ações (editar · pausar/retomar · excluir)', () => {
    const cab = filhos(bloco('rhead'), 'span').filter(Boolean)
    expect(cab).toEqual(['Rotina', 'Repete', 'Até', 'Quem', 'Hoje'])
    const h = TELA.match(/<div className="ro-rhead">([\s\S]*?)<\/div>/)![1]
    expect(filhos(h, 'span').filter(Boolean)).toEqual(cab)
    for (const a of ['>editar<', "'retomar'", "'pausar'", '>excluir<']) expect(TELA, a).toContain(a)
  })
  it('R30 a coluna HOJE com as palavras da lei: "terminou", "atrasada", "próxima", "pausada", "N itens"', () => {
    for (const p of ['terminou ', '>atrasada<', 'próxima ', '>pausada<', "'item' : 'itens'"]) expect(TELA, p).toContain(p)
    expect(LEI_SEM_COMENTARIO).toContain("'<small>atrasada</small>'")
  })
  it('R27 ATRASADA É ÂMBAR, NUNCA VERMELHO: a classe é a âmbar e os tokens de perigo não pintam atraso', () => {
    expect(TELA).toMatch(/r\.hoje\.atrasada \? 'amb'/)
    expect(TELA).toMatch(/\.ro-rrow \.hoje \.amb\{color:var\(--esc-ambar-t\)\}/)
    expect(TELA).not.toMatch(/atrasada[^\n]{0,80}perigo/)
  })
  it('o ⓘ é o da lei, palavra por palavra', () => {
    const pop = norm(LEI_SEM_COMENTARIO.match(/<span class="pop">([\s\S]*?)<\/span>/)![1])
    expect(texto(TELA)).toContain(pop)
  })
  it('estado vazio honesto, falha com "tentar de novo", e o celular empilha (REGRA 12)', () => {
    expect(TELA).toMatch(/<FalhouDeLer oQue=/)
    expect(TELA).toMatch(/className="rx-vazio"/)
    expect(TELA).toMatch(/@media \(max-width:760px\)/)
    expect(LEI_SEM_COMENTARIO).toMatch(/grid-template-areas:"rn hoje" "meta meta" "acoes acoes"/)
    expect(TELA).toContain(`grid-template-areas:"rn hoje" "meta meta" "acoes acoes"`)
  })
  it('R29 excluir pede confirmação COM NÚMEROS (a frase vem do servidor)', () => {
    expect(TELA).toContain('confirma-excluir-rotina')
    expect(TELA).toContain('{confirmando.previa.frase}')
  })
})

describe('R31 — UM NASCIMENTO POR CAMINHO', () => {
  it('⛔ a tela Rotinas NÃO cria tarefa avulsa: nenhuma chamada à rota de tarefas', () => {
    expect(TELA).not.toMatch(/producao\/tarefas/)
  })
  it('⛔ o Painel NÃO cria rotina: o cartão "Nova tarefa" não chama a API de rotinas — só NAVEGA pra tela', () => {
    expect(PAINEL_NOVA).not.toMatch(/\/api\/[^`'"]*rotinas/)
    expect(PAINEL_NOVA).toMatch(/window\.location\.href = `\/empresas\/\$\{id\}\/estoque\/producao\/rotinas\?/)
    expect(PAINEL_NOVA).toContain('isso repete →')
    // marcou → o clique do botão vai pra ponte ANTES de qualquer POST
    expect(PAINEL_NOVA).toMatch(/const criar = async \(\) => \{\s*if \(repete\) \{ irPraRotinas\(\); return \}/)
  })
  it('a emenda E2 está registrada na lei do Painel', () => {
    expect(ler('docs/producao-referencia.html')).toContain('E2· ISSO REPETE →')
  })
})

describe('JANELA DA COZINHA × amostra da lei', () => {
  it('o grupo é UM cartão: selo, progresso N/M, itens ticáveis, risco no feito, quem · hora, a nota', () => {
    expect(LEI_SEM_COMENTARIO).toContain('TAREFA · ROTINA')
    expect(JANELA).toContain('TAREFA · ROTINA')
    const nota = norm(LEI_SEM_COMENTARIO.match(/<div class="jnota">([\s\S]*?)<\/div>/)![1])
    expect(texto(JANELA)).toContain(nota)
    expect(JANELA).toContain('livre — quem pegar')
    expect(JANELA).toMatch(/line-through/)
    expect(JANELA).toMatch(/\{i\.quem\} · \{i\.hora\}/)
    expect(JANELA).toContain("chamar('ticar', { etapaId: t.etapaId, itemId })")
  })
  it('⛔ grupo não tem INICIAR: o cartão do grupo substitui o cartão com o botão', () => {
    expect(JANELA).toMatch(/t\.rotina && t\.rotina\.itens\.length > 0 \? \(\s*<li[^>]*>\s*<CartaoDoGrupo/)
  })
  it('R27 atrasada em âmbar (amber), nunca vermelho (rose/red)', () => {
    const linhas = JANELA.split('\n').filter((l) => l.includes('rotina-atrasada'))
    expect(linhas.length).toBeGreaterThan(0)
    for (const l of linhas) { expect(l).toMatch(/text-amber-400/); expect(l).not.toMatch(/rose|red-/) }
  })
})
