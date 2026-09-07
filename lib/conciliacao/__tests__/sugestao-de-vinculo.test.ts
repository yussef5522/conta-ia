// ⛔⛔⛔ O CASO CANCIAN, AO CENTAVO (07/09/2026) — a fixture é o dado REAL de prod.
//
// O dono olhava uma conta a pagar casável sem gesto pra casar. Medido em prod pelo
// matcher de verdade (REGRA 3, `scripts/diag-conciliacao-5.ts`):
//
//     linha do banco R$ 232,81 31/08 × conta a pagar R$ 230,81 venc 29/08
//     score 65 → NO_MATCH  (valor 40 · data 15 · FORNECEDOR 0 · descrição 10)
//
// **Os 15 pontos do fornecedor são o buraco**: a linha do extrato tem `supplierId`
// null (medido: 90 de 6.750 linhas, 1,3%), e o nome do fornecedor mora na DESCRIÇÃO.
// O teste que morde é este — sem reconhecer o nome, a sugestão não existe.

import { describe, it, expect } from 'vitest'
import {
  sugerirVinculos, sugerirVinculosDaConta, reconhecerFornecedor,
  CORTE_PRA_SUGERIR, type LadoDoPar, type FornecedorConhecido,
} from '../sugestao-de-vinculo'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

// ── as linhas REAIS da Caçula (ids e textos de prod) ───────────────────────────
const LINHA_CANCIAN: LadoDoPar = {
  id: 'cmtj0b2ck01ll3qo3fha8igr5',
  descricao: 'CARLOS CANCIAN CIA LTDA - Pagamento',
  valor: 232.81, data: d('2026-08-31'), tipo: 'DEBIT',
  fornecedorId: null,                       // ⛔ é isso que zerava os 15 pontos
  contaBancariaId: 'stone',
}
const CONTA_834771: LadoDoPar = {
  id: 'cmtn9txtz000m109fjlj54iln',
  descricao: 'CARLOS CANCIAN E CIA LTDA — NF 834771 (parcela 001)',
  valor: 230.81, data: d('2026-08-29'), tipo: 'DEBIT',
  fornecedorId: 'forn-cancian', contaBancariaId: null,
}
const CONTA_835271: LadoDoPar = {
  id: 'cmteoiw2u002h5966mgb1pyka',
  descricao: 'CARLOS CANCIAN E CIA LTDA — NF 835271 (parcela 001)',
  valor: 230.81, data: d('2026-09-05'), tipo: 'DEBIT',
  fornecedorId: 'forn-cancian', contaBancariaId: null,
}
// o par FALSO que a régua larga produzia em prod (medido: valor a 0,5% de distância)
const CONTA_ALAN: LadoDoPar = {
  id: 'cmt92phgp0036mzsde21z6o05',
  descricao: 'ALAN SALBEGO DA SILVA — NF 1538 (parcela 001)',
  valor: 231.60, data: d('2026-09-05'), tipo: 'DEBIT',
  fornecedorId: 'forn-alan', contaBancariaId: null,
}

const FORNECEDORES: FornecedorConhecido[] = [
  { id: 'forn-cancian', razaoSocial: 'CARLOS CANCIAN E CIA LTDA', nomeFantasia: null },
  { id: 'forn-alan', razaoSocial: 'ALAN SALBEGO DA SILVA', nomeFantasia: null },
  { id: 'forn-frigo', razaoSocial: 'FRIGORIFICO SILVA INDUSTRIA E COMERCIO LTDA', nomeFantasia: null },
]

describe('a sugestão de vínculo — o caso Cancian', () => {
  it('⭐ sugere o par que o matcher antigo deixava invisível (65 pts → passa do corte)', () => {
    const s = sugerirVinculos({
      extrato: LINHA_CANCIAN, contas: [CONTA_834771], fornecedores: FORNECEDORES,
    })
    expect(s).toHaveLength(1)
    expect(s[0].contaId).toBe(CONTA_834771.id)
    expect(s[0].score).toBeGreaterThanOrEqual(CORTE_PRA_SUGERIR)
    // ⛔ o fornecedor foi reconhecido pelo NOME — é o que faltava
    expect(s[0].fornecedorPeloNome).toBe('CARLOS CANCIAN E CIA LTDA')
  })

  it('⛔⛔ REPONDO O DEFEITO: sem os fornecedores cadastrados o par SOME (era o estado de hoje)', () => {
    const s = sugerirVinculos({
      extrato: LINHA_CANCIAN, contas: [CONTA_834771], fornecedores: [],
    })
    // 40 (valor) + 15 (data) + 0 (fornecedor) + 10 (descrição) = 65 < 70
    expect(s).toHaveLength(0)
  })

  it('a sugestão SEMPRE traz o motivo escrito — sugestão sem porquê não existe', () => {
    const [s] = sugerirVinculos({
      extrato: LINHA_CANCIAN, contas: [CONTA_834771], fornecedores: FORNECEDORES,
    })
    // ⚠️ `toLocaleString` de moeda usa ESPAÇO NÃO-SEPARÁVEL entre "R$" e o número.
    // Comparar com espaço comum falha por um caractere invisível — a asserção
    // usa o mesmo formatador da fonte, não uma cópia digitada à mão.
    const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    expect(s.porQue).toContain(`${brl(2)} de diferença`)
    expect(s.porQue).toContain('2 dias depois do vencimento')
    expect(s.porQue).toContain('CARLOS CANCIAN E CIA LTDA')
    expect(s.diferenca).toBe(2)
  })

  it('⛔ o par FALSO da régua larga não entra: ALAN SALBEGO × linha do CANCIAN', () => {
    const s = sugerirVinculos({
      extrato: LINHA_CANCIAN, contas: [CONTA_ALAN], fornecedores: FORNECEDORES,
    })
    expect(s).toHaveLength(0)
  })

  it('as DUAS notas do mesmo fornecedor aparecem — quem escolhe é o dono, não a régua', () => {
    const s = sugerirVinculos({
      extrato: LINHA_CANCIAN, contas: [CONTA_834771, CONTA_835271], fornecedores: FORNECEDORES,
    })
    // ⚠️ as duas são plausíveis (mesmo valor, mesmo fornecedor, dias diferentes).
    // Esconder uma seria a régua decidindo qual nota foi paga — e é justamente a
    // confusão que já aconteceu em 30/08. O card mostra a NF; a escolha é humana.
    expect(s.map((x) => x.contaId)).toEqual([CONTA_834771.id, CONTA_835271.id])
    expect(s[0].score).toBeGreaterThan(s[1].score) // a mais próxima primeiro
    expect(s[1].porQue).toContain('antes de vencer')
  })
})

describe('o sentido inverso — a metade que não existia', () => {
  it('⭐ partindo da CONTA A PAGAR, acha a linha do extrato (o caso do dono nos Pendentes)', () => {
    const s = sugerirVinculosDaConta({
      conta: CONTA_834771,
      extratos: [LINHA_CANCIAN],
      fornecedores: FORNECEDORES,
    })
    expect(s).toHaveLength(1)
    expect(s[0].extratoId).toBe(LINHA_CANCIAN.id)
  })

  it('⛔ os dois sentidos dão a MESMA resposta — uma régua só (a lição do B1)', () => {
    const daLinha = sugerirVinculos({
      extrato: LINHA_CANCIAN, contas: [CONTA_834771], fornecedores: FORNECEDORES,
    })
    const daConta = sugerirVinculosDaConta({
      conta: CONTA_834771, extratos: [LINHA_CANCIAN], fornecedores: FORNECEDORES,
    })
    expect(daConta).toEqual(daLinha)
  })
})

describe('"não é isso" — a recusa que fica', () => {
  it('o par recusado não volta a ser sugerido', () => {
    const recusados = [{ extratoId: LINHA_CANCIAN.id, contaId: CONTA_834771.id }]
    expect(sugerirVinculos({
      extrato: LINHA_CANCIAN, contas: [CONTA_834771], fornecedores: FORNECEDORES, recusados,
    })).toHaveLength(0)
  })

  it('⚠️ a recusa é do PAR, não da linha: a outra nota do mesmo fornecedor continua sugerida', () => {
    const recusados = [{ extratoId: LINHA_CANCIAN.id, contaId: CONTA_834771.id }]
    const s = sugerirVinculos({
      extrato: LINHA_CANCIAN, contas: [CONTA_834771, CONTA_835271], fornecedores: FORNECEDORES, recusados,
    })
    expect(s.map((x) => x.contaId)).toEqual([CONTA_835271.id])
  })

  it('a recusa vale nos DOIS sentidos — recusar na Conciliação cala nos Pendentes', () => {
    const recusados = [{ extratoId: LINHA_CANCIAN.id, contaId: CONTA_834771.id }]
    expect(sugerirVinculosDaConta({
      conta: CONTA_834771, extratos: [LINHA_CANCIAN], fornecedores: FORNECEDORES, recusados,
    })).toHaveLength(0)
  })
})

describe('reconhecer o fornecedor pelo nome — 15 pontos que não podem ser palpite', () => {
  it('acha o fornecedor dentro da descrição do extrato', () => {
    expect(reconhecerFornecedor('CARLOS CANCIAN CIA LTDA - Pagamento', FORNECEDORES)?.id)
      .toBe('forn-cancian')
  })

  it('⛔ EMPATE TÉCNICO NÃO DECIDE: dois fornecedores igualmente parecidos → ninguém', () => {
    const gemeos: FornecedorConhecido[] = [
      { id: 'a', razaoSocial: 'COMERCIAL SILVA LTDA', nomeFantasia: null },
      { id: 'b', razaoSocial: 'COMERCIAL SILVA LTDA', nomeFantasia: null },
    ]
    expect(reconhecerFornecedor('COMERCIAL SILVA LTDA - Pagamento', gemeos)).toBeNull()
  })

  it('⛔ nome que não bate não vira fornecedor (o Pix de salário não é o Frigorífico)', () => {
    expect(reconhecerFornecedor('JESSICA PERES DE ABREU - Transferência | Pix', FORNECEDORES))
      .toBeNull()
  })

  it('zero candidato é zero — sem contas, sem sugestão (nunca lista fantasma)', () => {
    expect(sugerirVinculos({ extrato: LINHA_CANCIAN, contas: [], fornecedores: FORNECEDORES }))
      .toEqual([])
  })
})
