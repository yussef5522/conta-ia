/**
 * ⭐⭐⭐ A TINTA E A LINHA DA FUNDAÇÃO — L2 · L3 · L4 · L6 (FRENTE A itens 2 e 3, 14/10/2026).
 *
 * **Ordem do dono:** *"TINTA (L2+L3): títulos, números e nomes em tinta FORTE; apoio em tinta
 * média; tinta fraca SÓ em dica/metadado. Dinheiro em peso 800 tabular"* · *"LINHA FIRME (L4):
 * borda de cartão 1px sólida, cabeçalho de tabela com régua forte, zebra sutil, hover
 * índigo-claro nas linhas clicáveis"* · *"É troca de roupa global — nenhuma lógica, rota ou
 * porta muda."*
 *
 * ⛔⛔ **O GUARD MEDE O LUGAR ONDE A LEI ALCANÇA O SISTEMA, não cada tela.** O que faz isto ser
 * *global* são três alavancas, e é nelas que o teste morde:
 *  · **`--radius`** → `rounded-lg` em 161 arquivos que usam `Card`;
 *  · **`ui/card`** → L4 (borda 1px) + L6 (sombra só no claro) nos mesmos 161;
 *  · **`density-*`** → L4 na tabela de dados das 22 telas que já usam a convenção;
 *  · **`.dinheiro`** → L3 nos 2 primitivos de dinheiro (21 telas).
 * ⚠️ Densidade tela a tela e as telas antigas fora do padrão são **fase 2**, por escrito no
 * próprio pedido. O guard não finge que elas entraram.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { lerReferenciaVisual, CAMINHO_DA_FUNDACAO } from '@/lib/referencias/visual'
import { razao, PISO_TEXTO_NORMAL } from '@/lib/ui/contraste'
import { semComentarios, usosDe } from './_leitura-de-fonte'

const RAIZ = process.cwd()
const CSS = readFileSync(join(RAIZ, 'app/globals.css'), 'utf8')
const REF = lerReferenciaVisual(CAMINHO_DA_FUNDACAO)
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8')
const semComentarioCss = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const LIMPO = semComentarioCss(CSS)

/** o corpo da regra cujo seletor contém `ancora` (o 1º) */
function bloco(ancora: string): string {
  const i = LIMPO.indexOf(ancora)
  expect(i, `âncora "${ancora}" não existe no globals.css`).toBeGreaterThan(-1)
  return LIMPO.slice(i, LIMPO.indexOf('}', i))
}

// ───────────────────────────── L6 · a profundidade ─────────────────────────────

describe('⭐⭐ L6 — sombra de 2 camadas no CLARO, elevação por SUPERFÍCIE no escuro', () => {
  /**
   * ⛔⛔ O VALOR SAI DA REFERÊNCIA, não de um literal aqui — é a mesma disciplina do guard da
   * raiz: tom/sombra ajustados "no olho" ficam vermelhos apontando o que o arquivo manda.
   */
  it('⛔ os dois mapas carregam a sombra que a referência declara', () => {
    const daRef = (trecho: string) =>
      /--sombra:\s*([^;]+);/.exec(trecho)?.[1].replace(/\s+/g, ' ').trim()

    const topoRef = REF.css.slice(0, REF.css.indexOf('@media'))
    const claroRef = daRef(topoRef)
    expect(claroRef, 'a referência declara a sombra do claro').toBeTruthy()

    const iEscuro = REF.css.indexOf(':root[data-theme="dark"]{')
    const escuroRef = daRef(REF.css.slice(iEscuro, REF.css.indexOf('}', iEscuro)))
    expect(escuroRef, 'L6: no escuro a referência ZERA a sombra').toBe('none')

    /** ⚠️ compara sem espaço: a referência escreve `rgba(10,15,30,.06)` e o CSS da casa
     *  `rgba(10, 15, 30, 0.06)` — a mesma sombra com outra pontuação. */
    const compacto = (s: string) => s.replace(/\s|0(?=\.)/g, '')
    const claroCasa = /--prod-sombra:\s*([^;]+);/.exec(bloco('--prod-bg: #f3f5fa'))
    expect(compacto(claroCasa?.[1] ?? ''), 'a sombra do claro é a da referência').toBe(
      compacto(claroRef!),
    )

    const escuroCasa = /--prod-sombra:\s*([^;]+);/.exec(
      LIMPO.slice(LIMPO.indexOf('--prod-bg: #0b0e1c')),
    )
    expect(escuroCasa?.[1].trim(), 'L6: fio de sombra no escuro contraria a lei').toBe('none')
  })

  /**
   * ⭐⭐ A ALAVANCA: **um** componente, 161 arquivos. E a prova do número está aqui — se o
   * `Card` voltar a cravar `shadow-sm`, todo cartão do tema escuro ganha sombra de novo e
   * nenhuma tela acusa.
   */
  it('⛔⛔ o `Card` LÊ o token da sombra — `shadow-sm` cravado vale nos 2 temas', () => {
    const card = semComentarios(ler('components/ui/card.tsx'))
    expect(card, 'a sombra tem que vir do token, senão o escuro não zera').toMatch(
      /boxShadow: 'var\(--prod-sombra\)'/,
    )
    expect(card, 'shadow-sm é valor cravado — ignora o tema').not.toMatch(/shadow-sm/)
    expect(card, 'L4: a borda de 1px sólida do cartão').toMatch(/\bborder\b/)
  })
})

// ───────────────────────────── L4 · a linha firme ─────────────────────────────

describe('⭐⭐ L4 — régua forte no cabeçalho, divisor de 1px, zebra e hover', () => {
  /**
   * ⛔⛔ A RÉGUA É DE **2px NA LINHA-FORTE** — e os dois números saem do `.tab` da referência,
   * não de um literal meu. Régua de 1px na linha fina é exatamente o *"0.5px fantasma em
   * superfície de dados"* que a lei nomeia.
   */
  it('⛔⛔ o cabeçalho de tabela tem a régua que o `.tab` da referência declara', () => {
    const tabTh = /\.tab th\{([^}]*)\}/.exec(REF.css)?.[1] ?? ''
    expect(tabTh, 'o `.tab th` saiu da referência').toBeTruthy()
    expect(tabTh, 'a referência manda régua de 2px').toMatch(/border-bottom:2px solid/)

    const th = bloco('.density-normal thead th')
    expect(th, 'régua de 2px na linha-FORTE').toMatch(
      /border-bottom: 2px solid var\(--prod-line-strong\)/,
    )
    expect(th, 'o peso 800 do cabeçalho').toMatch(/font-weight: 800/)
    expect(th, 'na tinta MÉDIA (L2: cabeçalho é apoio, não conteúdo)').toMatch(
      /color: var\(--prod-secondary\)/,
    )

    /** ⚠️ as 3 densidades, não só a `normal`: tabela em compact é a mesma tabela, e deixar uma
     *  fora é a lei valendo em 2 de 3 telas sem ninguém saber qual. */
    for (const d of ['compact', 'normal', 'comfortable']) {
      expect(LIMPO, `density-${d} fora da régua`).toMatch(
        new RegExp(`\\.density-${d} thead th`),
      )
      expect(LIMPO, `density-${d} fora do divisor`).toMatch(new RegExp(`\\.density-${d} tbody td`))
    }
  })

  it('⛔ o divisor de linha é 1px sólido na `--prod-line`', () => {
    expect(bloco('.density-normal tbody td'), 'divisor de 1px').toMatch(
      /border-bottom: 1px solid var\(--prod-line\)/,
    )
  })

  /**
   * ⛔⛔ **A ZEBRA É OPT-IN, E O GUARD AFIRMA ISSO — com o motivo medido.** Varredura de 14/10:
   * **13 das 22** tabelas de dados pintam o FUNDO DA LINHA por ESTADO (anulada, divergente,
   * suspeita). Uma zebra global vence o `bg-amber-50` da tela por especificidade (0,2,1 × 0,1,0)
   * e apagaria o sinal de estado nelas — trocaria listra bonita por informação que desapareceu.
   * ⚠️ Se alguém pendurar a zebra no `density-*`, este teste fica vermelho.
   */
  it('⛔⛔ a zebra NÃO é global — senão apaga o estado de 13 das 22 tabelas', () => {
    expect(LIMPO, 'a zebra existe como classe própria').toMatch(
      /\.zebra tbody tr:nth-child\(even\) td/,
    )
    for (const d of ['compact', 'normal', 'comfortable']) {
      expect(
        LIMPO,
        `zebra pendurada em density-${d} apaga a linha pintada por estado`,
      ).not.toMatch(new RegExp(`\\.density-${d} tbody tr:nth-child`))
    }
  })

  /**
   * ⚠️ HOVER SÓ EM LINHA CLICÁVEL (a lei diz *"nas linhas CLICÁVEIS"*): hover em linha que não
   * clica promete um gesto que não existe — a régua de afordância de 30/08.
   */
  it('⛔ o hover índigo-claro é gateado em linha clicável', () => {
    const hover = LIMPO.slice(LIMPO.indexOf('.density-compact tbody tr:is('))
    expect(hover.slice(0, 500), 'o gate da linha clicável').toMatch(
      /:is\(\.clicavel, \[role='button'\], :has\(a, button\)\)/,
    )
    expect(hover.slice(0, 500), 'índigo-claro = a superfície de ação').toMatch(
      /background: var\(--prod-surface-2\)/,
    )
    expect(LIMPO, 'hover em QUALQUER linha promete clique que não existe').not.toMatch(
      /\.density-normal tbody tr:hover/,
    )
  })

  /**
   * ⛔ AS ALTURAS NÃO FORAM TOCADAS — é o que mantém `lib/contas-pagar/virtualization.ts`
   * (que DUPLICA 36/48/60) honesto. A proibição da casa é sobre elas.
   */
  it('⛔⛔ as alturas do `density-*` seguem 36/48/60 — a virtualização depende delas', () => {
    expect(bloco('.density-compact tbody tr')).toMatch(/height: 36px/)
    expect(bloco('.density-normal tbody tr')).toMatch(/height: 48px/)
    expect(bloco('.density-comfortable tbody tr')).toMatch(/height: 60px/)

    const virt = ler('lib/contas-pagar/virtualization.ts')
    for (const h of ['36', '48', '60']) {
      expect(virt, `a virtualização conta com ${h}px`).toMatch(new RegExp(`\\b${h}\\b`))
    }
  })
})

// ───────────────────────────── L2 · L3 · a tinta e o dinheiro ─────────────────

describe('⭐⭐ L2 e L3 — as três tintas e o dinheiro com um dono só', () => {
  /**
   * ⛔ AS TRÊS TINTAS, E CADA UMA COM O PAPEL ESCRITO. O guard de `dois-temas-na-raiz` já casa o
   * VALOR delas com a referência; aqui o que se afirma é que são **três**, com papéis distintos.
   */
  it('⭐ as 3 tintas existem nos 2 mapas, e a referência declara o papel de cada uma', () => {
    for (const t of ['--tinta', '--tinta-2', '--tinta-3']) {
      expect(REF.valores[t], `${t} saiu da referência`).toBeTruthy()
    }
    for (const t of ['--prod-primary', '--prod-secondary', '--prod-muted']) {
      expect(bloco('--prod-bg: #f3f5fa'), `${t} no claro`).toMatch(new RegExp(`${t}:`))
      expect(
        LIMPO.slice(LIMPO.indexOf('--prod-bg: #0b0e1c')).slice(0, 1800),
        `${t} no escuro`,
      ).toMatch(new RegExp(`${t}:`))
    }
  })

  /**
   * ⛔⛔ **PROIBIDO TEXTO DE CONTEÚDO EM TINTA FRACA** (L2, literal). Aqui isso vira NÚMERO: a
   * tinta fraca não alcança o piso de texto normal (4,5:1) nos chãos da casa — então ela é
   * estruturalmente de dica/metadado, não de conteúdo. É a medição sustentando a lei em vez de
   * uma recomendação que alguém segue ou não.
   */
  it('⛔⛔ a tinta FRACA não passa o piso de texto normal — por isso é só dica', () => {
    const fraca = { claro: '#7e89a4', escuro: '#6a7390' }
    const chao = { claro: ['#f3f5fa', '#fff'], escuro: ['#0b0e1c', '#141829'] }
    for (const tema of ['claro', 'escuro'] as const) {
      for (const c of chao[tema]) {
        const r = razao(fraca[tema], c)
        expect(r, `${tema}: a fraca sobre ${c} dá ${r.toFixed(2)}:1`).toBeLessThan(
          PISO_TEXTO_NORMAL,
        )
      }
    }
    /** ⭐ e a FORTE passa com folga nos mesmos chãos — é ela que carrega título, número e nome */
    const forte = { claro: '#0a0f1e', escuro: '#eef1fb' }
    for (const tema of ['claro', 'escuro'] as const) {
      for (const c of chao[tema]) {
        expect(razao(forte[tema], c), `${tema}: a forte sobre ${c}`).toBeGreaterThanOrEqual(
          PISO_TEXTO_NORMAL,
        )
      }
    }
  })

  /**
   * ⛔⛔ L3 COM DONO ÚNICO, **E COM CHAMADOR**: classe de fundação sem consumidor é o
   * `registry.parse` decorativo — existe, ninguém chama, e ninguém descobre que está errada.
   * ⚠️ Conta o USO, nunca a menção (*"menção, não uso"*, a cicatriz que esta casa pagou 16×).
   */
  it('⛔⛔ `.dinheiro` é o dono do peso 800 tabular — e os 2 primitivos CONSOMEM', () => {
    const d = bloco('.dinheiro {')
    expect(d, 'peso 800').toMatch(/font-weight: 800/)
    expect(d, 'tabular').toMatch(/tabular-nums/)
    expect(d, 'a cor é de quem desenha: ela depende do que o número SIGNIFICA').not.toMatch(
      /color:/,
    )

    for (const f of ['components/ui/stat-card.tsx', 'components/ui/totals-bar.tsx']) {
      const src = semComentarios(ler(f))
      expect(src.includes('dinheiro'), `${f} não consome o dono do peso`).toBe(true)
      expect(src, `${f}: peso de dinheiro declarado no componente, fora da fundação`).not.toMatch(
        /font-(semibold|medium) tabular-nums/,
      )
    }
  })

  /**
   * ⭐ A MÉTRICA DO CARTÃO VEM DA REFERÊNCIA (`--r-cartao`), e é o `--radius` do shadcn que a
   * espalha pelos 161 arquivos. ⚠️ Lido do ARQUIVO, não cravado: raio ajustado no olho fica
   * vermelho apontando o que a referência manda.
   */
  it('⛔ o `--radius` carrega o raio de cartão da referência', () => {
    const rCartao = /--r-cartao:\s*(\d+)px/.exec(REF.css)?.[1]
    expect(rCartao, 'a referência declara o raio do cartão').toBe('12')
    expect(bloco('--radius:'), `o shadcn tem que servir ${rCartao}px`).toMatch(/0\.75rem/)
    expect(bloco('--prod-r-cartao'), 'e o token da fundação não divergiu').toMatch(
      new RegExp(`--prod-r-cartao: ${rCartao}px`),
    )
  })
})

// ─────────────────── a fronteira: nenhuma lógica muda ───────────────────

/**
 * ⛔⛔⛔ *"É troca de roupa global — nenhuma lógica, rota ou porta muda"* (o dono). Este bloco é
 * o que transforma a frase em teste: os 4 arquivos que a FRENTE A tocou não podem ter ganhado
 * nada que decida, busque ou grave.
 */
/**
 * ⚠️⚠️ O DESCRIBE "é ROUPA" MUDOU DE CASA — `a-fundacao-e-roupa.test.ts` (14/10/2026).
 *
 * Ele vivia aqui e cobria **4 arquivos**; o sprint tocou **11 peças de roupa**, a porta da
 * preferência e uma migration. Deixar a pergunta *"o sprint é roupa?"* em dois arquivos faria
 * os dois divergirem no primeiro arquivo novo — e o que ficaria pra trás é justamente o que
 * ninguém reabre. **A régua não afrouxou: ela ficou MAIS FORTE** (a lista de rotas por arquivo
 * é mais apertada que `not.toMatch(/\/api\//)`, que proibia tudo e por isso teria de ser
 * afrouxada pro botão do tema).
 */
