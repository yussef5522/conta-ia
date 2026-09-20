// ⛔⛔⛔ O MESMO PAR EM DUAS SUPERFÍCIES, COM BOTÕES NOS DOIS (20/09/2026)
//
// **O dono:** *"a linha FRANCIELE está na caixa COM palpite e o MESMO par aparece embaixo
// como card no PRA TUA MÃO (com botões próprios)."*
//
// ⛔ **A causa é estrutural: as duas superfícies decidem sozinhas.** A caixa monta palpites,
// o card monta a escolha manual, e **nenhuma sabe da outra**. Duas telas com botão pro mesmo
// par é a família do **caso Cancian** (08/09), em que a nota errada foi vinculada porque dois
// cards ficaram quase idênticos — ***o desenho certo é nem criar a disputa visual***.
//
// ⭐ **A DIVISÃO (régua do dono):** 1↔1 com palpite → **só na caixa**; ambíguo (2+ linhas
// pra mesma conta) ou N:M → **só no card**, e a linha na caixa vira PONTEIRO.

import { describe, it, expect } from 'vitest'
import {
  dividirPorCasa, fraseDoCasoNoCard, ancoraDoCard, consequenciaDeVincular,
} from '@/lib/conciliacao/uma-casa-por-caso'

/** o caso real: duas linhas de R$ 500 disputando a conta «franciele» */
const FRANCIELE = { linhaId: 'l_franciele', contaIds: ['c_franciele'], nomeDoCaso: 'franciele' }
const TIELE = { linhaId: 'l_tiele', contaIds: ['c_franciele'], nomeDoCaso: 'franciele' }
const DOCEOLI = { linhaId: 'l_doceoli', contaIds: ['c_doceoli'], nomeDoCaso: 'DOCEOLI ALIMENTOS' }
const LOTE = { linhaId: 'l_casper', contaIds: ['c1', 'c2', 'c3'], nomeDoCaso: 'CASPER' }
const SEM_PALPITE = { linhaId: 'l_nada', contaIds: [], nomeDoCaso: 'eletrosul' }

describe('⛔⛔⛔ um par, uma casa', () => {
  it('⭐ 1↔1 com palpite mora SÓ na caixa — o card não repete', () => {
    const casas = dividirPorCasa([DOCEOLI, SEM_PALPITE])
    expect(casas.get('l_doceoli')!.casa).toBe('CAIXA')
    expect(casas.get('l_nada')!.casa).toBe('CAIXA')
  })

  it('⛔⛔ o caso franciele×tiele: AMBÍGUO → as DUAS vão pro card', () => {
    const casas = dividirPorCasa([FRANCIELE, TIELE, DOCEOLI])
    for (const id of ['l_franciele', 'l_tiele']) {
      expect(casas.get(id)!.casa, `${id} ficou com botão na caixa — duas telas decidindo o mesmo par`).toBe('CARD')
      expect(casas.get(id)!.motivo).toBe('AMBIGUO')
    }
    // ⭐ e o vizinho não-ambíguo continua na caixa: a régua não é uma parede
    expect(casas.get('l_doceoli')!.casa).toBe('CAIXA')
  })

  it('⭐ N:M (lote) também é decisão do card', () => {
    expect(dividirPorCasa([LOTE]).get('l_casper')).toMatchObject({ casa: 'CARD', motivo: 'N_PARA_M' })
  })

  /**
   * ⚠️⚠️ A AMBIGUIDADE É MEDIDA SOBRE QUEM ESTÁ **NA CAIXA** — e isso foi escolha, com
   * número: a conta «franciele» tem **8 linhas candidatas** por valor+data em prod. Se
   * "2+ candidatas" bastasse, TODA conta viraria caso de card e o palpite nunca mais teria
   * botão. O que cria a disputa é duas linhas **em aberto** reivindicando a mesma conta.
   */
  it('⛔ linha já resolvida NÃO cria ambiguidade — ela não está na caixa', () => {
    // a Tiele resolvida simplesmente não entra na lista de entrada
    expect(dividirPorCasa([FRANCIELE]).get('l_franciele')!.casa).toBe('CAIXA')
  })

  it('⭐ a linha que vai pro card carrega o NOME e a ÂNCORA — nunca "resolve lá" sem lá', () => {
    const c = dividirPorCasa([FRANCIELE, TIELE]).get('l_franciele')!
    expect(c.nomeDoCaso).toBe('franciele')
    expect(c.ancora).toBe(ancoraDoCard('l_franciele'))
    expect(fraseDoCasoNoCard(c)).toMatch(/faz parte do caso «franciele»[\s\S]*Resolver lá/)
  })

  it('⛔ e a frase DIZ o porquê — "resolver lá" sem motivo é ordem, não explicação', () => {
    expect(fraseDoCasoNoCard(dividirPorCasa([FRANCIELE, TIELE]).get('l_tiele')!))
      .toMatch(/mais de uma linha pode ser o pagamento/)
    expect(fraseDoCasoNoCard(dividirPorCasa([LOTE]).get('l_casper')!))
      .toMatch(/cobre mais de uma nota/)
  })
})

describe('⭐⭐ a candidata JÁ CATEGORIZADA é oferecida — com a consequência escrita', () => {
  /**
   * ⭐ A pergunta do dono sobre a Tiele. A resposta é **sim**, e ela já era a régua de
   * 07/09: *"ter categoria não quita conta nenhuma"*. Escondê-la esconderia justamente o
   * caso em que o pagamento verdadeiro virou despesa avulsa — a dupla contagem.
   */
  it('⭐ linha com categoria: o aviso é OBRIGATÓRIO', () => {
    const c = consequenciaDeVincular('Salários', 'franciele')
    expect(c.precisaAvisar).toBe(true)
    expect(c.texto).toContain('já categorizada como Salários')
  })

  /**
   * ⚠️⚠️ **E A CONSEQUÊNCIA É A MEDIDA, NÃO A SUPOSTA.** O dono escreveu *"vincular aqui
   * DESFAZ aquilo"*; medido no código, **a categoria NÃO é desfeita** — o backfill é
   * cooperativo (só preenche o que é `null`). O que muda é a conta sair do "em aberto" e
   * a linha virar o pagamento dela. *Repetir a frase dele seria inventar um efeito.*
   */
  it('⛔ o texto NÃO promete desfazer a categoria — ele diz o que de fato muda', () => {
    const c = consequenciaDeVincular('Salários', 'franciele')
    expect(c.texto, 'voltou a prometer que a categoria é desfeita').not.toMatch(/desfaz|desfazer/i)
    expect(c.texto).toContain('a categoria dela fica')
    expect(c.texto).toMatch(/sai do "em aberto"/)
  })

  it('⭐ linha sem categoria: sem alarme — o aviso só existe quando há consequência', () => {
    expect(consequenciaDeVincular(null, 'franciele').precisaAvisar).toBe(false)
  })
})

describe('⭐ as DUAS rotas consultam a MESMA régua', () => {
  const fonte = (arq: string) =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), arq), 'utf-8')

  it('⛔ a caixa publica o caso quando ele mora no card', () => {
    const r = fonte('app/api/conciliacao/caixa/route.ts')
    expect(r).toContain('dividirPorCasa(')
    expect(r, 'a linha voltaria a mostrar botão num par que o card também decide').toContain('casoNoCard')
  })

  it('⛔⛔ e o card ESCONDE o par 1↔1 que já mora na caixa', () => {
    const r = fonte('app/api/conciliacao/escolher-na-mao/route.ts')
    expect(r, 'o card voltou a repetir o par da caixa').toContain('dividirPorCasa(')
    expect(r).toMatch(/casas\.get\(c\.linha\.id\)\?\.casa !== 'CAIXA'/)
    // ⭐ quem veio PELA PORTA nunca é escondido — abrir e não ter nada atrás é porta pintada
    expect(r).toMatch(/c\.linha\.id === data\.abrir \|\| porConta\.includes\(c\.linha\.id\)/)
  })

  /**
   * ⚠️⚠️ **A 1ª VERSÃO DESTE TESTE NÃO MORDEU** (REGRA 11): ele procurava a string
   * `{l.palpite && !l.casoNoCard && (` no arquivo, e ela aparece em **DOIS** blocos (o
   * palpite e o *"OU ESCOLHA OUTRO CAMINHO"*) — tirar o gate de UM passava verde.
   * ⭐ O que morde é olhar **o bloco que desenha o BOTÃO**: é ele que não pode existir
   * quando o caso mora no card.
   */
  it('⭐ a tela aponta pro card em vez de decidir', () => {
    const t = fonte('components/conciliacao/caixa-de-entrada.tsx')
    const iBotao = t.indexOf('l.palpite.botao')
    expect(iBotao, 'o botão do palpite sumiu da tela').toBeGreaterThan(0)
    const abertura = t.lastIndexOf('{l.palpite', t.lastIndexOf('{l.palpite', iBotao) - 1) >= 0
      ? t.slice(t.lastIndexOf('{l.palpite &&', iBotao), iBotao)
      : ''
    expect(abertura, 'o botão do palpite voltou a existir num caso que mora no card')
      .toContain('!l.casoNoCard')
    expect(t).toMatch(/href=\{`#\$\{l\.casoNoCard\.ancora\}`\}/)
  })

  it('⛔ e a âncora do card é a MESMA função dos dois lados', () => {
    expect(fonte('components/conciliacao/escolher-na-mao-card.tsx'))
      .toContain('id={ancoraDoCard(card.linha.id)}')
  })
})
