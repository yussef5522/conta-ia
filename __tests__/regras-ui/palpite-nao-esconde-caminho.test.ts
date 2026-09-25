/**
 * ⭐⭐⭐ PALPITE É ATALHO, NUNCA MURO (25/09/2026) — régua do dono.
 *
 * **O caso:** a linha do MERCADO PAGO (PIX 2.900,34) tinha palpite de *fatura 2026-09*, e o
 * chip **💳 pagamento de fatura ▾ SUMIA** da fileira *"OU ESCOLHA OUTRO CAMINHO"*. Se o
 * palpite apontasse o cartão ou a competência ERRADA, não havia como escolher outro cartão
 * registrado — o atalho tinha virado a única porta.
 *
 * ⛔ A causa era uma linha: `l.acoes.filter((a) => a.acao !== l.palpite?.acao)` — a fileira
 * escondia justamente o gesto que o palpite usou. ***Palpite presente não esconde caminho.***
 *
 * ⚠️ E o menu, quando aparecia, listava só o NOME do cartão: escolher *"mercado pago"* não
 * dizia QUAL competência baixava — e o servidor precisa das duas coisas. Era o **gesto pela
 * metade** que o menu do empréstimo já tinha resolvido em 18/09.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { secoesDeFatura, alvoDaFatura, vencimentoDaCompetencia, type CartaoComFaturas } from '@/lib/credit-card-pj/faturas-pra-quitar'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf-8')
/** ⚠️ sem comentário: o arquivo que DOCUMENTA o defeito não pode ser o que o absolve */
const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const TELA = 'components/conciliacao/caixa-de-entrada.tsx'
const brl = (n: number) => `R$ ${n.toFixed(2).replace('.', ',')}`

describe('⛔⛔ 1. a fileira de caminhos NUNCA esconde o gesto que o palpite usou', () => {
  it('⭐ o filtro que tirava o chip do palpite morreu', () => {
    const c = semComentario(ler(TELA))
    /**
     * ⛔ O que morde é o FILTRO ter morrido, não a frase existir. Qualquer `filter` sobre
     * `l.acoes` comparando com a ação do palpite é a mesma doença com outro nome.
     */
    expect(c, 'a fileira voltou a esconder o caminho que o palpite usou')
      .not.toMatch(/l\.acoes\.filter\([\s\S]{0,120}palpite/)
    // ⭐ e a fileira desenha a lista INTEIRA
    expect(c).toContain('l.acoes.map((a) => {')
  })
})

describe('⭐⭐ 2. o menu diz CARTÃO e COMPETÊNCIA — um toque, as duas respostas', () => {
  const cartoes: CartaoComFaturas[] = [
    {
      id: 'c1', nome: 'mercado pago',
      faturas: [
        { invoiceMonth: '2026-09', net: 2900.34, vencimento: '2026-09-05', jaPaga: false },
        { invoiceMonth: '2026-08', net: 1500, vencimento: '2026-08-05', jaPaga: true },
      ],
    },
    { id: 'c2', nome: 'carter banrisul', faturas: [] },
  ]

  it('⭐ cada fatura traz mês · valor · vencimento', () => {
    const s = secoesDeFatura(cartoes, brl)
    const item = s[0].itens[0]
    expect(item.nome).toBe('fatura 2026-09')
    expect(item.detalhe).toContain('R$ 2900,34')
    expect(item.detalhe, 'o menu voltou a esconder o vencimento').toContain('vence 05/09')
  })

  it('⛔ fatura JÁ PAGA continua na lista, marcada — some seria a lista mentindo', () => {
    const s = secoesDeFatura(cartoes, brl)
    expect(s[0].itens).toHaveLength(2)
    expect(s[0].itens[1].detalhe).toContain('já paga')
  })

  it('⛔ cartão SEM fatura importada NÃO some — o dono pode estar quitando o que vai importar', () => {
    const s = secoesDeFatura(cartoes, brl)
    const secaoSem = s.find((x) => x.titulo.includes('sem fatura'))
    expect(secaoSem, 'o cartão sem fatura sumiu da lista').toBeTruthy()
    expect(secaoSem!.itens[0].nome).toBe('carter banrisul')
  })

  it('⭐ o id composto leva cartão E competência — nunca o gesto pela metade', () => {
    const s = secoesDeFatura(cartoes, brl)
    expect(alvoDaFatura(s[0].itens[0].id)).toEqual({ cardId: 'c1', invoiceMonth: '2026-09' })
    // ⚠️ sem competência (cartão sem fatura) quem resolve é o SERVIDOR, como antes
    expect(alvoDaFatura('c2')).toEqual({ cardId: 'c2' })
  })

  it('⛔⛔ e o menu tem UM DONO — a tela não remonta as seções na mão', () => {
    /**
     * ⚠️ Eu mesmo montei estas seções DUAS vezes (no chip e no *"não é essa"*) na primeira
     * versão deste sprint. Duas derivações da mesma pergunta divergem no primeiro campo
     * novo — bastaria alguém acrescentar o "já paga" num só lado.
     */
    const c = semComentario(ler(TELA))
    expect((c.match(/titulo: `💳 \$\{/g) ?? []).length,
      'a tela voltou a montar as seções de fatura à mão — é a segunda derivação')
      .toBe(0)
    expect((c.match(/secoesDeFatura\(/g) ?? []).length, 'o menu tem que sair da lib, uma vez só').toBe(1)
  })
})

describe('⭐⭐ 3. o palpite de fatura tem a porta de troca — o irmão do "não é essa" da conta', () => {
  const c = semComentario(ler(TELA))

  it('⭐ existe e abre o MESMO menu do chip (uma pergunta, um lugar)', () => {
    /**
     * ⚠️⚠️ **A 1ª VERSÃO DESTE TESTE VEIO VERDE COM O DEFEITO REPOSTO.** Eu troquei o gate
     * por `{false && (` e ele passou — porque a FRASE continua no arquivo. É a *"menção,
     * não uso"* mais uma vez (o `moldura ? 'O BANCO DIZ' : null` de 20/09, o
     * `hrefSemPagamento` de 20/09, o `IgnoradosDoCardapio` de 23/09).
     *
     * ⭐ O que morde é o **GATE que renderiza**: o último `&& (` antes do controle tem que
     * ser o do palpite de fatura. Esvaziar a condição vira vermelho na hora.
     */
    expect(c, 'o palpite de fatura voltou a não ter saída quando erra')
      .toContain('não é essa — escolher outro cartão/fatura →')
    const i = c.indexOf('não é essa — escolher outro cartão/fatura →')
    const gate = c.slice(0, i).lastIndexOf('&& (')
    expect(c.slice(Math.max(0, gate - 60), gate),
      'o controle ficou preso a outro gate — esvaziar a condição o apaga da tela em silêncio')
      .toContain("l.palpite.acao === 'PGTO_CARTAO'")
    // ⭐ o bloco inteiro do palpite de fatura tem que consumir o menu único
    const bloco = c.slice(i, i + 600)
    expect(bloco, 'a porta de troca montou um menu próprio').toContain('secoes={menuDeFaturas}')
    expect(bloco).toContain('alvoDaFatura(id)')
  })

  it('⛔ e ela NÃO é uma segunda porta de gravação — quem efetiva é o gesto de sempre', () => {
    const i = c.indexOf('não é essa — escolher outro cartão/fatura →')
    const bloco = c.slice(i, i + 600)
    expect(bloco).not.toContain('fetch(')
    expect(bloco).toContain('onGesto(')
  })
})

describe('⭐ 4. o retrato da fatura diz o VENCIMENTO junto do valor', () => {
  /**
   * ⭐ Era o *"nomeado, não feito"* de 23/09: o palpite de conta a pagar ganhou
   * valor+vencimento+NF, e o de fatura ficou só com o valor. *"Eu confiro valor e data
   * ANTES de confirmar, não depois"* vale igual dos dois lados.
   */
  const p = semComentario(ler('lib/conciliacao/palpites-da-caixa.ts'))

  it('⭐ o detalhe carrega o vencimento derivado do dueDay', () => {
    expect(p, 'o retrato da fatura voltou a mostrar só o valor').toMatch(/vence \$\{diaCurto/)
  })

  it('⛔⛔ e o `dueDay` está no SELECT — sem ele o retrato não tem como dizer a data', () => {
    /**
     * ⚠️ É a doença do PIX de 7.000 (17/08): *o motor decide com um campo que a consulta não
     * trouxe, e não dá erro: dá silêncio*. Aqui o silêncio seria o vencimento sumir do
     * retrato sem nada quebrar.
     */
    expect(p).toMatch(/businessCreditCard\.findMany\([\s\S]{0,200}dueDay: true/)
  })

  it('⛔ sem `dueDay` conhecido NÃO inventa data — mostra só o valor', () => {
    expect(vencimentoDaCompetencia('2026-09', 5)).toBe('2026-09-05')
    // ⚠️ o `invoiceMonth` JÁ é o mês do vencimento — somar um mês erraria toda fatura
    expect(vencimentoDaCompetencia('2026-09', 5)!.slice(0, 7)).toBe('2026-09')
    expect(vencimentoDaCompetencia('mês-torto', 5)).toBeNull()
  })

  it('⭐ dia 31 em mês curto cai no ÚLTIMO dia — nunca vaza pro mês seguinte', () => {
    expect(vencimentoDaCompetencia('2026-02', 31)).toBe('2026-02-28')
    expect(vencimentoDaCompetencia('2026-04', 31)).toBe('2026-04-30')
  })
})
