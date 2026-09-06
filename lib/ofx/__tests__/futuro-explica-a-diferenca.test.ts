// ⛔⛔ "NÃO IDENTIFIQUEI A CAUSA" COM A RESPOSTA NO PRÓPRIO PREVIEW (05/09/2026).
//
// **CASO REAL** (`sicredi_1788654879.ofx`, fixture anonimizada ao lado): o extrato lista um
// crédito FUTURO de **+R$ 7.479,91** (08/09) que **não é importado**, e o `<LEDGERBAL>` do
// Sicredi — declarado no **fim do mês** (DTASOF 30/09) — **já o inclui**. A tela cuspiu
// *"não identifiquei a causa"* com o número listado dois centímetros abaixo.
//
// ⛔ A CAUSA: o casamento era `|diff + futurasSum|`, e **diff e futurasSum têm o MESMO
// sinal** — a soma nunca zera. Com `diff = LEDGERBAL − saldoPrevisto`:
//     futuro de CRÉDITO (+X) → o banco inclui → diff = +X
//     futuro de DÉBITO  (−X) → o banco inclui → diff = −X
// O casamento é a **subtração**. O `+` só fecharia com sinais opostos, o que não ocorre.
//
// ⚠️ E SOBREVIVEU 27 DIAS PORQUE **NENHUM TESTE EXERCITAVA O RAMO** — ele nasceu em 09/08
// como "rede de segurança" e ninguém o rodou. É a anatomia dos guards que nascem verdes por
// construção (REGRA 11), agora do lado do explicador.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseOFX } from '../parser'
import { buildLedgerBalCheck } from '../preview-v2'
import { estadoDoBanner } from '../banner-ledgerbal'
import { resolveBankProfile, resolveStatementAnchor } from '@/lib/bank-profiles'

const OFX = readFileSync(join(__dirname, 'fixtures', 'sicredi-futuro-real.ofx'), 'latin1')

/** monta o cenário REAL: parse → âncora do perfil → partição do futuro → gate */
function cenario() {
  const p = parseOFX(OFX)
  const perfil = resolveBankProfile(p.bankId ?? null)
  // ⚠️ ESPELHA A PRODUÇÃO: `lastRealTx` é a maior data **≤ hoje** (é assim no route e no
  // orquestrador). Pegar o máximo absoluto incluiria o próprio agendado e a âncora andaria
  // pra frente — o futuro deixaria de ser futuro.
  // ⚠️ `hoje` é o dia em que o arquivo foi baixado (05/09), passado explícito: o relógio
  // nunca decide num teste.
  const hoje = new Date('2026-09-05T12:00:00Z')
  const lastRealTxDate = p.transactions.reduce<Date | null>(
    (m, t) => (t.datePosted <= hoje && (m === null || t.datePosted > m) ? t.datePosted : m), null,
  )
  const anchor = resolveStatementAnchor(perfil, {
    dtAsOf: p.ledgerBalance?.asOfDate ?? null,
    dtEnd: p.statementEnd ?? null,
    lastRealTxDate,
    today: hoje,
  })
  // ⚠️ compara por DIA, não por instante: o parser data a linha às 00:00 e a âncora é o
  // DIA da última tx real — comparar com hora deixaria as linhas do próprio dia de fora.
  // (É a mesma armadilha que em 01/09 tirou 10 tx de 31/07 do saldo por causa do meio-dia.)
  const diaDaAncora = anchor.anchor!.toISOString().slice(0, 10)
  const reais = p.transactions.filter((t) => t.datePosted.toISOString().slice(0, 10) <= diaDaAncora)
  const futuras = p.transactions.filter((t) => t.datePosted.toISOString().slice(0, 10) > diaDaAncora)
  const signed = (t: (typeof p.transactions)[number]) => (t.type === 'CREDIT' ? t.amount : -t.amount)
  const futurasSum = Math.round(futuras.reduce((s, t) => s + signed(t), 0) * 100) / 100
  // o saldo "antes" que faz a conta fechar com as reais dentro
  const balanceAtual = Math.round(((p.ledgerBalance!.amount - futurasSum) - reais.reduce((s, t) => s + signed(t), 0)) * 100) / 100
  return { p, perfil, anchor, reais, futuras, futurasSum, balanceAtual, signed }
}

describe('⭐⭐ o futuro do Sicredi explica a diferença', () => {
  const c = cenario()

  it('⭐ o arquivo é o real: 11 linhas, LEDGERBAL −72.016,52 e DTASOF no FIM DO MÊS', () => {
    expect(c.p.transactions).toHaveLength(11)
    expect(c.p.ledgerBalance?.amount).toBeCloseTo(-72016.52, 2)
    expect(c.p.ledgerBalance?.asOfDate.toISOString().slice(0, 10), 'a mania do Sicredi').toBe('2026-09-30')
  })

  it('⭐⭐ a âncora é a ÚLTIMA TX REAL (não o DTASOF) e o futuro de 08/09 fica de fora', () => {
    expect(c.anchor.rule).toBe('LAST_REAL_TX')
    expect(c.anchor.anchor!.toISOString().slice(0, 10)).toBe('2026-09-04')
    expect(c.futuras).toHaveLength(1)
    expect(c.futurasSum, 'o crédito futuro da adquirente').toBeCloseTo(7479.91, 2)
  })

  it('⛔⛔ a diferença é EXATAMENTE o futuro — e o gate reconhece', () => {
    const check = buildLedgerBalCheck({
      ledgerBalance: c.p.ledgerBalance!,
      balanceAtual: c.balanceAtual,
      novasGenuinas: c.reais.map((t, i) => ({ ofxIndex: i, amount: t.amount, date: t.datePosted.toISOString(), memo: t.memo, type: t.type, fitid: t.fitid, dedupHash: `h${i}` })),
      conciliatePayable: [],
      futurasSum: c.futurasSum,
      futurasQtd: c.futuras.length,
    })
    expect(check.bate, 'o saldo declarado inclui o agendado — não bate, e está certo').toBe(false)
    expect(check.diff).toBeCloseTo(7479.91, 2)

    const h = check.hipoteses.find((x) => x.tipo === 'linhas_futuras')
    expect(h, '"não identifiquei a causa" com a resposta no próprio preview').toBeDefined()
    expect(h!.maisProvavel, 'a causa certa tem que LIDERAR').toBe(true)
  })

  it('⭐⭐ a frase é NEUTRA e diz que a conta fecha sozinha — não é susto', () => {
    const check = buildLedgerBalCheck({
      ledgerBalance: c.p.ledgerBalance!, balanceAtual: c.balanceAtual,
      novasGenuinas: c.reais.map((t, i) => ({ ofxIndex: i, amount: t.amount, date: t.datePosted.toISOString(), memo: t.memo, type: t.type, fitid: t.fitid, dedupHash: `h${i}` })),
      conciliatePayable: [], futurasSum: c.futurasSum, futurasQtd: 1,
    })
    const label = check.hipoteses.find((x) => x.tipo === 'linhas_futuras')!.label
    expect(label).toMatch(/JÁ INCLUI/)
    expect(label).toMatch(/7\.479,91/)
    expect(label).toMatch(/fecha sozinha/)
    expect(label, 'a frase que mandou o dono caçar um problema inexistente').not.toMatch(/não identifiquei/i)

    // ⭐ e a TELA sai do vermelho: estado próprio, tom neutro
    expect(estadoDoBanner({ temNoArquivo: true, ehReguaNesteBanco: true, bate: false, explicadoPorFuturos: true })).toBe('EXPLICADO')
    expect(estadoDoBanner({ temNoArquivo: true, ehReguaNesteBanco: true, bate: false, explicadoPorFuturos: false })).toBe('NAO_BATE')
  })

  it('⛔ e o ramo vale nos DOIS sinais — foi o erro que passou 27 dias', () => {
    const base = {
      ledgerBalance: { amount: 1000, asOfDate: new Date('2026-09-30T00:00:00Z') },
      novasGenuinas: [], conciliatePayable: [],
    }
    // futuro de CRÉDITO: o banco declara 1000 e nós prevemos 900 → diff +100 = futurasSum
    const credito = buildLedgerBalCheck({ ...base, balanceAtual: 900, futurasSum: 100, futurasQtd: 1 })
    expect(credito.hipoteses.some((h) => h.tipo === 'linhas_futuras')).toBe(true)
    // futuro de DÉBITO: o banco declara 1000 e nós prevemos 1100 → diff −100 = futurasSum
    const debito = buildLedgerBalCheck({ ...base, balanceAtual: 1100, futurasSum: -100, futurasQtd: 1 })
    expect(debito.hipoteses.some((h) => h.tipo === 'linhas_futuras')).toBe(true)
  })

  it('⛔ diferença que NÃO é o futuro continua sem explicação — o alarme não virou carimbo', () => {
    const outro = buildLedgerBalCheck({
      ledgerBalance: { amount: 1000, asOfDate: new Date('2026-09-30T00:00:00Z') },
      balanceAtual: 500, novasGenuinas: [], conciliatePayable: [], futurasSum: 100, futurasQtd: 1,
    })
    expect(outro.hipoteses.some((h) => h.tipo === 'linhas_futuras'), 'explicou o que não sabe').toBe(false)
  })
})
