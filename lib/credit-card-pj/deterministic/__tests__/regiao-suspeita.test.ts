// ⭐⭐ A RECUSA QUE AJUDA A CONSERTAR — peça 4 (16/09/2026)
//
// **O dono:** *"a dif de −18,00 é provavelmente UMA transação de 18,00 não lida; me mostra
// ela."* A aposta dele é a certa, e é a primeira hipótese que o diagnóstico testa.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { diagnosticarRecusa, regiaoAoRedor, mensagemDaRecusa } from '../regiao-suspeita'

const raiz = process.cwd()
const FIXTURE = join(raiz, 'lib/fatura-banrisul/__tests__/fixtures/banrisul-fatura-pf.txt')

describe('⭐⭐ acha a linha que explica a diferença', () => {
  const texto = readFileSync(FIXTURE, 'utf-8')

  /**
   * ⭐ O CASO DE HOJE, contra a fatura REAL: dif de −18,00 → o diagnóstico aponta as linhas
   * que TÊM 18,00. Numa delas a fixture mostra `JOD 18,00 TX DÓLAR` — **compra em moeda
   * estrangeira**, que é a classe de linha que este parser já perdeu antes (01/09: *"o
   * primeiro valor é o dólar e o real era cortado fora"*).
   */
  it('⭐ dif de −18,00 → aponta as linhas com 18,00', () => {
    const d = diagnosticarRecusa(texto, -18)
    expect(d.candidatas.length).toBeGreaterThan(0)
    expect(d.candidatas[0]!.valor).toBeCloseTo(18, 2)
    expect(d.candidatas[0]!.porQue).toContain('EXATO')
    expect(d.resumo).toMatch(/provavelmente é uma delas/)
  })

  /**
   * ⛔⛔ E QUANDO NADA BATE, ELE **DIZ ISSO** — nunca devolve lista vazia muda.
   * *"Lista vazia sem explicação é a ausência fingindo resposta"*, e aqui ela ainda aponta
   * a hipótese seguinte: **seção inteira não reconhecida = layout novo** (peça 3).
   */
  it('⛔ valor que não existe → o resumo EXPLICA, e sugere layout novo', () => {
    const d = diagnosticarRecusa(texto, -999999.99)
    expect(d.candidatas).toEqual([])
    expect(d.resumo).toMatch(/VÁRIAS linhas|layout novo/)
  })

  /**
   * ⚠️ A SEGUNDA HIPÓTESE: diferença que é o DOBRO de um valor é linha somando onde
   * deveria subtrair — a família do estorno esquecido (REGRA 6).
   */
  it('⭐ dif que é o DOBRO de uma linha sugere sinal trocado', () => {
    const d = diagnosticarRecusa('COMPRA X 50,00\nOUTRA 13,00', -100)
    expect(d.candidatas[0]?.porQue).toMatch(/METADE|subtrair/)
  })

  it('⭐ e mostra a REGIÃO ao redor, com a linha marcada', () => {
    const d = diagnosticarRecusa(texto, -18)
    const regiao = regiaoAoRedor(texto, d.candidatas[0]!.numero, 2)
    expect(regiao).toContain('▶')
    expect(regiao.split('\n').length).toBeGreaterThanOrEqual(3)
  })
})

describe('⭐ a mensagem da recusa diz os dois números E onde olhar', () => {
  it('⭐ o caso de hoje, formatado', () => {
    const texto = readFileSync(FIXTURE, 'utf-8')
    const m = mensagemDaRecusa({ rotulo: 'V1 Σ Brasil', esperado: 11376.89, lido: 11358.89, textoCru: texto })
    // os dois números que a recusa sempre teve
    expect(m).toContain('11.376,89')
    expect(m).toContain('11.358,89')
    // ⭐ e o que ela passou a ter: a linha candidata
    expect(m).toMatch(/linha \d+:/)
    expect(m).toMatch(/18,00/)
  })

  /**
   * ⛔ E ELA CONTINUA SENDO UMA RECUSA. O diagnóstico não soma a linha achada: isso seria
   * o sistema **inventando** a transação que não soube ler — o oposto de *"não inventar
   * dado que o arquivo não traz"*.
   */
  it('⛔ o diagnóstico não conserta nada — só aponta', () => {
    const fonte = readFileSync(join(raiz, 'lib/credit-card-pj/deterministic/regiao-suspeita.ts'), 'utf-8')
    expect(fonte, 'o diagnóstico virou gravação — ele é leitura').not.toMatch(/prisma\.|\.create\(|\.update\(/)
  })
})
