/**
 * ⭐⭐⭐ O TOPO BATE COM A REFERÊNCIA — O GUARD ABRE O ARQUIVO (14/10/2026).
 *
 * **Ordem do dono (FRENTE C):** *"Topo novo da referência: seletor da empresa com selo PJ, sino
 * com ponto, botão de tema, avatar com iniciais."* E a hierarquia, escrita por ele no PASSO 0:
 * *"esta referência manda na FUNDAÇÃO (tokens, trilho, **topo**, tinta, linha)"*.
 *
 * ⛔⛔ **A COMPARAÇÃO É DECLARAÇÃO A DECLARAÇÃO, com os tokens TRADUZIDOS por PAPEL.** Pra cada
 * linha que a referência escreve no `.topo`, o guard troca `var(--linha-forte)` pelo nome que a
 * casa dá àquele papel (`var(--prod-line-strong)`) e exige o resultado no `globals.css`. Isso
 * pega as DUAS doenças de uma vez: geometria ajustada "no olho" (56px virando 52) **e** token
 * trocado (a linha-forte virando a linha fina). ⚠️ Guard que só procura o nome da classe
 * aprovaria um topo com os números todos errados — foi assim que o guard do mock da Conciliação
 * nasceu cego em 13/09.
 *
 * ⚠️ **O guard cobra o que a referência DECLARA, não proíbe a casa de acrescentar.** O `.empresa`
 * da referência herda a cor do texto do pai; aqui ele declara `color: var(--prod-primary)`
 * porque a pílula é um `<button>` (e botão tem cor de UA própria). Acrescentar é legítimo;
 * divergir do que está escrito, não.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lerReferenciaVisual, CAMINHO_DA_FUNDACAO } from '@/lib/referencias/visual'
import { hexCravados, semComentarios } from './_leitura-de-fonte'

const RAIZ = process.cwd()
const CSS = readFileSync(join(RAIZ, 'app/globals.css'), 'utf8')
const REF = lerReferenciaVisual(CAMINHO_DA_FUNDACAO)

const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8')

/** ⚠️ sem comentário: o arquivo que DOCUMENTA o defeito não pode ser o que o absolve (21/09) */
const semComentarioCss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * Pega o CORPO da regra cujo seletor é EXATAMENTE `sel`.
 * ⚠️ O `(?:^|[}{])` é o mesmo cuidado do guard da raiz: regra que vive dentro de `@media{…}` é
 * precedida por `{`, não por `}` — com o regex olhando só `}` ela fica invisível e o guard passa
 * por cegueira.
 */
function corpoDaRegra(css: string, sel: string): string | null {
  const re = new RegExp(
    `(?:^|[}{])\\s*${sel.replace(/[.\s]/g, (c) => (c === '.' ? '\\.' : '\\s+'))}\\s*\\{([^}]*)\\}`,
  )
  const m = re.exec(semComentarioCss(css))
  return m ? m[1] : null
}

/** `height:56px; gap:12px` → `{height: '56px', gap: '12px'}` */
function declaracoes(corpo: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const linha of corpo.split(';')) {
    const i = linha.indexOf(':')
    if (i < 0) continue
    const k = linha.slice(0, i).trim()
    if (!k || k.startsWith('--')) continue
    out[k] = linha.slice(i + 1).trim().replace(/\s+/g, ' ')
  }
  return out
}

/**
 * O mapa 1:1 por PAPEL (token da referência → os nomes que a casa aceita pra aquele papel).
 * ⭐ É o MESMO mapa de `dois-temas-na-raiz`, recortado nos papéis que o topo usa — e os VALORES
 * daqueles tokens já são conferidos lá, hex a hex. Aqui o que se confere é o USO.
 */
const PAPEL: Record<string, string[]> = {
  '--card': ['--prod-surface'],
  '--card-2': ['--prod-surface-1', '--prod-mudo-bg'],
  '--linha': ['--prod-line'],
  '--linha-forte': ['--prod-line-strong'],
  '--tinta': ['--prod-primary'],
  '--tinta-2': ['--prod-secondary', '--prod-mudo'],
  '--tinta-3': ['--prod-muted'],
  '--acao': ['--prod-accent', '--prod-acao-bg', '--fam-indigo-mid'],
  '--acao-50': ['--prod-surface-2', '--fam-indigo-bg'],
  '--acao-tinta': ['--fam-indigo-ink'],
  '--coral': ['--prod-coral', '--fam-coral-mid'],
}

/** as formas que a casa aceita pro valor que a referência escreveu (1 por token traduzido) */
function traduzidas(valorDaRef: string): string[] {
  const usados = [...valorDaRef.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1])
  let formas = [valorDaRef]
  for (const t of usados) {
    const casa = PAPEL[t]
    if (!casa) continue
    formas = formas.flatMap((f) => casa.map((c) => f.replace(`var(${t})`, `var(${c})`)))
  }
  return formas
}

/**
 * ⭐ Os 6 blocos do topo, da referência pra casa. O seletor da casa é ANINHADO (`.topo .icbt`)
 * de propósito: `.icbt` solto viraria uma classe global que qualquer tela poderia pegar por
 * acidente, e aí o chassi do topo passaria a pintar botão de outro lugar.
 */
const BLOCOS: { ref: string; casa: string; oQueE: string }[] = [
  { ref: '.topo', casa: '.topo', oQueE: 'a barra' },
  { ref: '.empresa', casa: '.topo .empresa', oQueE: 'o seletor da empresa' },
  { ref: '.empresa .pj', casa: '.topo .empresa .pj', oQueE: 'o selo PJ' },
  { ref: '.topo .acoes', casa: '.topo .acoes', oQueE: 'o grupo da direita' },
  { ref: '.icbt', casa: '.topo .icbt', oQueE: 'o botão de ícone' },
  { ref: '.avatar', casa: '.topo .avatar', oQueE: 'o avatar' },
]

describe('⭐⭐⭐ o topo é 1:1 com a referência da fundação', () => {
  /**
   * ⚠️ PRIMEIRO: a referência TEM os blocos. Sem isto, o dia em que o arquivo for reescrito e
   * perder o `.topo` o guard passaria **comparando nada com nada** — o verde de graça.
   */
  it('⛔ a referência declara os 6 blocos do topo (senão o guard compara com o vazio)', () => {
    for (const b of BLOCOS) {
      expect(corpoDaRegra(REF.css, b.ref), `${b.ref} saiu da referência`).toBeTruthy()
    }
  })

  it('⛔⛔ cada declaração da referência vale no `globals.css`, com o token do PAPEL', () => {
    const divergem: string[] = []
    for (const b of BLOCOS) {
      const daRef = declaracoes(corpoDaRegra(REF.css, b.ref)!)
      const corpoCasa = corpoDaRegra(CSS, b.casa)
      if (!corpoCasa) {
        divergem.push(`${b.casa} não existe no globals.css (${b.oQueE})`)
        continue
      }
      const naCasa = declaracoes(corpoCasa)
      for (const [prop, valor] of Object.entries(daRef)) {
        /** ⚠️ `cursor`/`display`/`flex` são implementação; o que a referência MANDA é geometria,
         *  cor e peso. Checar `display:flex` daria vermelho num `inline-flex` equivalente. */
        if (['cursor', 'display', 'align-items', 'justify-content', 'position', 'flex'].includes(prop)) continue
        const aceitas = traduzidas(valor)
        if (!aceitas.includes(naCasa[prop] ?? '')) {
          divergem.push(
            `${b.casa} · ${prop}: a referência manda "${valor}" (= ${aceitas.join(' | ')}), a casa tem "${naCasa[prop] ?? '(ausente)'}"`,
          )
        }
      }
    }
    expect(divergem, `o topo divergiu da referência:\n  ${divergem.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔⛔ ZERO HEX NO TOPO — e não é preciosismo: hex cravado aqui é a **faixa branca no topo do
   * tema escuro**, que é o jeito mais rápido de um tema parecer quebrado (a cicatriz de 04/10,
   * quando a barra tinha `bg-card` cravado).
   */
  it('⛔⛔ nenhuma cor cravada — nem no CSS do topo, nem nos 5 arquivos da barra', () => {
    const cssDoTopo = semComentarioCss(CSS).slice(semComentarioCss(CSS).indexOf('\n.topo {'))
    expect([...cssDoTopo.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]), 'hex no CSS do topo')
      .toEqual([])

    for (const f of [
      'components/layout/top-bar.tsx',
      'components/layout/botao-tema.tsx',
      'components/layout/user-menu.tsx',
      'components/avisos/sininho.tsx',
    ]) {
      expect(hexCravados(ler(f)), `${f}: cor cravada vaza no tema escuro`).toEqual([])
    }
  })
})

describe('⭐⭐ a composição do topo — uma barra, os 4 controles, o ☰ só no celular', () => {
  const BAR = ler('components/layout/top-bar.tsx')

  /** ⭐ REGRA 12 por CONSTRUÇÃO: uma composição, não uma por viewport. */
  it('⛔⛔ é UMA barra `.topo`, e o ☰ da gaveta vive dentro dela', () => {
    expect(BAR).toMatch(/className="topo/)
    expect(BAR, 'o ☰ é o chassi de ícone com a marca que o CSS esconde no desktop').toMatch(
      /className="icbt menu-m"/,
    )
    expect(BAR, 'e ele avisa o shell, que é quem guarda o estado da gaveta').toMatch(
      /onClick=\{onAbrirGaveta\}/,
    )
    const menuM = corpoDaRegra(CSS, '.topo .menu-m')
    expect(menuM, 'sem a regra, o ☰ aparece no desktop ao lado do trilho').toMatch(/display: none/)
  })

  it('⭐ os 4 controles da referência estão na barra, na ordem dela', () => {
    const ordem = ['<WorkspaceSwitcherDual', '<Sininho', '<BotaoTema', '<UserMenu']
    let anterior = -1
    for (const tag of ordem) {
      const i = BAR.indexOf(tag)
      expect(i, `${tag} fora da barra`).toBeGreaterThan(-1)
      expect(i, `${tag} fora de ordem`).toBeGreaterThan(anterior)
      anterior = i
    }
  })

  /**
   * ⚠️ O SELO É INFORMAÇÃO, NÃO ENFEITE: ele é o que separa *"a Caçula"* de *"o meu bolso"* num
   * olhar, e **não pode ser `hidden sm:inline`** — era assim até hoje, ou seja a distinção sumia
   * justamente no celular, que é onde o dono mais opera.
   */
  it('⛔ o seletor é a pílula `.empresa` e o selo PJ/PF aparece nos DOIS viewports', () => {
    const sw = ler('components/layout/workspace-switcher-dual.tsx')
    const trecho = sw.slice(sw.indexOf('<button type="button" className="empresa'), sw.indexOf('</button>'))
    expect(trecho, 'a pílula da referência').toBeTruthy()
    expect(trecho, 'o selo do tipo').toMatch(/className=\{isPF \? 'pf' : 'pj'\}/)
    expect(trecho, 'selo escondido no celular = a distinção sumindo onde ela mais importa')
      .not.toMatch(/hidden sm:/)
  })

  it('⭐ o avatar leva as INICIAIS de quem está logado', () => {
    const um = ler('components/layout/user-menu.tsx')
    const i = um.indexOf('className="avatar"')
    expect(i, 'o disco da referência').toBeGreaterThan(-1)
    expect(um.slice(i, i + 300), 'iniciais, nunca foto inventada').toMatch(/\{initials\(userName\)\}/)
  })

  /**
   * ⛔⛔ A BUSCA ⌘K **NÃO ENTRA NESTA FASE, E O GUARD AFIRMA A AUSÊNCIA** (FRENTE C item 8:
   * *"Campo morto é proibido — se não houver porta pronta, ela fica pra fase 2"*). Não existe
   * registro de telas pra ligar nela, e campo que não faz nada é o `registry.parse` decorativo
   * que esta casa já pagou: existia, ninguém chamava, e o bug ficou invisível por semanas.
   * ⚠️ E o guard é de DOIS LADOS: a ausência **e o motivo escrito** — senão a próxima leva trata
   * como esquecimento e desenha o campo achando que faltou.
   */
  it('⛔⛔ nenhum campo de busca ⌘K na barra — e o porquê está escrito', () => {
    /** ⚠️ o CÓDIGO sem comentário é que não pode ter o campo; o COMENTÁRIO é que tem que ter o
     *  motivo. Ler o arquivo cru nas duas pontas seria uma contradizer a outra. */
    expect(semComentarios(BAR), 'campo morto é proibido').not.toMatch(/⌘K|cmdk|type="search"/)
    expect(BAR, 'o motivo da ausência tem que estar no arquivo').toMatch(/⌘K/)
    expect(semComentarioCss(CSS), 'CSS de controle inexistente convida alguém a desenhá-lo')
      .not.toMatch(/\.topo \.busca/)
  })
})
