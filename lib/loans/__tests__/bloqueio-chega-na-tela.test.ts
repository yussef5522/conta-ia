/**
 * ⛔⛔⛔ A RÉGUA DA RECUSA TEM UM DONO — E ELA TEM QUE CHEGAR NA TELA (19/10/2026)
 *
 * ⚠️⚠️ **ESTE GUARD NASCEU DE DOIS VERDES DE GRAÇA, medidos na REGRA 11 deste sprint.** Com
 * `bloqueioDoVinculo` extraída e consumida pela porta, repus dois defeitos e a suíte ficou
 * **VERDE em 1714 testes, com TS 0**:
 *
 *   1. a rota do preview deixando de passar `contratosCadastrados` pro `buildLinkGroup`;
 *   2. o modal deixando de desabilitar o Vincular pelo `bloqueio`.
 *
 * ⭐ **Os dois são a "porta sem maçaneta", a 11ª volta desta casa:** o motor está certo, os
 * testes do motor passam, e **nada chega até ele**. Sem o 1º, a exceção da conta garantida
 * fica **inalcançável em prod** — as duas linhas de 16/10 nunca entram no grupo e o dono vê
 * *"nenhum lançamento elegível"* numa tela cujo motor sabe a resposta. Sem o 2º, o botão
 * acende sobre uma recusa e o dono **clica pra levar um 422** — trabalho que dava pra poupar.
 *
 * ⛔ **E ele é de DOIS LADOS, de propósito:** um guard que só proibisse a forma antiga
 * aprovaria o dia em que a consulta sumisse de todo lugar. Ele exige que a peça EXISTA e que
 * alguém a CONSUMA.
 *
 * ⚠️ É **estrutural e assumido como tal** — o projeto roda em `environment: node`, sem jsdom,
 * então não há como clicar no botão num teste. O que ele trava é o que quebrou de fato.
 *
 * ⚠️ Lê o fonte **sem comentário** pelo detector único da casa (`_leitura-de-fonte.ts`): *o
 * arquivo que documenta o defeito não pode ser o que o absolve* — e este arquivo cita, por
 * escrito, as duas formas que ele proíbe.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe, blocoEntre, chamadasDe } from '../../../__tests__/regras-ui/_leitura-de-fonte'

const raiz = process.cwd()
const ler = (p: string) => semComentarios(readFileSync(join(raiz, p), 'utf8'))

const ROTA = 'app/api/empresas/[id]/emprestimos/[loanId]/vincular-parcela/preview/route.ts'
const MODAL = 'components/emprestimos/LinkPaymentModal.tsx'
const PORTA = 'lib/loans/vincular-pagamento.ts'

describe('a exceção da conta garantida é ALCANÇÁVEL pela tela', () => {
  it('a rota do preview BUSCA os contratos cadastrados da empresa', () => {
    const src = ler(ROTA)
    // ⚠️ A pergunta é pelo USO, nunca pela menção: `contratosCadastrados` aparece no
    // tipo de `buildLinkGroup`, e um guard que contasse ocorrências passaria com a
    // declaração intacta e a chamada vazia.
    expect(usosDe(src, 'contratosCadastrados')).toBeGreaterThanOrEqual(2)
    expect(src).toMatch(/prisma\.loan\.findMany/)
    expect(src).toMatch(/contractNumber:\s*true/)
  })

  it('e ENTREGA eles ao buildLinkGroup — sem isso o motor nunca é consultado', () => {
    // ⚠️ Estrutural: o que importa é o campo estar DENTRO da chamada, não por perto.
    // Janela de distância já produziu falso vermelho E falso verde nesta casa.
    const chamada = blocoEntre(ler(ROTA), 'buildLinkGroup(', ')')
    expect(chamada).toMatch(/contratosCadastrados/)
  })
})

describe('o bloqueio atravessa a rota e desarma o botão', () => {
  it('a rota CONSULTA a régua única e devolve o veredito no payload', () => {
    const src = ler(ROTA)
    expect(usosDe(src, 'bloqueioDoVinculo')).toBeGreaterThanOrEqual(1)
    // ⛔ o campo no payload é o que faz a tela poder recusar ANTES do clique
    expect(src).toMatch(/\n\s*bloqueio,/)
  })

  it('a rota confere a soma que vai ser GRAVADA, não só a do gesto', () => {
    // ⚠️ `buildLinkGroup` devolve o `paidTotal` só dos candidatos SELECIONADOS, e
    // `CANDIDATO_WHERE` exclui o que já está vinculado — então as mordidas anteriores
    // são invisíveis pra ele. Sem somar o já-vinculado, preview e porta avaliam números
    // diferentes: é a divergência preview↔confirm que custou o import de OFX inteiro.
    //
    // ⚠️⚠️ E a asserção precisou de DUAS voltas: contar `usosDe(…, 'paidTotalGravado') >= 2`
    // passou **VERDE** com o defeito reposto, porque sobram a declaração e o uso no split.
    // *Guard que conta ocorrência aprova o argumento trocado.* O que morde é exigir o
    // número CERTO **dentro de cada chamada** — estrutural, não contagem.
    const src = ler(ROTA)
    expect(src).toMatch(/loanInstallmentPayment\.findMany/)
    expect(usosDe(src, 'paidTotalGravado')).toBeGreaterThanOrEqual(2)

    for (const fn of ['bloqueioDoVinculo(', 'computeLinkSplit(']) {
      const args = blocoEntre(src, fn, '})')
      expect(args, `${fn} tem que receber a soma que vai ser GRAVADA`).toMatch(
        /paidTotal:\s*paidTotalGravado/,
      )
    }
  })

  it('o modal DESABILITA o Vincular pelo bloqueio — não só pinta o aviso', () => {
    const src = ler(MODAL)
    const disabled = /disabled=\{[^}]*\}/g
    const trava = [...src.matchAll(disabled)].map((m) => m[0]).find((s) => s.includes('bloqueio'))
    expect(trava, 'o botão Vincular tem que travar pelo bloqueio').toBeTruthy()
  })

  it('e DIZ o porquê — recusa muda manda o dono caçar o que não existe', () => {
    expect(ler(MODAL)).toMatch(/bloqueio\.mensagem/)
  })
})

describe('⭐⭐ a TERCEIRA BASE DO TETO chega nas DUAS pontas (04/11/2026)', () => {
  /**
   * ⛔⛔ **O defeito que este guard trava é o de sempre:** `tetoDoPagamento` passou a aceitar
   * `encargoRealRecente`, e o campo é **opcional** (contrato sem histórico se comporta como
   * antes). Opcional significa que *esquecer de passá-lo compila, passa no tsc e fica VERDE*
   * — e o Banrisul #60 seguiria recusado com o motor novo em prod, **inalcançável**. É a
   * "porta sem maçaneta" pela enésima vez, agora com o tipo ajudando a esconder.
   *
   * ⛔ E é de DOIS LADOS: se só a porta lesse o encargo, o painel apagaria o botão sobre um
   * vínculo que a gravação aceita — a divergência preview↔confirm ao contrário.
   */
  it('a porta E o preview passam `encargoRealRecente` DENTRO da chamada da régua', () => {
    for (const p of [ROTA, PORTA]) {
      const args = blocoEntre(ler(p), 'bloqueioDoVinculo(', '})')
      expect(args, `${p} não entrega o encargo real à régua — o teto velho continua valendo`)
        .toMatch(/encargoRealRecente:/)
    }
  })

  it('e os dois leem pela MESMA função — não por consulta copiada', () => {
    for (const p of [ROTA, PORTA]) {
      const src = ler(p)
      expect(usosDe(src, 'encargoRealRecente'), `${p} tem que chamar a porta única`).toBeGreaterThanOrEqual(2)
      /**
       * ⛔ uma 2ª consulta divergiria na janela (3 pagas) ou nos campos do encargo.
       *
       * ⛔⛔ **ESTE GUARD JÁ FOI POR JANELA DE DISTÂNCIA** (`/status:'PAID'[\s\S]{0,200}
       * paidCorrection/`) e isso é o anti-padrão que esta casa proíbe: a cópia que espaçasse
       * o `select` passaria VERDE, e um `where` inocente a 190 chars de um `paidCorrection`
       * alheio daria VERMELHO falso. Agora é ESTRUTURAL: extrai o bloco BALANCEADO de **cada**
       * chamada a `loanInstallment.find*` do arquivo e cobra que nenhuma delas leia os campos
       * do encargo. A distância deixou de importar.
       */
      for (const bloco of chamadasDe(src, /\.loanInstallment\.find\w*\s*\(/g)) {
        for (const campo of ['paidInterest', 'paidCorrection', 'paidPenalty'] as const) {
          expect(bloco, `${p} reimplementa a leitura das pagas (lê ${campo} direto do banco)`)
            .not.toContain(campo)
        }
      }
    }
  })

  /**
   * ⛔ REGRA 11 de mim mesmo: o guard acima só vale se ele AINDA acha chamada pra inspecionar.
   * Se amanhã alguém renomear `loanInstallment`, `chamadasDe` devolve `[]` e o `for` vazio
   * aprova tudo em silêncio — *o guard viraria enfeite*. Então a porta prova que há consulta.
   */
  it('o guard anterior não está vazio: a porta REALMENTE consulta loanInstallment', () => {
    expect(chamadasDe(ler(PORTA), /\.loanInstallment\.find\w*\s*\(/g).length).toBeGreaterThan(0)
  })
})

describe('a régua da recusa tem UM dono', () => {
  it('a porta de gravação consulta a MESMA função que o preview', () => {
    expect(usosDe(ler(PORTA), 'bloqueioDoVinculo')).toBeGreaterThanOrEqual(1)
  })

  it('e nenhum dos dois reescreve a régua na mão', () => {
    // ⛔ Uma 2ª implementação divergiria no 1º caso de borda, e o dono veria o botão
    // aceso sobre uma gravação que o servidor recusa (ou o contrário).
    for (const p of [ROTA, PORTA]) {
      const src = ler(p)
      expect(src, `${p} não pode decidir JA_QUITADA por conta própria`).not.toMatch(
        /code:\s*'JA_QUITADA'/,
      )
      expect(src, `${p} não pode decidir SOMA_ESTOUROU por conta própria`).not.toMatch(
        /code:\s*'SOMA_ESTOUROU'/,
      )
    }
  })
})
