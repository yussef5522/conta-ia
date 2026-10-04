/**
 * ⭐⭐⭐ OS DOIS TEMAS — GUARD DA RAIZ, DO CONTRASTE E DA PORTA ÚNICA (04/10/2026).
 *
 * **Ordem do dono:** *"implementação POR TOKEN, nunca por página: 2 mapas de design tokens NA
 * RAIZ"* · *"contraste conferido no escuro (nenhum texto tom 600 em fundo 800)"* · *"escolha
 * salva em tabela por usuário — **nunca localStorage**"* · *"default = claro"*.
 *
 * ⛔⛔ **O TESTE QUE MAIS IMPORTA É O DA ESPECIFICIDADE.** `[data-tela='x']` vale (0,1,0) e
 * `.dark` vale (0,1,0) — **empate**. Um bloco escopado que redefina token EMPATA com o tema e
 * ganha por ordem de arquivo: a tela ficaria CLARA dentro do tema escuro, e justamente as duas
 * telas que o dono abre todo dia. Por isso token escopado é vermelho aqui.
 *
 * ⚠️ REGRA 3: o contraste é CALCULADO (WCAG 2.1 sobre os hex reais do arquivo), não conferido
 * "no olho" nem por grep de nome de tom. É o que transforma *"nenhum texto 600 em fundo 800"*
 * de recomendação em número que reprova.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { normalizarTema, classeDoTema, alternar, caraDoBotao, TEMA_PADRAO } from '@/lib/tema/preferencia'

const RAIZ = process.cwd()
const css = readFileSync(join(RAIZ, 'app/globals.css'), 'utf8')

/** ⚠️ sem comentário: o arquivo que DOCUMENTA o defeito não pode ser o que o absolve (21/09) */
function semComentario(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** junta as declarações de TODOS os blocos cujo seletor é exatamente `sel` */
function declaracoesDe(sel: string): Record<string, string> {
  const limpo = semComentario(css)
  const out: Record<string, string> = {}
  /** ⚠️ o `[}{]` é obrigatório: o bloco do shadcn vive DENTRO de `@layer base {`, então ele é
   *  precedido por `{`, não por `}`. Com o regex só olhando `}` ele ficava INVISÍVEL — e o
   *  guard do espelho passaria achando que o claro não define `--background`. */
  const re = new RegExp(`(?:^|[}{])\\s*${sel.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(limpo))) {
    for (const linha of m[1].split(';')) {
      const [k, ...v] = linha.split(':')
      if (!k || !v.length) continue
      const nome = k.trim()
      if (nome.startsWith('--')) out[nome] = v.join(':').trim()
    }
  }
  return out
}

const CLARO = declaracoesDe(':root')
const ESCURO = declaracoesDe('.dark')

/** ⭐ `--radius` é geometria, não cor — tema não muda raio de borda */
const SEM_ESPELHO_ESCURO = new Set(['--radius'])

// ───────────────────────────────── a RAIZ ─────────────────────────────────

describe('⭐⭐ os dois mapas vivem na RAIZ, e são espelho um do outro', () => {
  it('⭐ o `:root` define os tokens de produção e de família', () => {
    expect(CLARO['--prod-bg'], 'canvas claro na raiz').toBe('#f8fafc')
    expect(CLARO['--prod-surface']).toBe('#fff')
    expect(CLARO['--prod-line']).toBe('#e2e8f0')
    expect(CLARO['--prod-primary']).toBe('#0f172a')
    expect(CLARO['--fam-indigo-bg']).toBeTruthy()
  })

  it('⭐ o `.dark` traz o escuro premium que o dono pediu', () => {
    expect(ESCURO['--prod-bg']).toBe('#16151d')
    expect(ESCURO['--prod-surface']).toBe('#1e1d28')
    expect(ESCURO['--prod-line']).toBe('#2a2936')
    expect(ESCURO['--prod-primary']).toBe('#f4f3fb')
  })

  /**
   * ⛔⛔ ESTE é o teste que torna o tema POSSÍVEL: todo token do claro tem par no escuro.
   * Ele pega de uma vez (a) o `.dark` do shadcn que NÃO EXISTIA até hoje — sem ele
   * `bg-background`/`text-foreground` ficariam claros com a classe ligada, que é mais ilegível
   * que o tema claro inteiro — e (b) o token novo que alguém acrescentar só no claro.
   */
  it('⛔⛔ TODO token do `:root` tem espelho no `.dark` (inclui os do shadcn)', () => {
    const faltando = Object.keys(CLARO).filter((k) => !SEM_ESPELHO_ESCURO.has(k) && !(k in ESCURO))
    expect(faltando, `tokens sem versão escura: ${faltando.join(', ')}`).toEqual([])
  })

  it('⛔ e o escuro não inventa token que o claro não tem', () => {
    const sobrando = Object.keys(ESCURO).filter((k) => !(k in CLARO))
    expect(sobrando, `tokens só no escuro: ${sobrando.join(', ')}`).toEqual([])
  })

  /**
   * ⛔⛔⛔ A ARMADILHA DA ESPECIFICIDADE — o motivo de os blocos `[data-tela='producao-*']`
   * terem SAÍDO em 04/10. Dois donos pra mesma variável é a doença que este projeto mais paga,
   * agora em CSS: o escopado empata com `.dark` e vence por ordem de arquivo.
   */
  it('⛔⛔ NENHUM bloco `[data-tela=…]` redefine token de tema', () => {
    const limpo = semComentario(css)
    const re = /\[data-tela=[^\]]+\][^{]*\{([^}]*)\}/g
    const ofensores: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(limpo))) {
      for (const linha of m[1].split(';')) {
        const nome = linha.split(':')[0]?.trim()
        if (nome?.startsWith('--')) ofensores.push(`${nome} em ${m[0].slice(0, 40)}…`)
      }
    }
    expect(ofensores, `token escopado em [data-tela] sombreia o .dark: ${ofensores.join(' | ')}`).toEqual([])
  })

  it('⛔ e nenhum `.dark [data-tela=…]` sobrou (era o espelho do bloco escopado)', () => {
    expect(semComentario(css)).not.toMatch(/\.dark\s*\[data-tela=/)
  })
})

// ──────────────────────────────── o CONTRASTE ────────────────────────────────

/** luminância relativa WCAG 2.1 */
function luminancia(hex: string): number {
  const h = hex.trim().replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function razao(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

const FAMILIAS = ['indigo', 'azul', 'verde', 'ambar', 'coral', 'teal', 'rosa', 'cinza'] as const

describe('⛔⛔ contraste MEDIDO nos dois temas (a régua do "nenhum 600 em fundo 800")', () => {
  for (const tema of ['claro', 'escuro'] as const) {
    const mapa = tema === 'claro' ? CLARO : ESCURO

    it(`⭐ ${tema}: o texto do cartão colorido (-ink) passa em TODAS as 8 famílias`, () => {
      for (const f of FAMILIAS) {
        const r = razao(mapa[`--fam-${f}-ink`], mapa[`--fam-${f}-bg`])
        expect(r, `${f} no ${tema}: ink sobre bg = ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
      }
    })

    /**
     * ⭐⭐ A INVERSÃO 50↔800 CHECADA PELA LUMINÂNCIA, não pelo nome do tom. No claro o fundo é
     * o tom claro e a tinta é escura; **no escuro troca** — era o pedido literal do dono, e
     * sem isso o cartão índigo viraria um bloco claro queimando no meio da tela preta.
     */
    it(`⭐⭐ ${tema}: a escada bg → mid → ink anda no sentido certo nas 8 famílias`, () => {
      for (const f of FAMILIAS) {
        const [bg, mid, ink] = [`bg`, `mid`, `ink`].map((d) => luminancia(mapa[`--fam-${f}-${d}`]))
        if (tema === 'claro') {
          expect(bg, `${f}: fundo claro mais claro que o meio`).toBeGreaterThan(mid)
          expect(mid, `${f}: meio mais claro que a tinta`).toBeGreaterThan(ink)
        } else {
          expect(bg, `${f}: fundo escuro mais escuro que o meio`).toBeLessThan(mid)
          expect(mid, `${f}: meio mais escuro que a tinta`).toBeLessThan(ink)
        }
      }
    })

    it(`⭐ ${tema}: primário e secundário passam sobre a superfície`, () => {
      const sup = mapa['--prod-surface']
      expect(razao(mapa['--prod-primary'], sup)).toBeGreaterThanOrEqual(4.5)
      expect(razao(mapa['--prod-secondary'], sup)).toBeGreaterThanOrEqual(4.5)
      // ⚠️ o `muted` é rótulo de apoio: piso de 3:1 (texto grande/secundário), nunca 2,5
      expect(razao(mapa['--prod-muted'], sup)).toBeGreaterThanOrEqual(3)
    })

    /**
     * ⚠️ A PÍLULA "SEM PEDIDO" quase passou como "discreta" sendo ILEGÍVEL: `#94a0b8` sobre
     * `#f1f3f8` dava **2,37:1**. O mudo vem do fundo cinza ao lado das pílulas coloridas, não
     * de apagar a tinta.
     */
    it(`⭐ ${tema}: a pílula muda ("sem pedido") é discreta, não ilegível`, () => {
      expect(razao(mapa['--prod-mudo'], mapa['--prod-mudo-bg'])).toBeGreaterThanOrEqual(4.5)
    })

    it(`⭐ ${tema}: a AÇÃO primária tem texto legível sobre o próprio fundo`, () => {
      const r = razao(mapa['--prod-acao-ink'], mapa['--prod-acao-bg'])
      expect(r, `botão "Nova ordem" no ${tema}: ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    })
  }

  /**
   * ⭐ E o botão de ação INVERTE: no claro é índigo forte com tinta branca, no escuro o fundo
   * CLAREIA (#7F77DD) e a tinta ESCURECE. Com `text-white` cravado no JSX (como estava até
   * 04/10) o escuro daria branco sobre lilás claro.
   */
  it('⭐⭐ a ação primária clareia no escuro e a tinta dela escurece', () => {
    expect(luminancia(ESCURO['--prod-acao-bg'])).toBeGreaterThan(luminancia(CLARO['--prod-acao-bg']))
    expect(luminancia(ESCURO['--prod-acao-ink'])).toBeLessThan(luminancia(CLARO['--prod-acao-ink']))
  })
})

// ───────────────────────── a PREFERÊNCIA (nunca localStorage) ─────────────────────────

describe('⛔⛔ a escolha vive em TABELA, nunca no navegador', () => {
  const arquivos = [
    'lib/tema/preferencia.ts',
    'lib/tema/servidor.ts',
    'components/layout/botao-tema.tsx',
    'components/layout/tema-do-dashboard.tsx',
    'app/api/tema/route.ts',
    'app/(dashboard)/layout.tsx',
  ]

  it('⛔ nenhum arquivo do tema toca localStorage/sessionStorage/cookie de tema', () => {
    for (const f of arquivos) {
      const src = semComentario(readFileSync(join(RAIZ, f), 'utf8'))
      expect(src, `${f} não pode guardar tema no navegador`).not.toMatch(/localStorage|sessionStorage/)
    }
  })

  it('⭐ a tabela é a fonte: o layout lê pelo `lerTema` do servidor', () => {
    const layout = readFileSync(join(RAIZ, 'app/(dashboard)/layout.tsx'), 'utf8')
    expect(layout).toMatch(/lerTema\(/)
    const servidor = readFileSync(join(RAIZ, 'lib/tema/servidor.ts'), 'utf8')
    expect(servidor).toMatch(/userTemaPreferencia/)
  })

  it('⭐ e a migration é CREATE-only, com CHECK na FORMA e não no vocabulário', () => {
    /** ⚠️ sem os comentários `--`: a instrução de ROLLBACK escrita no topo do arquivo contém
     *  um `DROP TABLE`, e o guard mordia a própria documentação dele (a lição de 21/09, agora
     *  em SQL). */
    const sql = readFileSync(
      join(RAIZ, 'prisma/migrations/20261005120000_user_tema_preferencia/migration.sql'),
      'utf8',
    ).replace(/^\s*--.*$/gm, '')
    expect(sql).toMatch(/CREATE TABLE "user_tema_preferencia"/)
    expect(sql, 'migration de tema não faz ALTER/DROP em tabela existente').not.toMatch(/ALTER TABLE|DROP TABLE/)
    expect(sql, 'CHECK na forma: não-vazio e minúsculo').toMatch(/lower\("tema"\)/)
    expect(sql, 'vocabulário fechado no banco envelhece mal (cicatriz de 21/09)').not.toMatch(/IN \('claro'/)
  })
})

describe('⭐ a régua pura do tema', () => {
  it('⭐⭐ default é CLARO — e vale pra ausência E pra lixo', () => {
    expect(TEMA_PADRAO).toBe('claro')
    expect(normalizarTema(undefined)).toBe('claro')
    expect(normalizarTema(null)).toBe('claro')
    expect(normalizarTema('')).toBe('claro')
    expect(normalizarTema('roxo')).toBe('claro')
    expect(normalizarTema(42)).toBe('claro')
  })

  it('⭐ aceita o que o banco grava, tolerando caixa e espaço', () => {
    expect(normalizarTema('escuro')).toBe('escuro')
    expect(normalizarTema(' ESCURO ')).toBe('escuro')
    expect(normalizarTema('claro')).toBe('claro')
  })

  it('⭐ a classe é a do Tailwind (`dark`), e no claro é VAZIA — nunca "light"', () => {
    expect(classeDoTema('escuro')).toBe('dark')
    expect(classeDoTema('claro')).toBe('')
  })

  it('⭐ alternar vai e volta', () => {
    expect(alternar('claro')).toBe('escuro')
    expect(alternar(alternar('claro'))).toBe('claro')
  })

  /** ⚠️ o ícone anuncia PRA ONDE o toque leva (convenção GitHub/Linear), não o estado atual */
  it('⭐ no claro mostra LUA, no escuro SOL — e o título explica', () => {
    expect(caraDoBotao('claro').icone).toBe('lua')
    expect(caraDoBotao('claro').titulo).toMatch(/escurecer/)
    expect(caraDoBotao('escuro').icone).toBe('sol')
    expect(caraDoBotao('escuro').titulo).toMatch(/claro/)
  })
})

// ─────────────────────────── onde a classe entra ───────────────────────────

describe('⛔⛔ a classe `dark` vai no documentElement — portal não fica claro no escuro', () => {
  /**
   * ⛔ Modal, dropdown e toast do Radix renderizam em PORTAL direto no `<body>`. Com a classe
   * num wrapper interno do dashboard, **todo menu abriria CLARO dentro do tema escuro** — e
   * isso é invisível em qualquer teste de página.
   */
  it('⭐ o layout do dashboard mexe em `documentElement.classList`', () => {
    const layout = readFileSync(join(RAIZ, 'app/(dashboard)/layout.tsx'), 'utf8')
    expect(layout).toMatch(/documentElement\.classList/)
  })

  it('⭐ e o desmonte limpa a classe (senão o login herda o escuro)', () => {
    const comp = readFileSync(join(RAIZ, 'components/layout/tema-do-dashboard.tsx'), 'utf8')
    expect(comp).toMatch(/classList\.remove\('dark'\)/)
    expect(comp, 'a limpeza tem que estar no return do efeito').toMatch(/return\s*\(\)\s*=>/)
  })

  /**
   * ⚠️ O canvas da casa era `bg-zinc-50` CRAVADO no shell — e o shell é `h-screen`, ou seja é
   * ELE que o olho vê como fundo. Deixá-lo em zinc deixaria o tema escuro com chão claro.
   */
  it('⛔ o shell não tem mais fundo cravado — canvas é token', () => {
    const shell = semComentario(readFileSync(join(RAIZ, 'components/layout/dashboard-shell.tsx'), 'utf8'))
    expect(shell, 'bg-zinc-50 cravado volta a deixar o chão claro no tema escuro').not.toMatch(/bg-zinc-50/)
    expect(shell).toMatch(/var\(--prod-bg\)/)
  })

  it('⛔ e a barra global também lê token (faixa branca no topo do escuro = tema quebrado)', () => {
    const bar = semComentario(readFileSync(join(RAIZ, 'components/layout/top-bar.tsx'), 'utf8'))
    expect(bar).not.toMatch(/bg-white/)
    expect(bar).toMatch(/var\(--prod-surface\)/)
  })
})

describe('⭐ REGRA 12 — o botão é o MESMO componente nos 2 viewports', () => {
  it('⭐ TopBar (desktop) e header do celular usam `BotaoTema`', () => {
    const bar = readFileSync(join(RAIZ, 'components/layout/top-bar.tsx'), 'utf8')
    const shell = readFileSync(join(RAIZ, 'components/layout/dashboard-shell.tsx'), 'utf8')
    expect(bar).toMatch(/<BotaoTema\s/)
    expect(shell).toMatch(/<BotaoTema\s/)
  })

  /**
   * ⛔ Uma 2ª implementação do toggle divergiria no 1º ajuste — e é o erro que esta casa já
   * pagou em 7 detectores de par. Só `botao-tema.tsx` pode ligar/desligar a classe.
   */
  it('⛔ só existe UM lugar que troca a classe no cliente', () => {
    const botao = semComentario(readFileSync(join(RAIZ, 'components/layout/botao-tema.tsx'), 'utf8'))
    expect(botao).toMatch(/classList\.add\('dark'\)/)
    // ⭐ e ele ANUNCIA, pra as duas instâncias nunca divergirem sobre qual tema está no ar
    expect(botao).toMatch(/tema:mudou/)
    const temaDoDash = semComentario(readFileSync(join(RAIZ, 'components/layout/tema-do-dashboard.tsx'), 'utf8'))
    expect(temaDoDash, 'o componente de limpeza não desenha botão nenhum').not.toMatch(/<button/)
  })

  /** ⚠️ pinta primeiro, grava depois — e se a gravação falhar, a cor VOLTA com o motivo */
  it('⭐⭐ a falha do PUT reverte a cor (nunca "salvo" que não salvou)', () => {
    const botao = semComentario(readFileSync(join(RAIZ, 'components/layout/botao-tema.tsx'), 'utf8'))
    const catch_ = botao.slice(botao.indexOf('} catch'))
    expect(catch_, 'o catch tem que reaplicar o tema anterior').toMatch(/aplicarTema\(anterior\)/)
    expect(catch_).toMatch(/setErro\(/)
  })
})
