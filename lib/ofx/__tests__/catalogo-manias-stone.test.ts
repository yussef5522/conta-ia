// ⭐⭐ CATÁLOGO DE MANIAS DO STONE (29/08/2026) — irmão do catálogo do Banrisul.
//
// Mesma disciplina: toda mania conhecida deste banco vira um caso aqui, e **mexeu no
// import, o catálogo inteiro roda de novo**.
//
// ⭐⭐ A MANIA QUE ABRIU O CATÁLOGO — **MEMO DE BANCO MENTE.** O Stone escreve
// `"<NOME> - Transferência|Pix"` em TODO PIX, seja ele transferência entre contas próprias
// ou pagamento a uma pessoa. A palavra "Transferência" ali é o NOME DO PRODUTO do banco,
// não a natureza do lançamento.
//
// ⚠️ E quem caiu nessa fui EU, numa auditoria de 29/08: agrupei 3 PIX do Stone como
// "transferência" porque o memo dizia isso — eram pagamentos a pessoas físicas. O dono
// corrigiu. É a mesma família do que o CLAUDE.md já registra em outro lugar: *"DESCRIÇÃO
// LIVRE NÃO É FONTE DE VERDADE, a CATEGORIA é"* e *"não inventar a intenção por trás do
// dado do dono"* — e do princípio duro do import: **heurística sobre texto livre pode
// SUGERIR, nunca DECIDIR.**
//
// O que decide é ESTRUTURA: CNPJ próprio no memo (documento, camada 1), nome de sócio
// cadastrado (camada 2), par de pernas em contas próprias. Nunca a palavra.
//
// ⚠️ FIXTURES derivadas dos arquivos reais, escritas à mão: valores e formato dos campos
// declarados são reais; **nome de pessoa é fictício** (dado pessoal de terceiro, LGPD — e
// nenhuma decisão depende do nome específico, só de HAVER nome).

import { describe, it, expect } from 'vitest'
import { parseOFX } from '../parser'
import { partitionFutureLines, settledThroughDate } from '../future-line'
import { stableKey } from '@/lib/reconciliation/stable-key'
import { classifyTransferPair, type UnifiedTx } from '@/lib/transfers/unified-transfer-engine'
import { resolveBankProfile } from '@/lib/bank-profiles/registry'

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

/** OFX no dialeto do Stone: BANKID 0197, ACCTID formatado com hífen, FITID UUID. */
function ofxStone(opts: {
  dtStart: string
  dtEnd: string
  dtAsOf: string
  saldo: number
  linhas: { data: string; valor: number; memo: string; fitid: string }[]
}) {
  const trn = opts.linhas
    .map(
      (l) => `<STMTTRN>
<TRNTYPE>${l.valor >= 0 ? 'CREDIT' : 'DEBIT'}
<DTPOSTED>${l.data}120000
<TRNAMT>${l.valor.toFixed(2)}
<FITID>${l.fitid}
<MEMO>${l.memo}
</STMTTRN>`,
    )
    .join('\n')
  return `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>0197<ACCTID>22155748-1<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>${opts.dtStart}<DTEND>${opts.dtEnd}
${trn}
</BANKTRANLIST>
<LEDGERBAL><BALAMT>${opts.saldo.toFixed(2)}<DTASOF>${opts.dtAsOf}</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`
}

// A empresa e os sócios de referência (os mesmos IDs/nomes que o motor recebe em prod).
const REFS = {
  cnpj: '29756732000198',
  names: ['CACULA MIX'],
  accountNames: ['stone', 'banrisul', 'sicredi'],
  ownerCpfs: [],
  ownerNames: ['YUSSEF ABU ZAHRY MUSA'],
}
const OPTS = { refs: REFS, matchOwnerName: true, valoresComuns: new Set<number>() }

const tx = (o: Partial<UnifiedTx> & { id: string; bankAccountId: string; amount: number; type: string; description: string }): UnifiedTx => ({
  date: D('2026-08-24'),
  ...o,
} as UnifiedTx)

// ─────────────────────────────────────────────────────────────────────────────
describe('⭐⭐ MANIA 1 — o memo diz "Transferência|Pix" em TUDO (memo de banco MENTE)', () => {
  // Os dois lançamentos abaixo têm o MESMO texto de produto no memo. Um é transferência
  // entre contas próprias; o outro é pagamento a uma pessoa. Só a ESTRUTURA distingue.
  const PAGAMENTO_A_PESSOA = 'MARIA DA SILVA SOUZA - Transferência|Pix'
  const TRANSFERENCIA_PROPRIA = 'CACULA MIX 29756732000198 - Transferência|Pix'

  it('⭐⭐ pagamento a PESSOA não vira par, mesmo com a palavra "Transferência" no memo', () => {
    const saida = tx({ id: 'd1', bankAccountId: 'banrisul', amount: 3000, type: 'DEBIT', description: 'PIX ENVIADO' })
    const entrada = tx({ id: 'c1', bankAccountId: 'stone', amount: 3000, type: 'CREDIT', description: PAGAMENTO_A_PESSOA })

    const r = classifyTransferPair(saida, entrada, OPTS)
    // pode até virar candidato de camada fraca (mesmo valor, mesmo dia), mas NUNCA é
    // sugerido sozinho: há nome de terceiro e nenhum sinal de entidade própria.
    expect(r?.autoSuggest ?? false).toBe(false)
    expect(r?.signals.thirdPartyName ?? true).toBe(true)
    expect(r?.signals.ownEntity ?? false).toBe(false)
  })

  it('⭐⭐ a MESMA frase COM o CNPJ próprio é transferência — camada 1, determinística', () => {
    const saida = tx({ id: 'd2', bankAccountId: 'banrisul', amount: 25000, type: 'DEBIT', description: 'PIX ENVIADO CACULA MIX' })
    const entrada = tx({ id: 'c2', bankAccountId: 'stone', amount: 25000, type: 'CREDIT', description: TRANSFERENCIA_PROPRIA })

    const r = classifyTransferPair(saida, entrada, OPTS)
    expect(r).not.toBeNull()
    expect(r!.layer).toBe('DETERMINISTIC')
    expect(r!.signals.ownEntity).toBe(true)
    expect(r!.autoSuggest).toBe(true)
  })

  it('⚠️ O ERRO QUE EU COMETI, escrito como contrafactual: a palavra sozinha classifica ERRADO', () => {
    // foi exatamente isto que eu fiz na auditoria — /transfer/i sobre a descrição.
    const heuristicaIngenua = (memo: string) => /transfer/i.test(memo)

    // o pagamento a pessoa e a transferência real dão o MESMO resultado pela palavra:
    expect(heuristicaIngenua(PAGAMENTO_A_PESSOA)).toBe(true)
    expect(heuristicaIngenua(TRANSFERENCIA_PROPRIA)).toBe(true)
    // ⭐ ou seja: o texto NÃO carrega a informação. Quem separa é o motor, pela estrutura.
    const pessoa = classifyTransferPair(
      tx({ id: 'd3', bankAccountId: 'banrisul', amount: 3000, type: 'DEBIT', description: 'PIX ENVIADO' }),
      tx({ id: 'c3', bankAccountId: 'stone', amount: 3000, type: 'CREDIT', description: PAGAMENTO_A_PESSOA }),
      OPTS,
    )
    const propria = classifyTransferPair(
      tx({ id: 'd4', bankAccountId: 'banrisul', amount: 25000, type: 'DEBIT', description: 'PIX ENVIADO CACULA MIX' }),
      tx({ id: 'c4', bankAccountId: 'stone', amount: 25000, type: 'CREDIT', description: TRANSFERENCIA_PROPRIA }),
      OPTS,
    )
    expect(propria!.autoSuggest).toBe(true)
    expect(pessoa?.autoSuggest ?? false).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('MANIA 2 — favorecido vem no MEMO (não precisa de PDF), e o nome de SÓCIO é camada 2', () => {
  it('o perfil do banco declara counterpartySource=MEMO', () => {
    const p = resolveBankProfile('0197')
    expect(p?.id).toBe('STONE')
    expect(p?.counterpartySource).toBe('MEMO')
  })

  it('⭐ nome do sócio no memo (sem CNPJ) sugere, mas em camada 2 — não vira determinística', () => {
    // o caso real: a perna que chega no Stone traz o NOME do dono, não o CNPJ.
    const r = classifyTransferPair(
      tx({ id: 'd5', bankAccountId: 'banrisul', amount: 17000, type: 'DEBIT', description: 'PIX ENVIADO' }),
      tx({ id: 'c5', bankAccountId: 'stone', amount: 17000, type: 'CREDIT', description: 'YUSSEF ABU ZAHRY MUSA - Transferência|Pix' }),
      OPTS,
    )
    expect(r).not.toBeNull()
    expect(r!.layer).toBe('STRONG')
    expect(r!.autoSuggest).toBe(true)
    // ⚠️ camada 1 é reservada ao documento (CNPJ/CPF) — nome não promove.
    expect(r!.signals.ownEntity).toBe(false)
  })

  it('⚠️ HOMÔNIMO não passa por sócio — o nome tem que ser o COMPLETO cadastrado', () => {
    const r = classifyTransferPair(
      tx({ id: 'd6', bankAccountId: 'banrisul', amount: 900, type: 'DEBIT', description: 'PIX ENVIADO' }),
      tx({ id: 'c6', bankAccountId: 'stone', amount: 900, type: 'CREDIT', description: 'YUSSEF NEDAL PEREIRA - Transferência|Pix' }),
      OPTS,
    )
    expect(r?.autoSuggest ?? false).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('MANIA 3 — FITID é UUID ESTÁVEL (o oposto do Banrisul), e mesmo assim a dedup não usa', () => {
  const linhas = [
    { data: '20260824', valor: -3000.0, memo: 'MARIA DA SILVA SOUZA - Transferência|Pix', fitid: '7c1f2a10-9b3e-4d55-8a21-0f6e5c4b3a2d' },
    { data: '20260824', valor: 25000.0, memo: 'CACULA MIX 29756732000198 - Transferência|Pix', fitid: 'b2e4d6f8-1234-4c9a-9e77-aa11bb22cc33' },
  ]
  const ofx = ofxStone({ dtStart: '20260824', dtEnd: '20260824', dtAsOf: '20260824', saldo: 240.19, linhas })

  it('o perfil declara FITID STABLE — por isso o Stone NUNCA entra na chave alternativa do enriquecimento', () => {
    expect(resolveBankProfile('0197')?.fitidStability).toBe('STABLE')
  })

  it('⭐ a identidade da linha continua sendo data+valor+memo — FITID não entra', () => {
    const p = parseOFX(ofx)
    expect(p.transactions).toHaveLength(2)
    const k = stableKey({ date: p.transactions[0].datePosted, signedAmount: -3000, memo: linhas[0].memo })
    // mesmo lançamento com OUTRO fitid (hipótese) daria a MESMA chave
    const kOutroFitid = stableKey({ date: D('2026-08-24'), signedAmount: -3000, memo: linhas[0].memo })
    expect(k).toBe(kOutroFitid)
    expect(k).not.toContain('7c1f2a10')
  })

  it('ACCTID vem FORMATADO com hífen — a trava de conta tem que normalizar', () => {
    const p = parseOFX(ofx)
    expect(p.accountId).toContain('-')
    expect(resolveBankProfile('0197')?.acctIdFormat).toBe('FORMATTED')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('MANIA 4 — Stone NÃO lista futuro: a âncora é o próprio dia da emissão', () => {
  it('nada é descartado por data num extrato do Stone bem-formado', () => {
    const ofx = ofxStone({
      dtStart: '20260820',
      dtEnd: '20260824',
      dtAsOf: '20260824',
      saldo: 240.19,
      linhas: [
        { data: '20260822', valor: -122.37, memo: 'PAGAMENTO - Pix', fitid: 'aa11' },
        { data: '20260824', valor: 25000.0, memo: 'CACULA MIX 29756732000198 - Transferência|Pix', fitid: 'bb22' },
      ],
    })
    const p = parseOFX(ofx)
    const ancora = settledThroughDate(p.ledgerBalance?.asOfDate ?? null, p.statementEnd ?? null)
    const { realLines, futureLines } = partitionFutureLines(
      p.transactions.map((t) => ({ datePosted: t.datePosted, fitid: t.fitid, memo: t.memo })),
      ancora!,
    )
    expect(futureLines).toHaveLength(0)
    expect(realLines).toHaveLength(2)
    expect(resolveBankProfile('0197')?.listsFutureMovements).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('MANIA 5 — dois downloads do MESMO dia divergem (o "70k" aberto desde 12/08)', () => {
  // ⚠️ Mania REGISTRADA, não resolvida: 07/08 tem dois arquivos com saldo diferente
  // (7.605,88 × 105,50). Aqui o catálogo trava o que JÁ é verdade — que as linhas
  // repetidas entre os dois arquivos têm a MESMA identidade e não podem duplicar.
  it('⭐ a linha repetida nos dois downloads dá a MESMA stableKey (não duplica)', () => {
    const linha = { data: '20260807', valor: -122.37, memo: 'PAGAMENTO - Pix', fitid: 'aa11' }
    const dl1 = parseOFX(ofxStone({ dtStart: '20260801', dtEnd: '20260807', dtAsOf: '20260807', saldo: 7605.88, linhas: [linha] }))
    const dl2 = parseOFX(ofxStone({ dtStart: '20260807', dtEnd: '20260807', dtAsOf: '20260807', saldo: 105.5, linhas: [linha] }))
    const k1 = stableKey({ date: dl1.transactions[0].datePosted, signedAmount: -122.37, memo: linha.memo })
    const k2 = stableKey({ date: dl2.transactions[0].datePosted, signedAmount: -122.37, memo: linha.memo })
    expect(k1).toBe(k2)
  })

  it('⚠️ e os DOIS declaram LEDGERBAL diferente pro mesmo dia — quem decide não é o arquivo mais novo', () => {
    const dl1 = parseOFX(ofxStone({ dtStart: '20260801', dtEnd: '20260807', dtAsOf: '20260807', saldo: 7605.88, linhas: [] }))
    const dl2 = parseOFX(ofxStone({ dtStart: '20260807', dtEnd: '20260807', dtAsOf: '20260807', saldo: 105.5, linhas: [] }))
    expect(dl1.ledgerBalance?.amount).not.toBe(dl2.ledgerBalance?.amount)
    // o desempate é problema do juiz (série B / conciliação de destinos), não do parser:
    // o parser reporta o declarado, sem escolher.
  })
})
