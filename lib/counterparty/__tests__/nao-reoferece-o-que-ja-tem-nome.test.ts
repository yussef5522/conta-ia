/**
 * ⛔⛔⛔ O PDF NÃO RE-OFERECE O QUE JÁ TEM NOME (30/09/2026).
 *
 * **O defeito, medido em prod com o Banrisul da Caçula:** o dono mandou o PDF de 01–30/09 e
 * a lista *"vão receber nome"* trouxe **22 lançamentos — TODOS os 22 já com nome gravado**,
 * incluindo os de 02/09, 08/09 e 16/09 que ele tinha nomeado na rodada anterior.
 *
 * ```
 * VÃO RECEBER NOME: 22  (FITID 22 · DATA+VALOR 0)   ⛔ 22 de 22 já tinham nome
 * progresso: 28 de 94                                ⛔ a CONTA inteira, num PDF de 1 mês
 * ```
 *
 * **A CAUSA — os dois níveis tinham réguas DIFERENTES pra "quem é candidato":**
 * o Nível 1 (FITID, o **preferencial**) filtrava só `MANUAL`; o Nível 2 filtrava manual +
 * já-tem-nome + elegibilidade. ⚠️ E o contrato da própria interface declarava a regra que o
 * Nível 1 não cumpria (`counterpartyName?: string | null // se já tem nome, não propõe`) —
 * ***menção, não uso***, agora no comentário de um campo.
 *
 * **⛔⛔ E O LAÇO FECHAVA MUDO:** as 22 têm contraparte de fonte `OFX`, e
 * `canApplyCounterparty('OFX','PDF_STATEMENT')` é **FALSE** — o confirm pulava todas por
 * precedência e gravava **ZERO**. Ciclo: *oferecer → preservar → oferecer de novo*, pra
 * sempre. A tela do fim era honesta (*"N preservados"*); quem mentia era a **LISTA**.
 *
 * ⚠️ As fixtures usam os VALORES E DOCUMENTOS REAIS do caso (anonimizados só no nome das
 * pessoas físicas) — fixture inventada testaria o mundo que eu imaginei.
 */
import { describe, it, expect } from 'vitest'
import { joinPdfStatement, type JoinTxInput } from '../join-pdf-statement'
import { buildEnrichmentPreview, type EnrichTx } from '../build-preview'
import { podeReceberNomeDoPdf } from '../pode-receber-nome'
import { canApplyCounterparty } from '../precedence'
import type { BankStatementLine, ParsedBankStatement } from '@/lib/bank-statement-pdf/types'

/**
 * ⚠️ TIPADA DE VERDADE (sem `as unknown`): `BankStatementLine` exige `day` e `signed`, e foi
 * o `tsc` que cobrou. Fixture que mente no tipo testa um documento que o parser não produz.
 */
const linha = (
  date: string,
  documento: string,
  amount: number,
  nome: string,
  historico = 'PIX RECEBIDO',
): BankStatementLine => ({
  day: Number(date.slice(8, 10)),
  historico,
  documento,
  amount,
  signed: amount,
  counterpartyName: nome,
  date,
})

const tx = (o: Partial<JoinTxInput> & { id: string }): JoinTxInput => ({
  externalId: null,
  amount: 0,
  description: 'PIX RECEBIDO',
  counterpartySource: null,
  counterpartyName: null,
  dateIso: '2026-09-02',
  ...o,
})

/** ⭐ OS TRÊS CASOS REAIS que o dono nomeou, com FITID e valor de prod */
const REAIS = [
  { id: 't1', dateIso: '2026-09-02', externalId: '3EB0FE', amount: 403.83, nome: 'HUB INSTITUICAO DE PAGAMENTO SA' },
  { id: 't2', dateIso: '2026-09-08', externalId: '681845', amount: 40000, nome: 'CACULA MIX' },
  { id: 't3', dateIso: '2026-09-16', externalId: 'C42BDB', amount: 521.8, nome: 'HUB INSTITUICAO DE PAGAMENTO SA' },
]
const pdfDosReais = REAIS.map((r) => linha(r.dateIso, r.externalId, r.amount, r.nome))

describe('⛔⛔⛔ a lista não re-oferece o que já foi feito', () => {
  it('⛔⛔⛔ os 3 casos reais: JÁ TÊM nome (fonte OFX) → 0 oferecidos, 3 contados', () => {
    const txs = REAIS.map((r) =>
      tx({ ...r, counterpartyName: r.nome, counterpartySource: 'OFX' }),
    )
    const r = joinPdfStatement(pdfDosReais, txs, { altKey: true })
    expect(r.exact, 'a lista re-ofereceu o que já tem nome — é o bug de 30/09').toHaveLength(0)
    expect(r.stats.jaResolvidas, 'as já resolvidas sumiram em vez de serem contadas').toBe(3)
    // ⭐ e cada uma diz o PORQUÊ — "pulada" sem motivo manda caçar erro que não existe
    expect(new Set(r.puladas.map((p) => p.motivo))).toEqual(new Set(['PRECEDENCIA']))
  })

  it('⛔⛔ e pelo NÍVEL 1 (FITID) também — era ele o frouxo', () => {
    /**
     * ⚠️ Este é o teste que ISOLA o defeito: com `altKey: false` só o Nível 1 roda. Era
     * nele que as 22 passavam (`FITID 22 · DATA+VALOR 0`, medido em prod).
     */
    const txs = REAIS.map((r) => tx({ ...r, counterpartyName: r.nome, counterpartySource: 'OFX' }))
    const r = joinPdfStatement(pdfDosReais, txs, { altKey: false })
    expect(r.exact, 'o Nível 1 voltou a re-oferecer').toHaveLength(0)
    expect(r.stats.jaResolvidas).toBe(3)
  })

  it('⭐ quem NÃO tem nome continua sendo oferecido — a cura não virou parede', () => {
    const txs = [
      tx({ id: 'semNome', dateIso: '2026-09-02', externalId: '3EB0FE', amount: 403.83 }),
      tx({ id: 'comNome', dateIso: '2026-09-08', externalId: '681845', amount: 40000, counterpartyName: 'CACULA MIX', counterpartySource: 'OFX' }),
    ]
    const r = joinPdfStatement(pdfDosReais, txs, { altKey: true })
    expect(r.exact.map((e) => e.txId)).toEqual(['semNome'])
    expect(r.exact[0].counterpartyName).toBe('HUB INSTITUICAO DE PAGAMENTO SA')
    expect(r.stats.jaResolvidas).toBe(1)
  })

  it('⛔⛔ nome de fonte PDF também não se re-oferece (a 2ª rodada do MESMO PDF)', () => {
    /**
     * ⚠️ `canApplyCounterparty('PDF_STATEMENT','PDF_STATEMENT')` é **TRUE** (rank igual), então
     * a precedência NÃO barra este caso — quem barra é o *já tem nome*. É exatamente o
     * cenário "confirmei e re-anexei o mesmo PDF", e sem esta trava ele reoferece pra sempre.
     */
    expect(canApplyCounterparty('PDF_STATEMENT', 'PDF_STATEMENT'), 'a precedência mudou — revisar este teste').toBe(true)
    const txs = [tx({ id: 'x', dateIso: '2026-09-02', externalId: '3EB0FE', amount: 403.83, counterpartyName: 'HUB INSTITUICAO DE PAGAMENTO SA', counterpartySource: 'PDF_STATEMENT' })]
    const r = joinPdfStatement(pdfDosReais, txs, { altKey: true })
    expect(r.exact, 're-ofereceu o que a rodada anterior gravou').toHaveLength(0)
    expect(r.puladas[0].motivo).toBe('JA_TEM_NOME')
  })

  it('⭐⭐ IDEMPOTÊNCIA: 2ª passada do MESMO PDF não oferece nada (o item 3 do dono)', () => {
    // 1ª passada: sem nome nenhum
    const antes = REAIS.map((r) => tx({ ...r }))
    const r1 = joinPdfStatement(pdfDosReais, antes, { altKey: true })
    expect(r1.exact).toHaveLength(3)

    // o confirm gravou → 2ª passada com os nomes de fonte PDF_STATEMENT
    const depois = REAIS.map((r) =>
      tx({ ...r, counterpartyName: r.nome, counterpartySource: 'PDF_STATEMENT' }),
    )
    const r2 = joinPdfStatement(pdfDosReais, depois, { altKey: true })
    expect(r2.exact, 'a 2ª passada do mesmo PDF voltou a oferecer').toHaveLength(0)
    expect(r2.stats.jaResolvidas).toBe(3)
  })

  it('⛔ linha NÃO-ELEGÍVEL (IOF/tarifa) não entra na lista nem pelo FITID', () => {
    /**
     * ⚠️ O Nível 1 também não checava elegibilidade. Medido em prod: **14 das 22** oferecidas
     * não eram elegíveis — a lista as oferecia e o progresso não as contava. Duas réguas.
     */
    const pdf = [linha('2026-09-05', '999999', 12.9, 'BANCO DO ESTADO', 'IOF')]
    const txs = [tx({ id: 'iof', dateIso: '2026-09-05', externalId: '999999', amount: 12.9, description: 'IOF' })]
    const r = joinPdfStatement(pdf, txs, { altKey: true })
    expect(r.exact).toHaveLength(0)
    expect(r.puladas[0].motivo).toBe('NAO_ELEGIVEL')
  })
})

describe('⭐⭐ A RÉGUA TEM UM DONO — e ele é o MESMO do confirm', () => {
  it('⛔⛔⛔ a precedência do preview É a `canApplyCounterparty` do confirm', () => {
    /**
     * ⭐ É o coração do conserto: enquanto o preview tinha régua própria, ele **oferecia o
     * que a gravação recusava** — e o dono refazia o trabalho sem fim. Este teste casa as
     * duas, caso a caso, em vez de prometer que elas concordam.
     */
    for (const fonte of ['MANUAL', 'OPEN_FINANCE', 'OFX', 'PDF_STATEMENT', null, 'LEGADO_DESCONHECIDO']) {
      const confirmGrava = canApplyCounterparty(fonte, 'PDF_STATEMENT')
      const previewOferece = podeReceberNomeDoPdf({
        description: 'PIX RECEBIDO',
        counterpartyName: null, // sem nome, pra isolar SÓ a precedência
        counterpartySource: fonte,
      }).pode
      expect(previewOferece, `divergiram na fonte ${fonte}: o preview oferece o que o confirm recusa`)
        .toBe(confirmGrava)
    }
  })

  it('⭐ a ORDEM dos motivos: precedência ganha de "já tem nome"', () => {
    /**
     * ⚠️ Dizer *"já tem nome"* numa linha que o confirm recusaria por FONTE esconderia a
     * razão real — e no dia em que o dono apagasse o nome, ela continuaria recusada sem ele
     * entender por quê.
     */
    const v = podeReceberNomeDoPdf({ description: 'PIX', counterpartyName: 'ALGUÉM', counterpartySource: 'MANUAL' })
    expect(v.motivo).toBe('PRECEDENCIA')
  })

  it('⛔ nome em branco NÃO conta como nome', () => {
    expect(podeReceberNomeDoPdf({ description: 'PIX RECEBIDO', counterpartyName: '   ', counterpartySource: null }).pode).toBe(true)
  })
})

/** Σ de todos os baldes da tela — usado pra provar que ninguém conta duas vezes. */
const somaDosBaldes = (p: ReturnType<typeof buildEnrichmentPreview>) =>
  p.counts.willReceive + p.counts.ambiguousTx + p.counts.jaResolvidas +
  p.counts.notApplicable + p.counts.outOfPeriod + p.counts.noPdfLine

describe('⭐⭐ O PROGRESSO DIZ DE QUE RECORTE ELE FALA', () => {
  const parsed = (lines: BankStatementLine[], start: string, end: string) =>
    ({ bank: 'BANRISUL', period: { start, end }, header: { agencia: null, conta: null }, lines, errors: [] }) as unknown as ParsedBankStatement

  const etx = (o: Partial<EnrichTx> & { id: string; date: Date }): EnrichTx => ({
    externalId: null, amount: 0, description: 'PIX RECEBIDO', type: 'CREDIT',
    counterpartyName: null, counterpartySource: null, ...o,
  })

  it('⛔⛔ "28 de 94" era a CONTA inteira num PDF de UM MÊS — agora diz os dois', () => {
    /**
     * ⭐ A reprodução do caso: setembro completo (2 de 2 com nome) e junho pendente (1 sem
     * nome). O número da conta inteira diz 2 de 3 — **e sozinho ele parece atraso**, quando
     * o que falta é o PDF de OUTRO mês.
     */
    const txs: EnrichTx[] = [
      etx({ id: 'set1', date: new Date('2026-09-02T12:00:00Z'), externalId: '3EB0FE', amount: 403.83, counterpartyName: 'HUB', counterpartySource: 'OFX' }),
      etx({ id: 'set2', date: new Date('2026-09-08T12:00:00Z'), externalId: '681845', amount: 40000, counterpartyName: 'CACULA MIX', counterpartySource: 'OFX' }),
      etx({ id: 'jun1', date: new Date('2026-06-10T12:00:00Z'), externalId: 'AAA111', amount: 100 }),
    ]
    const p = buildEnrichmentPreview(parsed(pdfDosReais, '2026-09-01', '2026-09-30'), txs, { altKey: true })

    expect(p.counts.willReceive, 'voltou a re-oferecer as de setembro').toBe(0)
    expect(p.counts.jaResolvidas).toBe(2)
    expect(p.progressoNoPeriodo, 'o progresso do período não existe').toEqual({ named: 2, totalEligible: 2 })
    expect(p.progress, 'o progresso da conta mudou de régua').toEqual({ named: 2, totalEligible: 3 })
    // ⭐ e o que falta é NOMEADO: o PDF de junho
    expect(p.outOfPeriodMonths).toEqual([{ month: '2026-06', count: 1 }])
    expect(p.counts.outOfPeriod).toBe(1)
  })

  /**
   * ⚠️⚠️ ESTE TESTE NÃO MORDIA NA 1ª VERSÃO (REGRA 11). Eu usei uma linha COM nome, e aí
   * quem a tirava dos baldes era o `if (t.counterpartyName) continue` que já existia —
   * **o guard que eu queria provar era inalcançável**. *Teste que escolhe um caso que outra
   * trava já cobre não prova nada sobre a trava nova.*
   *
   * ⭐ O caso que ISOLA é uma pulada **SEM nome**: o IOF que o PDF alcança. Sem o guard ela
   * aparece no balde novo *E* em "não se aplica" — a MESMA linha contada duas vezes na
   * mesma tela, que é a doença dos cards que não fecham com a lista.
   */
  it('⛔⛔ uma linha vive num balde SÓ — pulada sem nome não conta duas vezes', () => {
    const pdfIof = [linha('2026-09-05', '999999', 12.9, 'BANCO DO ESTADO', 'IOF')]
    const txs: EnrichTx[] = [
      etx({ id: 'iof', date: new Date('2026-09-05T12:00:00Z'), externalId: '999999', amount: 12.9, description: 'IOF' }),
    ]
    const p = buildEnrichmentPreview(parsed(pdfIof, '2026-09-01', '2026-09-30'), txs, { altKey: true })
    expect(p.counts.jaResolvidas).toBe(1)
    expect(p.counts.notApplicable, 'a pulada foi contada DUAS vezes na mesma tela').toBe(0)
    expect(p.counts.noPdfLine).toBe(0)
    expect(p.counts.outOfPeriod).toBe(0)
    expect(somaDosBaldes(p), 'a soma dos baldes não fecha com as linhas lidas').toBe(txs.length)
  })

  /**
   * ⛔⛔⛔ O INVARIANTE QUE IMPORTA — e a 1ª versão dele era FORTE DEMAIS.
   *
   * ⚠️ Eu tinha escrito `Σ baldes == total de linhas`, e **em prod isso deu 562 de 592**. As
   * 30 que faltavam são de **AGOSTO, já nomeadas na rodada do PDF de agosto**: elas não são
   * pendência deste PDF nem foram alcançadas por ele, então **legitimamente não pertencem a
   * balde nenhum desta tela**. *Invariante que falha no caso legítimo é pior que invariante
   * nenhum — alguém "conserta" o DADO pra bater com a régua errada.*
   *
   * ⭐ O enunciado honesto é mais estreito e mais útil: ***nenhuma linha que ainda PODE
   * receber nome fica fora dos contadores***. Medido em prod: **66 aptos = 66 `outOfPeriod`
   * + 0 `noPdfLine`**, ao centavo.
   */
  it('⛔⛔⛔ nenhuma linha que ainda PODE receber nome fica invisível', () => {
    const txs: EnrichTx[] = [
      // apta, no período, o PDF a alcança → willReceive
      etx({ id: 'apta', date: new Date('2026-09-02T12:00:00Z'), externalId: '3EB0FE', amount: 403.83 }),
      // apta, mas de OUTRO mês → outOfPeriod (pede o PDF de junho)
      etx({ id: 'outroMes', date: new Date('2026-06-10T12:00:00Z'), externalId: 'XXXXXX', amount: 55 }),
      // apta, no período, o PDF NÃO traz nome pra ela → noPdfLine
      etx({ id: 'semLinha', date: new Date('2026-09-12T12:00:00Z'), externalId: 'YYYYYY', amount: 77 }),
      // ⭐ já nomeada e FORA do alcance deste PDF (o caso das 30 de agosto)
      etx({ id: 'agosto', date: new Date('2026-08-05T12:00:00Z'), externalId: 'ZZZZZZ', amount: 99, counterpartyName: 'ALGUÉM', counterpartySource: 'OFX' }),
    ]
    const p = buildEnrichmentPreview(parsed(pdfDosReais, '2026-09-01', '2026-09-30'), txs, { altKey: true })

    const aptas = txs.filter((t) => podeReceberNomeDoPdf({ ...t, description: t.description }).pode)
    expect(aptas.map((t) => t.id).sort()).toEqual(['apta', 'outroMes', 'semLinha'])
    const contadas = p.counts.willReceive + p.counts.ambiguousTx + p.counts.outOfPeriod + p.counts.noPdfLine
    expect(contadas, 'uma linha que ainda pode receber nome ficou fora dos contadores').toBe(aptas.length)
    expect(p.counts.willReceive).toBe(1)
    expect(p.counts.outOfPeriod).toBe(1)
    expect(p.counts.noPdfLine).toBe(1)

    /**
     * ⭐ E a já-nomeada-fora-do-alcance **não entra em balde nenhum, de propósito**: ela não
     * é pendência (tem nome) nem foi alcançada (está fora do período). Contá-la em
     * `jaResolvidas` faria a tela afirmar que ESTE PDF resolveu algo que ele nem viu.
     */
    expect(p.counts.jaResolvidas, 'a de agosto entrou como se este PDF a tivesse resolvido').toBe(0)
    expect(somaDosBaldes(p), 'a soma mudou de significado').toBe(txs.length - 1)
  })

  it('⛔ e com nome também vive num balde só', () => {
    const txs: EnrichTx[] = [
      etx({ id: 'a', date: new Date('2026-09-02T12:00:00Z'), externalId: '3EB0FE', amount: 403.83, counterpartyName: 'HUB', counterpartySource: 'OFX' }),
    ]
    const p = buildEnrichmentPreview(parsed(pdfDosReais, '2026-09-01', '2026-09-30'), txs, { altKey: true })
    expect(p.counts.jaResolvidas).toBe(1)
    expect(p.counts.noPdfLine + p.counts.notApplicable + p.counts.outOfPeriod).toBe(0)
  })

  it('⭐ sem período declarado, o progresso do recorte é NULL — não se inventa', () => {
    const semPeriodo = ({ bank: 'BANRISUL', period: null, header: { agencia: null, conta: null }, lines: pdfDosReais, errors: [] }) as unknown as ParsedBankStatement
    const p = buildEnrichmentPreview(semPeriodo, [], { altKey: true })
    expect(p.progressoNoPeriodo).toBeNull()
  })

  it('⭐ as puladas vêm ordenadas por DATA, com o selo em palavras', () => {
    const txs: EnrichTx[] = [
      etx({ id: 'c', date: new Date('2026-09-16T12:00:00Z'), externalId: 'C42BDB', amount: 521.8, counterpartyName: 'HUB', counterpartySource: 'OFX' }),
      etx({ id: 'a', date: new Date('2026-09-02T12:00:00Z'), externalId: '3EB0FE', amount: 403.83, counterpartyName: 'HUB', counterpartySource: 'OFX' }),
    ]
    const p = buildEnrichmentPreview(parsed(pdfDosReais, '2026-09-01', '2026-09-30'), txs, { altKey: true })
    expect(p.puladas.map((x) => x.date)).toEqual(['2026-09-02', '2026-09-16'])
    expect(p.puladas[0].selo).toMatch(/preservado/)
    expect(p.puladas[0].nomeDoPdf).toBe('HUB INSTITUICAO DE PAGAMENTO SA')
  })
})
