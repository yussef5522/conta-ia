/**
 * ⭐⭐⭐ UMA LISTA SÓ — O GUARD DE PÁGINA (23/09/2026).
 *
 * **A ordem do dono:** *"UM contêiner de lista; nenhuma decisão renderizada fora dele;
 * nenhuma linha em 2 lugares; Σ dos filtros == total da caixa."*
 *
 * ⛔ É o irmão do guard de 20/09, que rodava contra a PÁGINA MONTADA porque *"guard que
 * roda contra as rotas separadas aprova exatamente o que o dono vê e eu não"*. Lá o par
 * aparecia em duas superfícies; aqui era a mesma PERGUNTA em duas listas.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { passaNoFiltro, contadoresDaLista, linhasDaLista, type LinhaDaLista } from '@/lib/conciliacao/lista-unica'

const ler = (p: string) => readFileSync(join(process.cwd(), p), 'utf-8')
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const PAGINA = ler('app/(dashboard)/conciliacao/page.tsx')
const CAIXA = ler('components/conciliacao/caixa-de-entrada.tsx')

describe('⛔⛔ a PÁGINA tem UM contêiner de lista — as seções morreram', () => {
  const p = semComentario(PAGINA)

  it('⛔⛔ nenhum cartão de decisão é desenhado FORA da caixa', () => {
    /**
     * ⚠️ São os três que existiam: o lote (PRONTOS PRA CONFIRMAR), o card de escolha
     * (PRA TUA MÃO) e o par 1↔1. Cada um é uma superfície que respondia a MESMA pergunta
     * que a caixa — *"o que esta linha do banco é?"*.
     */
    for (const tag of ['<LoteSugerido', '<FilaEscolherNaMao', '<ParSugerido']) {
      expect(p, `${tag} voltou a ser desenhado fora da lista — são 2 modelos de novo`)
        .not.toContain(tag)
    }
  })

  it('⛔ e os RÓTULOS das seções sumiram junto — senão a casa volta sem o cartão', () => {
    expect(p).not.toContain('prontos pra confirmar')
  })

  it('⭐ a caixa é a ÚNICA lista que a página desenha', () => {
    expect(p).toContain('<CaixaDeEntrada')
    expect(p.match(/<CaixaDeEntrada/g) ?? []).toHaveLength(1)
  })

  it('⛔ a dupla contagem FICA — ela é anomalia, não seção de decisão', () => {
    /**
     * ⚠️ Conta marcada como paga E sem vínculo é **o mesmo dinheiro em duas linhas**.
     * Ela não é "espera", é defeito — e se saísse junto com as seções não sobraria lugar
     * nenhum onde ela aparecesse (a exceção que a régua de 08/09 já tinha nomeado).
     */
    expect(p).toContain('duplaContagem')
  })
})

describe('⭐⭐ o CASO renderiza DENTRO do cartão ≍ da linha', () => {
  const c = semComentario(CAIXA)

  it('⭐ as três famílias têm painel na linha', () => {
    expect(c).toMatch(/l\.caso\.tipo === 'LOTE'[\s\S]{0,200}<LoteSugerido/)
    expect(c).toMatch(/l\.caso\.tipo === 'ESCOLHA'[\s\S]{0,200}<EscolherNaMaoCard/)
    expect(c).toMatch(/l\.caso\.tipo === 'AMBIGUO'[\s\S]{0,200}<PainelDoCaso/)
  })

  it('⛔⛔ e eles entram em MODO PAINEL — senão o chassi ≍ nasce duas vezes', () => {
    /**
     * ⛔ Cada um desses componentes desenha o próprio `ChassiDoCartao` (com a coluna
     * *O BANCO DIZ*). Dentro do cartão da linha, isso mostraria **a linha do banco duas
     * vezes no mesmo cartão** — o oposto do "um modelo só".
     */
    expect(c).toMatch(/<LoteSugerido\s+comoPainel/)
    expect(c).toMatch(/<EscolherNaMaoCard\s+comoPainel/)
    for (const arq of ['components/conciliacao/lote-sugerido.tsx', 'components/conciliacao/escolher-na-mao-card.tsx'])
      expect(semComentario(ler(arq)), `${arq} perdeu o modo painel`).toContain('if (comoPainel) return')
  })

  it('⛔ a 2ª linha do caso APONTA, nunca redesenha o painel', () => {
    expect(c).toContain("l.caso?.hospeda === false")
    expect(CAIXA).toContain('parte do caso')
    // ⛔ e o painel só sai quando hospeda === true
    expect(c).toMatch(/l\.caso\?\.hospeda === true && l\.caso\.tipo === 'LOTE'/)
  })
})

describe('⛔ O MOCK v3 acompanha — ele é a RÉGUA versionada', () => {
  const MOCK = ler('docs/mocks/conciliacao-caixa-mock-v3.html')

  it('⛔ as seções morreram no mock também', () => {
    /**
     * ⚠️ *"Divergência do mock = defeito"* (10/09). Se o mock ainda desenhasse as seções,
     * o guard de tokens aprovaria o dia em que alguém as ressuscitasse na tela.
     */
    expect(MOCK, 'a seção PRA TUA MÃO voltou ao mock').not.toContain('PRA TUA MÃO — O PAGAMENTO EXISTE')
    expect(MOCK).not.toContain('PRONTOS PRA CONFIRMAR')
  })

  it('⭐ e os filtros da lista única estão lá', () => {
    expect(MOCK).toContain('class="filtros"')
    expect(MOCK).toContain('⭐ prontos')
    expect(MOCK).toContain('🖐 na mão')
    // ⭐ e a marca da linha que entra só pelo caso
    expect(MOCK).toContain('já classificada')
  })
})

describe('⛔⛔ NENHUMA LINHA EM DOIS LUGARES, e Σ dos filtros == a lista', () => {
  const lista: LinhaDaLista[] = [
    { id: 'a', soPeloCaso: false, caso: { tipo: 'PALPITE', hospeda: true } },
    { id: 'b', soPeloCaso: false, caso: { tipo: 'LOTE', hospeda: true } },
    { id: 'c', soPeloCaso: true, caso: { tipo: 'ESCOLHA', hospeda: true } },
    { id: 'd', soPeloCaso: false, caso: { tipo: 'ESCOLHA', hospeda: false, ancora: '#c' } },
    { id: 'e', soPeloCaso: false, caso: null },
  ]

  it('⛔ nenhuma linha passa em dois filtros', () => {
    for (const l of lista) {
      const em = (['PRONTOS', 'MAO'] as const).filter((f) => passaNoFiltro(l, f))
      expect(em.length, `a linha ${l.id} está em ${em.length} baldes`).toBeLessThanOrEqual(1)
    }
  })

  it('⭐⭐ Σ(prontos + mão) nunca passa do total, e TUDO mostra a lista inteira', () => {
    const c = contadoresDaLista(lista)
    expect(c.prontos + c.mao).toBeLessThanOrEqual(c.tudo)
    expect(c.tudo).toBe(lista.length)
  })

  it('⛔⛔ a ROTA devolve a lista larga — não o filtro `estacao === CAIXA`', () => {
    /**
     * ⛔⛔ ESTE É O DEFEITO MAIS CARO DO SPRINT: voltar a filtrar só a caixa faz as **14
     * linhas já categorizadas** sumirem junto com as seções — R$ 2.120,81 · 2.275,05 ·
     * 3.510,78 … de trabalho real. *Categoria não quita conta* (07/09).
     *
     * ⚠️ E a 1ª versão deste guard veio VERDE com o defeito reposto: ela fazia
     * `toContain('linhasDaLista(')` e a **menção** sobreviveu à reposição. *"Menção, não
     * uso"* — o que morde é o filtro velho ter MORRIDO e a resposta sair da lista larga.
     */
    const rota = semComentario(ler('app/api/conciliacao/caixa/route.ts'))
    expect(rota, 'a lista voltou a filtrar só a caixa — as 14 linhas somem')
      .not.toMatch(/linhas:\s*linhas\.filter\(\(l\) => l\.estacao === 'CAIXA'\)/)
    expect(rota, 'a resposta parou de sair da lista larga').toMatch(/linhas:\s*paraTela,/)
    // ⭐ e `paraTela` tem que NASCER da régua pura, não de um filtro escrito na rota
    expect(rota).toMatch(/const daLista = new Set\(linhasDaLista\(/)
  })

  it('⛔⛔ e a lista NÃO perde a linha já categorizada que tem caso aberto', () => {
    // ⚠️ é o caso medido em prod: 14 cards com a linha em ARQUIVO
    const r = linhasDaLista(
      [{ id: 'x' }], new Set<string>(),
      new Map([['x', { tipo: 'ESCOLHA' as const, hospeda: true }]]),
    )
    expect(r, 'a linha do card de escolha sumiu da lista').toHaveLength(1)
    expect(r[0].soPeloCaso).toBe(true)
  })

  it('⭐ a tela LÊ da mesma régua — nunca de um filtro próprio', () => {
    const c = semComentario(CAIXA)
    expect(c, 'a caixa escreveu um filtro próprio — contador e lista vão divergir')
      .toContain('passaNoFiltro(')
    expect(c).toContain('contadoresDaLista(')
  })
})
