/**
 * ⛔⛔⛔ A COMPETÊNCIA VIAJA NO GESTO — o guard do defeito de 20/10/2026.
 *
 * **O defeito, numa linha:** o banner azul da prévia do import casava o pagamento mandando só
 * `{ txId }`. Como ele casa *"sem esperar o confirm"*, a fatura do mês **ainda não existe**, o
 * servidor caía no fallback silencioso e o pagamento de R$ 12.696,23 foi pra **2026-09**.
 *
 * ⚠️⚠️ **E ele escapou de tudo o que já existia:** o motor estava certo (o resolvedor acha a
 * competência quando ela existe), os testes do motor passavam, e **a TELA não mandava o
 * campo** — a 12ª volta de *"guard que testa a lib aprova a tela que a ignora"* (as cicatrizes
 * de 14/09 e 16/09).
 *
 * ⭐ Por isso este guard é **de DOIS LADOS**: a prévia DEVOLVE a competência **e** o banner a
 * CONSOME no corpo do POST. *Guard que só exige o campo na rota aprovaria o dia em que a tela
 * parasse de mandá-lo; guard que só olha a tela aprovaria um campo apontando pro nada.*
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { semComentarios, usosDe, blocoEntre } from './_leitura-de-fonte'

const ler = (p: string) => readFileSync(p, 'utf8')

const BANNER = 'app/(dashboard)/empresas/[id]/cartoes/[cardId]/importar-fatura/page.tsx'
const PREVIEW = 'app/api/empresas/[id]/cartoes/[cardId]/importar-fatura/preview/route.ts'
const CONFIRM = 'app/api/empresas/[id]/cartoes/[cardId]/importar-fatura/confirm/route.ts'
const ROTA_CASAR = 'app/api/empresas/[id]/cartoes/[cardId]/casar-pagamento/route.ts'
const PORTA = 'lib/credit-card-pj/casar-pagamento.ts'
const RESOLVEDOR = 'lib/credit-card-pj/fatura-net-total.ts'
const MARCACAO = 'lib/ofx-v3/aplicar-marcacao.ts'
const ORQUESTRADOR = 'lib/reconciliation/import-orchestrator.ts'

describe('⭐⭐ LADO 1 — a prévia DEVOLVE a competência do documento', () => {
  it('ela deriva da porta única, nunca de um `slice` próprio', () => {
    const src = semComentarios(ler(PREVIEW))
    expect(usosDe(src, 'competenciaDaFatura'), 'a prévia parou de derivar a competência').toBeGreaterThanOrEqual(1)
    expect(src).toMatch(/invoiceMonth:\s*competenciaDaFatura\(/)
  })

  it('⛔ e NENHUM dos dois lados do import recorta a data na mão', () => {
    for (const f of [PREVIEW, CONFIRM, BANNER]) {
      const src = semComentarios(ler(f))
      /**
       * ⛔ `dueDate.slice(0, 7)` era a conta escrita à mão dentro do confirm. Copiá-la pro
       * banner criaria a **2ª derivação** da mesma data — e duas réguas pra *"de que mês é
       * esta fatura?"* divergem no primeiro formato novo, fazendo o banner casar o pagamento
       * numa competência e o import gravar as linhas em outra.
       */
      expect(src, `${f} voltou a recortar a competência na mão`).not.toMatch(/dueDate[^\n]{0,40}\.slice\(\s*0\s*,\s*7\s*\)/)
    }
  })

  it('o CONFIRM usa a MESMA porta — uma conta, as duas pontas', () => {
    const src = semComentarios(ler(CONFIRM))
    expect(usosDe(src, 'competenciaDaFatura')).toBeGreaterThanOrEqual(1)
  })
})

describe('⭐⭐⭐ LADO 2 — o banner MANDA a competência no corpo do POST', () => {
  /**
   * ⭐ Asserção **ESTRUTURAL**: o corpo do `casarAgora`, do `fetch` até o fim do `JSON.stringify`.
   * Procurar o nome no arquivo inteiro passaria com o campo numa interface e o POST sem ele
   * (*"menção, não uso"*); janela por distância já produziu falso vermelho E falso verde nesta
   * casa 10 vezes.
   */
  const corpoDoGesto = () => {
    const src = semComentarios(ler(BANNER))
    const fn = blocoEntre(src, 'async function casarAgora', '\n  }')
    return blocoEntre(fn, 'JSON.stringify(', '),')
  }

  it('⭐⭐ o `invoiceMonth` está DENTRO do corpo que vai pro servidor', () => {
    const corpo = corpoDoGesto()
    expect(corpo, 'o bloco do gesto não foi encontrado — âncora mudou de casa?').not.toBe('')
    expect(corpo, '⛔ o defeito de 20/10: o banner mandava só { txId }').toMatch(/invoiceMonth/)
  })

  it('e ele vem do SERVIDOR (`extraction.invoiceMonth`), não de conta na tela', () => {
    expect(corpoDoGesto()).toMatch(/extraction\.invoiceMonth/)
  })
})

describe('⛔⛔ A RECUSA QUE ENSINA — e a meia-marca que ficou impossível', () => {
  it('o resolvedor NÃO tem mais fallback "a mais recente"', () => {
    const src = semComentarios(ler(RESOLVEDOR))
    /**
     * ⛔ O veneno era `return [...netByMonth.keys()].sort().pop() ?? null`. Ele escolhia um mês
     * **em silêncio** quando nada batia — e silêncio aqui é um vínculo plausível no mês errado,
     * que ninguém percebe até o juiz rodar.
     */
    expect(src, 'o `sort().pop()` voltou ao resolvedor').not.toMatch(/\.keys\(\)[^\n]*\.sort\(\)[^\n]*\.pop\(\)/)
  })

  it('a PORTA recusa quando a competência não dá pra resolver', () => {
    const src = semComentarios(ler(PORTA))
    expect(src).toMatch(/if\s*\(!paidInvoiceMonth\)/)
    expect(src, 'a recusa tem que ser de domínio (422), não 500 cru').toMatch(/throw new CasarPagamentoError/)
  })

  it('o IMPORT devolve um desfecho PRÓPRIO em vez de gravar meia-marca', () => {
    const src = semComentarios(ler(MARCACAO))
    expect(src).toMatch(/if\s*\(!paidInvoiceMonth\)\s*return\s*'sem-competencia'/)
    expect(src, 'o tipo tem que conhecer o 3º desfecho').toMatch(/'applied'\s*\|\s*'skipped'\s*\|\s*'sem-competencia'/)
  })

  it('⭐⭐ e o LOG do orquestrador DIZ a verdade — recusada ≠ pulada-idempotente', () => {
    const src = semComentarios(ler(ORQUESTRADOR))
    /**
     * ⛔ Colapsar `'sem-competencia'` no ramo do `else` faria o log escrever *"motivo: já
     * estava aplicada (idempotente)"* sobre uma marcação que **nada aplicou**. O log é o único
     * rastro que a marcação deixa — e foi marcação pulada em silêncio que fez um vínculo
     * desaparecer em 10/09.
     */
    expect(src).toMatch(/r\s*===\s*'sem-competencia'/)
    const ramo = blocoEntre(src, "r === 'sem-competencia'", '} else {')
    expect(ramo).toMatch(/RECUSADA/)
    expect(ramo, 'o ramo da recusa não pode dizer "idempotente"').not.toMatch(/idempotente/)
  })
})

describe('⭐⭐ O RASTRO — a rota que move dinheiro grava AUDIT', () => {
  const src = () => semComentarios(ler(ROTA_CASAR))

  it('os DOIS gestos deixam rastro: casar e desfazer', () => {
    /**
     * ⛔ Quando a fatura de outubro apareceu paga em setembro, o `AuditLog` da transação tinha
     * **ZERO** eventos: deu pra provar que NÃO veio da conciliação e **não deu pra provar por
     * onde veio**. O desfazer entra junto porque é o gesto que desmancha o estrago — sem ele, a
     * correção seria ela própria invisível.
     */
    expect(usosDe(src(), 'rastro'), 'a rota voltou a mover dinheiro sem rastro').toBeGreaterThanOrEqual(3)
    expect(src()).toMatch(/gesto:\s*'casar-pagamento-de-cartao'/)
    expect(src()).toMatch(/gesto:\s*'desfazer-casamento-de-cartao'/)
  })

  it('⭐ o rastro diz DE ONDE veio a competência — era isso que faltava na perícia', () => {
    expect(src()).toMatch(/competenciaVeioDe/)
  })

  it('⛔ e ele é FAIL-SOFT: rastro que derruba o gesto seria pior que rastro nenhum', () => {
    const fn = blocoEntre(src(), 'async function rastro', '\n}')
    expect(fn).toMatch(/try\s*\{/)
    expect(fn, 'a falha de rastro tem que aparecer no log, nunca sumir').toMatch(/console\.warn/)
  })

  /**
   * ⚠️⚠️ A 1ª VERSÃO DESTA ASSERÇÃO REPROVOU A PRÓPRIA DOCUMENTAÇÃO DA CURA. Ela proibia a
   * frase *"usa a fatura mais recente do cartão (default seguro)"* no arquivo CRU — e o
   * comentário novo **cita** a frase antiga pra dizer que ela era mentira. ***O arquivo que
   * registra o defeito não pode ser condenado por registrá-lo*** (a mesma lição de 17/10).
   *
   * ⛔ E ler `semComentarios` aqui não serve: a frase **só pode** viver em comentário, então a
   * asserção nunca falharia — *linha que não pode falhar é linha que finge ser trava*.
   *
   * ⭐ O que dá pra afirmar com valor é o CONTRÁRIO: o campo opcional **declara a recusa**.
   * Quem reintroduzir o fallback e reescrever a frase cai aqui — e no teste do resolvedor.
   */
  it('⭐ o zod DECLARA o desfecho certo do campo ausente: recusa, não chute', () => {
    const cru = ler(ROTA_CASAR)
    const bloco = blocoEntre(cru, 'const casarSchema', 'invoiceMonth: z')
    expect(bloco, 'o schema do gesto não foi encontrado').not.toBe('')
    expect(bloco, 'o campo ausente tem que dizer que o servidor RECUSA, nunca que "usa a mais recente"')
      .toMatch(/RECUSA ENSINANDO/)
  })
})
