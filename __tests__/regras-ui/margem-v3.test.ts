/**
 * ⭐⭐ OS GUARDS DE TELA DA MARGEM v3 (07/10/2026).
 *
 * ⚠️ **Estrutural e assumido como tal**: o projeto roda em `environment: node`, sem jsdom —
 * não dá pra clicar nem medir pixel aqui. O que estes testes travam é a FORMA que já mordeu
 * nesta casa: hex cravado, opacidade sobre token, duas composições por viewport, e a tela
 * voltando a calcular dinheiro por conta própria.
 *
 * ⚠️ E a tela é lida **SEM COMENTÁRIO** — ela documenta no próprio texto os defeitos que
 * matou, e *"o arquivo que documenta o defeito não pode ser o que o absolve"* (a 11ª "menção,
 * não uso", 21/09).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { semComentarios, usosDe } from './_leitura-de-fonte'

const R = (p: string) => resolve(process.cwd(), p)
const TELA = R('app/(dashboard)/empresas/[id]/margem/page.tsx')
const ROTA = R('app/api/empresas/[id]/margem/route.ts')
const SIDEBAR = R('components/sidebar/global-sidebar.tsx')
const CASA = R('lib/margem/casa.ts')
const LEITURA = R('lib/margem/leitura.ts')

const ler = (p: string) => readFileSync(p, 'utf8')
const tela = semComentarios(ler(TELA))

describe('⛔⛔ ZERO HEX CRAVADO — a tela pinta por TOKEN, nos dois temas', () => {
  it('⛔ nenhuma cor literal no arquivo da tela', () => {
    // ⚠️ `#` de âncora/hash não conta — o que morde é cor hexadecimal de 3 ou 6 dígitos
    const hex = tela.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hex, `cores cravadas: ${hex.join(' ')}`).toHaveLength(0)
  })

  it('⛔⛔ nada de `bg-[var(--x)]/70` — no Tailwind 3 isso sai TRANSPARENTE (05/10)', () => {
    expect(tela).not.toMatch(/\[var\(--[a-z-]+\)\]\/\d/)
  })

  it('⭐ os tokens que a tela usa existem nos DOIS mapas do CSS', () => {
    const css = ler(R('app/globals.css'))
    /**
     * ⭐ Os dois mapas da casa são `:root` (claro) e `.dark` (escuro) — e a régua é a CONTAGEM
     * de declarações, não um fatiamento do arquivo: o `globals.css` tem **dois** blocos
     * `.dark` e vários `:root`, então cortar no primeiro `.dark {` acusa token que está lá
     * (foi o falso vermelho da 1ª versão deste guard).
     *
     * ⛔ Conferir só a EXISTÊNCIA aprovaria um token declarado apenas no claro — e a tela
     * ficaria com o texto de um tema sobre o fundo do outro. Medido no CSS que prod serve:
     * cada token aparece exatamente 2×.
     */
    const vezes = (t: string) => css.split(`${t}:`).length - 1
    const usados = [...new Set((tela.match(/var\((--[a-z0-9-]+)\)/g) ?? []).map((m) => m.slice(4, -1)))]
    expect(usados.length).toBeGreaterThan(8)
    for (const t of usados) {
      // ⚠️ `--fam-${x}-mid` é montado por template na tela: a família vem do payload
      if (t.startsWith('--fam-') && !/^--fam-[a-z]+-(bg|mid|ink)$/.test(t)) continue
      expect(vezes(t), `token ${t} precisa dos DOIS mapas (claro e escuro)`).toBeGreaterThanOrEqual(2)
    }
    // ⭐ os tokens de família montados por template têm que existir pra TODA família do mapa
    const familias = [
      ...new Set(
        [...ler(R('lib/stock/producao/cara-da-receita.ts')).matchAll(/familia: '([a-z]+)'/g)].map(
          (m) => m[1],
        ),
      ),
    ]
    expect(familias.length).toBeGreaterThan(4)
    for (const f of familias) {
      expect(vezes(`--fam-${f}-mid`), `--fam-${f}-mid nos dois mapas`).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('⛔ UMA COMPOSIÇÃO, DOIS VIEWPORTS (REGRA 12)', () => {
  it('⛔ nenhum bloco só-celular: não existe par `sm:hidden` × `hidden sm:`', () => {
    const soCel = (tela.match(/className="[^"]*\bsm:hidden\b/g) ?? []).length
    const soDesk = (tela.match(/className="[^"]*\bhidden sm:/g) ?? []).length
    expect(soCel + soDesk, 'duas composições do mesmo dado divergem no 1º selo novo').toBe(0)
  })

  it('⭐ a casa é SVG com viewBox + largura 100% — é o que a faz legível em 390px', () => {
    const i = tela.indexOf('function CasaDeTijolos')
    const bloco = tela.slice(i, tela.indexOf('function Conta'))
    expect(bloco).toContain('viewBox=')
    expect(bloco).toMatch(/className="w-full"/)
    // ⛔ largura fixa em px no SVG quebraria no celular
    expect(bloco).not.toMatch(/<svg[^>]*width="\d/)
  })

  it('⛔⛔ a pilha de tijolos NUNCA estoura o telhado (a sobreposição de 07/10)', () => {
    const i = tela.indexOf('function CasaDeTijolos')
    const bloco = tela.slice(i, tela.indexOf('function Conta'))
    // ⭐ a altura de cada tijolo é a fatia DELE vezes a altura PAGA — nunca vezes H cru:
    // com a sobra passando do custo fixo, `× H` fazia a pilha passar do telhado e o
    // `Math.max(0, y)` empilhava os de cima um sobre o outro.
    expect(bloco).toMatch(/t\.pctDaSobra \* alturaPaga/)
    expect(bloco).not.toMatch(/t\.pctDaSobra \* H/)
    // ⚠️ e `alturaPaga` tem que ser calculada ANTES do laço que empilha
    expect(bloco.indexOf('const alturaPaga')).toBeLessThan(bloco.indexOf('c.tijolos.map'))
  })

  it('⭐ o rótulo do tijolo só é desenhado quando CABE — senão vaza do tijolo', () => {
    const i = tela.indexOf('function CasaDeTijolos')
    const bloco = tela.slice(i, tela.indexOf('function Conta'))
    // ⚠️ dois degraus (26px e 12px) + o truncamento do nome
    expect(bloco).toMatch(/h >= 26/)
    expect(bloco).toMatch(/h >= 12/)
    expect(bloco).toMatch(/slice\(0, 2[0-9]\)/)
  })
})

describe('⛔⛔ A TELA NÃO CALCULA DINHEIRO — ela desenha o payload', () => {
  it('⛔ nenhuma aritmética de dinheiro na tela', () => {
    // ⚠️ o que se permite é GEOMETRIA (as frações do SVG e a largura da barra), nunca somar
    // ou subtrair valor — a Σ e a subtração moram em `casa.ts`/`sobra.ts`
    expect(usosDe(tela, 'sobraTotal')).toBeGreaterThan(0)
    // ⛔ a tela não pode somar os tijolos nem subtrair o complemento
    expect(tela).not.toMatch(/reduce\([^)]*sobra/)
    expect(tela).not.toMatch(/sobraTotal\s*-\s*/)
    expect(tela).not.toMatch(/custoFixo\s*-\s*/)
  })

  it('⭐ a tela usa o VEREDITO e a RESSALVA do servidor, nunca compara por conta própria', () => {
    expect(usosDe(tela, 'veredito')).toBeGreaterThan(1)
    expect(tela).toContain('{c.veredito.ressalva}')
    // ⛔ comparar sobra com custo fixo aqui seria a 2ª régua do "pagou"
    expect(tela).not.toMatch(/sobraLiquida\s*>=?\s*/)
  })

  it('⭐ REGRA 4: o logo deriva do NOME pela mesma `caraDaReceita`, sem 2ª derivação', () => {
    expect(tela).toContain('<LogoDaReceita nome={x.nome}')
    // ⛔ `forcar` aqui seria a 2ª tradução de nome → cor/ícone
    expect(tela).not.toMatch(/LogoDaReceita[^/]*forcar=/)
  })
})

describe('⛔⛔ NADA DE AVISO INLINE (a lei de 04/10) — o que pede AÇÃO vai pro sininho', () => {
  it('⛔ a tela não monta o bloco de avisos', () => {
    expect(tela).not.toContain('BlocoDeAvisos')
    expect(usosDe(tela, 'registrarAviso')).toBe(0)
  })

  it('⭐ e o produtor do sininho EXISTE e está ligado na rodada', () => {
    const prod = semComentarios(ler(R('lib/avisos/produtores/margem.ts')))
    expect(usosDe(prod, 'registrarAviso')).toBeGreaterThan(0)
    const rodar = semComentarios(ler(R('lib/avisos/produtores/rodar.ts')))
    expect(usosDe(rodar, 'produzirAvisosDeMargem'), 'produtor sem chamador é promessa').toBeGreaterThan(0)
  })
})

describe('⭐ A TELA DIZ A COMPOSIÇÃO DOS CHIPS, e o veredito nunca vem seco', () => {
  it('⛔ a frase da composição é desenhada', () => {
    expect(tela).toContain('{c.composicao.texto}')
  })

  it('⛔⛔ o custo do complemento aparece NOMEADO na conta da casa', () => {
    expect(tela).toContain('complementos')
    expect(tela).toContain('ocorrenciasComCusto')
    // ⚠️ e o PISO é dito: o custo é o mínimo, não o total
    expect(tela).toContain('ocorrenciasSemCusto')
    // ⚠️ a frase quebra em duas linhas no JSX — a âncora é o pedaço contíguo
    expect(tela).toContain('custo acima é o mínimo, não o total')
  })

  it('⭐ a cobertura e o placar aparecem — o dia D nunca sozinho', () => {
    expect(tela).toContain('cobertura')
    expect(tela).toContain('{c.placar.porque}')
  })
})

describe('⭐ A FRONTEIRA DE PAPEL — isto é DINHEIRO, não operação de estoque', () => {
  it('⛔ a rota exige `transaction.view`, nunca `stock.view`', () => {
    const rota = semComentarios(ler(ROTA))
    expect(rota).toContain("requirePermission('transaction.view')")
    expect(rota).not.toContain('stock.view')
  })

  it('⛔ o item do menu exige a MESMA permissão da página (a porta acompanha a sala)', () => {
    const sb = semComentarios(ler(SIDEBAR))
    const i = sb.indexOf('/margem`')
    expect(i).toBeGreaterThan(-1)
    const bloco = sb.slice(Math.max(0, i - 400), i + 200)
    expect(bloco).toContain('perm="transaction.view"')
  })
})

describe('⛔⛔ O MOTOR NÃO PODE VOLTAR A ESCONDER O COMPLEMENTO NEM A CRAVAR O FATOR', () => {
  it('⛔ a casa decide "pagou" pela sobra LÍQUIDA', () => {
    const casa = semComentarios(ler(CASA))
    expect(casa).toMatch(/pagou\s*=.*sobraLiquida/)
    expect(casa).toMatch(/sobraLiquida\s*=\s*round2\(sobraTotal - complementos\.custo\)/)
  })

  it('⛔⛔ NENHUM fator por tamanho no motor da margem (o fator morreu em 07/10)', () => {
    for (const f of ['casa.ts', 'sobra.ts', 'liga.ts', 'leitura.ts', 'por-dia.ts', 'ficha-de-margem.ts']) {
      const src = semComentarios(ler(R(`lib/margem/${f}`)))
      expect(src, `${f} não pode multiplicar por fator de tamanho`).not.toMatch(/fator/i)
    }
  })

  it('⭐ "GRANDE" é tamanho vazado e a lista é FECHADA', () => {
    const l = semComentarios(ler(LEITURA))
    expect(l).toContain('NAO_SAO_SABOR')
    expect(l).toMatch(/'GRANDE'/)
    expect(usosDe(l, 'ehSaborDeVerdade')).toBeGreaterThan(1)
  })
})
