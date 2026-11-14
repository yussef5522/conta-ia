// ⭐⭐ AS 4 TELAS DA PRODUÇÃO BATEM COM A LEI (13/11/2026) — Ao vivo v3 · Desempenho v2 · Receitas v2 · Equipe v2.
//
// ⛔ ARQUIVO DE REFERÊNCIA = LEI: este guard ABRE as 4 referências em docs/ e compara com as telas:
// tokens --esc-* POR VALOR (globals.css), os chips da R1, títulos de bloco, cabeçalhos de coluna,
// frases do ⓘ, os vetos do dono (R5/R6) e os dois viewports (REGRA 12). As telas são lidas SEM
// comentário (o arquivo que documenta não pode ser o que absolve). A lógica (mediana, ritmo, barra,
// exclusão, PIN) é provada por EXECUÇÃO em quatro-telas.integration e leis-r-pinos.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHIPS_DA_PRODUCAO } from '@/components/estoque/producao-telas'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const semComentario = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
const norm = (s: string) => s.replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
const LEI = (n: string) => ler(`docs/producao-${n}-referencia.html`)
const TELA = (n: string) => semComentario(ler(`app/(dashboard)/empresas/[id]/estoque/producao/${n}/page.tsx`))
const textoDaTela = (src: string) => norm(src.replace(/\{' '\}/g, ' '))

/** os textos de um bloco da lei: <tag class="X">…</tag> → filhos <span|button> */
const filhos = (html: string, classe: string, tag = 'span|button') => {
  const m = html.match(new RegExp(`<div class="${classe}"[^>]*>([\\s\\S]*?)</div>`))
  expect(m, `a lei não tem .${classe}`).toBeTruthy()
  return [...m![1].matchAll(new RegExp(`<(?:${tag})[^>]*>([\\s\\S]*?)</(?:${tag})>`, 'g'))].map((x) => norm(x[1])).filter(Boolean)
}
const pops = (html: string) => [...html.matchAll(/<span class="pop">([\s\S]*?)<\/span>/g)].map((m) => norm(m[1]))

describe('tokens --esc-* POR VALOR (as 4 leis declaram o mesmo :root)', () => {
  const css = ler('app/globals.css')
  const raiz = css.slice(css.indexOf('--esc-bg: #f3f5fa') - 200)
  const bloco = raiz.slice(raiz.indexOf(':root {'), raiz.indexOf('}', raiz.indexOf(':root {')))
  it.each(['ao-vivo', 'desempenho', 'receitas', 'equipe'])('%s — cada --esc-* da lei tem o MESMO valor no :root da casa', (n) => {
    const root = LEI(n).match(/:root\{([\s\S]*?)\}/)![1]
    const tokens = [...root.matchAll(/(--esc-[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)]
    expect(tokens.length).toBeGreaterThan(12)
    for (const [, k, v] of tokens) {
      const m = bloco.match(new RegExp(`${k}:\\s*(#[0-9a-f]{6})`))
      expect(m?.[1], `${k} da lei ${n}`).toBe(v.toLowerCase())
    }
  })
})

describe('R1 — os chips da produção', () => {
  // ⭐ (13/11) a família R continua: a lei MAIS NOVA (Rotinas, R25–R31) desenha os 6 chips e manda;
  // as 4 leis anteriores desenharam os 5 primeiros — eles seguem iguais, na mesma ordem (prefixo)
  it('a porta única tem os chips da lei mais nova (Rotinas), na ordem dela', () => {
    expect(CHIPS_DA_PRODUCAO.map((c) => c.rotulo)).toEqual(filhos(ler('docs/rotinas-referencia.html'), 'chips'))
  })
  it('as 4 leis anteriores são o PREFIXO da família (nenhum chip mudou de nome nem de lugar)', () => {
    for (const n of ['ao-vivo', 'desempenho', 'receitas', 'equipe']) {
      const daLei = filhos(LEI(n), 'chips')
      expect(CHIPS_DA_PRODUCAO.map((c) => c.rotulo).slice(0, daLei.length), n).toEqual(daLei)
    }
  })
  it.each([['ao-vivo', 'ao-vivo'], ['desempenho', 'desempenho'], ['receitas', 'receitas'], ['equipe', 'equipe']])('%s acende o próprio chip', (n, aba) => {
    expect(TELA(n)).toContain(`<ChipsDaProducao empresaId={id} aba="${aba}" />`)
  })
})

describe('as 4 telas: estado vazio honesto, falha com "tentar de novo" e os DOIS viewports', () => {
  it.each(['ao-vivo', 'desempenho', 'receitas', 'equipe'])('%s', (n) => {
    const t = TELA(n)
    expect(t, 'falha de leitura vira tela vazia').toMatch(/<FalhouDeLer oQue=/)
    expect(t, 'sem estado vazio').toMatch(/className="rx-vazio"/)
    expect(t, 'sem composição de celular').toMatch(/@media \(max-width:760px\)/)
  })
})

describe('AO VIVO v3 — R2–R8', () => {
  const lei = LEI('ao-vivo'), t = TELA('ao-vivo'), txt = textoDaTela(TELA('ao-vivo'))
  it('R2: os dois blocos, nesta ordem, com os cabeçalhos da lei', () => {
    expect(t.indexOf('Na mão agora')).toBeGreaterThan(-1)
    expect(t.indexOf('Na mão agora')).toBeLessThan(t.indexOf('Concluídas hoje'))
    expect(filhos(lei, 'lhead')).toEqual(['Quem · o quê', 'Começou', 'Tempo'])
    for (const h of filhos(lei, 'lhead')) expect(t).toContain(`>${h}<`)
  })
  it('R3/R4: as palavras da lei e o ⓘ igual', () => {
    for (const p of ['acima do normal', 'ainda sem mediana', 'tempo não mediu', 'aguarda conferência', 'abrir janela da cozinha →', 'sem mediana']) expect(t).toContain(p)
    expect(txt).toContain(pops(lei)[0])
  })
  it('⛔ R5/R6 VETADAS: nada de validade nem previsão de demanda; ⛔ R2: nenhum KPI do Painel, nenhum pódio', () => {
    for (const p of [/validade/i, /vence/i, /a noite vai pedir/i, /previs/i, /custo do dia/i, /lotes do dia/i, /pódio/i]) expect(txt).not.toMatch(p)
  })
  it('atualiza a cada 30s pela leitura leve', () => {
    expect(t).toMatch(/setInterval\(ler, 30_000\)/)
  })
})

describe('DESEMPENHO v2 — R9–R16', () => {
  const lei = LEI('desempenho'), t = TELA('desempenho'), txt = textoDaTela(TELA('desempenho'))
  it('R9: período Hoje · 7 dias · 30 dias + calendário nativo; abas Pessoas · Receitas; o título repete o período', () => {
    expect(t).toMatch(/'Hoje' : t === '7d' \? '7 dias' : '30 dias'/)
    expect(t).toContain('type="date"')
    expect(filhos(lei, 'abas')).toEqual(['Pessoas', 'Receitas'])
    for (const a of ['Pessoas', 'Receitas']) expect(t).toContain(`>${a}</button>`)
    expect(t).toMatch(/Quem fez o quê · <span>\{rot\}<\/span>/)
    expect(t).toMatch(/Receita por receita · <span>\{rot\}<\/span>/)
  })
  it('os cabeçalhos de coluna das duas abas são os da lei', () => {
    for (const c of ['phead', 'rhead']) for (const h of filhos(lei, c)) expect(t, `${c}: ${h}`).toContain(`>${h}<`)
  })
  it('os dois ⓘ dizem o que a lei diz', () => {
    for (const p of pops(lei)) expect(txt).toContain(p)
  })
  it('⛔ R11: a tela NÃO calcula barra — desenha a escala única que o motor mandou', () => {
    expect(t).not.toMatch(/barPct|Math\.max/)
    expect(t).toContain('`${p.barLotes}%`')
    expect(t).toContain('`${p.barMin}%`')
  })
  it('R13/R16: "fora da comparação" e "ver →" em toda linha', () => {
    expect(t).toContain('fora da comparação:')
    expect((t.match(/'ver →'/g) ?? []).length).toBe(2)
  })
})

describe('RECEITAS v2 — R17–R19 + R24', () => {
  const lei = LEI('receitas'), t = TELA('receitas'), txt = textoDaTela(TELA('receitas'))
  it('R17: os 5 filtros-contadores da lei, contados e filtrados pela MESMA função', () => {
    const rots = [...lei.matchAll(/\{rot:'([^']+)'/g)].map((m) => m[1])
    expect(rots).toEqual(['Todas', '⚠ Sem validade', '⚠ Custo incompleto', 'Nunca produzidas', 'Desativadas'])
    for (const r of rots) expect(t).toContain(`'${r}'`)
    expect(t).toContain('passaNoFiltro(r, filtro)')
  })
  it('cabeçalhos da lista e da ficha, e a verdade operacional no rodapé', () => {
    for (const h of filhos(lei, 'ghead')) expect(t).toContain(`>${h}<`)
    for (const p of ['Quantidade', 'Custo', 'desconta do estoque ao concluir o lote', '⚠ sem validade', 'nunca produzida', '⚠ sem preço']) expect(t).toContain(p)
    expect(txt).toContain(pops(lei)[0])
  })
  it('R24: editar · desativar · excluir receita na ficha; o servidor decide (prévia antes)', () => {
    for (const b of ['editar receita', 'desativar', 'excluir receita']) expect(t).toContain(`>${b}<`)
    expect(t).toMatch(/method: 'OPTIONS'/)
  })
})

describe('EQUIPE v2 — R20–R23', () => {
  const lei = LEI('equipe'), t = TELA('equipe'), txt = textoDaTela(TELA('equipe'))
  it('R22: "Nova conta" é cartão FIXO no topo, antes da lista; sem "+" em lugar nenhum', () => {
    expect(t.indexOf('data-testid="nova-conta"')).toBeGreaterThan(-1)
    expect(t.indexOf('data-testid="nova-conta"')).toBeLessThan(t.indexOf('data-testid="lista-contas"'))
    expect(txt).not.toMatch(/\+ ?(nova|adicionar)/i)
  })
  it('R20: os campos e os 3 papéis da lei; os cabeçalhos da lista', () => {
    for (const l of [...lei.matchAll(/<label>([^<]+)<\/label>/g)].map((m) => m[1])) expect(t).toContain(l)
    expect(filhos(lei, 'papeis')).toEqual(['Cozinha', 'Escritório', 'Aparelho'])
    for (const h of filhos(lei, 'ehead').filter(Boolean)) expect(t).toContain(`>${h}<`)
    expect(txt).toContain(pops(lei)[0])
  })
  it('⛔ R21: PIN digitado OCULTO, 4 dígitos, e a tela só diz "PIN definido ✓"', () => {
    expect((t.match(/type="password"/g) ?? []).length).toBe(2)
    expect((t.match(/maxLength=\{4\}/g) ?? []).length).toBe(2)
    expect(t).toContain('PIN definido ✓')
    expect(t, 'a conta da tela nunca tem campo de PIN pra desenhar').not.toMatch(/c\.pin\b/)
  })
  it('⛔ R23: excluir em toda conta, confirmação com números do servidor; "desativar" NÃO existe aqui', () => {
    expect(t).toContain('data-testid="excluir-conta"')
    expect(t).toContain('{confirmando.previa.frase}')
    expect(txt).not.toMatch(/desativar/i)
  })
})
