/**
 * ⭐⭐⭐ A CONTA GARANTIDA DO SICREDI — A EXCEÇÃO NOMEADA E ESTREITA (19/10/2026)
 *
 * **O caso real, medido em prod:** em 16/10 o Sicredi debitou a parcela 25 do `C41022227-1`
 * em DUAS linhas, e nenhuma delas nomeia o contrato da parcela:
 *
 * ```
 * 16/10  DEBIT  4.257,46  "AMORTIZACAO CONTRATO-C61022527"
 * 16/10  DEBIT  2.798,29  "LIQUIDACAO CONTRATO-C61022527"
 *                          ↑ C61022527 é um contrato AUXILIAR que o banco abre, usa e extingue
 *                            no MESMO dia — ele NÃO existe no cadastro
 * ```
 *
 * ⛔⛔ **O que as barrava era o guard Cancian** (`nomeiaOutroContrato`, 10/09): *"linha que
 * nomeia OUTRO identificador longo nunca entra, nem por keyword"*. Ele está **certo** — foi
 * ele que tirou do grupo as 6 linhas do `C61021766` e o boleto de cartão. A saída não é
 * afrouxá-lo: é uma exceção **NOMEADA**, com as quatro condições abaixo, deixando o guard
 * mordendo todo o resto.
 *
 * ⚠️⚠️ **E ela NÃO resolveu o caso real — o dono resolveu, por outro caminho.** Medido em prod
 * em 19/10: a parcela 25 já está `PAID` com **2 pagamentos somando 7.055,75** e fechando em
 * **144.736,96**. Ele vinculou pelo chip 🏦 da caixa de entrada, que chama a porta com
 * `transactionIds: [tx.id]` — **uma linha por vez, sem passar pelo `buildLinkGroup`**. ⭐ A
 * exceção aqui serve o PAINEL e o próximo caso; os números deste arquivo são os dele.
 */
import { describe, it, expect } from 'vitest'
import {
  contratoAuxiliarNaoCadastrado,
  linhasDaContaGarantida,
  buildLinkGroup,
  tetoDoPagamento,
  bloqueioDoVinculo,
  FOLGA_DO_TETO,
} from '../link-payment'

/** ⚠️ os contratos REAIS da Caçula — é contra ELES que o auxiliar é "não-cadastrado" */
const CADASTRADOS = [
  '002100057538834', '002100064956967', 'C41022227-1', 'C41022570-0', 'C41033828-8',
  '000000000001837311', '000000000001827478', null, 'C61021346-2', 'Arafat — forno (2ª tranche)',
]

const d = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

/** ⭐ as duas linhas REAIS de 16/10 */
const AMORT = { id: 'tx-amort', description: 'AMORTIZACAO CONTRATO-C61022527', amount: 4257.46, date: d('2026-10-16') }
const LIQUID = { id: 'tx-liquid', description: 'LIQUIDACAO CONTRATO-C61022527', amount: 2798.29, date: d('2026-10-16') }

describe('⭐⭐⭐ as DUAS linhas de 16/10 entram no grupo da parcela 25', () => {
  it('⭐⭐ o par do MESMO auxiliar no MESMO dia é oferecido — e a soma é a do caso real', () => {
    const achadas = linhasDaContaGarantida([AMORT, LIQUID], CADASTRADOS)
    expect(achadas.size, 'as duas linhas da conta garantida voltaram a ser barradas').toBe(2)

    const g = buildLinkGroup({
      pend: [AMORT, LIQUID],
      contractNumber: 'C41022227-1',
      originTxId: AMORT.id,
      contratosCadastrados: CADASTRADOS,
    })
    expect(g.candidates.map((c) => c.id).sort()).toEqual(['tx-amort', 'tx-liquid'])
    /**
     * ⛔⛔ **NADA PRÉ-MARCADO ALÉM DA SEMENTE** — a régua da casa (*"o atalho SÓ MARCA, o
     * Conciliar continua sendo meu"*). A exceção OFERECE; marcar as duas por conta própria
     * seria o sistema decidindo que as duas são da mesma parcela.
     */
    expect(g.selectedIds, 'a exceção passou a MARCAR, não só oferecer').toEqual(['tx-amort'])
    expect(g.paidTotal, 'só a semente está marcada').toBe(4257.46)

    // ⭐ e com as duas marcadas, a soma é o débito real do banco
    const comAsDuas = buildLinkGroup({
      pend: [AMORT, LIQUID],
      contractNumber: 'C41022227-1',
      transactionIds: [AMORT.id, LIQUID.id],
      contratosCadastrados: CADASTRADOS,
    })
    expect(comAsDuas.paidTotal).toBe(7055.75)
  })

  it('⭐ a conta do caso real fecha: 7.055,75 − 4.385,96 de capital = 2.669,79 de encargos', () => {
    // ⚠️ aritmética do brief conferida contra o banco (parcela 25: amortization 4.385,96)
    expect(Math.round((7055.75 - 4385.96) * 100) / 100).toBe(2669.79)
  })
})

describe('⛔⛔⛔ OS VERMELHOS — o guard Cancian continua mordendo todo o resto', () => {
  it('⛔⛔ linha de contrato CADASTRADO não é conta garantida (o dinheiro tem dono)', () => {
    /**
     * ⭐ É a trava central. `C41022570-0` é contrato de verdade da empresa — e há uma linha
     * REAL dele em 15/10 (`LIQUIDACAO DE PARCELA-C41022570`, R$ 5.601,95). Tratá-la como
     * auxiliar jogaria o pagamento de um contrato dentro da parcela de outro.
     */
    const doCadastrado = { id: 'x', description: 'AMORTIZACAO CONTRATO-C41022570-0', amount: 1000, date: d('2026-10-16') }
    const irmao = { ...doCadastrado, id: 'y', description: 'LIQUIDACAO CONTRATO-C41022570-0' }
    expect(contratoAuxiliarNaoCadastrado(doCadastrado.description, CADASTRADOS)).toBeNull()
    expect(linhasDaContaGarantida([doCadastrado, irmao], CADASTRADOS).size).toBe(0)
  })

  it('⛔⛔ o par em DIAS diferentes não é conta garantida — a operação nasce e morre no mesmo dia', () => {
    /**
     * ⚠️ É a 3ª condição, e ela é o que ancora a exceção sem precisar de `originTxId`: o
     * auxiliar existe por HORAS. Par em dias distintos é outra coisa, e assumir que é a mesma
     * operação ligaria linhas que o banco não ligou.
     */
    const outroDia = { ...LIQUID, id: 'tx-liquid-17', date: d('2026-10-17') }
    expect(linhasDaContaGarantida([AMORT, outroDia], CADASTRADOS).size).toBe(0)
  })

  it('⛔ auxiliar com UMA linha só naquele dia NÃO é oferecido', () => {
    /**
     * ⭐ A 3ª condição é auto-ancorada: a linha precisa de um IRMÃO do mesmo auxiliar no mesmo
     * dia. Sozinha, ela pode ser qualquer coisa — e oferecer "qualquer coisa" é o caça-níquel
     * que esta casa recusa.
     */
    expect(linhasDaContaGarantida([AMORT], CADASTRADOS).size).toBe(0)
  })

  it('⛔⛔ `LIQUIDACAO DE PARCELA-…` (o formato NORMAL) nunca é conta garantida', () => {
    /**
     * ⚠️ A régua casa `CONTRATO-<num>`, nunca `DE PARCELA-<num>`. Aquele é o formato do
     * pagamento direto, que o guard do número já resolve — e confundir os dois faria a
     * exceção engolir o caminho comum.
     */
    const normal = { id: 'n1', description: 'LIQUIDACAO DE PARCELA-C41022227', amount: 7000, date: d('2026-10-16') }
    const normal2 = { ...normal, id: 'n2', description: 'LIQUIDACAO DE PARCELA-C41022570' }
    expect(contratoAuxiliarNaoCadastrado(normal.description, CADASTRADOS)).toBeNull()
    expect(linhasDaContaGarantida([normal, normal2], CADASTRADOS).size).toBe(0)
  })

  it('⛔⛔⛔ SEM `contratosCadastrados` a exceção NÃO roda — e é por isso que ela estava morta', () => {
    /**
     * ⛔ Era literalmente o estado de prod até 19/10: o motor existia e a rota do preview não
     * passava a lista → `new Set()` vazio → as duas linhas seguiam barradas. **O motor estava
     * em prod e inalcançável** — a *"porta sem maçaneta"* desta casa pela enésima vez.
     */
    const g = buildLinkGroup({ pend: [AMORT, LIQUID], contractNumber: 'C41022227-1', originTxId: AMORT.id })
    expect(g.candidates.map((c) => c.id), 'a exceção passou a valer sem a lista de contratos').toEqual(['tx-amort'])
  })
})

describe('⛔⛔ O TETO DA SOMA — a folga saiu do histórico MEDIDO deste contrato', () => {
  /** ⚠️ os números são da parcela 25 real: capital 4.385,96 · saldo de abertura 149.122,92 */
  const P25 = { amortization: 4385.96, interest: 0, openingBalance: 149122.92, rateMonthly: 0.0172076372375527 }

  it('⭐ o juros esperado sai do saldo quando a agenda diz 0 (pós-fixado amort-only)', () => {
    const { teto, jurosEsperado } = tetoDoPagamento(P25)
    /**
     * ⚠️⚠️ **O TESTE CORRIGIU A MINHA ARITMÉTICA:** eu tinha escrito **2.566,14** no
     * `CLAUDE.md` e o motor devolve **2.566,05** (`149.122,92 × 0,01720763… = 2.566,05`). O
     * número do doc era meu, de cabeça; o do código sai do saldo real. *O que importa — a
     * razão do pagamento real sobre o juros do mês, 1,04× — não muda; a minha conta mudou.*
     */
    expect(jurosEsperado, 'o juros esperado deixou de sair do saldo × taxa').toBe(2566.05)
    // ⚠️ cravado porque o motor arredonda em 2 casas; a soma solta dá 9518.060000000001
    expect(FOLGA_DO_TETO).toBe(2)
    expect(teto).toBe(9518.06)
  })

  it('⭐⭐ os TRÊS pagamentos reais do contrato passam — a folga não aperta o caso legítimo', () => {
    /**
     * ⚠️⚠️ **A folga é MEDIDA, não escolhida:** `#23` 2.949,89 ÷ 2.717,00 = 1,09× · `#24`
     * 2.517,49 ÷ 2.641,52 = 0,95× · `#25` 2.669,79 ÷ 2.566,05 = 1,04×. Com `FOLGA = 2` sobra
     * mais de 80% de margem. *Invariante que falha no caso legítimo é pior que invariante
     * nenhum — alguém "conserta" o DADO pra bater com a régua errada.*
     */
    const { teto } = tetoDoPagamento(P25)
    expect(teto).not.toBeNull()
    expect(7055.75, 'o débito real da #25 passou a ser barrado pelo teto').toBeLessThanOrEqual(teto!)
  })

  it('⛔⛔ o absurdo BARRA — e a frase diz os números', () => {
    /** ⚠️ 15.614 ÷ 2.566,05 = 6,1× o juros do mês: isto não é mora, é linha de outra parcela */
    const b = bloqueioDoVinculo({
      installmentNumber: 25, temVinculo11: false, status: 'OPEN',
      jaVinculados: { quantos: 0, soma: 0 },
      paidTotal: 20000, ...P25,
    })
    expect(b?.code).toBe('SOMA_ESTOUROU')
    expect(b?.mensagem).toContain('passa do teto')
    expect(b?.mensagem, 'a recusa deixou de dizer o capital').toContain('4.385,96')
  })

  it('⛔⛔ taxa ZERO (o mútuo) NÃO tem teto — e é honesto: ali o valor é LIVRE', () => {
    /**
     * ⭐ No FLEXIBLE a devolução é conforme o caixa (40k · 50k · 50k nas três reais). Um teto
     * sobre a agenda nominal recusaria devolução legítima — o oposto do que a trava existe
     * pra fazer.
     */
    expect(tetoDoPagamento({ ...P25, rateMonthly: 0 }).teto).toBeNull()
    expect(
      bloqueioDoVinculo({
        installmentNumber: 1, temVinculo11: false, status: 'OPEN',
        jaVinculados: { quantos: 0, soma: 0 },
        paidTotal: 50000, amortization: 41428.57, interest: 0, openingBalance: 380000, rateMonthly: 0,
      }),
    ).toBeNull()
  })

  it('⛔ juros esperado ≤ 0 também não ganha teto — ausência de régua não se inventa', () => {
    expect(tetoDoPagamento({ ...P25, openingBalance: 0, interest: 0 }).teto).toBeNull()
  })
})

describe('⛔⛔⛔ AS TRÊS RECUSAS, E ELAS SÃO A MESMA FUNÇÃO DA PORTA', () => {
  const P25 = { amortization: 4385.96, interest: 0, openingBalance: 149122.92, rateMonthly: 0.0172076372375527 }

  it('⛔ vínculo 1:1 existente barra o grupo (juros contado 2× no DRE)', () => {
    const b = bloqueioDoVinculo({
      installmentNumber: 25, temVinculo11: true, status: 'OPEN',
      jaVinculados: { quantos: 0, soma: 0 }, paidTotal: 100, ...P25,
    })
    expect(b?.code).toBe('JA_VINCULADA_1_1')
  })

  it('⛔⛔⛔ pedaço NOVO em parcela já quitada POR VÍNCULO = barrado — o estado real da #25 hoje', () => {
    /**
     * ⭐ Medido em prod: a parcela 25 está `PAID` com **2 pagamentos somando 7.055,75**. Um 3º
     * pedaço somaria no `paidTotal` e o excedente viraria **encargo fantasma no DRE** —
     * exatamente a dupla contagem que o `ofereceMarcarPaga` tirou da TELA em 02/10 e que a
     * PORTA ainda aceitava. *Trava de tela é combinado; trava de porta é impossibilidade.*
     */
    const b = bloqueioDoVinculo({
      installmentNumber: 25, temVinculo11: false, status: 'PAID',
      jaVinculados: { quantos: 2, soma: 7055.75 }, paidTotal: 11000, ...P25,
    })
    expect(b?.code, 'a porta voltou a aceitar pedaço em parcela quitada').toBe('JA_QUITADA')
    expect(b?.mensagem).toContain('2 pagamento(s)')
    expect(b?.mensagem).toContain('7.055,75')
  })

  it('⭐⭐ `PAID` SEM vínculo nenhum CONTINUA aceitando o 1º vínculo — são 180 parcelas assim', () => {
    /**
     * ⛔⛔ **É a metade que impede a trava de virar parede.** Há 180 parcelas `PAID` sem
     * vínculo (pagas por documento, histórico anterior ao sistema), e a **#22 deste mesmo
     * contrato** é uma delas — a conta garantida de julho a deixou paga sem transação.
     * Barrar `PAID` seco tornaria **impossível** anexar a transação verdadeira depois, e essa
     * correção é uma decisão em aberto do dono.
     */
    const b = bloqueioDoVinculo({
      installmentNumber: 22, temVinculo11: false, status: 'PAID',
      jaVinculados: { quantos: 0, soma: 0 }, paidTotal: 7294.4, ...P25,
    })
    expect(b, 'barrar PAID seco tornou a correção da #22 impossível').toBeNull()
  })

  it('⭐ o caso real passa pelas três: nada barra o débito legítimo de 16/10', () => {
    expect(
      bloqueioDoVinculo({
        installmentNumber: 25, temVinculo11: false, status: 'OPEN',
        jaVinculados: { quantos: 0, soma: 0 }, paidTotal: 7055.75, ...P25,
      }),
    ).toBeNull()
  })
})
