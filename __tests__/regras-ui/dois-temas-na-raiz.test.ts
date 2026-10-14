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
import { lerReferenciaVisual, CAMINHO_DA_FUNDACAO } from '@/lib/referencias/visual'
import { telasDoApp } from './_leitura-de-fonte'
import { descreverViolacao, paresDeCor, violacoesL7NoCss } from '@/lib/ui/varredura-l7'

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

/**
 * ⭐⭐⭐ A REFERÊNCIA DA FUNDAÇÃO É LEI — O GUARD ABRE O ARQUIVO (14/10/2026).
 *
 * ⚠️ ESTES TESTES SUBSTITUÍRAM 8 VALORES CRAVADOS, COM O MOTIVO ESCRITO. Até 13/10 eles
 * afirmavam o canvas `#f8fafc` / `#16151d`, a superfície `#fff` / `#1e1d28` etc. — **os tons que
 * o dono pediu EM PROSA em 04/10**. A `docs/cara-do-sistema-referencia.html`, aprovada por ele,
 * declara outros: `#F3F5FA` / `#0B0E1C`, `#FFFFFF` / `#141829`. **A HIERARQUIA DAS LEIS resolve:
 * a referência da fundação manda nos TOKENS do sistema; as de TELA mandam na estrutura das telas
 * delas; em conflito de token, a fundação vence.** Então o valor saiu da memória de um pedido e
 * passou a ser LIDO do arquivo versionado — tom ajustado "no olho" fica vermelho apontando o hex
 * que o arquivo manda, em vez de passar porque o literal do teste foi editado junto.
 *
 * ⛔⛔ E A COMPARAÇÃO É POR **VALOR**, nunca por presença de nome: o `margem-bate-com-a-referencia`
 * casa token→token por NOME (e está certo no papel dele, que é estrutura de tela); aqui o que
 * importa é a COR que o token carrega. Guard que só conta nomes aprova a paleta trocada — foi
 * exatamente como o guard do mock da Conciliação nasceu cego em 13/09.
 */
const REF = lerReferenciaVisual(CAMINHO_DA_FUNDACAO)

/** ⚠️ `#fff` e `#FFFFFF` são a MESMA cor — comparar sem normalizar daria vermelho sobre valores idênticos */
function hexCheio(v: string | undefined): string | undefined {
  if (!v) return v
  const h = v.trim().toLowerCase()
  if (!/^#[0-9a-f]{3}$/.test(h)) return h
  return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
}

/**
 * ⭐ O ESCURO DA REFERÊNCIA É A CASCATA, NÃO O BLOCO: o `:root[data-theme="dark"]` só redefine o
 * que ele LISTA — tudo que falta ali segue valendo do `:root`. É isso que torna *"o trilho é
 * igual nos 2 temas"* (L1) uma consequência do arquivo, não um combinado: a referência declara
 * os 7 tokens do trilho UMA vez e não os redefine no escuro.
 */
const REF_ESCURO = { ...REF.valores, ...REF.valoresEscuros }

/**
 * O mapa 1:1 por PAPEL (referência → os tokens da casa que carregam aquela cor).
 *
 * ⛔ Fica FORA de propósito, e cada ausência tem motivo:
 *  · `--fam-{azul,teal,rosa,cinza}-*` — identidade de PRODUTO (a bolinha do `caraDaReceita`); a
 *    própria referência usa esses tons cravados nos `.ponto` dela, não como token;
 *  · `--fam-*-{solid,on,on-soft}` — o chão que INVERTE por tema é desenho da CASA (10/10); a
 *    referência não tem o conceito de `-solid`, então aqui eles são validados pelo NÚMERO (os
 *    testes de contraste mais abaixo), que é a régua certa pra eles;
 *  · `--prod-acao-ink` — nasceu pra consertar a L7 que a própria referência viola (`.bt.p` com
 *    branco sobre o índigo claro dá 2,98:1); ela não tem token pra isso.
 */
const MAPA_DA_FUNDACAO: Record<string, string[]> = {
  '--bg': ['--prod-bg'],
  '--card': ['--prod-surface'],
  '--card-2': ['--prod-surface-1', '--prod-mudo-bg'],
  '--linha': ['--prod-line'],
  '--linha-forte': ['--prod-line-strong'],
  '--tinta': ['--prod-primary'],
  '--tinta-2': ['--prod-secondary', '--prod-mudo'],
  '--acao': ['--prod-accent', '--prod-acao-bg', '--fam-indigo-mid'],
  '--acao-quente': ['--prod-acao-quente'],
  '--acao-50': ['--prod-surface-2', '--fam-indigo-bg'],
  '--acao-tinta': ['--fam-indigo-ink'],
  '--trilho': ['--prod-trilho'],
  '--trilho-borda': ['--prod-trilho-borda'],
  '--trilho-tx': ['--prod-trilho-tx'],
  '--trilho-kicker': ['--prod-trilho-kicker'],
  '--trilho-on': ['--prod-trilho-on'],
  '--trilho-pilula': ['--prod-trilho-pilula'],
  '--trilho-hover': ['--prod-trilho-hover'],
  '--verde': ['--prod-verde', '--fam-verde-mid'],
  '--verde-50': ['--prod-verde-bg', '--fam-verde-bg'],
  '--verde-tinta': ['--fam-verde-ink'],
  '--coral': ['--prod-coral', '--fam-coral-mid'],
  '--coral-50': ['--prod-coral-bg', '--fam-coral-bg'],
  '--coral-tinta': ['--fam-coral-ink'],
  '--ambar': ['--prod-ambar', '--fam-ambar-mid'],
  '--ambar-50': ['--prod-ambar-bg', '--fam-ambar-bg'],
  '--ambar-tinta': ['--fam-ambar-ink'],
}

/**
 * ⚠️⚠️ AS DUAS DIVERGÊNCIAS DELIBERADAS — cada uma com a MEDIÇÃO que a justifica, porque a
 * régua desta casa é *"a medição vence a letra do pedido"* (o precedente de 10/10, quando o
 * `-mid` como chão de texto branco reprovou em 6 dos 8 casos e o desenho mudou).
 */
const DIVERGENCIAS_MEDIDAS: Record<string, { casa: [string, string]; porque: string }> = {
  '--tinta-3': {
    casa: ['#7e89a4', '#6a7390'],
    porque:
      'a tinta de DICA da referência (#8B94AD) dá 2,78:1 sobre o papel e 2,83:1 sobre o bloco — ' +
      'abaixo até do piso de 3:1 de TEXTO GRANDE. Os tons da casa dão 3,21 e 3,47 no pior chão.',
  },
}

describe('⭐⭐⭐ a fundação é LEI — os tokens da casa batem com a referência, valor a valor', () => {
  it('⛔⛔ o `:root` carrega os valores que a referência declara pro tema CLARO', () => {
    const divergem: string[] = []
    for (const [daRef, naCasa] of Object.entries(MAPA_DA_FUNDACAO)) {
      const esperado = hexCheio(REF.valores[daRef])
      expect(esperado, `a referência não declara ${daRef} — o mapa envelheceu`).toBeTruthy()
      for (const token of naCasa) {
        const achado = hexCheio(CLARO[token])
        if (achado !== esperado) divergem.push(`${token}=${achado} ≠ ${daRef}=${esperado}`)
      }
    }
    expect(divergem, `tom ajustado fora da referência: ${divergem.join(' | ')}`).toEqual([])
  })

  it('⛔⛔ o `.dark` carrega os valores que a referência declara pro tema ESCURO', () => {
    const divergem: string[] = []
    for (const [daRef, naCasa] of Object.entries(MAPA_DA_FUNDACAO)) {
      const esperado = hexCheio(REF_ESCURO[daRef])
      for (const token of naCasa) {
        const achado = hexCheio(ESCURO[token])
        if (achado !== esperado) divergem.push(`${token}=${achado} ≠ ${daRef}=${esperado}`)
      }
    }
    expect(divergem, `tom ajustado fora da referência: ${divergem.join(' | ')}`).toEqual([])
  })

  /**
   * ⭐ A L1 VIRA CONSEQUÊNCIA, NÃO COMBINADO: o trilho é escuro NOS DOIS TEMAS porque é a MARCA.
   * Sem este teste, "igual nos dois" é uma frase de comentário; com ele, clarear o trilho no
   * escuro — que o olho pediria, e que era o que a casa fazia até 13/10 — fica vermelho.
   */
  it('⭐ os 7 tokens do TRILHO são IDÊNTICOS nos dois temas (L1 — é a marca, não o tema)', () => {
    const trilho = Object.keys(CLARO).filter((k) => k.startsWith('--prod-trilho'))
    expect(trilho.length, 'os 7 tokens do trilho na raiz').toBe(7)
    const diferentes = trilho.filter((k) => hexCheio(CLARO[k]) !== hexCheio(ESCURO[k]))
    expect(diferentes, `trilho mudou de cor no escuro: ${diferentes.join(', ')}`).toEqual([])
  })

  /** ⚠️ divergência SEM a medição escrita é "ajustei no olho" com outro nome */
  it('⚠️ as divergências da referência são EXATAMENTE as declaradas, com a medição', () => {
    for (const [daRef, { casa, porque }] of Object.entries(DIVERGENCIAS_MEDIDAS)) {
      const [claro, escuro] = casa
      expect(hexCheio(CLARO['--prod-muted']), `${daRef} claro`).toBe(claro)
      expect(hexCheio(ESCURO['--prod-muted']), `${daRef} escuro`).toBe(escuro)
      expect(hexCheio(REF.valores[daRef]), `a referência mudou ${daRef} — remedir`).not.toBe(claro)
      expect(porque.length, 'a divergência tem que dizer o número').toBeGreaterThan(60)
    }
  })

  /** ⭐ geometria e elevação também são da fundação (L6 + raios 16/12) */
  it('⭐ raios e sombra vêm da referência', () => {
    expect(REF.css).toContain('--r-painel:16px')
    expect(REF.css).toContain('--r-cartao:12px')
    expect(CLARO['--prod-r-painel']).toBe('16px')
    expect(CLARO['--prod-r-cartao']).toBe('12px')
    expect(ESCURO['--prod-r-painel']).toBe('16px')
    expect(ESCURO['--prod-r-cartao']).toBe('12px')

    /** ⚠️ L6: sombra curta de 2 camadas SÓ no claro; no escuro a elevação é SUPERFÍCIE */
    expect(CLARO['--prod-sombra']).toMatch(/rgba\(10,\s*15,\s*30/)
    expect((CLARO['--prod-sombra'] ?? '').split('px ').length, '2 camadas no claro').toBeGreaterThan(2)
    expect(REF.css).toContain('--sombra:none')
    expect(ESCURO['--prod-sombra']).not.toMatch(/rgba\(10,\s*15,\s*30/)
  })

  /**
   * ⛔ A referência declara o escuro DUAS vezes (no `@media` e no `[data-theme]`) de propósito —
   * é o que faz o botão de tema ganhar nos dois sentidos. Se os dois blocos DIVERGIREM, metade
   * dos usuários (os que nunca tocaram no botão) vê uma paleta e a outra metade vê outra.
   */
  it('⛔ os dois blocos escuros DA REFERÊNCIA concordam entre si', () => {
    const media = REF.css.slice(REF.css.indexOf('@media (prefers-color-scheme: dark)'))
    const bloco = media.slice(0, media.indexOf('}}'))
    const doMedia: Record<string, string> = {}
    for (const m of bloco.matchAll(/(--[a-z0-9-]+):\s*(#[0-9A-Fa-f]{3,8})/g)) {
      doMedia[m[1]] = m[2].toLowerCase()
    }
    expect(Object.keys(doMedia).length, 'o `@media` escuro da referência tem tokens').toBeGreaterThan(10)
    const divergem = Object.keys(doMedia).filter((k) => doMedia[k] !== REF.valoresEscuros[k])
    expect(divergem, `a referência se contradiz no escuro: ${divergem.join(', ')}`).toEqual([])
  })
})

describe('⭐⭐ os dois mapas vivem na RAIZ, e são espelho um do outro', () => {
  it('⭐ o `:root` define os tokens de produção e de família', () => {
    expect(CLARO['--prod-bg'], 'canvas claro na raiz').toBeTruthy()
    expect(CLARO['--prod-surface']).toBeTruthy()
    expect(CLARO['--fam-indigo-bg']).toBeTruthy()
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

/**
 * ⭐⭐⭐ O CARTÃO SÓLIDO — os 4 cartões × 2 temas, MEDIDOS (10/10/2026).
 *
 * **Exigência do dono, literal:** *"nos 2 temas os sólidos seguem sólidos — contraste
 * branco×fundo provado pelo guard WCAG existente nos 4 cartões × 2 temas"*.
 *
 * ⛔⛔ **E FOI ESTA MEDIÇÃO QUE MUDOU O DESENHO:** a letra do pedido era o `-mid`, e branco
 * sobre ele **reprova em 6 dos 8 casos** — verde **3,51:1** e coral **3,91:1** já no tema
 * CLARO (o que o dono usa), e no escuro os quatro abaixo de 3,3:1 porque lá o `-mid` CLAREIA.
 * O par `solid`/`on`/`on-soft` entrega sólido cheio com o degrau certo por tema, e aí passa.
 *
 * ⚠️ O piso é **4,5:1**, não os 3:1 de texto grande: o número é 30px, mas a **etiqueta de
 * 11px e a sub** ficam sobre o MESMO chão e são texto normal.
 */
const CARTOES = [
  { qual: 'O mês custa', fam: 'indigo' },
  { qual: 'Por dia aberto', fam: 'azul' },
  { qual: 'Ponto de equilíbrio', fam: 'verde' },
  { qual: 'Pra não afundar', fam: 'coral' },
] as const

describe('⛔⛔ o CARTÃO SÓLIDO passa WCAG nos 4 × 2 temas', () => {
  for (const tema of ['claro', 'escuro'] as const) {
    const mapa = tema === 'claro' ? CLARO : ESCURO

    it(`⭐ ${tema}: a TINTA do número passa nos 4 cartões`, () => {
      for (const c of CARTOES) {
        const r = razao(mapa[`--fam-${c.fam}-on`], mapa[`--fam-${c.fam}-solid`])
        expect(r, `${c.qual} (${c.fam}) no ${tema}: on sobre solid = ${r.toFixed(2)}:1`)
          .toBeGreaterThanOrEqual(4.5)
      }
    })

    it(`⭐ ${tema}: a ETIQUETA e a SUB (texto de 11px) passam nos 4 cartões`, () => {
      for (const c of CARTOES) {
        const r = razao(mapa[`--fam-${c.fam}-on-soft`], mapa[`--fam-${c.fam}-solid`])
        expect(r, `${c.qual} (${c.fam}) no ${tema}: on-soft sobre solid = ${r.toFixed(2)}:1`)
          .toBeGreaterThanOrEqual(4.5)
      }
    })

    /**
     * ⛔ *"nos 2 temas os sólidos seguem SÓLIDOS"* — o chão é escuro o suficiente pra carregar
     * tinta branca nos dois. Um chão pastel aqui faria o cartão voltar a ser fraco.
     */
    it(`⭐ ${tema}: o chão é SÓLIDO (escuro), nunca pastel`, () => {
      for (const c of CARTOES) {
        const l = luminancia(mapa[`--fam-${c.fam}-solid`])
        expect(l, `${c.qual}: luminância do chão no ${tema} = ${l.toFixed(3)}`).toBeLessThan(0.2)
      }
    })
  }

  /**
   * ⛔⛔ O CONTRAFACTUAL — sem ele este guard seria uma afirmação sobre o mundo bom. Ele prova
   * que o `-mid` (a letra do pedido) REPROVA, e é por isso que o cartão não o usa.
   */
  it('⛔⛔ o `-mid` cru com branco REPROVA — a medição que mudou o desenho', () => {
    const reprovam: string[] = []
    for (const tema of ['claro', 'escuro'] as const) {
      const mapa = tema === 'claro' ? CLARO : ESCURO
      for (const c of CARTOES) {
        const r = razao('#ffffff', mapa[`--fam-${c.fam}-mid`])
        if (r < 4.5) reprovam.push(`${c.fam}/${tema} ${r.toFixed(2)}:1`)
      }
    }
    expect(reprovam.length, `o -mid reprova em: ${reprovam.join(' · ')}`).toBeGreaterThanOrEqual(6)
  })

  /** ⭐ e o CHÃO inverte por tema, como a lei do 50↔800 da casa manda */
  it('⭐⭐ o chão sólido muda de tom entre os temas (não é o mesmo hex nos dois)', () => {
    for (const c of CARTOES) {
      expect(CLARO[`--fam-${c.fam}-solid`], `${c.fam}: o chão tem que inverter`)
        .not.toBe(ESCURO[`--fam-${c.fam}-solid`])
    }
  })
})

/**
 * ⭐⭐⭐ A VARREDURA WCAG CONTRA OS CONTRASTES **ESCRITOS NA REFERÊNCIA** (14/10/2026).
 *
 * **Exigência do dono (TESTE da fundação):** *"VARREDURA WCAG automatizada nos 2 temas: texto
 * branco sobre tom médio = vermelho (L7); **pares principais têm que bater os contrastes
 * escritos na referência**"*.
 *
 * ⛔⛔ **OS NÚMEROS SÃO LIDOS DO ARQUIVO, não digitados aqui.** A referência confere 6 pares no
 * comentário do `<script>` dela (*"tinta/#FFF 17,9:1 · tinta-2/#FFF 7,6:1 · …"*). Guard com os
 * números cravados passaria no dia em que o dono trocasse um tom e editasse o literal junto —
 * é a mesma disciplina que fez os 8 valores de 13/10 saírem da memória de um pedido pro arquivo.
 */
describe('⛔⛔ os pares principais batem os contrastes que a referência CONFERIU', () => {
  /** o comentário do `<script>` da referência, de onde os pares saem */
  const CONFERIDOS = REF.script

  /** `7,6:1` → 7.6 (a referência escreve com vírgula, como o Brasil) */
  const numero = (s: string) => Number(s.replace(',', '.'))

  /**
   * ⚠️ O par é achado pelo RÓTULO que a referência usa, e a tolerância é de **0,05** — não é
   * folga: a referência arredonda na 1ª casa (`6,3:1`) e a casa mede `6,29:1`. Exigir igualdade
   * exata daria vermelho sobre a MESMA cor por causa do arredondamento do texto.
   */
  const PARES: { rotulo: string; texto: string; chao: string; tema: 'claro' | 'escuro' }[] = [
    { rotulo: 'tinta/#FFF', texto: '--prod-primary', chao: '--prod-surface', tema: 'claro' },
    { rotulo: 'tinta-2/#FFF', texto: '--prod-secondary', chao: '--prod-surface', tema: 'claro' },
    { rotulo: 'trilho-tx/trilho', texto: '--prod-trilho-tx', chao: '--prod-trilho', tema: 'claro' },
    { rotulo: 'escuro: tinta/#141829', texto: '--prod-primary', chao: '--prod-surface', tema: 'escuro' },
    { rotulo: 'tinta-2/#141829', texto: '--prod-secondary', chao: '--prod-surface', tema: 'escuro' },
  ]

  it('⛔ a referência ainda CONFERE os pares (senão o guard compara com o vazio)', () => {
    expect(CONFERIDOS, 'o bloco de contrastes saiu da referência').toMatch(/Contrastes conferidos/)
    for (const p of PARES) {
      expect(CONFERIDOS, `o par "${p.rotulo}" saiu da referência`).toContain(p.rotulo)
    }
  })

  it('⛔⛔ a casa alcança ou supera cada par conferido, no tema dele', () => {
    const abaixo: string[] = []
    for (const p of PARES) {
      const m = new RegExp(`${p.rotulo.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&')}\\s+([\\d,]+):1`).exec(CONFERIDOS)
      expect(m, `não achei o número do par "${p.rotulo}"`).toBeTruthy()
      const esperado = numero(m![1])
      const mapa = p.tema === 'claro' ? CLARO : ESCURO
      const medido = razao(mapa[p.texto], mapa[p.chao])
      if (medido + 0.05 < esperado) {
        abaixo.push(`${p.rotulo} (${p.tema}): a referência confere ${esperado}:1, a casa mede ${medido.toFixed(2)}:1`)
      }
    }
    expect(abaixo, `pares abaixo do conferido:\n  ${abaixo.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔⛔⛔ **L7 COMO VARREDURA DE USO — e ela achou DOIS defeitos VIVOS em 14/10.**
   *
   * **A lei:** *"texto branco só sobre degrau 700+ da família (a cicatriz WCAG dos tons médios
   * continua valendo)"*. ⚠️⚠️ E a régua é o **USO**, não o tom: medir *"nenhum `-mid` alcança
   * 4,5 com branco"* seria uma afirmação FALSA sobre o arquivo (índigo 6,29 · azul 5,17 · teal
   * 5,06 · rosa 5,11 no claro **passam**) — e a própria referência confere *"branco/pílula
   * índigo 6,3:1"*. O que a lei proíbe é **PINTAR** branco num chão que reprova.
   *
   * ⛔ **E o perigo real é a INVERSÃO:** os quatro que passam no claro **reprovam no escuro**
   * (índigo cai pra 2,98), porque o `-mid` CLAREIA. Então tela que usa mid+branco funciona num
   * tema e quebra no outro — por isso a varredura mede **os dois**.
   *
   * **OS DOIS ACHADOS, corrigidos no mesmo commit:**
   *  · `producao/[ordemId]` — o botão *"concluir agora"* do aviso de ordem parada: `text-white`
   *    sobre `--fam-ambar-mid` = **3,19:1 claro / 2,15:1 escuro**, os dois reprovando;
   *  · `estoque/itens/[itemId]` — *"confirmar a troca"*: âmbar médio com `--prod-acao-ink`, que
   *    é **BRANCO no tema claro** (ele pareia com o índigo `--prod-acao-bg`). ⚠️ Mais sutil: o
   *    token usado É o da "tinta sobre fundo forte", só estava sobre o chão ERRADO.
   */
  /**
   * ⭐⭐ O DETECTOR TEM NOME E TEM AUTO-TESTE. ⚠️⚠️ A REGRA 11 cobrou isto: com os dois defeitos
   * já corrigidos, **enfraquecer o detector não produz vermelho nenhum** (medido: tirar a linha
   * do `text-white` deixa a varredura VERDE com o defeito reposto na tela). Ou seja — sem o
   * auto-teste, a próxima mão que mexer aqui deixa o defeito voltar INVISÍVEL. É a terceira vez
   * que esta casa paga por guard que nasceu cego.
   */
  const TINTA_CLARA = [
    { marca: /text-white/, hex: () => '#ffffff' },
    { marca: /color:\s*'#(fff|ffffff)'/i, hex: () => '#ffffff' },
    /** ⚠️ o `acao-ink` é BRANCO no claro (ele pareia com o índigo `--prod-acao-bg`) — foi por
     *  esta porta que o 2º defeito de 14/10 entrou, com o token "certo" no chão errado. */
    { marca: /--prod-acao-ink/, hex: (t: 'claro' | 'escuro') => (t === 'claro' ? CLARO : ESCURO)['--prod-acao-ink'] },
    { marca: /--prod-trilho-on/, hex: () => CLARO['--prod-trilho-on'] },
  ]

  /** devolve as violações de L7 de UMA linha de tela (vazio = limpa) */
  function violaL7(linha: string): string[] {
    /** ⚠️ o arquivo que DOCUMENTA o defeito removido não pode ser o que o acusa (21/09) */
    if (/^\s*(\{?\s*\/\*|\*|\/\/)/.test(linha)) return []
    const fam = /--fam-([a-z]+)-mid/.exec(linha)?.[1]
    if (!fam || !/background|bg-\[/.test(linha)) return []
    const tinta = TINTA_CLARA.find((t) => t.marca.test(linha))
    if (!tinta) return []
    const fora: string[] = []
    for (const tema of ['claro', 'escuro'] as const) {
      const mapa = tema === 'claro' ? CLARO : ESCURO
      const r = razao(tinta.hex(tema), mapa[`--fam-${fam}-mid`])
      if (r < 4.5) fora.push(`${tema} ${fam}-mid ${r.toFixed(2)}:1`)
    }
    return fora
  }

  it('⛔⛔⛔ L7: nenhuma TELA pinta tinta clara sobre um chão que reprova, nos 2 temas', () => {
    const reprovam: string[] = []
    for (const arq of telasDoApp()) {
      const src = readFileSync(join(RAIZ, arq), 'utf8')
      for (const [n, linha] of src.split('\n').entries()) {
        for (const v of violaL7(linha)) reprovam.push(`${arq}:${n + 1} ${v}`)
      }
    }
    expect(reprovam, `L7 violada — tinta clara sobre tom médio:\n  ${reprovam.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔⛔⛔ A VARREDURA DO **CSS** — O FLANCO QUE O DETECTOR DE TELA NÃO ALCANÇA (14/10).
   *
   * **Achado medindo os contrastes pro relatório:** o badge do Contas a Pagar pinta
   * `color: var(--prod-trilho-on)` sobre `background: var(--prod-coral)` **no `globals.css`** —
   * e o detector de cima varre `telasDoApp()`, que é **TSX**. Resultado: **3,75:1 no claro e
   * 2,78:1 no escuro**, texto de 10,5px (piso 4,5), e a varredura **não tinha como ver**.
   *
   * ⭐⭐ **É a lição do "guard que testa a vitrine aprova a prateleira vazia", em CSS:** par
   * pintado por classe no `globals.css` é invisível pra quem lê JSX. E este flanco não é teórico
   * — ele escondeu um par que o próprio brief nomeia (*"badge vermelho vivo (Contas a Pagar)"*).
   *
   * ⚠️ A régua aqui é **TODO par (color, background) do mesmo bloco**, não só `-mid` — no CSS o
   * chão pode ser qualquer token, e foi um `--prod-coral` (não um `-mid`) que escapou.
   */
  it('⛔⛔⛔ L7 no CSS: todo par (tinta, chão) do mesmo bloco passa nos 2 temas', () => {
    const fora = violacoesL7NoCss(css, { claro: CLARO, escuro: ESCURO })
    expect(
      fora.map(descreverViolacao),
      'L7 violada no CSS (tinta sobre chão que reprova)',
    ).toEqual([])
  })

  /**
   * ⛔⛔ AUTO-TESTE DO DETECTOR DE CSS (REGRA 11) — ele tem que ver o par do BLOCO, e o badge do
   * trilho é o caso que o motivou: foi ele que escapou da varredura de TSX.
   */
  it('⛔ o detector de CSS acha os pares de verdade do globals', () => {
    const pares = paresDeCor(css)
    expect(pares.length, 'o CSS da casa tem par (color,background) pra medir').toBeGreaterThan(5)
    expect(
      pares.some((p) => p.seletor.includes('.badge')),
      'o badge do trilho é um par — foi ele que escapou da varredura de TSX',
    ).toBe(true)
  })

  /**
   * ⛔⛔ E O DETECTOR PEGA O DEFEITO REAL QUANDO ELE VOLTA — o contrafactual com os hex de hoje,
   * executado. Sem isto, *"a varredura existe"* seria uma afirmação sobre o mundo bom.
   */
  it('⛔⛔ o detector reprova o par que o sprint corrigiu (contrafactual)', () => {
    const cssComDefeito = `.x{background:var(--prod-coral);color:var(--prod-trilho-on)}`
    const fora = violacoesL7NoCss(cssComDefeito, { claro: CLARO, escuro: ESCURO })
    expect(fora.map((v) => v.tema), 'reprova nos DOIS temas').toEqual(['claro', 'escuro'])
    expect(descreverViolacao(fora[0])).toContain('3,75:1')
    expect(descreverViolacao(fora[1])).toContain('2,78:1')
  })

  /** ⭐ e o par que ficou no lugar dele PASSA nos dois — 5,09 e 6,87 */
  it('⭐ o par novo (coral-on sobre o coral vivo) passa nos 2 temas', () => {
    const cssOk = `.x{background:var(--prod-coral);color:var(--prod-coral-on)}`
    expect(violacoesL7NoCss(cssOk, { claro: CLARO, escuro: ESCURO })).toEqual([])
  })

  /**
   * ⛔⛔ AUTO-TESTE DO DETECTOR (REGRA 11) — as DUAS formas reais do defeito de 14/10, e as
   * formas que ele **não** pode morder (senão alarme falso no dia 1 mata a varredura).
   */
  it('⛔⛔ o detector pega as 2 formas reais, e não morde o que é legítimo', () => {
    expect(
      violaL7(`<a className="rounded-lg bg-[var(--fam-ambar-mid)] px-3 text-xs font-bold text-white">x</a>`),
      'forma 1: `text-white` sobre o âmbar médio (o botão da ordem parada)',
    ).toEqual(['claro ambar-mid 3.19:1', 'escuro ambar-mid 2.15:1'])

    expect(
      violaL7(`style={{ background: 'var(--fam-ambar-mid)', color: 'var(--prod-acao-ink)' }}>`),
      'forma 2: o `acao-ink` (branco no claro) sobre o âmbar médio',
    ).toEqual(['claro ambar-mid 3.19:1'])

    /** ⭐ o que NÃO é violação: */
    expect(violaL7(`<div style={{ width: '40%', background: 'var(--fam-verde-mid)' }} />`),
      'barra de progresso não tem texto em cima').toEqual([])
    expect(violaL7(`style={{ background: 'var(--fam-indigo-mid)', color: 'var(--prod-acao-ink)' }}`),
      'o índigo de ação PASSA (6,29:1) — a exceção que a referência confere').toEqual([])
    expect(violaL7(`style={{ background: 'var(--fam-ambar-solid)', color: 'var(--fam-ambar-on)' }}`),
      'o chão SÓLIDO é o certo').toEqual([])
    expect(violaL7(`   /* era bg-[var(--fam-ambar-mid)] com text-white — corrigido em 14/10 */`),
      'o comentário que documenta o defeito não pode acusar o arquivo').toEqual([])
  })

  /**
   * ⛔⛔ O CONTRAFACTUAL DA VARREDURA — sem ele ela seria uma afirmação sobre o mundo bom: o
   * detector tem que PEGAR a forma exata do defeito que existia (a cicatriz de 14/10).
   */
  it('⛔⛔ e a varredura PEGA a forma do defeito que existia', () => {
    const defeito = `<a className="bg-[var(--fam-ambar-mid)] text-white">x</a>`
    const fam = /--fam-([a-z]+)-mid/.exec(defeito)![1]
    expect(razao('#ffffff', CLARO[`--fam-${fam}-mid`]), 'claro').toBeLessThan(4.5)
    expect(razao('#ffffff', ESCURO[`--fam-${fam}-mid`]), 'escuro').toBeLessThan(4.5)
    /** ⚠️ e o `--prod-acao-ink` é BRANCO no claro — foi por aí que o 2º defeito entrou */
    expect(CLARO['--prod-acao-ink']).toMatch(/#(fff|ffffff)/i)
  })

  /** ⭐ e o CHÃO (-solid) carrega branco nas 8 famílias × 2 temas — o outro lado da L7 */
  it('⭐ o chão SÓLIDO passa com a tinta dele nas 8 famílias × 2 temas', () => {
    const reprovam: string[] = []
    for (const tema of ['claro', 'escuro'] as const) {
      const mapa = tema === 'claro' ? CLARO : ESCURO
      for (const f of FAMILIAS) {
        const chao = mapa[`--fam-${f}-solid`]
        if (!chao) continue
        const r = razao(mapa[`--fam-${f}-on`], chao)
        if (r < 4.5) reprovam.push(`${f}/${tema} ${r.toFixed(2)}:1`)
      }
    }
    expect(reprovam, `chão sólido sem contraste: ${reprovam.join(' · ')}`).toEqual([])
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

  /**
   * ⚠️ REAPONTADO EM 14/10, E FICOU MAIS FORTE. Ele exigia o literal `lerTema(` no layout, e em
   * 14/10 a leitura virou `lerPreferenciaDeTela` (uma consulta pras DUAS preferências, tema e
   * trilho, que moram na mesma linha) — então ele ficou **vermelho com o código CERTO**, que é
   * a razão de existir da REGRA 3: *grep não distingue "refatorei" de "quebrei"*.
   *
   * ⭐ A PERGUNTA NÃO MUDOU (*"a tabela é a fonte, e quem lê é o SERVIDOR"*); o que mudou é que
   * ela passou a ser feita por ESTRUTURA — o layout importa a porta do servidor e NÃO toca em
   * `localStorage`. Isso cobre o defeito antigo **e mais um que o literal não via**: alguém
   * trocar a leitura por uma preferência de navegador, que é exatamente o que o dono proibiu
   * (*"nunca localStorage"* — ele confere no celular E no notebook).
   */
  it('⭐ a tabela é a fonte: o layout lê pela porta do SERVIDOR, nunca do navegador', () => {
    const layout = readFileSync(join(RAIZ, 'app/(dashboard)/layout.tsx'), 'utf8')
    expect(layout, 'o layout importa a porta de leitura do servidor').toMatch(
      /from\s*'@\/lib\/tema\/servidor'/,
    )
    expect(layout, 'e a CHAMA (uso, nunca menção)').toMatch(/(lerTema|lerPreferenciaDeTela)\(/)
    expect(semComentario(layout), 'preferência de tela não vem do navegador').not.toMatch(
      /localStorage/,
    )
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

  /**
   * ⚠️ REAPONTADO EM 14/10 — e a pergunta não mudou: *"a barra global lê TOKEN?"*. O que mudou é
   * **onde a resposta mora**: o chão do topo saiu do `style` inline e virou a classe `.topo` do
   * CSS, 1:1 com a referência. Continuar procurando `var(--prod-surface)` no TSX seria *grep que
   * não distingue "refatorei" de "quebrei"* — a razão de existir da REGRA 3. Agora o guard
   * confere o CSS (onde a regra está) **e** proíbe cor cravada no TSX (onde o defeito voltaria).
   */
  it('⛔ e a barra global também lê token (faixa branca no topo do escuro = tema quebrado)', () => {
    const bar = semComentario(readFileSync(join(RAIZ, 'components/layout/top-bar.tsx'), 'utf8'))
    expect(bar, 'a barra é a classe da referência, não cor cravada').toMatch(/className="topo/)
    expect(bar).not.toMatch(/bg-white/)
    expect(bar, 'hex cravado no topo = faixa branca no escuro').not.toMatch(/#[0-9a-fA-F]{3,8}\b/)

    const topo = semComentario(css).slice(semComentario(css).indexOf('\n.topo {'))
    expect(topo.slice(0, 400), 'o chão do topo sai do token da superfície').toMatch(
      /background: var\(--prod-surface\)/,
    )
    expect(topo.slice(0, 400), 'e a linha de baixo é a linha-forte da fundação').toMatch(
      /border-bottom: 1px solid var\(--prod-line-strong\)/,
    )
  })
})

describe('⭐ REGRA 12 — o botão é o MESMO componente nos 2 viewports', () => {
  /**
   * ⚠️ REAPONTADO EM 14/10: a 2ª barra (`md:hidden` no shell) MORREU — o topo virou uma
   * composição só. *"Nos 2 viewports"* passou a ser garantido por o shell renderizar a barra
   * única **sem gate**, em vez de por duas cópias que alguém mantinha iguais na mão.
   */
  it('⭐ a barra ÚNICA usa `BotaoTema`, e o shell a renderiza sem gate de viewport', () => {
    const bar = readFileSync(join(RAIZ, 'components/layout/top-bar.tsx'), 'utf8')
    const shell = readFileSync(join(RAIZ, 'components/layout/dashboard-shell.tsx'), 'utf8')
    expect(bar).toMatch(/<BotaoTema\s/)
    expect(shell).toMatch(/<TopBar\b/)
    expect(shell, 'barra atrás de `hidden md:block` obriga uma 2ª cópia pro celular')
      .not.toMatch(/hidden md:block[\s\S]{0,120}<TopBar/)
    expect(shell, 'o toggle desenhado 2× é a barra duplicada de volta').not.toMatch(/<BotaoTema\s/)
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
