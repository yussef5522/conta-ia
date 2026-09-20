// ⛔⛔⛔ O MESMO PAR COM BOTÃO EM DUAS SUPERFÍCIES (20/09/2026)
//
// **O dono, com o print na mão, DEPOIS da minha 1ª entrega:** *"a linha FRANCIELE está na
// caixa COM palpite e botão E o card dela está no PRA TUA MÃO com [Vincular] nas duas linhas
// + o aviso de ambiguidade. Tua entrega mediu «pares com botão nas duas: NENHUM» — a minha
// tela mostra o oposto."*
//
// ⛔⛔⛔ **ELE ESTAVA CERTO E A MINHA PROVA ESTAVA ERRADA — eu medi a superfície errada.**
// A página faz **QUATRO** chamadas (`/caixa`, `/fila`, `/escolher-na-mao`, `/corte`); quem
// desenha o `[Vincular]` do *"pra tua mão"* é a **`/fila`**, e eu tinha ligado a régua em
// `/caixa` + `/escolher-na-mao`. ***Guard que roda contra as rotas separadas aprova o que o
// dono não vê*** — por isso este arquivo monta **o que a PÁGINA recebe** e pergunta a ela.
//
// ⛔⛔ **E HAVIA DUAS DEFINIÇÕES DE CASO** (ele apontou antes de mim, e a medição confirmou):
// a fila conta candidatas **incluindo categorizadas** (07/09) → franciele = **2** → caso;
// a minha régua contava linhas **na caixa** → franciele = **1** → 1↔1. Cada lado se achou
// dono. A definição que fica é a **da fila**, por decisão dele: *"se a Tiele-categorizada
// mantém o caso vivo, então o caso EXISTE e a linha da caixa vira PONTEIRO"*.

import { describe, it, expect } from 'vitest'
import {
  dividir, fraseDoCasoNoCard, ancoraDoCard, ancoraDoPar, consequenciaDeVincular,
  aCaixaDesenhaBotao, aFilaDesenhaBotao, oCardDesenhaBotao,
  type SugestaoDaConta, type PalpiteDaLinha,
} from '@/lib/conciliacao/uma-casa-por-caso'

/** ⭐ o caso REAL, com os números medidos em prod */
const CONTA_FRANCIELE = 'c_franciele'
const SUG_AMBIGUA: SugestaoDaConta = {
  contaId: CONTA_FRANCIELE, nomeDaConta: 'franciele',
  // a de 15/09 (score 95) e a Tiele de 08/09 já categorizada (score 55)
  linhaIds: ['l_franciele', 'l_tiele'],
}
const SUG_SIMPLES: SugestaoDaConta = { contaId: 'c_doceoli', nomeDaConta: 'DOCEOLI', linhaIds: ['l_doceoli'] }
const P_FRANCIELE: PalpiteDaLinha = { linhaId: 'l_franciele', contaIds: [CONTA_FRANCIELE], nomeDoCaso: 'franciele' }
const P_DOCEOLI: PalpiteDaLinha = { linhaId: 'l_doceoli', contaIds: ['c_doceoli'], nomeDoCaso: 'DOCEOLI' }
const P_LOTE: PalpiteDaLinha = { linhaId: 'l_casper', contaIds: ['c1', 'c2'], nomeDoCaso: 'CASPER' }

// ═══════════════════════════════════════════════════════════════════════════════
// ⭐⭐⭐ O GUARD QUE MONTA A PÁGINA — as três superfícies, como o dono vê
// ═══════════════════════════════════════════════════════════════════════════════

/** o que cada superfície desenharia, dada a divisão */
function paginaMontada(entrada: { sugestoesPorConta: SugestaoDaConta[]; palpites: PalpiteDaLinha[] }) {
  const d = dividir(entrada)
  return {
    /** ⭐ a CAIXA só põe botão onde ela é a dona */
    botaoNaCaixa: entrada.palpites
      .filter((p) => aCaixaDesenhaBotao(d.linhas.get(p.linhaId), p.contaIds.length > 0))
      .map((p) => p.linhaId),
    /** ⭐ a FILA (o "pra tua mão") esconde o que a caixa reivindicou */
    botaoNaFila: entrada.sugestoesPorConta
      .filter((s) => aFilaDesenhaBotao(s.contaId, d))
      .flatMap((s) => s.linhaIds),
    /** ⭐ o CARD do escolher-na-mão só desenha o que a caixa E a fila NÃO resolvem */
    botaoNoCard: entrada.palpites
      .filter((p) => oCardDesenhaBotao(d.linhas.get(p.linhaId), false))
      .map((p) => p.linhaId),
    divisao: d,
  }
}

/** ⛔ a pergunta que o dono faz olhando a tela: alguma linha tem botão em DUAS superfícies? */
function linhasComBotaoEmDuas(pg: ReturnType<typeof paginaMontada>): string[] {
  const conta = new Map<string, number>()
  for (const s of [pg.botaoNaCaixa, pg.botaoNaFila, pg.botaoNoCard])
    for (const id of new Set(s)) conta.set(id, (conta.get(id) ?? 0) + 1)
  return [...conta.entries()].filter(([, n]) => n > 1).map(([id]) => id)
}

describe('⛔⛔⛔ a PÁGINA MONTADA nunca tem o mesmo par com botão em duas superfícies', () => {
  it('⛔⛔ O CASO DO PRINT: franciele ambíguo — caixa aponta, fila decide', () => {
    const pg = paginaMontada({ sugestoesPorConta: [SUG_AMBIGUA], palpites: [P_FRANCIELE] })
    expect(linhasComBotaoEmDuas(pg), 'é exatamente o que o dono vê na tela dele').toEqual([])
    expect(pg.botaoNaCaixa, 'a linha voltou a ter botão num caso que a fila decide').toEqual([])
    expect(pg.botaoNaFila).toContain('l_franciele')
    expect(pg.divisao.linhas.get('l_franciele')).toMatchObject({ casa: 'FILA', motivo: 'AMBIGUO', nomeDoCaso: 'franciele' })
  })

  it('⭐ 1↔1: a caixa é a dona e a FILA esconde — a outra metade do defeito', () => {
    const pg = paginaMontada({ sugestoesPorConta: [SUG_SIMPLES], palpites: [P_DOCEOLI] })
    expect(linhasComBotaoEmDuas(pg)).toEqual([])
    expect(pg.botaoNaCaixa).toEqual(['l_doceoli'])
    expect(pg.botaoNaFila, 'a fila continuou oferecendo o par que a caixa já resolve').toEqual([])
  })

  it('⭐ os dois casos na MESMA tela — um de cada lado, nenhum nos dois', () => {
    const pg = paginaMontada({
      sugestoesPorConta: [SUG_AMBIGUA, SUG_SIMPLES],
      palpites: [P_FRANCIELE, P_DOCEOLI, P_LOTE],
    })
    expect(linhasComBotaoEmDuas(pg)).toEqual([])
    expect(pg.botaoNaCaixa).toEqual(['l_doceoli'])
    expect(pg.botaoNaFila).toEqual(['l_franciele', 'l_tiele'])
    expect(pg.botaoNoCard, 'o ambíguo voltou a ter card — a fila já o desenha').toEqual(['l_casper'])
  })

  it('⭐ N:M (lote) é decisão do card, nunca da caixa', () => {
    const pg = paginaMontada({ sugestoesPorConta: [], palpites: [P_LOTE] })
    expect(pg.divisao.linhas.get('l_casper')).toMatchObject({ casa: 'CARD', motivo: 'N_PARA_M' })
    expect(pg.botaoNaCaixa).toEqual([])
  })

  /**
   * ⛔⛔ **SOME DOS DOIS É PIOR QUE APARECER NOS DOIS.** A caixa só reivindica a conta
   * quando a fila oferece **aquela mesma linha**. Se a sugestão apontasse outra, esconder
   * faria o par sumir das duas superfícies — e trabalho que some é trabalho perdido.
   */
  it('⛔ a caixa NÃO reivindica conta cuja única sugestão é OUTRA linha', () => {
    const pg = paginaMontada({
      sugestoesPorConta: [{ contaId: 'c_x', nomeDaConta: 'x', linhaIds: ['l_outra'] }],
      palpites: [{ linhaId: 'l_essa', contaIds: ['c_x'], nomeDoCaso: 'x' }],
    })
    expect(pg.botaoNaFila, 'o par sumiu das duas telas').toContain('l_outra')
  })

  it('⛔ linha sem palpite não é reivindicada por ninguém', () => {
    const pg = paginaMontada({ sugestoesPorConta: [], palpites: [{ linhaId: 'l_nada', contaIds: [], nomeDoCaso: 'x' }] })
    expect(pg.divisao.linhas.get('l_nada')!.casa).toBe('CAIXA')
    expect(pg.botaoNaCaixa).toEqual([])   // sem alvo, o que ela mostra são os chips
  })
})

describe('⭐ o ponteiro DIZ o caso, o porquê e o caminho', () => {
  it('⭐ nome + âncora + motivo — "resolver lá" sem o "lá" seria ordem, não caminho', () => {
    const c = dividir({ sugestoesPorConta: [SUG_AMBIGUA], palpites: [P_FRANCIELE] }).linhas.get('l_franciele')!
    expect(c.ancora, 'o ambíguo é ancorado pela CONTA — é ela que reúne as N linhas').toBe(ancoraDoPar(CONTA_FRANCIELE))
    expect(fraseDoCasoNoCard(c)).toMatch(/faz parte do caso «franciele»[\s\S]*mais de uma linha[\s\S]*Resolver lá/)
  })

  it('⭐ e o lote diz o motivo DELE', () => {
    const c = dividir({ sugestoesPorConta: [], palpites: [P_LOTE] }).linhas.get('l_casper')!
    expect(fraseDoCasoNoCard(c)).toMatch(/cobre mais de uma nota/)
  })
})

describe('⭐⭐ a candidata JÁ CATEGORIZADA mantém o caso vivo — e tem a consequência escrita', () => {
  /**
   * ⭐ Foi a Tiele (categorizada como Salários) que deixou o caso ambíguo. Ela **continua**
   * sendo oferecida — a régua de 07/09, *"ter categoria não quita conta nenhuma"* —, e é
   * justamente isso que tira o botão da caixa.
   */
  it('⛔ tirar a categorizada da lista faria o caso virar 1↔1 (e o botão voltar)', () => {
    const semTiele = dividir({
      sugestoesPorConta: [{ ...SUG_AMBIGUA, linhaIds: ['l_franciele'] }],
      palpites: [P_FRANCIELE],
    })
    expect(semTiele.linhas.get('l_franciele')!.casa, 'é o contraste que prova de onde vem o caso').toBe('CAIXA')
  })

  it('⭐ o aviso é obrigatório na candidata com categoria', () => {
    const c = consequenciaDeVincular('Salários', 'franciele')
    expect(c.precisaAvisar).toBe(true)
    expect(c.texto).toContain('já categorizada como Salários')
  })

  /**
   * ⚠️⚠️ **A CONSEQUÊNCIA É A MEDIDA, NÃO A SUPOSTA.** O dono escreveu *"vincular aqui
   * DESFAZ aquilo"*; medido no código, **a categoria NÃO é desfeita** — o backfill é
   * cooperativo. O que muda é a conta sair do "em aberto".
   */
  it('⛔ o texto não promete desfazer a categoria', () => {
    const c = consequenciaDeVincular('Salários', 'franciele')
    expect(c.texto).not.toMatch(/desfaz|desfazer/i)
    expect(c.texto).toContain('a categoria dela fica')
  })

  it('⭐ sem categoria, sem alarme', () => {
    expect(consequenciaDeVincular(null, 'franciele').precisaAvisar).toBe(false)
  })
})

describe('⭐ as TRÊS superfícies passam pela MESMA porta', () => {
  const fonte = (arq: string) =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), arq), 'utf-8')

  /**
   * ⛔⛔ O GUARD QUE FALTAVA: a 1ª versão cobriu duas rotas e deixou a `/fila` decidindo
   * sozinha — e foi exatamente ela que o dono viu com botão.
   */
  it('⛔ /caixa, /fila e /escolher-na-mao chamam divisaoDaTela', () => {
    for (const r of [
      'app/api/conciliacao/caixa/route.ts',
      'app/api/conciliacao/fila/route.ts',
      'app/api/conciliacao/escolher-na-mao/route.ts',
    ]) {
      expect(fonte(r), `${r} voltou a decidir sozinha — é assim que as réguas divergem`)
        .toContain('divisaoDaTela(')
    }
  })

  /**
   * ⛔⛔⛔ **E CADA ROTA TEM QUE USAR O PREDICADO, NÃO REIMPLEMENTAR.** A prova em prod
   * pegou a `/caixa` testando `casa === 'CARD'` depois que o ambíguo passou a morar em
   * `FILA` — o `casoNoCard` vinha `null` e **o botão voltava na tela do dono**.
   * ***Guard que exercita a lib aprova a rota que a ignora.***
   */
  it('⛔⛔ as rotas CHAMAM os predicados — nenhuma compara a casa na mão', () => {
    expect(fonte('app/api/conciliacao/caixa/route.ts'), 'a caixa voltou a decidir por comparação própria')
      .toContain('aCaixaDesenhaBotao(')
    expect(fonte('app/api/conciliacao/escolher-na-mao/route.ts')).toContain('oCardDesenhaBotao(')
    for (const r of ['app/api/conciliacao/caixa/route.ts', 'app/api/conciliacao/escolher-na-mao/route.ts'])
      expect(fonte(r), `${r} compara a casa na mão — é assim que a 3ª casa passa despercebida`)
        .not.toMatch(/\.casa === '(CARD|FILA|CAIXA)'/)
  })

  it('⛔ a fila ESCONDE a conta que a caixa reivindicou', () => {
    expect(fonte('lib/conciliacao/fila-de-conciliacao.ts'))
      .toMatch(/!contasQueMoramNaCaixa\.has\(c\.conta\.id\)/)
    // ⚠️ e a dupla contagem NUNCA é escondida — ela é anomalia, não espera
    expect(fonte('lib/conciliacao/fila-de-conciliacao.ts'))
      .toMatch(/c\.situacao === 'DUPLA_CONTAGEM'/)
  })

  it('⛔ e a porta única lê as DUAS fontes — senão ela decide com meia verdade', () => {
    const d = fonte('lib/conciliacao/divisao-da-tela.ts')
    expect(d, 'perdeu a fonte dos [Vincular]').toContain('contasEsperandoPagamento(')
    expect(d, 'perdeu a fonte dos palpites').toContain('palpitesDaCaixa(')
  })

  it('⭐ a tela aponta em vez de decidir, e o card carrega a âncora', () => {
    const t = fonte('components/conciliacao/caixa-de-entrada.tsx')
    const iBotao = t.indexOf('l.palpite.botao')
    expect(t.slice(t.lastIndexOf('{l.palpite &&', iBotao), iBotao),
      'o botão do palpite voltou a existir num caso que mora no card').toContain('!l.casoNoCard')
    expect(fonte('components/conciliacao/escolher-na-mao-card.tsx')).toContain('id={ancoraDoCard(card.linha.id)}')
    // ⛔ e o par da FILA também é alcançável — "resolver lá" sem o "lá" é ordem, não caminho
    expect(fonte('components/conciliacao/par-sugerido.tsx'), 'o ponteiro do ambíguo apontaria pro nada')
      .toContain('id={ancoraDoPar(item.conta.id)}')
  })
})
