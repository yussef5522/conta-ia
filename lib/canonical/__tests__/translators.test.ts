// Sprint Rearquitetura-Import FASE 2 (13/08) — REGRA 3: executa os tradutores
// contra OFX no formato real de cada banco. Cobre as decisões que importam +
// o BUG de 13/08 (emprestimo 4.092,02 descartado por FITID).

import { describe, it, expect } from 'vitest'
import { toCanonical } from '../to-canonical'
import { CANONICAL_TRANSLATORS, translatorFromSpec } from '../translators'

// Helper: monta um STMTTRN.
const trn = (dt: string, amt: string, fitid: string, memo: string, name?: string) =>
  `<STMTTRN><TRNTYPE>${amt.startsWith('-') ? 'DEBIT' : 'CREDIT'}</TRNTYPE><DTPOSTED>${dt}</DTPOSTED>` +
  `<TRNAMT>${amt}</TRNAMT><FITID>${fitid}</FITID><MEMO>${memo}</MEMO>${name ? `<NAME>${name}</NAME>` : ''}</STMTTRN>`

const ofx = (opts: {
  bankId: string
  dtStart?: string
  dtEnd?: string
  balamt?: string
  dtAsOf?: string
  trns: string[]
}) =>
  `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>${opts.bankId}</BANKID><ACCTID>123</ACCTID></BANKACCTFROM>` +
  `<BANKTRANLIST>${opts.dtStart ? `<DTSTART>${opts.dtStart}</DTSTART>` : ''}${opts.dtEnd ? `<DTEND>${opts.dtEnd}</DTEND>` : ''}` +
  `${opts.trns.join('')}</BANKTRANLIST>` +
  `${opts.balamt ? `<LEDGERBAL><BALAMT>${opts.balamt}</BALAMT>${opts.dtAsOf ? `<DTASOF>${opts.dtAsOf}</DTASOF>` : ''}</LEDGERBAL>` : ''}` +
  `</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

describe('BANRISUL — o bug de 13/08 + as evidências', () => {
  // Extrato emitido 13/08: parcela de 11/08 (JÁ PAGA, FITID==YYMMDD) + cartão de
  // 17/08 (futuro de verdade) + uma linha normal.
  const raw = ofx({
    bankId: '041',
    dtStart: '20260801',
    dtEnd: '20260813',
    balamt: '-8349.33',
    dtAsOf: '20260813',
    trns: [
      trn('20260810', '-100.00', '260810X', 'PIX ENVIADO'),
      trn('20260811', '-4092.02', '260811', 'EMPRESTIMO'), // o bug: FITID==YYMMDD, mas JÁ SAIU
      trn('20260817', '-13779.73', '260817', 'PAGAMENTO CARTAO'), // futuro real
    ],
  })
  const c = toCanonical(raw)

  it('a parcela de 11/08 é EFETIVADA (não descartada) — o FITID NÃO decide status', () => {
    const emp = c.transactions.find((t) => t.signedAmount === -4092.02)!
    expect(emp.status).toBe('EFETIVADA') // 11/08 <= âncora 13/08
  })
  it('o cartão de 17/08 é AGENDADA (futuro real, > âncora)', () => {
    const cartao = c.transactions.find((t) => t.signedAmount === -13779.73)!
    expect(cartao.status).toBe('AGENDADA')
  })
  it('identidade = data+valor+descrição (NÃO o FITID que renumera)', () => {
    const emp = c.transactions.find((t) => t.signedAmount === -4092.02)!
    expect(emp.stableId).not.toBe('260811')
    expect(emp.stableId).toContain('2026-08-11')
    expect(emp.stableId).toContain('-4092.02')
  })
  it('Banrisul nunca traz favorecido (NAME==MEMO)', () => {
    expect(c.transactions.every((t) => t.counterpartyName === null)).toBe(true)
  })
  it('ledger + período vêm do arquivo', () => {
    expect(c.ledger.balance).toBe(-8349.33)
    expect(c.ledger.asOf!.toISOString().slice(0, 10)).toBe('2026-08-13')
    expect(c.conservative).toBe(false)
  })
})

describe('SICREDI — DTASOF no fim do mês não estraga a âncora', () => {
  const raw = ofx({
    bankId: '748',
    dtEnd: '20260831', // fim do mês, FUTURO
    balamt: '20717.97',
    dtAsOf: '20260831', // fim do mês, FUTURO
    trns: [
      trn('20260804', '-50.00', 'SIC1', 'PIX'),
      trn('20260806', '129.90', 'SIC2', 'RECEBIMENTO PIX FULANO', 'FULANO SILVA'),
    ],
  })
  const c = toCanonical(raw)
  it('âncora cai na última tx real (06/08), não no DTASOF 31/08 → tudo EFETIVADA', () => {
    expect(c.transactions.every((t) => t.status === 'EFETIVADA')).toBe(true)
  })
  it('identidade = FITID (quase estável) + ocorrência', () => {
    expect(c.transactions[0].stableId).toBe('SIC1#1')
  })
  it('favorecido do MEMO quando o parser separa (NAME != MEMO)', () => {
    const rec = c.transactions.find((t) => t.signedAmount === 129.9)!
    expect(rec.counterpartyName).toBe('FULANO SILVA')
  })
})

describe('STONE — FITID UUID estável + âncora DTASOF', () => {
  const raw = ofx({
    bankId: '197',
    dtEnd: '20260807',
    balamt: '105.50',
    dtAsOf: '20260807',
    trns: [trn('20260807', '-10.00', 'uuid-abc-123', 'PIX ENVIADO NOME', 'JOAO')],
  })
  const c = toCanonical(raw)
  it('identidade = FITID UUID', () => {
    expect(c.transactions[0].stableId).toBe('uuid-abc-123#1')
    expect(c.transactions[0].status).toBe('EFETIVADA')
    expect(c.conservative).toBe(false)
  })
})

describe('BANRISUL — colisão de identidade (2× CAPITALIZACAO RG no mesmo dia)', () => {
  // Caso real: 2 capitalizações de 70,02 no mesmo dia (docs 590242, 590243). São
  // REAIS distintas — a identidade data+valor+descrição colidiria; o desempate
  // por ocorrência separa (quase apagamos uma achando que era duplicata).
  const raw = ofx({
    bankId: '041', dtEnd: '20260807', balamt: '100', dtAsOf: '20260807',
    trns: [
      trn('20260807', '-70.02', '590242', 'CAPITALIZACAO RG'),
      trn('20260807', '-70.02', '590243', 'CAPITALIZACAO RG'),
    ],
  })
  const c = toCanonical(raw)
  it('as duas viram stableId DISTINTO (#1 e #2), não colidem', () => {
    expect(c.transactions).toHaveLength(2)
    expect(c.transactions[0].stableId).not.toBe(c.transactions[1].stableId)
    expect(c.transactions[0].stableId.endsWith('#1')).toBe(true)
    expect(c.transactions[1].stableId.endsWith('#2')).toBe(true)
    // e a base é a mesma (mesma data+valor+descrição)
    expect(c.transactions[0].stableId.split('#')[0]).toBe(c.transactions[1].stableId.split('#')[0])
  })
  it('o documento (FITID) preserva a distinção original do banco', () => {
    expect(c.transactions.map((t) => t.document).sort()).toEqual(['590242', '590243'])
  })
})

describe('CONSERVADOR — Caixa (104) e banco desconhecido', () => {
  it('Caixa cai no conservador + AVISO na tela', () => {
    const c = toCanonical(ofx({ bankId: '104', dtEnd: '20260804', balamt: '1000', dtAsOf: '20260804', trns: [trn('20260804', '-5.00', 'X', 'DEBITO')] }))
    expect(c.translatorId).toBe('CONSERVATIVE')
    expect(c.conservative).toBe(true)
    expect(c.warnings.some((w) => /conservadora/i.test(w))).toBe(true)
  })
  it('banco desconhecido (999) idem — nunca adivinha', () => {
    const c = toCanonical(ofx({ bankId: '999', dtEnd: '20260804', balamt: '1000', dtAsOf: '20260804', trns: [trn('20260804', '-5.00', 'X', 'X')] }))
    expect(c.conservative).toBe(true)
  })
})

describe('SEM RELÓGIO — o resultado só depende do arquivo', () => {
  const raw = ofx({ bankId: '041', dtEnd: '20260813', balamt: '-8349.33', dtAsOf: '20260813', trns: [trn('20260811', '-4092.02', '260811', 'EMPRESTIMO')] })
  it('duas traduções do MESMO arquivo dão resultado idêntico (nenhum now)', () => {
    expect(toCanonical(raw)).toEqual(toCanonical(raw))
  })
  it('DTASOF ausente → ledger.asOf NULL (não inventa "hoje") + avisa', () => {
    const semDtasof = ofx({ bankId: '041', dtEnd: '20260813', balamt: '-8349.33', trns: [trn('20260811', '-4092.02', '260811', 'EMPRESTIMO')] })
    const c = toCanonical(semDtasof)
    expect(c.ledger.asOf).toBeNull()
    expect(c.warnings.some((w) => /DTASOF/.test(w))).toBe(true)
  })
})

describe('spec vira translator por construção', () => {
  it('translatorFromSpec expõe id + conservative', () => {
    const t = translatorFromSpec(CANONICAL_TRANSLATORS.BANRISUL)
    expect(t.id).toBe('BANRISUL')
    expect(t.conservative).toBe(false)
  })
})
