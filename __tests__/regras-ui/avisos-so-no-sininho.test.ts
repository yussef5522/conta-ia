/**
 * ⭐⭐⭐ OS 3 AJUSTES DA HOME DE PRODUÇÃO (04/10/2026) — guard estrutural.
 *
 * **Ordem do dono, ao pé da letra:**
 * 1. *"o bloco inline MORRE — avisos SÓ no sininho do topo. Home limpa: título → cartões →
 *    listas. Componente guardado; **nada de aviso inline em tela nenhuma sem o dono pedir**."*
 * 2. *"cada concluída mostra 'pedido 120 · fez 148' (as palavras SEMPRE visíveis — **nunca dois
 *    números soltos pra adivinhar**). A PÍLULA DE % SAI DA LISTA (ela confundia: parecia
 *    fez÷pedido e não é)."*
 * 3. *"o fiscal continua, mas no lugar certo: (a) na PÁGINA DA ORDEM; (b) no SININHO quando vira
 *    padrão ou caso impossível; na LISTA, o único resto visual: um PONTINHO vermelho — sem
 *    número, sem pílula."*
 *
 * ⚠️ Assumido como ESTRUTURAL (o projeto roda em `environment: node`, sem jsdom): ele trava a
 * FORMA que o dono reprovou ao olhar a tela.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8')
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const HOME = 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'
const BLOCO = 'components/avisos/bloco-do-setor.tsx'
const ORDEM = 'app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx'

// ─────────────────── 1. avisos SÓ no sininho ───────────────────

describe('⛔⛔ 1. nenhum aviso INLINE em tela nenhuma — só o sininho', () => {
  it('⛔⛔ a home de produção não monta o bloco de avisos', () => {
    const h = semComentario(ler(HOME))
    expect(h, 'o bloco inline saiu da home por decisão do dono').not.toMatch(/<BlocoDeAvisos/)
    expect(h, 'e o import morto também').not.toMatch(/bloco-do-setor/)
  })

  /**
   * ⛔⛔ **A VARREDURA É DO APP INTEIRO, não só da home.** O pedido é *"nada de aviso inline em
   * tela nenhuma sem o dono pedir"* — e o jeito de isso voltar não é alguém reeditar a home, é
   * alguém pôr o bloco numa tela NOVA "porque já estava pronto".
   */
  it('⛔⛔ NENHUMA tela do app monta `<BlocoDeAvisos`', () => {
    const ofensores: string[] = []
    const varrer = (dir: string) => {
      for (const n of readdirSync(join(RAIZ, dir))) {
        const rel = `${dir}/${n}`
        if (n === 'node_modules' || n === '.next') continue
        if (statSync(join(RAIZ, rel)).isDirectory()) { varrer(rel); continue }
        if (!/\.tsx?$/.test(n)) continue
        if (rel === BLOCO) continue // ⭐ o próprio componente guardado
        if (semComentario(readFileSync(join(RAIZ, rel), 'utf8')).includes('<BlocoDeAvisos')) ofensores.push(rel)
      }
    }
    varrer('app')
    varrer('components')
    expect(ofensores, `aviso inline voltou em: ${ofensores.join(', ')}`).toEqual([])
  })

  /**
   * ⭐ **A FUNÇÃO NÃO SE PERDEU — e o guard prova os DOIS lados.** Guard que só verifica a
   * remoção aprovaria o dia em que os avisos sumissem de todo lugar, e aí não seria mudança de
   * casa, seria perda (a disciplina da conferência de saldo que mudou de casa em 10/09).
   */
  it('⭐⭐ e o sininho CONTINUA mostrando os avisos nos 2 viewports', () => {
    expect(ler('components/layout/top-bar.tsx')).toMatch(/<Sininho\s*\/>/)
    expect(ler('components/layout/dashboard-shell.tsx')).toMatch(/<Sininho\s*\/>/)
    const sino = ler('components/avisos/sininho.tsx')
    expect(sino, 'agrupado por setor').toMatch(/ROTULO_DO_SETOR/)
    expect(sino, 'com contador').toMatch(/naoLidos > 0 &&/)
    expect(sino, 'e o "o que fazer"').toMatch(/O que fazer:/)
  })

  /** ⛔ o componente fica GUARDADO com selo — senão a próxima faxina trata como código morto */
  it('⛔ o bloco existe com o selo de CAPACIDADE GUARDADA', () => {
    expect(existsSync(join(RAIZ, BLOCO))).toBe(true)
    expect(ler(BLOCO)).toMatch(/CAPACIDADE GUARDADA/)
  })
})

// ─────────────────── 2. dois números, com as palavras ───────────────────

describe('⛔⛔ 2. "pedido N · fez M" — as PALAVRAS sempre visíveis', () => {
  const lista = () => {
    const h = ler(HOME)
    return h.slice(h.indexOf('function ListaConcluidas'))
  }

  it('⭐⭐ as duas palavras aparecem na linha da concluída', () => {
    const l = lista()
    expect(l, 'a palavra "pedido" ao lado do número').toMatch(/>pedido </)
    expect(l, 'a palavra "fez" ao lado do número').toMatch(/>fez </)
  })

  /**
   * ⛔⛔ A SETA SAIU: `120 → 148` são *"dois números soltos pra adivinhar"* — exatamente o que
   * o dono proibiu. A seta não diz qual é qual.
   */
  it('⛔⛔ nenhuma seta no lugar das palavras', () => {
    expect(semComentario(lista()), 'a seta voltou a substituir as palavras').not.toMatch(/<ArrowRight/)
  })

  /** ⚠️ ordem antiga sem pedido mostra SÓ o "fez" — inventar pedido seria o "pedido 0" de 04/10 */
  it('⭐ o "pedido" é condicional; o "fez" é sempre', () => {
    const l = lista()
    const bloco = l.slice(l.indexOf('pf?.pedido != null'), l.indexOf('fiscalImpossivel'))
    expect(bloco, 'o "pedido" vive dentro do gate de existência').toMatch(/pf\?\.pedido != null && \([\s\S]*?>pedido </)
    // ⭐ e o "fez" está FORA do gate
    const depoisDoGate = bloco.slice(bloco.lastIndexOf('</>'))
    expect(depoisDoGate).toMatch(/>fez </)
  })

  /**
   * ⛔⛔ A PÍLULA FOI **APAGADA**, não escondida: *função sem chamador é função que alguém
   * religa por descuido* (a régua da faxina de 15/09).
   */
  it('⛔⛔ a pílula de % não existe mais na home', () => {
    const h = semComentario(ler(HOME))
    expect(h, 'a pílula voltou pra lista').not.toMatch(/PilulaEf/)
    expect(h, 'nem o import da régua que só ela usava').not.toMatch(/faixaDoSelo/)
  })

  /**
   * ⭐ **E A RÉGUA NÃO MORREU NEM VIROU CÓPIA** — ela segue servindo a tela "Por dia"
   * (relatório, onde o percentual tem a coluna do pedido ao lado) e o juiz P8.
   */
  it('⭐⭐ `faixaDoSelo` continua viva onde ela tem régua visível', () => {
    expect(ler('app/(dashboard)/empresas/[id]/estoque/producao/por-dia/page.tsx')).toMatch(/faixaDoSelo/)
    expect(ler('lib/stock/producao/producao-invariants.ts')).toMatch(/DESVIO_ALERTA|eficienciaDaOrdem|faixaDoSelo/)
  })
})

// ─────────────────── 3. o fiscal, nos 3 lugares ───────────────────

describe('⛔⛔ 3. o fiscal no lugar certo — ordem · sininho · pontinho', () => {
  it('⭐⭐ (a) a PÁGINA DA ORDEM mostra a frase de balcão, da LIB', () => {
    const o = ler(ORDEM)
    expect(o).toMatch(/fraseDoFiscal\(/)
    expect(o, 'só desenha quando há material pra fiscalizar').toMatch(/eficiencia\.fiscal\.permitido != null/)
    const lib = ler('lib/stock/producao/eficiencia-da-ordem.ts')
    expect(lib, 'a frase que o dono ditou').toMatch(/pelo material separado, a receita permite ~/)
    expect(lib).toMatch(/foram declaradas/)
  })

  /**
   * ⚠️⚠️ APERTADO depois da prova em prod, **que achou uma enxurrada**: a 1ª versão emitia
   * **90 avisos** (um por ordem impossível da janela de 60 dias). O dono pediu *"padrão **ou**
   * caso impossível"* — e são as duas formas que o guard passou a exigir, com a supressão de
   * *"uma causa, um alarme"* no meio.
   */
  it('⭐⭐ (b) o SININHO ganha o aviso do caso impossível, com link pra ordem', () => {
    const prod = ler('lib/avisos/produtores/producao.ts')
    expect(prod).toMatch(/FISCAL_DECLARADO/)
    expect(prod, 'o aviso leva DIRETO pra ordem').toMatch(/estoque\/producao\/\$\{ultimo\.ordemId\}/)
    expect(prod, 'e nomeia quem declarou').toMatch(/\$\{quem\} declarou/)
    expect(prod).toMatch(/fiscalDoDeclaradoNoSininho\(companyId, r, db\)/)
  })

  /**
   * ⛔⛔ **UMA CAUSA, UM ALARME.** Ficha com o lote na unidade errada tem aviso PRÓPRIO (a fila
   * de conversão); ali o `permitido` não mede lançamento, mede a ficha quebrada. Sem a
   * supressão o sininho acusava o mesmo defeito duas vezes e mandava o dono conferir a mão da
   * cozinha.
   */
  it('⛔⛔ (b) ficha com lote torto NÃO vira aviso de fiscal', () => {
    const prod = semComentario(ler('lib/avisos/produtores/producao.ts'))
    const fn = prod.slice(prod.indexOf('async function fiscalDoDeclaradoNoSininho'))
    expect(fn, 'a mesma supressão que o padrão de rendimento usa').toMatch(/fichasComLoteTorto\(companyId, db\)/)
    expect(fn).toMatch(/loteTorto\.has\(f\.fichaId\)\) continue/)
  })

  /** ⛔ repetiu na MESMA receita = PADRÃO = **UM** aviso (90 avisos é enxurrada, não central) */
  it('⛔⛔ (b) repetição na mesma receita vira UM aviso de padrão', () => {
    const prod = semComentario(ler('lib/avisos/produtores/producao.ts'))
    const fn = prod.slice(prod.indexOf('async function fiscalDoDeclaradoNoSininho'))
    expect(fn, 'agrupa por receita antes de gravar').toMatch(/porFicha\.set\(f\.fichaId/)
    expect(fn, 'caso isolado continua sendo um aviso da ORDEM').toMatch(/ord\.length === 1/)
    expect(fn, 'o padrão é da FICHA, e o alvo diz isso').toMatch(/alvo: `ficha:\$\{fichaId\}`/)
    expect(fn, 'e ele diz quantos lotes').toMatch(/\$\{ord\.length\} lotes/)
  })

  /**
   * ⛔⛔ (c) O PONTINHO É **SINAL, NÃO VEREDITO**: sem número e sem pílula. Pôr o número aqui
   * recriaria exatamente o que a pílula fazia de errado — um percentual sem a régua ao lado.
   */
  it('⛔⛔ (c) na LISTA é só um pontinho — sem número, sem pílula', () => {
    const h = ler(HOME)
    const l = h.slice(h.indexOf('function ListaConcluidas'))
    expect(l).toMatch(/c\.fiscalImpossivel &&/)
    const ponto = l.slice(l.indexOf('c.fiscalImpossivel &&'), l.indexOf('ChevronRight', l.indexOf('c.fiscalImpossivel')))
    expect(ponto, 'o pontinho não imprime número nenhum').not.toMatch(/\{Math\.round|fmtQtd|%/)
    expect(ponto, 'é um círculo de 7px').toMatch(/rounded-full/)
    expect(ponto, 'e tem nome pra quem passa o mouse / usa leitor de tela').toMatch(/aria-label=/)
  })

  /**
   * ⛔⛔ **A TELA NÃO DIVIDE NADA.** O booleano vem do servidor: se a tela derivasse, seria a 2ª
   * régua do fiscal e discordaria do sininho e da página da ordem no 1º ajuste de teto — a
   * doença dos 7 detectores de par.
   */
  it('⛔⛔ a tela recebe o BOOLEANO do servidor, nunca calcula o fiscal', () => {
    const h = semComentario(ler(HOME))
    expect(h, 'nenhuma divisão de fiscal na tela').not.toMatch(/permitido|pctFisico|TETO_FISICO/)
    const rota = semComentario(ler('app/api/empresas/[id]/estoque/producao/ordens/route.ts'))
    expect(rota).toMatch(/fiscalDeOrdens\(/)
    expect(rota, 'só o booleano viaja').toMatch(/fiscalImpossivel: fiscal\.get\(c\.ordemId\)\?\.impossivel \?\? false/)
    expect(rota, 'e o número NÃO viaja (senão alguém o desenha e a pílula volta)').not.toMatch(/permitido:/)
  })

  /**
   * ⛔⛔ ZERO N+1: a home é tela de todo dia, e `for (…) await` nela é o defeito de 28/09
   * (4.909 ms · 1.786 consultas).
   */
  it('⛔⛔ o fiscal da lista lê em LOTE, nunca uma consulta por ordem', () => {
    const f = semComentario(ler('lib/stock/producao/fiscal-dos-lotes.ts'))
    expect(f, 'consumo em lote').toMatch(/consumidoPorOrdem\(/)
    expect(f, 'ordens em lote').toMatch(/id: \{ in: ids \}/)
    expect(f, 'nenhuma chamada por ordem dentro do laço').not.toMatch(/for \([^)]*\) \{[\s\S]{0,400}?await (db|consumoDaOrdem|consumidoPorItem)\./)
    const ordens = semComentario(ler('lib/stock/producao/ordens.ts'))
    expect(ordens, 'o leitor em lote usa o MESMO filtro do leitor por ordem').toMatch(
      /receiptId: \{ in: ordemIds \}, tipo: TIPO_CONSUMO/,
    )
  })
})
