/**
 * ⭐⭐⭐ NO CAMINHO CORTESIA É PROIBIDO NASCER PAYABLE — GUARD ESTRUTURAL (04/11/2026)
 *
 * ⚠️ **Por que estrutural, tendo o teste de fluxo:** `nota-de-cortesia.integration.test.ts`
 * prova que **os três caminhos de hoje** não geram cobrança. Ele fica verde no dia em que
 * alguém adicionar um QUARTO `stockPayableSuggestion.create` sem lembrar da cortesia — e aí
 * a nota de brinde volta a criar dívida, com a suíte toda verde. Este arquivo é o canário
 * dessa classe: *o teste de fluxo cobre os caminhos que existem; o estrutural cobre o
 * próximo.*
 *
 * ⛔ A régua é ESTRUTURAL e nunca por proximidade: ele conta as portas de criação e lê a
 * CONDIÇÃO de cada uma — `[\s\S]{0,N}` já deu falso verde E falso vermelho nesta casa.
 *
 * ⚠️ Lê o fonte pelo detector ÚNICO da casa, sem comentário: *o arquivo que documenta o
 * defeito não pode ser o que o absolve* — e o `confirmar-conferencia.ts` explica por escrito
 * exatamente o que este guard proíbe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe, chamadasDe, elementosJsx } from '../../../__tests__/regras-ui/_leitura-de-fonte'

const PORTA = 'lib/stock/confirmar-conferencia.ts'
const src = semComentarios(readFileSync(join(process.cwd(), PORTA), 'utf8'))

/**
 * As portas de criação de sugestão que existem hoje, MEDIDAS: o laço das duplicatas, o laço
 * do boleto de papel e o fallback "A DEFINIR".
 * ⛔ Se este número mudar, **pare e pense na cortesia** antes de atualizar a constante.
 */
const PORTAS_DE_SUGESTAO = 3

describe('cortesia não pode gerar conta a pagar', () => {
  it('⛔ o nº de portas que criam StockPayableSuggestion é o conhecido — canário de porta nova', () => {
    const portas = chamadasDe(src, /stockPayableSuggestion\.create\s*\(/g)
    expect(portas.length,
      'nasceu uma porta nova de sugestão: ela TEM que respeitar `input.cortesia` (ver o header deste arquivo)')
      .toBe(PORTAS_DE_SUGESTAO)
  })

  /**
   * ⛔⛔ O laço das duplicatas: ele itera sobre uma lista que a cortesia ZERA. Guardar com
   * `if` em volta funcionaria igual, mas neutralizar a lista é mais difícil de desfazer sem
   * ver — e é o que está no código.
   */
  it('⛔ o laço das duplicatas itera uma lista VAZIA quando é cortesia', () => {
    expect(src).toContain('for (const d of input.cortesia ? [] : dups)')
  })

  /** ⛔ o fallback (nota sem duplicata) é o caminho pelo qual a nota de brinde passava */
  it('⛔ o fallback "A DEFINIR"/boleto de papel está fechado pra cortesia', () => {
    expect(src).toContain('if (!dups.length && !input.cortesia)')
  })

  it('⭐ e a marca da cortesia é gravada na MESMA transação do estoque', () => {
    const [bloco] = chamadasDe(src, /tx\.stockNfeCortesia\.create\s*\(/g)
    expect(bloco, 'a marca tem que nascer com `tx`, não com `prisma` — ou ela sobrevive a um rollback')
      .toBeTruthy()
    expect(bloco!).toContain('marcadaPorId: userId')
  })

  /**
   * ⛔ A trava do XML: nota COM duplicata não vira cortesia. Estrutural porque o teste de
   * fluxo prova o caso de hoje e este prova que a CONDIÇÃO continua sendo as duas coisas.
   */
  it('⛔ a recusa de "cortesia com duplicata no XML" existe no servidor', () => {
    expect(src).toContain('if (input.cortesia && temDup > 0)')
  })

  /** ⭐ a trava velha ganhou a terceira resposta, sem perder as duas antigas */
  it('⭐ a porta das 21 notas segue fechada: as 3 respostas estão na MESMA condição', () => {
    const [cond] = chamadasDe(src, /if \(temDup === 0 &&/g)
    expect(cond).toBeTruthy()
    for (const resposta of ['!input.cortesia', '!input.pagamento?.parcelas?.length', '!input.pagamento?.semDataDefinirDepois']) {
      expect(cond!, `a condição perdeu a resposta ${resposta}`).toContain(resposta)
    }
  })

  it('a fiação existe: `cortesia` é USADA, não só declarada', () => {
    expect(usosDe(src, 'cortesia')).toBeGreaterThanOrEqual(5)
  })

  /**
   * ⭐⭐ REGRA 14 — OS IRMÃOS HERDAM DE GRAÇA, e isso é estrutural.
   *
   * O recebimento parte as linhas em `paraEstoque` / `paraEquipamento` (`destino-da-linha.ts`).
   * ⛔ Se o corte da cortesia tivesse sido feito DENTRO de um desses ramos, a nota de brinde
   * de um equipamento voltaria a gerar cobrança — a doença "N caminhos, 1 esquecido". O corte
   * mora no bloco do financeiro, que é comum aos dois: então nenhuma das duas condições de
   * cortesia menciona destino/equipamento.
   */
  it('⛔ o corte da cortesia NÃO discrimina destino — equipamento e estoque herdam igual', () => {
    const condicoes = [
      'for (const d of input.cortesia ? [] : dups)',
      'if (!dups.length && !input.cortesia)',
      'if (input.cortesia && temDup > 0)',
    ]
    for (const c of condicoes) {
      for (const palavra of ['paraEquipamento', 'paraEstoque', 'EQUIPAMENTO', 'destino']) {
        expect(c, `a condição "${c}" virou específica de destino (${palavra})`).not.toContain(palavra)
      }
    }
  })
})

/**
 * ⭐⭐⭐ A FIAÇÃO DO DEDO DO DONO ATÉ O MOTOR (04/11/2026)
 *
 * ⛔⛔ **ESTE BLOCO NASCEU DE UM FURO MEDIDO NA REGRA 11.** Apaguei
 * `cortesia: parsed.data.cortesia` da rota HTTP e **os 15 testes ficaram VERDES** — porque
 * todos chamam `confirmarConferencia` DIRETO. O motor estava certo, o guard estrutural
 * estava verde, e a opção **não chegaria** da tela: a nota de brinde voltaria a travar com a
 * suíte toda verde. *Porta sem maçaneta*, agora com o Zod no lugar do botão.
 *
 * ⚠️ Estrutural e por BLOCO (`chamadasDe` devolve a chamada balanceada), nunca por distância.
 */
describe('a opção chega da tela até o motor', () => {
  const ROTA = 'app/api/empresas/[id]/estoque/recebimentos/[nfeId]/confirmar/route.ts'
  const VIEW = 'components/estoque/conferencia-view.tsx'
  const rota = semComentarios(readFileSync(join(process.cwd(), ROTA), 'utf8'))
  const view = semComentarios(readFileSync(join(process.cwd(), VIEW), 'utf8'))

  it('⛔ o Zod da rota ACEITA cortesia (sem isso o campo morre no parse)', () => {
    expect(rota).toMatch(/cortesia:\s*z\.boolean\(\)/)
    expect(rota).toMatch(/cortesiaMotivo:\s*z\.string\(\)/)
  })

  it('⛔ e a rota REPASSA os dois DENTRO da chamada de confirmarConferencia', () => {
    const [chamada] = chamadasDe(rota, /confirmarConferencia\s*\(/g)
    expect(chamada, 'não achei a chamada do motor na rota').toBeTruthy()
    expect(chamada!, 'o Zod aceita e a rota engole: o campo não chega ao motor')
      .toContain('cortesia: parsed.data.cortesia')
    expect(chamada!).toContain('cortesiaMotivo: parsed.data.cortesiaMotivo')
  })

  it('⛔ a tela ENVIA cortesia no corpo do POST', () => {
    expect(usosDe(view, 'cortesia'), 'declarada e nunca enviada é o defeito').toBeGreaterThanOrEqual(4)
    expect(view).toContain('...(cortesia ? { cortesia: true } : {})')
  })

  it('⛔ e o botão de confirmar passa a aceitar a cortesia como resposta', () => {
    const [bloco] = chamadasDe(view, /const pagamentoRespondido = useMemo\s*\(/g)
    expect(bloco, 'não achei o useMemo do pagamentoRespondido').toBeTruthy()
    expect(bloco!, 'sem isto o dono marca cortesia e o botão fica cinza')
      .toContain('if (cortesia) return true')
  })

  /**
   * ⛔⛔⛔ ESTE TESTE LÊ O CRU, E O MOTIVO É UM FURO MEDIDO NO DETECTOR DA CASA.
   *
   * `semComentarios` engole **27.816 dos 81.765 chars (34%)** desta tela, num bloco único de
   * **16.069 chars** — e o checkbox da cortesia cai dentro dele. A causa: o atributo
   * `accept` do upload de foto, cujo valor termina em **barra-asterisco**: essa sequência
   * dentro da string abre um "comentário de bloco" que corre até o próximo fecha-comentário,
   * lá embaixo.
   *
   * ⚠️ E a prova mais barata de que a classe morde: a 1ª versão DESTE comentário escrevia o
   * valor literal e **quebrou o próprio arquivo de teste** — o fecha-comentário apareceu no
   * meio da frase. O defeito que documento é o defeito que me pegou. ***Todo guard que lê esta tela pelo
   * detector está cego em um terço dela*** — é a mesma classe da cicatriz de 08/10, por outra
   * porta. Anotado como micro-bloco; consertar a porta única de leitura de fonte mexe com
   * dezenas de guards e não cabe neste sprint.
   *
   * ⭐ Ler o cru sozinho reabriria o "comentário que absolve", então a asserção é
   * ESTRUTURAL: `elementosJsx` extrai os `<input>` de verdade, e comentário não é elemento.
   */
  it('⭐ o checkbox existe como <input> de verdade (imune ao furo do detector)', () => {
    const inputs = elementosJsx(readFileSync(join(process.cwd(), VIEW), 'utf8'), 'input')
    const caixa = inputs.find((el) => el.includes('data-testid="conferencia-cortesia"'))
    expect(caixa, 'não achei o <input> da cortesia na tela').toBeTruthy()
    expect(caixa!).toContain('type="checkbox"')
    expect(caixa!, 'o checkbox tem que estar ligado ao estado').toContain('setCortesia(e.target.checked)')
    expect(caixa!).toContain('checked={cortesia}')
  })

  /** ⭐ o selo de CFOP é SUGESTÃO: ele pinta, e não marca a caixa */
  it('⛔ o CFOP sugere e NÃO decide: nada marca cortesia a partir dele', () => {
    const [selo] = chamadasDe(view, /const cfopDeBonificacao = useMemo\s*\(/g)
    expect(selo).toBeTruthy()
    expect(selo!, 'o CFOP não pode chamar setCortesia — heurística não decide em silêncio')
      .not.toContain('setCortesia')
  })
})
