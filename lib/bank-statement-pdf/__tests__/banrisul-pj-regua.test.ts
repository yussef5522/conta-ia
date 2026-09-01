// ⭐⭐⭐ GOLDEN — o PDF do Banrisul como RÉGUA, contra os dois extratos REAIS de 01/09.
//
// Os dois arquivos são o `pdftotext -layout` de verdade, anonimizados só nos NOMES DE
// PESSOA e nos identificadores da conta. **Toda palavra que o parser usa pra decidir
// sobrevive** — `SALDO ANT EM`, `SALDO NA DATA`, `(+) BLOQUEADO`, `SALDO DEVEDOR`,
// `++ MOVIMENTOS`, `MOVIMENTOS FUTUROS`, `NOME:`. Já mordeu duas vezes anonimizar
// palavra que decide (26/08 comeu "PAGAMENTO"; 31/08 comeu "Banrisul").
//
// ⛔ O QUE ESTE ARQUIVO TRAVA, e por que cada um importa:
//   · o saldo CONTÁBIL de cada dia (21 em agosto) — a régua da conferência;
//   · `disponível + bloqueado = contábil` (−4.925,96 + 1.700 = −3.225,96), a conta que
//     explica o fantasma de R$ 1.700 que a conta carregava com o ledger correto;
//   · o bloco de FUTUROS separado dos realizados — o consórcio de 09/09 entrava como
//     lançamento de 01/09 antes deste sprint;
//   · a OSCILAÇÃO DE COLUNA, que é o que impede a cura dos parsers de cartão (cortar por
//     posição) de funcionar aqui.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { banrisulPdfParser } from '../banrisul-parser'
import { conferirDiaADia, contabilMaisRecente, mensagemDoDia, type LancamentoSistema } from '../conferencia-diaria'

const fx = (n: string) => readFileSync(join(__dirname, 'fixtures', n), 'utf-8')
const AGOSTO = fx('banrisul-pj-extrato-agosto.txt')
const RECENTES = fx('banrisul-pj-extrato-recentes.txt')

describe('⭐ o parser lê a RÉGUA, não só as linhas', () => {
  it('⭐ agosto: 136 lançamentos, 21 saldos diários, abertura 31/07 = −22.188,17', () => {
    const r = banrisulPdfParser.parse(AGOSTO)
    expect(r.lines).toHaveLength(136)
    expect(r.saldosDiarios).toHaveLength(21)
    expect(r.saldoAnterior).toEqual({ data: '2026-07-31', valor: -22188.17 })
    expect(r.saldosDiarios?.[0]).toEqual({ data: '2026-08-03', valor: 4518.24 })
    expect(r.saldosDiarios?.slice(-1)[0]).toEqual({ data: '2026-08-31', valor: -7353.66 })
  })

  it('⭐⭐ disponível + bloqueado = contábil — a conta que explica o fantasma de 1.700', () => {
    const r = banrisulPdfParser.parse(RECENTES)
    expect(r.saldoDisponivel).toBe(-4925.96) // "SALDO DEVEDOR" do cabeçalho
    expect(r.bloqueado).toBe(1700)
    expect((r.saldoDisponivel as number) + (r.bloqueado as number)).toBeCloseTo(-3225.96, 2)
    // e o contábil do dia bate com essa soma
    expect(contabilMaisRecente({ saldoAnterior: r.saldoAnterior ?? null, saldosDiarios: r.saldosDiarios ?? [] }))
      .toEqual({ data: '2026-09-01', valor: -3225.96 })
  })

  it('⛔⛔ o FUTURO não é lançamento: o consórcio de 09/09 sai da lista de realizados', () => {
    const r = banrisulPdfParser.parse(RECENTES)
    expect(r.lines).toHaveLength(13) // 7 de 31/08 + 6 de 01/09 — sem o agendado
    expect(r.futuros).toHaveLength(1)
    expect(r.futuros?.[0]).toMatchObject({ historico: 'PAGAMENTO CONSORCIO', signed: -1478.51, date: '2026-09-09' })
    // ⚠️ e o mês vem do marcador "++ MOVIMENTOS SET/2026", não do período do extrato:
    // pelo período (que acaba em agosto) ele viraria 09/08 — um mês NO PASSADO, dentro
    // da janela que a conferência confere, e passaria a acusar um buraco que não existe.
    expect(r.futuros?.[0].date).not.toBe('2026-08-09')
    expect(r.lines.some((l) => l.historico.includes('CONSORCIO') && l.documento === '150023')).toBe(false)
  })

  it('⚠️ mas o CONSÓRCIO de 11/08 é REAL e continua na lista (documento diferente)', () => {
    // ⚠️ os dois se parecem e só o DOCUMENTO os separa: 150022 aconteceu, 150023 vai
    // acontecer. Filtrar por descrição mataria o lançamento real.
    const r = banrisulPdfParser.parse(AGOSTO)
    const real = r.lines.find((l) => l.documento === '150022')
    expect(real).toMatchObject({ historico: 'PAGAMENTO CONSORCIO', signed: -1478.51, day: 11 })
  })

  it('⭐ os NOMES do PIX vêm do PDF — é o que o OFX do Banrisul não traz', () => {
    const r = banrisulPdfParser.parse(AGOSTO)
    const comNome = r.lines.filter((l) => l.counterpartyName)
    expect(comNome.length).toBe(30)
    // os dois de 25/08, que estão sem nome no sistema
    const d25 = r.lines.filter((l) => l.day === 25 && l.historico === 'PIX ENVIADO')
    expect(d25.map((l) => [l.signed, l.counterpartyName])).toEqual([[-100, 'TITULAR DE TESTE FULA'], [-6000, 'CACULA MIX']])
  })
})

describe('⛔⛔ a OSCILAÇÃO DE COLUNA — por que não dá pra cortar por posição', () => {
  it('⛔⛔ duas linhas do MESMO dia em colunas diferentes, e as duas são lidas', () => {
    // ⚠️ ISTO É REAL, do arquivo do banco (31/08):
    //      PIX ENVIADO                                          796274         1.000,00-
    //      PIX ENVIADO                                        819416           500,00-
    // A cura dos parsers de cartão (cortar na coluna do header) QUEBRARIA aqui. A régua
    // que funciona é posicional-relativa: valor = último token, sinal pelo "-" final,
    // documento = os 6 dígitos anteriores.
    const r = banrisulPdfParser.parse(RECENTES)
    const d31 = r.lines.filter((l) => l.day === 31 && l.historico === 'PIX ENVIADO')
    expect(d31.map((l) => l.signed)).toEqual([-1000, -35000, -1000, -500])
    expect(d31.map((l) => l.documento)).toEqual(['060993', '619679', '796274', '819416'])
  })

  it('⛔ e a prova de que a coluna REALMENTE varia no arquivo (senão o teste acima é vazio)', () => {
    const linhas = RECENTES.split('\n').filter((l) => /PIX ENVIADO/.test(l))
    const colunas = new Set(linhas.map((l) => l.indexOf('PIX ENVIADO') + l.replace(/\s+$/, '').length))
    expect(colunas.size).toBeGreaterThan(1) // não estão todas alinhadas
  })
})

describe('⭐⭐⭐ conferência DIA A DIA — os 21 dias de agosto', () => {
  /** o ledger do sistema, reconstruído das próprias linhas do PDF (o sistema bate com elas) */
  const ledgerDoSistema = (): LancamentoSistema[] => {
    const r = banrisulPdfParser.parse(AGOSTO)
    return r.lines.map((l, i) => ({ id: `t${i}`, data: l.date as string, valor: l.signed, descricao: l.historico }))
  }
  const regua = () => {
    const r = banrisulPdfParser.parse(AGOSTO)
    return { saldoAnterior: r.saldoAnterior ?? null, saldosDiarios: r.saldosDiarios ?? [] }
  }

  it('⭐⭐ os 21 dias fecham ao centavo', () => {
    const c = conferirDiaADia(regua(), ledgerDoSistema())
    expect(c.conferivel).toBe(true)
    expect(c.dias).toHaveLength(21)
    expect(c.todosFecham).toBe(true)
    expect(c.primeiroQueNaoFecha).toBeNull()
    // os números do dono, conferidos um a um
    expect(c.dias.find((d) => d.data === '2026-08-11')?.saldoBanco).toBe(-4617.37)
    expect(c.dias.find((d) => d.data === '2026-08-13')?.saldoBanco).toBe(-7944.08)
    expect(c.dias.find((d) => d.data === '2026-08-28')?.saldoBanco).toBe(-4567.03)
  })

  it('⛔ tirando UM lançamento, a conferência aponta o DIA e o VALOR — nunca "não identifiquei"', () => {
    const semUm = ledgerDoSistema().filter((l) => !(l.data === '2026-08-11' && l.valor === -1478.51))
    const c = conferirDiaADia(regua(), semUm)
    expect(c.todosFecham).toBe(false)
    expect(c.primeiroQueNaoFecha?.data).toBe('2026-08-11')
    expect(c.primeiroQueNaoFecha?.diferenca).toBeCloseTo(1478.51, 2)
    expect(mensagemDoDia(c.primeiroQueNaoFecha!)).toContain('11/08')
    expect(mensagemDoDia(c.primeiroQueNaoFecha!)).toContain('a mais que o banco')
  })

  it('⭐ o erro NÃO contamina os dias seguintes — cada dia é uma equação própria', () => {
    // ⚠️ se a conferência seguisse do NOSSO saldo, um erro no dia 13 pintaria de vermelho
    // todos os dias seguintes e esconderia onde começou.
    const semUm = ledgerDoSistema().filter((l) => !(l.data === '2026-08-11' && l.valor === -1478.51))
    const c = conferirDiaADia(regua(), semUm)
    expect(c.dias.filter((d) => !d.fecha)).toHaveLength(1)
  })

  it('⚠️ sem abertura no PDF, NÃO confere — e diz por quê, em vez de inventar', () => {
    const c = conferirDiaADia({ saldoAnterior: null, saldosDiarios: [{ data: '2026-08-03', valor: 1 }] }, [])
    expect(c.conferivel).toBe(false)
    expect(c.motivoNaoConferivel).toContain('SALDO ANT')
  })

  it('⚠️ lançamento em dia que o banco NÃO lista entra no próximo dia declarado', () => {
    // o banco só lista dia com movimento; sábado nosso cai no dia útil seguinte declarado
    const c = conferirDiaADia(
      { saldoAnterior: { data: '2026-08-01', valor: 0 }, saldosDiarios: [{ data: '2026-08-04', valor: 100 }] },
      [{ id: 'a', data: '2026-08-02', valor: 60, descricao: 'sábado' }, { id: 'b', data: '2026-08-04', valor: 40, descricao: 'segunda' }],
    )
    expect(c.todosFecham).toBe(true)
    expect(c.dias[0].lancamentos).toHaveLength(2)
  })
})
