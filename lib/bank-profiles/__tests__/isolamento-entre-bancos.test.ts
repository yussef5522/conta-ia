// ⛔⛔⛔ GUARD DE ISOLAMENTO ENTRE BANCOS — PROVADO, NÃO PROMETIDO (05/09/2026).
//
// **O QUE ESTE ARQUIVO EXISTE PRA IMPEDIR:** uma regra que nasceu do **Banrisul** vazar pro
// caminho comum e mudar, em silêncio, o resultado do Sicredi e do Stone. O módulo já pagou
// essa conta três vezes só neste sprint — a supressão do LEDGERBAL (que virou fóssil no gate
// do confirm), a canonização do histórico (que ia matar a regra de 851 aplicações do PIX do
// Sicredi) e a caixa "LEDGERBAL ausente" (uma flag, dois significados).
//
// ⭐ A RÉGUA É O RESULTADO, NÃO O CÓDIGO: as duas fixtures são **arquivos reais** que já
// funcionam em produção, e passam pelo **caminho completo** — parse → ficha do banco →
// âncora → partição do futuro → gate de saldo → estado da faixa. A tabela abaixo é o
// resultado de hoje, TRAVADO. Regra do Banrisul que escape pro comum muda alguma célula
// dela, e o teste morre **antes** do deploy.
//
//   |                    | Sicredi (748)      | Stone (197)     | (Banrisul, de fora)      |
//   | âncora             | LAST_REAL_TX       | DTASOF          | DTASOF                   |
//   | LEDGERBAL é régua? | SIM                | SIM             | NÃO (embute bloqueio)    |
//   | compara no gate?   | compara            | compara         | não compara              |
//   | faixa de saldo     | BATE/EXPLICADO     | BATE            | OCULTO                   |
//
// ⚠️ **REGRA 11** (`guard só conta depois de rodar contra o defeito que o motivou`): o último
// bloco LIGA de propósito a regra do Banrisul no caminho do Sicredi e do Stone e prova que a
// tabela acima **deixa de valer**. Sem esse bloco, este arquivo seria uma afirmação sobre o
// mundo bom — que é exatamente como três guards deste projeto nasceram verdes por cegueira.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseOFX } from '@/lib/ofx/parser'
import { partitionFutureLines } from '@/lib/ofx/future-line'
import { estadoDoBanner } from '@/lib/ofx/banner-ledgerbal'
import {
  resolveBankProfile,
  resolveStatementAnchor,
  podeConferirPorLedgerbal,
  avaliarFechamentoDeSaldo,
} from '@/lib/bank-profiles'

const fixture = (n: string) => readFileSync(join(__dirname, '..', '..', 'ofx', '__tests__', 'fixtures', n), 'latin1')

/**
 * ⚠️ `hoje` é PASSADO EXPLÍCITO, nunca o relógio: o resultado de um guard não pode depender
 * do dia em que a suíte roda (a cicatriz das datas fixas de 01/09). É o dia em que cada
 * arquivo foi baixado.
 */
function caminhoCompleto(ofx: string, hoje: Date) {
  const p = parseOFX(ofx)
  const ficha = resolveBankProfile(p.bankId ?? null)

  // ⭐ ESPELHA A PRODUÇÃO (route + orquestrador): última tx **≤ hoje**, nunca o máximo
  // absoluto — senão o próprio agendado empurraria a âncora e deixaria de ser futuro.
  const lastRealTxDate = p.transactions.reduce<Date | null>(
    (m, t) => (t.datePosted <= hoje && (m === null || t.datePosted > m) ? t.datePosted : m), null,
  )
  const anchor = resolveStatementAnchor(ficha, {
    dtAsOf: p.ledgerBalance?.asOfDate ?? null,
    dtEnd: p.statementEnd ?? null,
    lastRealTxDate,
    today: hoje,
  })

  const { realLines, futureLines } = partitionFutureLines(
    p.transactions.map((t) => ({ ...t, datePosted: t.datePosted })),
    anchor.anchor ?? hoje,
    hoje,
  )
  const assinado = (t: (typeof p.transactions)[number]) => (t.type === 'CREDIT' ? t.amount : -t.amount)
  const cent = (n: number) => Math.round(n * 100) / 100
  const somaReais = cent(realLines.reduce((s, t) => s + assinado(t), 0))
  const futurasSum = cent(futureLines.reduce((s, t) => s + assinado(t), 0))

  // o saldo que o import calcularia com as linhas reais dentro (o "antes" é derivado do
  // declarado, que é como o `recalcularSaldoConta` ancora — não é soma ingênua)
  const saldoCalculado = cent((p.ledgerBalance?.amount ?? 0) - futurasSum)

  const fechamento = avaliarFechamentoDeSaldo({
    ficha,
    nomeDoBanco: ficha?.displayName ?? null,
    saldoCalculado,
    ledgerBalance: p.ledgerBalance?.amount ?? null,
  })
  const banner = estadoDoBanner({
    temNoArquivo: p.ledgerBalance != null,
    ehReguaNesteBanco: podeConferirPorLedgerbal(ficha),
    bate: fechamento.ledgerBalMatched === true,
    explicadoPorFuturos: futurasSum !== 0,
  })

  return { p, ficha, anchor, realLines, futureLines, somaReais, futurasSum, saldoCalculado, fechamento, banner }
}

const SICREDI = () => caminhoCompleto(fixture('sicredi-futuro-real.ofx'), new Date('2026-09-05T12:00:00Z'))
const STONE = () => caminhoCompleto(fixture('stone-real.ofx'), new Date('2026-08-28T18:04:40Z'))

describe('⭐⭐ o caminho comum, ponta a ponta, nos dois bancos que NÃO são o Banrisul', () => {
  it('⭐ SICREDI: ficha, âncora e futuro — o arquivo real de 05/09', () => {
    const c = SICREDI()
    expect(c.ficha?.id).toBe('SICREDI')
    expect(c.p.transactions).toHaveLength(11)
    // a mania do Sicredi: DTASOF no FIM DO MÊS → a âncora TEM que ser a última tx real
    expect(c.p.ledgerBalance?.asOfDate.toISOString().slice(0, 10)).toBe('2026-09-30')
    expect(c.anchor.rule).toBe('LAST_REAL_TX')
    expect(c.anchor.anchor?.toISOString().slice(0, 10)).toBe('2026-09-04')
    expect(c.futureLines, 'o crédito agendado de 08/09').toHaveLength(1)
    expect(c.futurasSum).toBeCloseTo(7479.91, 2)
  })

  it('⭐ STONE: ficha, âncora e futuro — o arquivo real de 28/08', () => {
    const c = STONE()
    expect(c.ficha?.id).toBe('STONE')
    expect(c.p.transactions).toHaveLength(22)
    expect(c.p.ledgerBalance?.amount).toBeCloseTo(860.57, 2)
    // Stone NÃO lista futuro: DTASOF é o dia da emissão e a âncora é max(DTASOF, DTEND)
    expect(c.anchor.rule).toBe('DTASOF')
    expect(c.anchor.anchor?.toISOString().slice(0, 10)).toBe('2026-08-28')
    expect(c.futureLines, 'nada a descartar por data neste banco').toHaveLength(0)
    expect(c.somaReais, 'as 22 linhas do arquivo real').toBeCloseTo(-2783.02, 2)
  })

  it('⛔⛔ NOS DOIS o LEDGERBAL É RÉGUA — o gate COMPARA e RESPONDE', () => {
    for (const c of [SICREDI(), STONE()]) {
      expect(podeConferirPorLedgerbal(c.ficha), `${c.ficha?.id} deixou de conferir por saldo`).toBe(true)
      // ⭐ o que se trava aqui é o gate ter RESPOSTA. `null` é a marca do vazamento: é o que
      // o BANRISUL devolve ("não dá pra dizer por aqui"), e num banco de régua boa seria
      // jogar fora a conferência que funciona.
      expect(c.fechamento.ledgerBalMatched, `${c.ficha?.id} ficou sem resposta`).not.toBeNull()
      expect(c.fechamento.avisoSemSelo, 'aviso de "sem régua" é do Banrisul, não daqui').toBeNull()
    }
  })

  it('⭐ e a RESPOSTA de cada um é a certa: Stone fecha; Sicredi difere EXATAMENTE o agendado', () => {
    const stone = STONE()
    expect(stone.fechamento.ledgerBalMatched, 'sem futuro, o declarado é o previsto').toBe(true)
    expect(stone.fechamento.mismatch).toBeNull()

    // ⛔ no Sicredi NÃO fechar é o comportamento CERTO: o LEDGERBAL é do fim do mês e já
    // inclui o crédito de 08/09 que (corretamente) não importamos. Quem explica isso é a
    // faixa, não o gate — e a diferença tem que ser o futuro AO CENTAVO, nunca "algum" valor.
    const sic = SICREDI()
    expect(sic.fechamento.ledgerBalMatched).toBe(false)
    expect(sic.fechamento.mismatch?.diferenca).toBeCloseTo(-sic.futurasSum, 2)
  })

  it('⭐ a faixa de saldo aparece nos dois — OCULTO é estado do Banrisul', () => {
    expect(STONE().banner).toBe('BATE')
    // no Sicredi a diferença tem dono (o agendado que o banco já contou) → neutro, não susto
    expect(SICREDI().banner).toBe('EXPLICADO')
  })

  it('⛔ o parser não reescreve o memo de quem não tem a inversão do Banrisul', () => {
    // `corrigirInversao` roda pra TODO banco no parser; aqui ela não pode inventar nada
    const stone = STONE().p.transactions[0]
    expect(stone.memo).toBe('CLIENTE 01 - Pix | Maquininha')
    expect(stone.counterpartyName ?? null, 'o Stone não manda <NAME>; inventar seria pior').toBeNull()
    expect(SICREDI().p.transactions.some((t) => /RECEBIMENTO PIX/i.test(t.memo ?? ''))).toBe(true)
  })

  it('⭐ a ficha do Banrisul continua sendo a ÚNICA com o saldo declarado desqualificado', () => {
    const banrisul = resolveBankProfile('041')
    expect(podeConferirPorLedgerbal(banrisul)).toBe(false)
    // e as duas manias que existem SÓ por causa dele seguem cercadas pela ficha
    expect(banrisul?.counterpartySource).toBe('PDF_ONLY')
    expect(banrisul?.fitidStability).toBe('PER_DOWNLOAD')
    for (const id of ['748', '197']) {
      const f = resolveBankProfile(id)
      expect(f?.counterpartySource, `${id} caiu no fluxo de PDF do Banrisul`).toBe('MEMO')
      expect(f?.fitidStability, `${id} entrou na chave alternativa do Banrisul`).not.toBe('PER_DOWNLOAD')
    }
  })
})

describe('⛔⛔ REGRA 11 — ligando a regra do Banrisul de propósito, o guard MORDE', () => {
  /** a ficha do banco com a mania do Banrisul enxertada — o vazamento que se quer impedir */
  const comManiaDoBanrisul = (c: ReturnType<typeof SICREDI>) =>
    avaliarFechamentoDeSaldo({
      ficha: { ...c.ficha!, ledgerBalReliable: false },
      nomeDoBanco: c.ficha?.displayName ?? null,
      saldoCalculado: c.saldoCalculado,
      ledgerBalance: c.p.ledgerBalance?.amount ?? null,
    })

  it('⛔ supressão do LEDGERBAL vazando pro SICREDI: o selo morre e o gate para de comparar', () => {
    const c = SICREDI()
    const vazado = comManiaDoBanrisul(c)
    expect(vazado.ledgerBalMatched, 'o selo que o teste de cima trava').toBeNull()
    expect(vazado.ledgerBalMatched).not.toBe(c.fechamento.ledgerBalMatched)
    expect(vazado.avisoSemSelo, 'a frase do bloqueio de 24h num banco que não tem bloqueio').toMatch(/bloqueio de 24h/)
  })

  it('⛔ e no STONE: a faixa de saldo SOME da tela', () => {
    const c = STONE()
    const vazado = comManiaDoBanrisul(c)
    const banner = estadoDoBanner({
      temNoArquivo: true,
      ehReguaNesteBanco: podeConferirPorLedgerbal({ ledgerBalReliable: false }),
      bate: vazado.ledgerBalMatched === true,
    })
    expect(banner).toBe('OCULTO')
    expect(banner, 'a faixa que o teste de cima trava como BATE').not.toBe(c.banner)
  })

  it('⭐⭐ a ÂNCORA tem DUAS camadas — trocar a ficha do Sicredi pra DTASOF não move nada', () => {
    const c = SICREDI()
    const comFichaDoBanrisul = resolveStatementAnchor(
      { ...c.ficha!, dateAnchor: 'DTASOF' },
      {
        dtAsOf: c.p.ledgerBalance?.asOfDate ?? null,
        dtEnd: c.p.statementEnd ?? null,
        lastRealTxDate: new Date('2026-09-04T00:00:00Z'),
        today: new Date('2026-09-05T12:00:00Z'),
      },
    )
    // ⭐ a REGRA DURA GENERALIZADA ("DTASOF no futuro nunca é 'liquidado até aqui'") segura
    // sozinha: a ficha muda, a âncora NÃO. É a 2ª camada existindo de verdade, e é por isso
    // que este caso NÃO morde — a defesa não depende só do campo da ficha.
    expect(comFichaDoBanrisul.rule).toBe('FUTURE_FALLBACK')
    expect(comFichaDoBanrisul.anchor?.toISOString().slice(0, 10)).toBe('2026-09-04')
  })

  it('⛔⛔ mas SEM a âncora resolvida (ancorar no DTASOF cru) o agendado ENTRA como real', () => {
    const c = SICREDI()
    // este é o vazamento de verdade: usar `max(DTASOF, DTEND)` direto — que é a regra do
    // Banrisul e do Stone — no arquivo do Sicredi, sem passar pelo resolvedor.
    const cru = partitionFutureLines(
      c.p.transactions,
      c.p.ledgerBalance!.asOfDate,
      new Date('2026-09-05T12:00:00Z'),
    )
    expect(cru.futureLines, 'o descarte de futuro fica TOOTHLESS').toHaveLength(0)
    expect(cru.futureLines.length).not.toBe(c.futureLines.length)
    // ⛔ e o estrago tem número: R$ 7.479,91 de crédito que ainda não existe entrariam no
    // ledger como dinheiro realizado.
    expect(c.futurasSum).toBeCloseTo(7479.91, 2)
  })
})
