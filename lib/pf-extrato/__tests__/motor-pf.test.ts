// ⛔⛔⛔ O MESMO DINHEIRO NUNCA ENTRA DUAS VEZES NA PF (13/09/2026)
//
// **A régua que o dono confirmou:** *"a linha do extrato é o FATO, a tx da ponte é o
// REGISTRO do mesmo fato — o import CASA com a ponte existente, NUNCA cria segunda."*
//
// **O caso real, medido antes de existir código:** o perfil tem **84 pontes PJ→PF** e as três
// transferências de setembro (10.000 · 3.500 · 21.000) já vivem na PF como crédito criado
// pela ponte, `origin: MANUAL` e **sem `dedupHash`**. Sem esta régua, o primeiro OFX do
// banrisul PF criaria as três de novo.

import { describe, it, expect } from 'vitest'
import { desfechoDaLinha, planoDoExtrato, JANELA_DE_CASAMENTO_DIAS, type LinhaDoExtrato, type TxExistente } from '../casar-com-existente'
import { conferirSaldo, reconhecerPagamentoDeFatura, ehAmbiguo, type FaturaAberta } from '../conferencia-e-fatura'
import { stableKey } from '@/lib/reconciliation/stable-key'

const linha = (o: Partial<LinhaDoExtrato> & { valorComSinal: number }): LinhaDoExtrato => ({
  fitid: o.fitid ?? `f-${o.valorComSinal}`, data: o.data ?? new Date('2026-09-10T12:00:00Z'),
  memo: o.memo ?? 'PIX RECEBIDO', ...o,
})
const tx = (o: Partial<TxExistente> & { id: string; valorComSinal: number }): TxExistente => ({
  data: o.data ?? new Date('2026-09-10T12:00:00Z'), descricao: o.descricao ?? 'Distribuição de Lucros caçula',
  origem: o.origem ?? 'MANUAL', dedupHash: o.dedupHash ?? null, temPonte: o.temPonte ?? false,
  categoriaId: o.categoriaId ?? null, ...o,
})

describe('⛔⛔ as 3 transferências da empresa CASAM com a ponte, não duplicam', () => {
  /** o estado REAL do perfil: os 3 créditos criados pela ponte, sem dedupHash */
  const PONTES: TxExistente[] = [
    tx({ id: 'ponte-10k', valorComSinal: 10000, data: new Date('2026-09-08T12:00:00Z'), temPonte: true, categoriaId: 'cat-retirada' }),
    tx({ id: 'ponte-3k5', valorComSinal: 3500, data: new Date('2026-09-09T12:00:00Z'), temPonte: true, categoriaId: 'cat-retirada' }),
    tx({ id: 'ponte-21k', valorComSinal: 21000, data: new Date('2026-09-10T12:00:00Z'), temPonte: true, categoriaId: 'cat-retirada' }),
  ]

  it('⭐ o OFX traz as três e NENHUMA vira transação nova', () => {
    const plano = planoDoExtrato([
      linha({ valorComSinal: 10000, data: new Date('2026-09-08T12:00:00Z'), memo: 'PIX RECEBIDO CACULA MIX' }),
      linha({ valorComSinal: 3500, data: new Date('2026-09-09T12:00:00Z'), memo: 'PIX RECEBIDO CACULA MIX' }),
      linha({ valorComSinal: 21000, data: new Date('2026-09-10T12:00:00Z'), memo: 'PIX RECEBIDO CACULA MIX' }),
    ], PONTES)
    expect(plano.novas, '⛔ criou transação nova pro dinheiro que já estava lá').toHaveLength(0)
    expect(plano.casadas).toHaveLength(3)
    expect(plano.casadas.every((c) => c.temPonte)).toBe(true)
    expect(plano.casadas[0].porQue).toContain('ponte')
  })

  it('⛔⛔ e o TEXTO não entra na conta — é o mesmo fato com dois nomes', () => {
    // a ponte diz "Distribuição de Lucros caçula" (as palavras do dono); o banco diz
    // "PIX RECEBIDO…" — casar por memo não casaria NADA, e é por isso que a régua é
    // data + valor + sentido.
    const d = desfechoDaLinha(
      linha({ valorComSinal: 21000, memo: 'PIX RECEBIDO 29756732000198' }),
      [tx({ id: 'ponte-21k', valorComSinal: 21000, descricao: 'Distribuição de Lucros caçula', temPonte: true })])
    expect(d.tipo).toBe('CASA_COM_MANUAL')
  })

  it('⭐ a janela é de ±2 dias — o PIX cai no dia ou no seguinte', () => {
    const dentro = desfechoDaLinha(
      linha({ valorComSinal: 10000, data: new Date('2026-09-10T12:00:00Z') }),
      [tx({ id: 'p', valorComSinal: 10000, data: new Date('2026-09-08T12:00:00Z'), temPonte: true })])
    expect(dentro.tipo).toBe('CASA_COM_MANUAL')
    const fora = desfechoDaLinha(
      linha({ valorComSinal: 10000, data: new Date('2026-09-12T12:00:00Z') }),
      [tx({ id: 'p', valorComSinal: 10000, data: new Date('2026-09-08T12:00:00Z'), temPonte: true })])
    expect(fora.tipo, `${JANELA_DE_CASAMENTO_DIAS} dias é o teto`).toBe('NOVA')
  })

  it('⛔ valor QUASE igual não é o mesmo dinheiro', () => {
    const d = desfechoDaLinha(linha({ valorComSinal: 21000 }), [tx({ id: 'p', valorComSinal: 20999.99, temPonte: true })])
    expect(d.tipo).toBe('NOVA')
  })

  it('⛔ sentido oposto nunca casa (entrada não quita saída)', () => {
    const d = desfechoDaLinha(linha({ valorComSinal: 21000 }), [tx({ id: 'p', valorComSinal: -21000, temPonte: true })])
    expect(d.tipo).toBe('NOVA')
  })
})

describe('⭐ as 152 manuais: as que o OFX cobrir casam, as outras ficam', () => {
  it('lançamento manual sem ponte também casa — é o mesmo fato', () => {
    const d = desfechoDaLinha(
      linha({ valorComSinal: -450, memo: 'COMPRA CARTAO' }),
      [tx({ id: 'manual', valorComSinal: -450, descricao: 'mercado', origem: 'MANUAL' })])
    expect(d.tipo).toBe('CASA_COM_MANUAL')
    if (d.tipo === 'CASA_COM_MANUAL') expect(d.temPonte).toBe(false)
  })

  it('⭐ o que o OFX NÃO trouxer fica manual, intocado', () => {
    const existentes = [tx({ id: 'nao-veio', valorComSinal: -77, data: new Date('2026-06-01T12:00:00Z') })]
    const plano = planoDoExtrato([linha({ valorComSinal: -450 })], existentes)
    expect(plano.casadas).toHaveLength(0)
    expect(plano.novas).toHaveLength(1)   // a linha do extrato é dinheiro novo
  })

  it('⛔⛔ DOIS candidatos do mesmo valor = AMBÍGUA, o sistema não escolhe', () => {
    const d = desfechoDaLinha(linha({ valorComSinal: -100 }), [
      tx({ id: 'a', valorComSinal: -100, descricao: 'padaria' }),
      tx({ id: 'b', valorComSinal: -100, descricao: 'farmácia' }),
    ])
    expect(d.tipo).toBe('AMBIGUA')
    if (d.tipo === 'AMBIGUA') expect(d.candidatos).toHaveLength(2)
  })

  it('⭐ mas a PONTE desempata: ela é uma afirmação explícita', () => {
    const d = desfechoDaLinha(linha({ valorComSinal: 10000 }), [
      tx({ id: 'manual', valorComSinal: 10000, descricao: 'sei lá' }),
      tx({ id: 'ponte', valorComSinal: 10000, temPonte: true }),
    ])
    expect(d.tipo).toBe('CASA_COM_MANUAL')
    if (d.tipo === 'CASA_COM_MANUAL') expect(d.txId).toBe('ponte')
  })

  it('⛔ uma tx manual casa com UMA linha só — a segunda não a reusa', () => {
    const plano = planoDoExtrato(
      [linha({ fitid: 'a', valorComSinal: -100 }), linha({ fitid: 'b', valorComSinal: -100 })],
      [tx({ id: 'unica', valorComSinal: -100 })])
    expect(plano.casadas).toHaveLength(1)
    expect(plano.novas, 'a segunda linha sumiu em vez de virar transação').toHaveLength(1)
  })
})

describe('⭐ re-importar o mesmo arquivo não cria nada', () => {
  it('a linha que já veio de um import casa pela IDENTIDADE, não pela janela', () => {
    const l = linha({ valorComSinal: -320, memo: 'SUPERMERCADO X' })
    const chave = stableKey({ date: l.data, signedAmount: l.valorComSinal, memo: l.memo })
    const plano = planoDoExtrato([l], [tx({ id: 'ja', valorComSinal: -320, origem: 'OFX', dedupHash: chave })])
    expect(plano.jaImportadas).toBe(1)
    expect(plano.novas).toHaveLength(0)
    expect(plano.casadas).toHaveLength(0)
  })

  it('⛔ e quem já veio de OFX não entra na régua larga (só na identidade)', () => {
    // sem isto, uma tx importada semana passada casaria com qualquer linha de mesmo valor
    const d = desfechoDaLinha(linha({ valorComSinal: -320, memo: 'OUTRA COISA' }),
      [tx({ id: 'ja', valorComSinal: -320, origem: 'OFX', dedupHash: 'chave-de-outra-linha' })])
    expect(d.tipo).toBe('NOVA')
  })
})

describe('⭐ a conferência do saldo (o BATE/DIVERGE)', () => {
  it('bate ao centavo com o que o banco declarou', () => {
    const c = conferirSaldo({ saldoAntes: 50609.96, entram: [21000, 3500, -3500], declarado: 71609.96 })
    expect(c.estado).toBe('BATE')
    expect(c.frase).toContain('confere')
  })

  it('⛔ diverge → a frase NÃO chuta a causa', () => {
    const c = conferirSaldo({ saldoAntes: 1000, entram: [100], declarado: 1500 })
    expect(c.estado).toBe('DIVERGE')
    expect(c.diferenca).toBe(-400)
    // sobrar de um lado tem DUAS explicações; afirmar uma manda procurar no lugar errado
    expect(c.frase).not.toMatch(/falta|sobra|esqueceu/i)
    expect(c.frase).toContain('diferença')
  })

  it('⛔⛔ sem LEDGERBAL a resposta é SEM_DECLARADO — nunca "bate" de graça', () => {
    // a lição do invariante circular (28/08): o que não pode falhar dá selo verde de graça
    const c = conferirSaldo({ saldoAntes: 1000, entram: [100], declarado: null })
    expect(c.estado).toBe('SEM_DECLARADO')
    expect(c.frase).toContain('não dá pra conferir')
  })

  it('⚠️ um centavo é ruído, não divergência', () => {
    expect(conferirSaldo({ saldoAntes: 100, entram: [0.01], declarado: 100 }).estado).toBe('BATE')
  })
})

describe('⭐⭐ o pagamento de fatura que se reconhece sozinho', () => {
  const venc = new Date('2026-09-10T00:00:00Z')
  const fatura = (o: Partial<FaturaAberta> & { invoiceId: string; emAberto: number }): FaturaAberta => ({
    cardId: o.cardId ?? `c-${o.invoiceId}`, cardNome: o.cardNome ?? 'banrisul', bankName: o.bankName ?? 'banrisul',
    lastDigits: o.lastDigits ?? '9113', referencia: o.referencia ?? '2026-08', vencimento: o.vencimento ?? venc,
    cardAtivo: o.cardAtivo ?? true, ...o,
  })

  it('⭐ valor exato dentro da janela → reconhece e diz o porquê', () => {
    const r = reconhecerPagamentoDeFatura(
      { data: new Date('2026-09-10T12:00:00Z'), valor: -18593.16, memo: 'PAGTO FATURA CARTAO' },
      [fatura({ invoiceId: 'f-ago', emAberto: 18593.16 })])
    expect(ehAmbiguo(r)).toBe(false)
    expect(r && !ehAmbiguo(r) ? r.invoiceId : null).toBe('f-ago')
    expect(r && !ehAmbiguo(r) ? r.porQue : '').toContain('valor exato')
  })

  it('⛔ valor QUASE igual não é pagamento — o dono aponta', () => {
    const r = reconhecerPagamentoDeFatura(
      { data: new Date('2026-09-10T12:00:00Z'), valor: -18593.00, memo: 'PAGTO FATURA' },
      [fatura({ invoiceId: 'f', emAberto: 18593.16 })])
    expect(r).toBeNull()
  })

  it('⛔ fora da janela do vencimento não casa', () => {
    const r = reconhecerPagamentoDeFatura(
      { data: new Date('2026-08-01T12:00:00Z'), valor: -18593.16, memo: 'PAGTO' },
      [fatura({ invoiceId: 'f', emAberto: 18593.16 })])
    expect(r).toBeNull()
  })

  it('⛔⛔ CARTÃO INATIVO nunca é escolhido — o caso real dos dois ****9113', () => {
    // o perfil tem um "banrisul pf ****9113" vazio e INATIVO ao lado do que tem 277 tx.
    // Casar pelos 4 dígitos sem olhar o estado escolheria o cadastro abandonado.
    const r = reconhecerPagamentoDeFatura(
      { data: new Date('2026-09-10T12:00:00Z'), valor: -18593.16, memo: 'PAGTO FATURA' },
      [fatura({ invoiceId: 'f-morto', emAberto: 18593.16, cardNome: 'banrisul pf', cardAtivo: false })])
    expect(r).toBeNull()
  })

  it('⛔ duas faturas do MESMO valor = ambíguo, o sistema não desempata', () => {
    const r = reconhecerPagamentoDeFatura(
      { data: new Date('2026-09-10T12:00:00Z'), valor: -500, memo: 'PAGAMENTO' },
      [fatura({ invoiceId: 'a', emAberto: 500, cardNome: 'nubank', bankName: 'nubank', lastDigits: '1564' }),
       fatura({ invoiceId: 'b', emAberto: 500, cardNome: 'magalu', bankName: 'magalu', lastDigits: '2971' })])
    expect(ehAmbiguo(r)).toBe(true)
  })

  it('⭐ mas o EMISSOR no texto desempata — e só desempata, nunca afrouxa o valor', () => {
    const r = reconhecerPagamentoDeFatura(
      { data: new Date('2026-09-10T12:00:00Z'), valor: -500, memo: 'PAGAMENTO FATURA NUBANK' },
      [fatura({ invoiceId: 'a', emAberto: 500, cardNome: 'nubank', bankName: 'nubank', lastDigits: '1564' }),
       fatura({ invoiceId: 'b', emAberto: 500, cardNome: 'magalu', bankName: 'magalu', lastDigits: '2971' })])
    expect(ehAmbiguo(r)).toBe(false)
    expect(r && !ehAmbiguo(r) ? r.invoiceId : null).toBe('a')
  })

  it('⛔ fatura já quitada não é candidata', () => {
    const r = reconhecerPagamentoDeFatura(
      { data: new Date('2026-09-10T12:00:00Z'), valor: -18593.16, memo: 'PAGTO' },
      [fatura({ invoiceId: 'f', emAberto: 0 })])
    expect(r).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
import { painelDoMes, type LinhaDoMes } from '../painel-do-mes'

const lm = (o: Partial<LinhaDoMes> & { valorComSinal: number }): LinhaDoMes => ({
  id: o.id ?? `l${o.valorComSinal}`, data: o.data ?? new Date('2026-09-10T12:00:00Z'),
  descricao: o.descricao ?? 'x', categoriaId: o.categoriaId ?? null, categoriaNome: o.categoriaNome ?? null,
  ehPagamentoDeFatura: o.ehPagamentoDeFatura ?? false, ...o,
})

describe('⭐⭐ o painel do mês: ENTROU · SAIU · SOBROU', () => {
  it('a conta do topo é a do dono, sem enfeite', () => {
    const p = painelDoMes('2026-09', [
      lm({ valorComSinal: 21000, categoriaNome: 'Retirada da empresa', categoriaId: 'c1' }),
      lm({ valorComSinal: -3000, categoriaId: 'c2', categoriaNome: 'Moradia' }),
      lm({ valorComSinal: -500, categoriaId: 'c3', categoriaNome: 'Alimentação' }),
    ])
    expect(p.entrou).toBe(21000)
    expect(p.saiu).toBe(3500)
    expect(p.sobrou).toBe(17500)
  })

  it('⛔⛔ o PAGAMENTO DE FATURA fica FORA do SAIU — senão a despesa conta 2×', () => {
    // a compra do cartão já é despesa no mês em que foi feita; somar a fatura no mês em que
    // foi paga contaria o mesmo dinheiro de novo (a régua do Fluxo da PJ, 25/08)
    const p = painelDoMes('2026-09', [
      lm({ valorComSinal: -1000, categoriaId: 'c', categoriaNome: 'Moradia' }),
      lm({ valorComSinal: -18593.16, ehPagamentoDeFatura: true, descricao: 'PAGTO FATURA' }),
    ])
    expect(p.saiu).toBe(1000)
    // ⭐ mas ele APARECE, nomeado — exclusão escondida é tão ruim quanto exclusão nenhuma
    expect(p.pagamentosDeFatura).toEqual({ quantos: 1, total: 18593.16 })
  })

  it('⚠️ "a classificar" entra nas barras, nunca some', () => {
    const p = painelDoMes('2026-09', [
      lm({ valorComSinal: -800, categoriaId: 'c', categoriaNome: 'Moradia' }),
      lm({ valorComSinal: -200 }),
    ])
    expect(p.gastosPorCategoria.map((g) => g.nome)).toContain('a classificar')
    expect(p.semCategoria).toEqual({ quantos: 1, total: 200 })
    expect(p.saiu, 'o sem-categoria sumiu da conta').toBe(1000)
  })

  it('⛔ mês sem lançamento DIZ o motivo — não mostra três zeros', () => {
    const p = painelDoMes('2026-10', [lm({ valorComSinal: -100 })])
    expect(p.vazio).toContain('importe o extrato')
    expect(p.lancamentos).toBe(0)
  })

  it('⭐ as barras saem da maior pra menor', () => {
    const p = painelDoMes('2026-09', [
      lm({ id: 'a', valorComSinal: -100, categoriaId: 'a', categoriaNome: 'Lazer' }),
      lm({ id: 'b', valorComSinal: -900, categoriaId: 'b', categoriaNome: 'Moradia' }),
    ])
    expect(p.gastosPorCategoria.map((g) => g.nome)).toEqual(['Moradia', 'Lazer'])
    expect(p.gastosPorCategoria[0].proporcao).toBe(1)
  })
})
