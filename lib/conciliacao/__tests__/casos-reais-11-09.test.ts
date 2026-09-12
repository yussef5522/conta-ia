// ⭐⭐⭐ OS CASOS REAIS DE 11/09/2026, um por um — medidos em prod antes de virar régua.
//
// **O dono cruzou os 99 débitos da Stone com o Contas a Pagar** e mostrou que a maioria dos
// "sumidos" ESTÁ no extrato: *"o matcher é que não apresenta"*. Cada `it` abaixo é um par
// que ele nomeou, com os valores exatos.

import { describe, it, expect } from 'vitest'
import { sugerirVinculos, type FornecedorConhecido } from '../sugestao-de-vinculo'
import { nomeDaContaBateComALinha, palavrasQueIdentificam } from '../nome-da-conta-manual'

const FORN: FornecedorConhecido[] = [
  { id: 'f-doceoli', razaoSocial: 'DOCEOLI ALIMENTOS LTDA', nomeFantasia: null },
  { id: 'f-casper', razaoSocial: 'CASPER DISTRIB.DE PROD. ALIMENTICIOS LTDA', nomeFantasia: null },
]

const linha = (descricao: string, valor: number, dia: string) => ({
  id: `l-${descricao.slice(0, 6)}`, descricao, valor, data: new Date(`${dia}T12:00:00Z`),
  tipo: 'DEBIT' as const, fornecedorId: null, contaBancariaId: 'stone',
})
const conta = (descricao: string, valor: number, venc: string, fornecedorId: string | null = null) => ({
  id: `c-${descricao.slice(0, 6)}`, descricao, valor, data: new Date(`${venc}T00:00:00Z`),
  tipo: 'DEBIT' as const, fornecedorId, contaBancariaId: null,
})
const oferta = (l: ReturnType<typeof linha>, c: ReturnType<typeof conta>) =>
  sugerirVinculos({ extrato: l, contas: [c], fornecedores: FORN })

describe('⭐⭐ item 2 — a CONTA MANUAL casa pelo nome do favorecido', () => {
  it('⭐ ELETROSUL 143,03 × conta "eletrosul" 143,00 (3 centavos) — AGORA oferece', () => {
    const r = oferta(linha('NC ELETROSUL MONITORAMENTO PATRIMONIAL LTDA', 143.03, '2026-09-11'),
      conta('eletrosul', 143.00, '2026-09-10'))
    expect(r).toHaveLength(1)
    expect(r[0].motivos).toContain('NOME_DA_CONTA_MANUAL')
    expect(r[0].porQue).toContain('ELETROSUL')
    expect(r[0].diferenca).toBeCloseTo(0.03, 2)
  })

  it('⭐ ELETROSUL 40,02 × "ELETROSUL" 40,00 — idem', () => {
    const r = oferta(linha('NC ELETROSUL MONITORAMENTO PATRIMONIAL LTDA', 40.02, '2026-09-11'),
      conta('ELETROSUL ', 40.00, '2026-09-10'))
    expect(r).toHaveLength(1)
  })

  it('⭐ Casper 2.120,81 × manual "casper" 2.113,83 (+6,98)', () => {
    const r = oferta(linha('CASPER DISTRIBUIDORA DE PRODUTOS ALIMENTICIOS', 2120.81, '2026-09-11'),
      conta('casper', 2113.83, '2026-09-10'))
    expect(r).toHaveLength(1)
    expect(r[0].motivos).toContain('NOME_DA_CONTA_MANUAL')
  })

  it('⛔ e a conta manual SEM palavra identificadora não ganha nada de graça', () => {
    // "aluguel caçula" é natureza + apelido da loja: não nomeia QUEM recebeu
    expect(palavrasQueIdentificam('aluguel caçula')).not.toContain('aluguel')
    expect(nomeDaContaBateComALinha('fgts da rescisao', 'CAIXA ECONOMICA FEDERAL - Transferência')).toBeNull()
  })
})

describe('⛔⛔⛔ item 6 — o GUARD DO FALSO-AMIGO', () => {
  it('⛔⛔ aluguel caçula 5.234,00 × DOCEOLI 5.234,88 NUNCA é sugerido', () => {
    // ⚠️ ESTE PAR TINHA 70 PONTOS e PASSAVA: 88 centavos de diferença + mesmo dia.
    // Diferença de centavos não compra identidade.
    const r = oferta(linha('DOCEOLI ALIMENTOS LTDA - Pagamento', 5234.88, '2026-09-09'),
      conta('aluguel caçula', 5234.00, '2026-09-10'))
    expect(r).toHaveLength(0)
  })

  it('⛔ MIXX PLAY 111,21 × "radio" 109,00 também não — ninguém diz que são a mesma coisa', () => {
    // ⚠️ O DONO SABE que a MIXX é o rádio; o SISTEMA não tem como saber. A saída é ele
    // vincular uma vez pelo Find & Match e o vínculo ENSINAR o padrão (item 5).
    const r = oferta(linha('MIXX PLAY - Pagamento', 111.21, '2026-09-11'),
      conta('radio', 109.00, '2026-09-10'))
    expect(r).toHaveLength(0)
  })

  it('⭐ mas o VALOR EXATO continua passando sozinho — é o sinal mais forte do domínio', () => {
    const r = oferta(linha('CAIXA ECONOMICA FEDERAL - Transferência', 2114.98, '2026-09-11'),
      conta('fgts da rescisao', 2114.98, '2026-09-11'))
    expect(r).toHaveLength(1)
    expect(r[0].motivos).toContain('VALOR_EXATO')
  })

  it('⭐ e o quase-exato COM nome compatível passa (é o ELETROSUL)', () => {
    const r = oferta(linha('NC ELETROSUL MONITORAMENTO', 143.03, '2026-09-11'), conta('eletrosul', 143.00, '2026-09-10'))
    expect(r).toHaveLength(1)
  })

  it('⭐ quase-exato com FORNECEDOR IGUAL também passa — a FK diz quem é', () => {
    const r = oferta(linha('CASPER DISTRIB - Pagamento', 2120.81, '2026-09-11'),
      { ...conta('NF 123', 2113.83, '2026-09-10'), fornecedorId: 'f-casper' })
    expect(r.length).toBeGreaterThan(0)
  })
})

// ⭐⭐⭐ ITEM 1 — A DIFERENÇA QUE **EU** NOMEIO (11/09/2026)
//
// **O caso real:** Frigorífico, linha **3.845,71** × NF parcela 001 de **3.800,11** paga
// atrasada — os **R$ 45,60** SÃO multa+juros, e o teto automático de R$ 25 os deixava sem
// saída nenhuma.

import { contaDoRodape, TETO_DA_DIFERENCA, tetoDoGestoManual } from '../escolher-na-mao'

describe('⭐⭐ item 1 — diferença acima do teto fecha COM a confirmação do dono', () => {
  const frigorifico = () => contaDoRodape({
    valorDaLinha: 3845.71,
    marcadas: [{ id: 'nf001', emAberto: 3800.11 }],
  })

  it('⛔ os R$ 45,60 NÃO cabem no teto automático (R$ 25) — o sistema não oferece sozinho', () => {
    const r = frigorifico()
    expect(r.diferenca).toBeCloseTo(45.60, 2)
    expect(r.cabeAcertoComNome).toBe(false)
    expect(45.60).toBeGreaterThan(TETO_DA_DIFERENCA)
  })

  it('⭐⭐ mas o GESTO EXPLÍCITO aparece, com o valor em destaque e a frase do dono', () => {
    const r = frigorifico()
    expect(r.acertoQueEuConfirmo).not.toBeNull()
    expect(r.acertoQueEuConfirmo!.frase).toContain('45,60')
    expect(r.acertoQueEuConfirmo!.frase).toContain('juros/multa de atraso')
    expect(r.acertoQueEuConfirmo!.teto).toBeCloseTo(384.57, 2)   // 10% da linha
  })

  it('⛔ e o Conciliar SÓ acende quando ele NOMEIA — confirmar continua sendo gesto dele', () => {
    expect(frigorifico().podeConciliar).toBe(false)
    const nomeada = contaDoRodape({
      valorDaLinha: 3845.71, marcadas: [{ id: 'nf001', emAberto: 3800.11 }], diferencaNomeada: true,
    })
    expect(nomeada.podeConciliar).toBe(true)
  })

  it('⛔⛔ O TETO DE SEGURANÇA MORDE: 500 de juros numa nota de 600 NÃO tem gesto', () => {
    // o pedido do dono, ao pé da letra: "pra ninguém confirmar 500 de juros em nota de 600
    // sem querer — acima disso, só baixa parcial ou nota faltando"
    const r = contaDoRodape({ valorDaLinha: 1100, marcadas: [{ id: 'n', emAberto: 600 }], diferencaNomeada: true })
    expect(r.acertoQueEuConfirmo).toBeNull()
    expect(r.podeConciliar).toBe(false)
    expect(tetoDoGestoManual(1100)).toBe(110)
  })

  it('⭐ até R$ 25 nada muda — o sistema continua oferecendo o acerto sozinho', () => {
    const r = contaDoRodape({ valorDaLinha: 2020, marcadas: [{ id: 'n', emAberto: 2000 }] })
    expect(r.cabeAcertoComNome).toBe(true)
    expect(r.acertoQueEuConfirmo).toBeNull()   // ⚠️ não duplica: ou é automático, ou é manual
  })
})

// ⭐⭐⭐ ITEM 5 — O INTERMEDIÁRIO DE BOLETO (11/09/2026)
import { processadoraDaLinha, chaveDoPadrao } from '../processadora-de-boleto'

describe('⭐⭐ item 5 — a processadora SUGERE com aviso, e o vínculo ensina', () => {
  const pjbank = () => linha('PJBANK PAGAMENTOS S A - Pagamento', 2222.88, '2026-09-08')
  const aluguel = () => conta('aluguel escritorio', 2222.81, '2026-09-08')

  it('⭐ PJBANK × aluguel escritório (7 centavos) AGORA sugere — antes era invisível', () => {
    const r = oferta(pjbank(), aluguel())
    expect(r).toHaveLength(1)
    expect(r[0].avisoDeProcessadora).toContain('PJBANK')
    expect(r[0].avisoDeProcessadora).toContain('não diz o beneficiário')
  })

  it('⛔⛔ e ela NÃO fura o guard do falso-amigo pro resto — a lista é fechada', () => {
    // DOCEOLI não é processadora: o par do aluguel com ela continua barrado
    const r = oferta(linha('DOCEOLI ALIMENTOS LTDA - Pagamento', 5234.88, '2026-09-09'),
      conta('aluguel caçula', 5234.00, '2026-09-10'))
    expect(r).toHaveLength(0)
    expect(processadoraDaLinha('DOCEOLI ALIMENTOS LTDA - Pagamento')).toBeNull()
  })

  it('⛔ processadora com data LONGE também não passa — o valor sozinho não basta', () => {
    const r = oferta(linha('PJBANK PAGAMENTOS S A - Pagamento', 2222.88, '2026-09-30'),
      conta('aluguel escritorio', 2222.81, '2026-09-08'))
    expect(r).toHaveLength(0)
  })

  it('⭐⭐ o PADRÃO APRENDIDO muda a frase e vale pontos — "costuma ser o boleto desta conta"', () => {
    const padroes = new Map([[chaveDoPadrao('PJBANK', 'aluguel escritorio'), 3]])
    const semPadrao = oferta(pjbank(), aluguel())
    const comPadrao = sugerirVinculos({
      extrato: pjbank(), contas: [aluguel()], fornecedores: FORN, padroesDeProcessadora: padroes,
    })
    expect(comPadrao[0].avisoDeProcessadora).toContain('costuma ser o boleto desta conta')
    expect(comPadrao[0].avisoDeProcessadora).toContain('3×')
    expect(comPadrao[0].score).toBeGreaterThan(semPadrao[0].score)
  })

  it('⭐ e o padrão aprendido salva até quando a data está longe — é memória, não coincidência', () => {
    const padroes = new Map([[chaveDoPadrao('PJBANK', 'aluguel escritorio'), 2]])
    const r = sugerirVinculos({
      extrato: linha('PJBANK PAGAMENTOS S A - Pagamento', 2222.88, '2026-09-30'),
      contas: [aluguel()], fornecedores: FORN, padroesDeProcessadora: padroes,
    })
    expect(r).toHaveLength(1)
  })
})
