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
function paginaMontada(entrada: {
  sugestoesPorConta: SugestaoDaConta[]
  palpites: PalpiteDaLinha[]
  /**
   * ⭐⭐ AS LINHAS QUE SÓ EXISTEM NO CARD (o CASPER) — elas **não estão na caixa**, então
   * não têm palpite. ⛔ A 1ª versão deste guard derivava o card dos PALPITES e por isso
   * **o CASPER nunca entrou no cenário**: o "some dos dois" passou despercebido justamente
   * na linha que sumiu. *Guard que só imagina o caminho conhecido não cobre o que some.*
   */
  linhasSoNoCard?: string[]
}) {
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
    botaoNoCard: [...entrada.palpites.map((p) => p.linhaId), ...(entrada.linhasSoNoCard ?? [])]
      .filter((id) => oCardDesenhaBotao(d.linhas.get(id), false)),
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
    // ⭐ o palpite não desenha botão: quem decide é o PAINEL DO CASO, no mesmo cartão
    expect(pg.botaoNaCaixa, 'a linha voltou a ter botão de palpite num caso ambíguo').toEqual([])
    // ⭐⭐ e a FILA soltou o caso — ele mora dentro do cartão ≍ agora
    expect(pg.botaoNaFila, 'a mesma decisão voltou a aparecer na seção de baixo').toEqual([])
    expect(pg.divisao.linhas.get('l_franciele')).toMatchObject({
      casa: 'FILA', motivo: 'AMBIGUO', nomeDoCaso: 'franciele', hospeda: true,
    })
    expect(pg.divisao.casos.get(CONTA_FRANCIELE)!.linhaIds).toEqual(['l_franciele', 'l_tiele'])
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
    expect(pg.botaoNaFila, 'o ambíguo hospedado não pode voltar pra seção de baixo').toEqual([])
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
    /**
     * ⚠️ REAPONTADO em 20/09, não afrouxado: a `/caixa` deixou de perguntar *"quem desenha
     * botão?"* porque o caso agora **mora dentro do cartão** — ela monta o PAINEL. A régua
     * que continua valendo (e é a que pegou o bug da 3ª casa) é *nenhuma rota compara a
     * casa na mão*.
     */
    expect(fonte('app/api/conciliacao/caixa/route.ts'), 'a caixa parou de montar o painel do caso')
      .toContain('function montarCaso(')
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
      'o palpite voltou a desenhar botão num caso — dois botões pra mesma decisão').toContain('!l.caso')
    // ⭐ e o painel do caso renderiza DENTRO do cartão, no lugar do palpite
    expect(t, 'o caso voltou a ser seção separada').toContain('<PainelDoCaso')
    expect(fonte('components/conciliacao/escolher-na-mao-card.tsx')).toContain('id={ancoraDoCard(card.linha.id)}')
    // ⛔ e o par da FILA também é alcançável — "resolver lá" sem o "lá" é ordem, não caminho
    expect(fonte('components/conciliacao/par-sugerido.tsx'), 'o ponteiro do ambíguo apontaria pro nada')
      .toContain('id={ancoraDoPar(item.conta.id)}')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ⛔⛔⛔ NENHUM CASO INVISÍVEL — o CASPER que sumiu (20/09, achado pelo dono)
//
// **Ele:** *"o CASPER (N:M → CARD) SUMIU da página: cadê o card dele? Se foi pro «esconde»,
// é o some-dos-dois que tua régua proíbe."*
//
// **Medido:** as duas linhas do CASPER são de **04/09 e já categorizadas** — elas **não
// estão na caixa**, então `divisaoDaTela` **não as conhece**. O predicado fazia
// `c?.casa ?? 'CAIXA'` e tratava desconhecida como *"a caixa é dona"* → escondeu.
// ***O default da régua cometeu o erro que a régua proíbe.***
describe('⛔⛔⛔ linha que a divisão NÃO conhece continua visível', () => {
  it('⭐ o caso do CASPER: sem palpite, sem sugestão — o card DESENHA', () => {
    const pg = paginaMontada({ sugestoesPorConta: [], palpites: [], linhasSoNoCard: ['l_casper1', 'l_casper2'] })
    expect(pg.botaoNoCard, 'o caso ficou invisível na página inteira').toEqual(['l_casper1', 'l_casper2'])
    expect(linhasComBotaoEmDuas(pg)).toEqual([])
  })

  it('⛔ e o default é APARECER — duplicar é feio, sumir é perder trabalho', () => {
    expect(oCardDesenhaBotao(undefined, false), 'desconhecida voltou a ser tratada como "da caixa"').toBe(true)
  })

  it('⭐ o que a caixa OU a fila reivindicou continua escondido do card', () => {
    expect(oCardDesenhaBotao({ casa: 'CAIXA' }, false)).toBe(false)
    expect(oCardDesenhaBotao({ casa: 'FILA' }, false)).toBe(false)
    expect(oCardDesenhaBotao({ casa: 'CARD' }, false)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ⛔⛔⛔ AS DUAS AFIRMAÇÕES QUE O DONO EXIGIU DO GUARD DE PÁGINA (20/09)
//
//   1. *"nenhuma decisão renderizada 2× na página"*
//   2. *"nenhum caso invisível — toda linha da caixa ou resolve ou aponta pra algo VISÍVEL
//      na mesma página"*
//
// ⚠️ A segunda é a que faltava: o CASPER sumiu porque **ninguém perguntava se o caso ainda
// tinha onde aparecer**. *O guard que só procura duplicata nunca acha o que some.*
describe('⛔⛔⛔ nenhuma decisão 2× · nenhum caso invisível', () => {
  /** o que a página inteira renderiza, por decisão (conta) */
  function aparicoesPorConta(e: Parameters<typeof paginaMontada>[0]) {
    const d = dividir(e)
    const mapa = new Map<string, string[]>()
    const add = (conta: string, onde: string) => mapa.set(conta, [...(mapa.get(conta) ?? []), onde])
    // ⭐ o painel do caso aparece UMA vez: no cartão da linha ANFITRIÃ
    for (const [conta, anfitria] of d.anfitriaDoCaso) add(conta, `cartao:${anfitria}`)
    // ⭐ a fila desenha o que ninguém reivindicou
    for (const s of e.sugestoesPorConta) if (aFilaDesenhaBotao(s.contaId, d)) add(s.contaId, 'fila')
    return mapa
  }

  it('⛔ o caso ambíguo aparece UMA vez — no cartão, nunca também na fila', () => {
    const ap = aparicoesPorConta({ sugestoesPorConta: [SUG_AMBIGUA], palpites: [P_FRANCIELE] })
    expect(ap.get(CONTA_FRANCIELE), 'a mesma decisão em dois modelos visuais — é o print do dono')
      .toEqual(['cartao:l_franciele'])
  })

  it('⛔⛔ duas linhas do MESMO caso na caixa → só UMA hospeda o painel', () => {
    const d = dividir({
      sugestoesPorConta: [SUG_AMBIGUA],
      palpites: [P_FRANCIELE, { linhaId: 'l_tiele', contaIds: [CONTA_FRANCIELE], nomeDoCaso: 'franciele' }],
    })
    expect(d.linhas.get('l_franciele')!.hospeda, 'a 1ª linha do caso hospeda').toBe(true)
    expect(d.linhas.get('l_tiele')!.hospeda, 'a 2ª redesenharia o painel — duplicação no modelo certo').toBe(false)
    expect([...d.anfitriaDoCaso.values()]).toEqual(['l_franciele'])
  })

  it('⭐⭐ NENHUM CASO INVISÍVEL: sem linha na caixa, a fila é a casa dele', () => {
    // é a situação do CASPER: a linha não está na caixa, então não há cartão pra hospedar
    const ap = aparicoesPorConta({
      sugestoesPorConta: [{ contaId: 'c_orfa', nomeDaConta: 'CASPER', linhaIds: ['l_fora1', 'l_fora2'] }],
      palpites: [],
    })
    expect(ap.get('c_orfa'), 'o caso ficou sem casa — invisível na página inteira').toEqual(['fila'])
  })

  it('⛔ e toda linha da caixa ou RESOLVE ou APONTA pra algo que existe', () => {
    const d = dividir({
      sugestoesPorConta: [SUG_AMBIGUA],
      palpites: [P_FRANCIELE, { linhaId: 'l_tiele', contaIds: [CONTA_FRANCIELE], nomeDoCaso: 'franciele' }],
    })
    for (const [id, c] of d.linhas) {
      if (c.casa === 'CAIXA') continue                       // resolve nela mesma
      if (c.hospeda) { expect(d.casos.has(c.contaDoCaso!)).toBe(true); continue }  // hospeda o painel
      // aponta — e o alvo TEM que estar na página
      expect(d.anfitriaDoCaso.get(c.contaDoCaso!), `${id} aponta pro nada`).toBeTruthy()
    }
  })
})
