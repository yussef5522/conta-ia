/**
 * ⭐⭐⭐ A LISTA DE CONCLUÍDAS — VISUAL v4 (05/10/2026), mock aprovado no chat.
 *
 * **Ordem do dono, ao pé da letra:** *"logos, pedido redondo, pílula «% do pedido», linhas
 * fortes. (1) PEDIDO SEMPRE REDONDO na exibição: 84,8608 → «85» — vale em toda tela que mostra
 * pedido em UN. (2) LOGO COLORIDO POR RECEITA: quadradinho 38px radius 11 com ícone de comida
 * por família (…) coral PROIBIDO pra receita. O pontinho vermelho do fiscal mora no canto do
 * logo. (3) QUEM FEZ: mini-avatar colorido com iniciais (…) sem responsável = bonequinho cinza
 * + «sem responsável» itálico discreto (o «?» morre). (4) A PÍLULA VOLTA COM SOBRENOME E CONTA
 * NOVA: «N% do pedido» = fez ÷ pedido (escrito POR EXTENSO dentro da pílula). (5) LINHAS MAIS
 * FORTES: divisória 1px border-strong + zebrado suave + hover; moldura da lista 1px."*
 *
 * ⚠️ **ESTRUTURAL e assumido como tal** (o projeto roda em `environment: node`, sem jsdom): o
 * que dá pra provar por comportamento mora nas libs (`pedido-na-tela`, `cara-da-receita`) e tem
 * teste próprio. Aqui o que se trava é a FORMA que o dono aprovou no mock.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8')
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const HOME = 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'
const AVATAR = 'components/estoque/avatar-pessoa.tsx'
const CARA = 'lib/stock/producao/cara-da-receita.ts'
const LIB = 'lib/stock/producao/pedido-na-tela.ts'
const LOGO = 'components/estoque/logo-da-receita.tsx'

const tela = () => semComentario(ler(HOME))
const lista = () => {
  const t = tela()
  return t.slice(t.indexOf('function ListaConcluidas'))
}

// ─────────────── 1. o pedido redondo, em TODA tela que mostra pedido ───────────────

describe('⭐⭐ 1. PEDIDO REDONDO — e o arredondamento tem UM dono', () => {
  /**
   * ⛔⛔ **QUATRO TELAS MOSTRAM PEDIDO** (home/concluídas, home/abertas, relatório Por dia e
   * página da ordem, via `fraseDoCiclo`). Quatro `Math.round` divergiriam na primeira borda, e
   * o dono veria *"85"* num lugar e *"84,86"* no outro **pro mesmo lote** — a doença do B1.
   */
  it('⛔⛔ as 4 telas que mostram pedido passam pelo `fmtPedido`', () => {
    const t = tela()
    expect(t, 'a home importa o dono único').toMatch(/from '@\/lib\/stock\/producao\/pedido-na-tela'/)
    expect(t, 'na lista de concluídas').toMatch(/fmtPedido\(pf\?\.pedido, un\)/)
    expect(t, 'e nas abertas').toMatch(/fmtPedido\(c\.pedido, o\.unidadeProduzido\)/)
    expect(semComentario(ler('lib/stock/producao/relatorio-por-dia.ts')), 'a tela "Por dia"').toMatch(
      /fmtPedido\(x\.qtd, x\.unidade\)/,
    )
    expect(semComentario(ler('lib/stock/producao/pedido-da-ordem.ts')), 'a frase do ciclo').toMatch(
      /fmtPedido\(p\.pedido, p\.unidadeProduto\)/,
    )
    expect(
      semComentario(ler('app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx')),
      'o cabeçalho da ordem',
    ).toMatch(/fmtPedido\(pedido\.unidades, ordem\.unidadeProduzido\)/)
  })

  /** ⛔ ninguém arredonda pedido na mão — nem na tela, nem nas libs vizinhas */
  it('⛔ nenhum arredondamento de pedido fora do dono único', () => {
    for (const f of [
      HOME,
      'lib/stock/producao/relatorio-por-dia.ts',
      'lib/stock/producao/pedido-da-ordem.ts',
      'app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx',
    ]) {
      const s = semComentario(ler(f))
      expect(
        /Math\.round\([^)]*pedido|toFixed\(0\)[^)]*pedido|pedido[^)\n]*toFixed\(0\)/i.test(s),
        `${f}: round de pedido fora da lib é a 2ª régua`,
      ).toBe(false)
    }
  })

  /**
   * ⛔⛔ **E O ARREDONDAMENTO É GATEADO PELA UNIDADE, pela régua da CASA.** Em KG/LT a fração é
   * o dado (`2,858 KG` é o lote da maionese) — e quem responde *"esta unidade é de contagem?"*
   * é o `aceitaFracao`, a lista fechada de 28/08. Uma segunda lista aqui faria a tela e o campo
   * de digitação discordarem sobre a mesma unidade.
   */
  it('⛔⛔ a lib consulta a régua de unidade da casa, não uma lista própria', () => {
    const s = semComentario(ler(LIB))
    expect(s).toMatch(/import \{ aceitaFracao \} from '@\/lib\/stock\/quantidade'/)
    expect(/UN\|UND\|PC|'UN'\s*===|=== 'UN'/.test(s), 'lista de unidades copiada aqui é a 2ª régua').toBe(false)
  })
})

/**
 * ⛔⛔⛔ **E A LISTA NÃO PODE VOLTAR A DEPENDER DO TETO.** Achado na prova em prod deste sprint:
 * o `listOrdens` corta as encerradas em 200, e a lista de concluídas montava nome/unidade/pedido
 * **filtrando essa lista truncada** → com 30 dias de período, **200 das 379 linhas saíam com nome
 * "—", sem logo, sem pedido e sem pílula**. O comportamento tem teste de integração próprio
 * (`concluidas-nao-dependem-do-teto`); aqui se trava a FORMA, que é por onde o defeito volta.
 */
describe('⛔⛔ a lista de concluídas resolve a receita POR ID', () => {
  const ROTA = 'app/api/empresas/[id]/estoque/producao/ordens/route.ts'

  it('⛔⛔ a rota resolve por ID, nunca filtrando o `ordens` truncado', () => {
    const r = semComentario(ler(ROTA))
    expect(r, 'a receita das concluídas vem do leitor por id').toMatch(
      /receitaDasOrdens\(companyId, idsDasConclusoes, prisma\)/,
    )
    expect(
      /ordens\.filter\(\(o\) => concluidas\.some/.test(r),
      'filtrar o `ordens` (truncado em 200) é o defeito que escondia 200 linhas',
    ).toBe(false)
    expect(r, 'e o payload leva a receita pra tela').toMatch(/receitaDasConcluidas,/)
  })

  it('⭐ a tela MESCLA as duas fontes, e a resolvida por id manda', () => {
    const t = tela()
    expect(t).toMatch(/setReceitaConcl\(j\.receitaDasConcluidas \?\? \{\}\)/)
    const mapa = t.slice(t.indexOf('nomePorOrdem={new Map(['), t.indexOf('pedidoFeito={pedidoFeito}'))
    expect(mapa, 'a lista geral entra primeiro…').toMatch(/ordens\.map\(\(o\) => \[o\.id, o\.nomeProduzido\]/)
    expect(mapa, '…e a do período por último (ela vence, porque não depende do teto)').toMatch(
      /Object\.entries\(receitaConcl\)\.map\(\(\[id, r\]\) => \[id, r\.nome\]/,
    )
  })
})

// ─────────────── 2. o logo colorido por receita ───────────────

describe('⭐⭐ 2. LOGO COLORIDO POR RECEITA — 38px, raio 11, estável', () => {
  /**
   * ⚠️ REAPONTADO em 05/10: o logo **mudou de casa** (`components/estoque/logo-da-receita.tsx`)
   * porque a página da ORDEM pede *"o quadradinho 48px, mesma família/ícone da lista"*. A régua
   * é a mesma; o guard ficou MAIS FORTE, porque passou a exigir **um dono só**.
   */
  it('⭐ o logo da lista é 38/11 com o ícone proporcional', () => {
    const logo = semComentario(ler(LOGO))
    expect(logo, '38px e raio 11 na lista').toMatch(/h-\[38px\] w-\[38px\] rounded-\[11px\]/)
    expect(logo, 'e o ícone acompanha').toMatch(/h-\[18px\] w-\[18px\]/)
    expect(logo, 'e o 48 do cabeçalho da ordem').toMatch(/h-12 w-12 rounded-\[14px\]/)
    expect(lista(), 'a lista pede o tamanho grande').toMatch(/tamanho=\{38\}/)
  })

  /**
   * ⛔⛔ **UM DONO SÓ PRA `nome → (ícone, cor)`.** Duas traduções divergiriam no 1º grupo novo
   * do mapa e a MESMA receita teria caras diferentes em duas telas — e o reconhecimento (a
   * razão de o logo existir) morre exatamente aí.
   */
  it('⛔⛔ ninguém mais traduz ícone de receita em componente', () => {
    const ofensores: string[] = []
    const varrer = (dir: string) => {
      for (const n of readdirSync(join(RAIZ, dir))) {
        const rel = `${dir}/${n}`
        if (n === 'node_modules' || n === '.next') continue
        if (statSync(join(RAIZ, rel)).isDirectory()) { varrer(rel); continue }
        if (!/\.tsx?$/.test(n) || rel === LOGO) continue
        const c = semComentario(readFileSync(join(RAIZ, rel), 'utf8'))
        if (/Record<IconeDaReceita/.test(c)) ofensores.push(rel)
      }
    }
    varrer('app'); varrer('components')
    expect(ofensores, `2ª tradução de ícone em: ${ofensores.join(', ')}`).toEqual([])
    expect(tela(), 'a home consome o dono único').toMatch(/import \{ LogoDaReceita \}/)
  })

  /**
   * ⛔⛔ **TODO ÍCONE DO MAPA TEM COMPONENTE.** A lib é PURA (devolve o NOME do ícone) e a tela
   * traduz; ícone novo na lib sem par aqui renderizaria `undefined` e **quebraria a linha** —
   * é a classe do "campo que a tela não sabe desenhar". O `Record` completo já obriga no
   * TypeScript, e este teste é o cinto: ele falha com a mensagem em vez de um `tsc` genérico.
   */
  it('⛔⛔ os 13 ícones da lib têm componente', () => {
    const cara = semComentario(ler(CARA))
    const tipo = cara.slice(cara.indexOf('export type IconeDaReceita'), cara.indexOf('export interface CaraDaReceita'))
    const nomes = [...tipo.matchAll(/'([a-z]+)'/g)].map((m) => m[1])
    expect(nomes.length, 'o mapa cresceu de 5 pra 13 grupos (v4)').toBe(13)
    const logo = semComentario(ler(LOGO))
    const mapa = logo.slice(logo.indexOf('const ICONES'), logo.indexOf('}', logo.indexOf('const ICONES')))
    for (const n of nomes) expect(mapa, `o ícone "${n}" precisa de componente`).toMatch(new RegExp(`\\b${n}:`))
  })

  /**
   * ⛔⛔ **CORAL É DO ALARME** — guard que já existia, reafirmado aqui porque o mapa cresceu:
   * 8 grupos novos são 8 chances de alguém dar coral pra uma comida, e aí toda linha daquela
   * receita nasce com a cara de ordem atrasada.
   */
  it('⛔⛔ nenhuma família de receita é coral', () => {
    const cara = semComentario(ler(CARA))
    const tipos = cara.slice(cara.indexOf('const TIPOS'), cara.indexOf('const DO_HASH'))
    expect(/familia: 'coral'/.test(tipos), 'coral é a cor do alarme, não de comida').toBe(false)
  })

  /** ⭐ e o pontinho do fiscal mora no CANTO do logo (sinal colado no que ele acusa) */
  it('⭐⭐ o alerta do fiscal é slot do logo', () => {
    expect(lista(), 'a lista passa o alerta').toMatch(/alerta=\{c\.fiscalImpossivel \?/)
    const logo = semComentario(ler(LOGO))
    expect(logo).toMatch(/\{alerta && \(/)
    expect(logo, 'no canto, nos 3 tamanhos').toMatch(/-right-\[3px\] -top-\[3px\]/)
  })
})

// ─────────────── 3. quem fez ───────────────

describe('⭐ 3. QUEM FEZ — mini-avatar na sublinha, e o "?" morreu', () => {
  it('⭐ a sublinha tem o avatar de 18px + o nome', () => {
    const l = lista()
    expect(l, 'o mini-avatar na sublinha').toMatch(/<AvatarPessoa nome=\{c\.colaboradorNome\} apenasAvatar tamanho=\{18\} \/>/)
    expect(l, 'o nome ao lado').toMatch(/\{c\.colaboradorNome \?\? <i>sem responsável<\/i>\}/)
  })

  /**
   * ⛔⛔ **O "?" MORREU (ordem do dono).** Ele lia como *"faltou dado, procure"*; o bonequinho
   * cinza diz *"ninguém assinou"*, que é o FATO. ⚠️ E continua **não inventando pessoa**: nem
   * iniciais, nem cor de identidade — o cinza é a família MUDA, fora da paleta de gente.
   */
  it('⛔⛔ sem responsável = bonequinho cinza, nunca "?"', () => {
    const a = semComentario(ler(AVATAR))
    const semNome = a.slice(a.indexOf('if (!nome) {'), a.indexOf('const c = corDaPessoa'))
    expect(semNome, 'o bonequinho').toMatch(/<User /)
    expect(/>\s*\?\s*</.test(semNome), 'o "?" voltou').toBe(false)
    expect(semNome, 'e o texto em itálico discreto').toMatch(/italic">sem responsável</)
    expect(semNome, 'na família muda, nunca numa cor de pessoa').toMatch(/var\(--prod-mudo-bg\)/)
  })

  /** ⭐ a cor da pessoa continua ESTÁVEL por hash (e coral fora da paleta) */
  it('⭐ a identidade de pessoa segue estável e sem coral', () => {
    const a = semComentario(ler(AVATAR))
    expect(a).toMatch(/export function corDaPessoa/)
    const paleta = a.slice(a.indexOf('const PALETA'), a.indexOf('] as const'))
    expect(/coral/i.test(paleta), 'pessoa nunca é vermelha').toBe(false)
  })
})

// ─────────────── 4. a pílula "% do pedido" ───────────────

describe('⭐⭐ 4. A PÍLULA COM SOBRENOME — "% do pedido"', () => {
  /**
   * ⛔⛔ **O SOBRENOME É O QUE A FAZ EXISTIR.** A pílula antiga (`PilulaEf`) mostrava a
   * eficiência congelada **contra a FICHA** e foi aposentada em 04/10 porque *"parecia
   * fez÷pedido e não é"*. O texto por extenso DENTRO dela é o que impede a confusão de voltar.
   */
  it('⛔⛔ o texto diz de que percentual se trata, dentro da pílula', () => {
    expect(semComentario(ler(LIB))).toMatch(/\$\{pct\}% do pedido/)
    expect(lista(), 'e a tela desenha o texto da lib, não um "%" seco').toMatch(/\{pil\.texto\}/)
  })

  /** ⛔ a régua (90-110 · <70 · >130) mora na LIB — número de faixa em JSX é a 2ª régua */
  it('⛔⛔ nenhum degrau digitado na tela', () => {
    const l = lista()
    expect(/>= ?90|<= ?110|< ?70|> ?130/.test(l), 'a régua mora na lib').toBe(false)
    const lib = semComentario(ler(LIB))
    expect(lib).toMatch(/pct >= 90 && pct <= 110/)
    expect(lib).toMatch(/pct < 70 \|\| pct > 130/)
  })

  /** ⭐ sem pedido não há pílula — inventar denominador seria o "pedido 0" de volta */
  it('⭐ sem pedido, sem pílula', () => {
    expect(lista(), 'a tela só desenha quando a lib devolveu algo').toMatch(/\{pil && \(/)
    expect(semComentario(ler(LIB)), 'e a lib se cala sem pedido').toMatch(/if \(base == null \|\| base <= 0\) return null/)
  })

  /**
   * ⛔⛔ **ELA NÃO É O FISCAL NEM O P8.** A régua da receita (eficiência congelada) continua no
   * pontinho do logo, na página da ordem e no sininho. Confundir as duas foi o que aposentou a
   * pílula antiga — e a home continua **sem importar** `faixaDoSelo`.
   */
  it('⛔⛔ a home não julga rendimento contra a ficha', () => {
    const t = tela()
    expect(t).not.toMatch(/faixaDoSelo/)
    expect(t).not.toMatch(/PilulaEf/)
  })

  /** ⭐ e o ⚠ aparece só no extremo, que é o que a lib chama de `alarme` */
  it('⭐ o ⚠ vem do `alarme` da lib, não de uma comparação na tela', () => {
    expect(lista()).toMatch(/\{pil\.alarme && <AlertTriangle/)
  })
})

// ─────────────── 5. linhas mais fortes ───────────────

describe('⭐⭐ 5. LINHAS MAIS FORTES — moldura, divisória e zebrado', () => {
  it('⭐ moldura de 1px na lista e divisória no tom forte', () => {
    const l = lista()
    expect(l, 'a moldura').toMatch(/border: '1px solid var\(--prod-line\)'/)
    expect(l, 'a divisória sobe pro line-strong').toMatch(/borderTop: '1px solid var\(--prod-line-strong\)'/)
  })

  /**
   * ⛔⛔ **O ZEBRADO VAI POR CLASSE, NUNCA POR `style` INLINE** — e o motivo é de CSS, não de
   * gosto: **estilo inline ganha de classe**, então o `hover:` deixaria de pintar justamente
   * nas linhas alternadas. Metade da lista pararia de responder ao mouse, sem nada quebrar.
   */
  it('⛔⛔ zebrado por CLASSE e hover num tom ACIMA dele', () => {
    const l = lista()
    expect(l, 'o zebrado alterna por classe').toMatch(/i % 2 === 1 \? 'bg-\[var\(--prod-surface-1\)\]' : ''/)
    expect(l, 'e o hover sobe pro surface-2 (senão a linha zebrada não responde)').toMatch(
      /hover:bg-\[var\(--prod-surface-2\)\]/,
    )
    const linha = l.slice(l.indexOf('<a key={c.id}'), l.indexOf('<IconeDaFicha'))
    expect(/style=\{\{[^}]*background/.test(linha), 'fundo inline na linha mataria o hover').toBe(false)
  })
})

// ─────────────── os 2 viewports ───────────────

describe('⭐⭐ REGRA 12 — uma composição, dois viewports', () => {
  /**
   * ⛔⛔ **UMA MARCAÇÃO SÓ.** O celular empilha pelo `flex-wrap` e a pílula desce pro 2º andar
   * **junto do par de números** (os dois com o mesmo `pl-[50px]`, alinhados abaixo do logo).
   * ⚠️ Dois blocos de linha (um por viewport) seriam duas composições a manter — e a segunda é
   * a que alguém esquece de ajustar, que é a doença que a REGRA 12 existe pra impedir.
   */
  it('⛔⛔ a linha tem UMA composição, com flex-wrap', () => {
    const l = lista()
    const linha = l.slice(l.indexOf('<a key={c.id}'), l.indexOf('</a>'))
    expect(linha, 'empilha por flex-wrap').toMatch(/flex flex-wrap items-center/)
    expect((linha.match(/<IconeDaFicha/g) ?? []).length, 'um logo por linha, não um por viewport').toBe(1)
    expect((linha.match(/\{pil && \(/g) ?? []).length, 'uma pílula por linha').toBe(1)
    expect(/sm:hidden|hidden sm:/.test(linha), 'bloco por viewport = duas composições').toBe(false)
  })

  /** ⭐ e o 2º andar do celular alinha os números abaixo do logo (38px + gap) */
  it('⭐ o par e a pílula descem alinhados no celular', () => {
    expect(lista()).toMatch(/pl-\[50px\] text-right lg:ml-0 lg:pl-0/)
  })
})
