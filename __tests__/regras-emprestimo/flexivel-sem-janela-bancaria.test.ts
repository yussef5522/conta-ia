/**
 * ⛔⛔⛔ GUARD — A JANELA BANCÁRIA NÃO VOLTA PRO FLEXÍVEL (09/10/2026).
 *
 * **A régua que o dono ditou:** *"o «Marcar paga» com janela bancária fica SÓ nos contratos
 * PRE/POS; no FLEXIBLE ele sai da tela (o botão novo é a porta). GUARD: janela bancária de
 * volta no FLEXIBLE = vermelho."*
 *
 * ⚠️ **E ELE PROVA OS DOIS LADOS.** Guard que só afirmasse a ausência no flexível aprovaria o
 * dia em que a janela sumisse de TODO lugar — e ela é a régua certa no contrato de banco, onde
 * o valor é conhecido e o débito cai perto do vencimento. Então: **fechada no flexível E viva
 * no bancário**.
 *
 * ⛔ Parte dele é ESTRUTURAL (lê a fonte da tela) e isso está assumido: o projeto roda em
 * `environment: node`, sem jsdom — não dá pra clicar. O que é COMPORTAMENTO (`ofereceMarcarPaga`
 * e `ehJanelaBancaria`) é EXECUTADO.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe } from '../regras-ui/_leitura-de-fonte'
import { estadoDaParcela, ofereceMarcarPaga } from '@/lib/loans/estado-da-parcela'
import { ehJanelaBancaria, JanelaBancariaNoFlexivelError } from '@/lib/loans/janela-bancaria'

const RAIZ = process.cwd()
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8')

const PAGINA = 'app/(dashboard)/empresas/[id]/emprestimos/[loanId]/page.tsx'
const ROTA = 'app/api/empresas/[id]/emprestimos/[loanId]/route.ts'
const CANDIDATOS = 'app/api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]/candidatos/route.ts'
const POST_PARCELA = 'app/api/empresas/[id]/emprestimos/[loanId]/parcelas/[number]/route.ts'

/**
 * uma referência flexível aberta, do jeito que ela existe em prod.
 *
 * ⚠️ O VENCIMENTO É RELATIVO AO RELÓGIO (REGRA do guard `sem-data-fixa-no-futuro`): data fixa
 * no futuro ocupando posição de "agora" é **contagem regressiva** — passa hoje e quebra sozinha
 * quando o calendário chegar lá. O guard me pegou com `2026-12-20` na posição de `hoje`.
 */
const AGORA = new Date()
const maisDias = (n: number) => new Date(Date.now() + n * 86_400_000)
const REFERENCIA_ABERTA = {
  dueDate: maisDias(60),
  payment: 41428.57,
  status: 'OPEN',
  paidTotal: null,
  pagamentos: [],
  valorDoVinculo11: null,
}
/** a MESMA referência, já vencida — pra o lado bancário do guard */
const REFERENCIA_VENCIDA = { ...REFERENCIA_ABERTA, dueDate: maisDias(-10) }

describe('⛔⛔ a régua: no flexível a janela bancária não existe', () => {
  it('⛔⛔ `ofereceMarcarPaga` devolve FALSE no flexível — o botão sai da tela', () => {
    const v = estadoDaParcela(REFERENCIA_ABERTA, { flexible: true, hoje: AGORA })
    expect(v.estado, 'flexível nunca atrasa (a isenção de 02/10)').toBe('A_VENCER')
    expect(ofereceMarcarPaga(v, { flexible: true }), 'a janela bancária voltou pro flexível').toBe(false)
  })

  it('⭐⭐ E CONTINUA VIVA NO BANCÁRIO — guard que só afirma a ausência aprova o sumiço total', () => {
    const v = estadoDaParcela(REFERENCIA_VENCIDA, { flexible: false, hoje: AGORA })
    expect(v.estado).toBe('ATRASADA')
    expect(ofereceMarcarPaga(v, { flexible: false }), 'o gesto do contrato de banco morreu').toBe(true)
    /** ⚠️ e sem o parâmetro também — chamador antigo não muda de comportamento */
    expect(ofereceMarcarPaga(v)).toBe(true)
  })

  it('⛔ parcela PAGA segue sem oferecer, nos dois mundos — era a porta da dupla contagem', () => {
    const paga = estadoDaParcela(
      { ...REFERENCIA_VENCIDA, status: 'PAID' },
      { flexible: false, hoje: AGORA },
    )
    expect(ofereceMarcarPaga(paga, { flexible: false })).toBe(false)
    expect(ofereceMarcarPaga(paga, { flexible: true })).toBe(false)
  })

  it('⭐ `ehJanelaBancaria` é o dono único da pergunta', () => {
    expect(ehJanelaBancaria('FLEXIBLE')).toBe(false)
    expect(ehJanelaBancaria('IMPORTED')).toBe(true)
    expect(ehJanelaBancaria(null)).toBe(true)
    expect(ehJanelaBancaria(undefined)).toBe(true)
  })

  it('⭐ a recusa ENSINA a saída — sem a frase, ela só troca um beco por outro', () => {
    const e = new JanelaBancariaNoFlexivelError()
    expect(e.code).toBe('JANELA_BANCARIA_NO_FLEXIVEL')
    expect(e.message).toContain('Registrar devolução')
    expect(e.message, 'a recusa tem que dizer POR QUE a janela não serve').toMatch(/valor.*livre|livre.*valor/i)
  })
})

describe('⛔⛔ a TRAVA É DO SERVIDOR, nos DOIS ramos do «Marcar paga»', () => {
  it('⛔ o `candidatos` (a busca) consulta a régua e recusa', () => {
    const src = semComentarios(ler(CANDIDATOS))
    expect(usosDe(src, 'ehJanelaBancaria'), 'a busca da janela deixou de consultar a régua').toBeGreaterThanOrEqual(1)
    expect(usosDe(src, 'JanelaBancariaNoFlexivelError')).toBeGreaterThanOrEqual(1)
    /** ⚠️ e a régua é IMPORTADA, nunca comparada na mão: `scheduleSource === 'FLEXIBLE'` espalhado
     *  é a segunda cópia que diverge no primeiro tipo de agenda novo. */
    expect(src).not.toMatch(/scheduleSource\s*===\s*'FLEXIBLE'/)
  })

  it('⛔⛔ o POST da parcela (a GRAVAÇÃO) também recusa — travar só a busca deixa a escrita aberta', () => {
    const src = semComentarios(ler(POST_PARCELA))
    expect(usosDe(src, 'ehJanelaBancaria'), 'a porta de escrita do «Marcar paga» ficou aberta no flexível').toBeGreaterThanOrEqual(1)
    expect(usosDe(src, 'JanelaBancariaNoFlexivelError')).toBeGreaterThanOrEqual(1)
    /** ⭐ e o `select` tem que trazer o campo — sem ele a régua decide com `undefined` (a doença
     *  do select incompleto do PIX de 7.000, 17/08) */
    expect(src).toContain('scheduleSource: true')
  })

  it('⛔ a rota do detalhe passa o `flexible` pra régua do botão — o USO, não a menção', () => {
    const src = semComentarios(ler(ROTA))
    expect(src).toMatch(/ofereceMarcarPaga\(v,\s*\{\s*flexible\s*\}\)/)
  })

  it('⛔⛔ a ROTA monta o histórico dos VÍNCULOS (as duas portas) e chama o resumo derivado', () => {
    /**
     * ⚠️ Esta asserção existe porque o teste de integração deriva as devoluções ELE MESMO,
     * espelhando a rota — então uma régua nova na rota passaria verde. É o *"guard que testa a
     * lib e aprova a rota que a ignora"*, a classe que já custou 3 sprints nesta casa.
     */
    const src = semComentarios(ler(ROTA))
    expect(usosDe(src, 'resumoDoFlexivel'), 'a rota parou de derivar o resumo').toBeGreaterThanOrEqual(1)
    expect(usosDe(src, 'devolucoesComData'), 'o histórico voltou a sair da PARCELA').toBeGreaterThanOrEqual(2)
    /** ⛔ as DUAS portas de vínculo — ler uma e declarar completo foi o bug de 14/08 */
    const bloco = src.slice(src.indexOf('devolucoesComData'), src.indexOf('historicoDevolucoes'))
    expect(bloco).toContain('reconciledTransaction')
    expect(bloco).toContain('payments')
    /** ⛔ e o histórico NÃO pode voltar a filtrar parcela paga */
    expect(src).not.toMatch(/historicoDevolucoes\s*=\s*paid/)
  })
})

describe('⛔ a TELA do flexível: a porta nova existe e a velha não', () => {
  const pagina = () => semComentarios(ler(PAGINA))

  it('⭐⭐ o botão «Registrar devolução» existe e é GATEADO por `loan.flexible`', () => {
    const src = pagina()
    expect(src).toContain('Registrar devolução')
    expect(usosDe(src, 'RegistrarDevolucaoDialog'), 'o modal da porta nova não é renderizado').toBeGreaterThanOrEqual(1)
    /** ⚠️ o gate tem que estar IMEDIATAMENTE antes do botão — distância aprova o condicional
     *  do vizinho (a janela de distância que já deu falso verde 7 vezes nesta casa) */
    const i = src.indexOf('Registrar devolução')
    const antes = src.slice(Math.max(0, i - 420), i)
    expect(antes, 'o botão da devolução apareceu em contrato de banco').toContain('loan.flexible && (')
  })

  it('⛔⛔ o `CandidatosDialog` (a janela bancária) NÃO renderiza no flexível', () => {
    const src = pagina()
    const i = src.indexOf('<CandidatosDialog')
    expect(i, 'o dialog da janela sumiu de todo lugar — ele é a régua certa no bancário').toBeGreaterThan(0)
    const antes = src.slice(Math.max(0, i - 200), i)
    expect(antes, 'a janela bancária voltou a ser oferecida no flexível').toContain('!loan.flexible')
  })

  it('⛔⛔ o resumo da tela é o DERIVADO — a tela não imprime total de devolução escrito à mão', () => {
    const src = pagina()
    expect(usosDe(src, 'resumoFlex'), 'a tela voltou a não ler o resumo derivado').toBeGreaterThanOrEqual(1)
    expect(src).toContain('agregados.resumoFlex.frase')
    /**
     * ⛔ E ela GRITA quando as partes não fecham: `fecha: false` = Σ(devoluções) ≠ principal −
     * saldo. Escolher um dos dois números é a família do cabeçalho que afirmava 69 duplicatas
     * com a aba dizendo 0.
     */
    expect(src).toContain('!agregados.resumoFlex.fecha')
  })

  it('⛔ nenhum valor de dinheiro cravado na tela do empréstimo', () => {
    const src = pagina()
    /** ⚠️ era o `notes` com "Saldo 290.000" dentro; agora nem na tela nem em literal */
    expect(src).not.toMatch(/R\$\s?\d{1,3}(\.\d{3})+/)
    expect(src).not.toContain('290.000')
  })
})
