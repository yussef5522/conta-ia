// ⭐⭐ CATÁLOGO DE MANIAS DO BANRISUL (29/08/2026) — a peça ANTI-REGRESSÃO.
//
// Toda mania conhecida deste banco vira um caso aqui. **Mexeu no import, o catálogo inteiro
// roda de novo** — é o que impede uma correção nova de reabrir um buraco velho, que foi
// exatamente o que aconteceu com a heurística de FITID (nasceu resolvendo um caso de 11/06,
// armou, e explodiu num débito real de R$ 2.444,62 em 26/08).
//
// ⚠️ AS FIXTURES SÃO DERIVADAS DOS BLOBS REAIS mas escritas à mão, com os VALORES reais e
// os memos genéricos do banco. Nome de pessoa (que aparece em "PIX ENVIADO … <NOME>") NÃO
// entra: é dado pessoal de terceiro sob LGPD, e nenhuma decisão do parser depende dele.
// ⚠️ O que NÃO pode ser trocado: as palavras que o parser usa pra DECIDIR e o formato dos
// campos declarados (FITID, DTPOSTED, TRNAMT, DTASOF) — anonimizar isso já quebrou fixture
// duas vezes na fatura PF.

import { describe, it, expect } from 'vitest'
import { parseOFX } from '../parser'
import { partitionFutureLines, settledThroughDate } from '../future-line'
import { stableKey } from '@/lib/reconciliation/stable-key'
import { normalizeExact } from '@/lib/ai-categorizer/normalize'
import { conciliarDestinos } from '../conciliar-destinos'

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/** monta um OFX no dialeto SGML do Banrisul (é assim que os arquivos reais vêm) */
function ofxBanrisul(opts: { dtStart: string; dtEnd: string; dtAsOf: string; saldo: number; linhas: { data: string; valor: number; memo: string; fitid: string }[] }) {
  const trn = opts.linhas.map((l) => `<STMTTRN>
<TRNTYPE>${l.valor >= 0 ? 'CREDIT' : 'DEBIT'}
<DTPOSTED>${l.data}120000[-3:BRT]
<TRNAMT>${l.valor.toFixed(2)}
<FITID>${l.fitid}
<MEMO>${l.memo}
</STMTTRN>`).join('\n')
  return `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>041<ACCTID>06055341<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>${opts.dtStart}<DTEND>${opts.dtEnd}
${trn}
</BANKTRANLIST>
<LEDGERBAL><BALAMT>${opts.saldo.toFixed(2)}<DTASOF>${opts.dtAsOf}</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
}

describe('MANIA 1 — FITID no formato da data (o que comeu R$ 2.444,62)', () => {
  const ofx = ofxBanrisul({
    dtStart: '20260826', dtEnd: '20260828', dtAsOf: '20260828', saldo: -1267.03,
    linhas: [
      { data: '20260826', valor: -2444.62, memo: 'EMPRESTIMO', fitid: '260826' }, // FITID == YYMMDD
      { data: '20260826', valor: 3965.48, memo: 'OP. CREDITO C/GARANTIA', fitid: '000001' },
    ],
  })

  it('⭐⭐ a linha de empréstimo é REAL — formato de identificador não decide destino', () => {
    const p = parseOFX(ofx)
    expect(p.transactions).toHaveLength(2)
    const { realLines, futureLines } = partitionFutureLines(
      p.transactions.map((t) => ({ datePosted: t.datePosted, fitid: t.fitid, memo: t.memo })),
      D('2026-08-28'),
    )
    expect(realLines).toHaveLength(2)
    expect(futureLines).toHaveLength(0)
  })
})

describe('MANIA 2 — grafia dupla OP.CREDITO / OP. CREDITO (no MESMO arquivo)', () => {
  it('⭐ as duas grafias normalizam igual, então UMA regra pega as duas', () => {
    // real: dias 25-27 com espaço, dia 28 sem — conferido no Extrato_20260828.ofx
    expect(normalizeExact('OP. CREDITO C/GARANTIA')).toBe(normalizeExact('OP.CREDITO C/GARANTIA'))
  })

  it('⚠️ mas continuam sendo LINHAS distintas (a grafia não funde transações)', () => {
    const a = stableKey({ date: D('2026-08-27'), signedAmount: 6976.93, memo: 'OP. CREDITO C/GARANTIA' })
    const b = stableKey({ date: D('2026-08-28'), signedAmount: 7549.18, memo: 'OP.CREDITO C/GARANTIA' })
    expect(a).not.toBe(b)
  })
})

describe('MANIA 3 — FITID renumerado entre downloads (fitidStability: PER_DOWNLOAD)', () => {
  it('⭐ a mesma linha, com FITID diferente nos dois arquivos, tem a MESMA chave', () => {
    const chave = (fitid: string) => {
      const p = parseOFX(ofxBanrisul({
        dtStart: '20260901', dtEnd: '20260910', dtAsOf: '20260910', saldo: 0,
        linhas: [{ data: '20260909', valor: -1478.51, memo: 'PAGAMENTO CONSORCIO', fitid }],
      }))
      const t = p.transactions[0]
      return stableKey({ date: t.datePosted, signedAmount: t.type === 'CREDIT' ? t.amount : -t.amount, memo: t.memo })
    }
    expect(chave('150023')).toBe(chave('907731')) // renumerou, não duplica
  })
})

describe('MANIA 4 — agendado no MEIO do extrato (o consórcio de 09/09)', () => {
  const ofx = ofxBanrisul({
    dtStart: '20260801', dtEnd: '20260828', dtAsOf: '20260828', saldo: -1267.03,
    linhas: [
      { data: '20260828', valor: 7549.18, memo: 'OP.CREDITO C/GARANTIA', fitid: '016182' },
      { data: '20260909', valor: -1478.51, memo: 'PAGAMENTO CONSORCIO', fitid: '150023' }, // futuro
      { data: '20260828', valor: 417.82, memo: 'ANTECIP STONE', fitid: '008913' },
    ],
  })

  it('⭐ só a de data futura sai, e as reais NÃO são afetadas pela ordem', () => {
    const p = parseOFX(ofx)
    const ancora = settledThroughDate(p.ledgerBalance!.asOfDate, p.statementEnd ?? null)!
    const { realLines, futureLines } = partitionFutureLines(
      p.transactions.map((t) => ({ datePosted: t.datePosted, fitid: t.fitid, memo: t.memo })), ancora,
    )
    expect(realLines).toHaveLength(2)
    expect(futureLines.map((f) => f.memo)).toEqual(['PAGAMENTO CONSORCIO'])
  })
})

describe('MANIA 5 — LEDGERBAL é a âncora (e o DTASOF pode ser < DTEND)', () => {
  it('⭐ a âncora é max(DTASOF, DTEND) — DTASOF curto não descarta linha real', () => {
    const p = parseOFX(ofxBanrisul({
      dtStart: '20260801', dtEnd: '20260828', dtAsOf: '20260827', saldo: -1267.03,
      linhas: [{ data: '20260828', valor: 417.82, memo: 'ANTECIP STONE', fitid: '008913' }],
    }))
    const ancora = settledThroughDate(p.ledgerBalance!.asOfDate, p.statementEnd ?? null)!
    expect(ancora.toISOString().slice(0, 10)).toBe('2026-08-28')
    const { realLines } = partitionFutureLines(
      p.transactions.map((t) => ({ datePosted: t.datePosted, fitid: t.fitid })), ancora,
    )
    expect(realLines).toHaveLength(1) // com âncora 27 ela sumiria
  })

  it('o saldo declarado é lido do arquivo, não inferido', () => {
    const p = parseOFX(ofxBanrisul({ dtStart: '20260801', dtEnd: '20260828', dtAsOf: '20260828', saldo: -1267.03, linhas: [] }))
    expect(p.ledgerBalance?.amount).toBe(-1267.03)
    expect(p.ledgerBalance?.asOfDate.toISOString().slice(0, 10)).toBe('2026-08-28')
  })
})

describe('MANIA 6 — export de MESMO DIA pode vir incompleto', () => {
  it('⚠️ o arquivo é lido como está; quem acusa a falta é o LEDGERBAL, não um palpite', () => {
    // o banco declara -1.267,03 mas só lista parte das linhas: a soma NÃO fecha, e é isso
    // que tem que aparecer — o parser não inventa linha nem "corrige" o saldo.
    const p = parseOFX(ofxBanrisul({
      dtStart: '20260826', dtEnd: '20260828', dtAsOf: '20260828', saldo: -1267.03,
      linhas: [{ data: '20260826', valor: 3965.48, memo: 'OP. CREDITO C/GARANTIA', fitid: '000001' }],
    }))
    expect(p.transactions).toHaveLength(1)
    expect(p.ledgerBalance?.amount).toBe(-1267.03)
  })
})

describe('⭐ INVARIANTE DO PARSER — nenhum bloco do arquivo evapora', () => {
  it('blocos == parseadas + erros, em arquivo bom', () => {
    const p = parseOFX(ofxBanrisul({
      dtStart: '20260826', dtEnd: '20260828', dtAsOf: '20260828', saldo: -1267.03,
      linhas: [
        { data: '20260826', valor: -2444.62, memo: 'EMPRESTIMO', fitid: '260826' },
        { data: '20260827', valor: 6976.93, memo: 'OP. CREDITO C/GARANTIA', fitid: '000032' },
        { data: '20260909', valor: -1478.51, memo: 'PAGAMENTO CONSORCIO', fitid: '150023' },
      ],
    }))
    expect(p.totalBlocos).toBe(3)
    expect(p.transactions.length + p.errors.length).toBe(p.totalBlocos)
  })

  it('⭐⭐ e a conciliação de destinos fecha ponta a ponta', () => {
    const p = parseOFX(ofxBanrisul({
      dtStart: '20260826', dtEnd: '20260828', dtAsOf: '20260828', saldo: -1267.03,
      linhas: [
        { data: '20260826', valor: -2444.62, memo: 'EMPRESTIMO', fitid: '260826' },
        { data: '20260909', valor: -1478.51, memo: 'PAGAMENTO CONSORCIO', fitid: '150023' },
      ],
    }))
    const { realLines, futureLines } = partitionFutureLines(
      p.transactions.map((t) => ({ datePosted: t.datePosted, fitid: t.fitid })), D('2026-08-28'),
    )
    const r = conciliarDestinos({
      totalNoArquivo: p.totalBlocos, novas: realLines.length, jaExistem: 0,
      futuras: futureLines.length, ignoradas: 0, ilegiveis: p.errors.length,
    })
    expect(r.fecha).toBe(true)
    expect(r.resumo).toContain('2 linhas no arquivo')
  })

  it('⚠️ linha ilegível NÃO some: cai no balde de erros e a conta continua fechando', () => {
    const quebrado = ofxBanrisul({
      dtStart: '20260826', dtEnd: '20260828', dtAsOf: '20260828', saldo: 0,
      linhas: [{ data: '20260826', valor: -2444.62, memo: 'EMPRESTIMO', fitid: '260826' }],
    }).replace('<TRNAMT>-2444.62\n', '') // o banco mandou a linha sem valor
    const p = parseOFX(quebrado)
    expect(p.totalBlocos).toBe(1)
    expect(p.transactions).toHaveLength(0)
    expect(p.errors).toHaveLength(1)
    const r = conciliarDestinos({ totalNoArquivo: p.totalBlocos, novas: 0, jaExistem: 0, futuras: 0, ignoradas: 0, ilegiveis: p.errors.length })
    expect(r.fecha).toBe(true)
    expect(r.resumo).toContain('1 ilegível no arquivo')
  })
})
