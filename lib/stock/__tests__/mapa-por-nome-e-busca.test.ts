// ⛔⛔ DUAS CLASSES, ACHADAS NO MESMO DIA (31/08/2026).
//
// 1. FILTRO QUE NÃO FILTRA: na busca de Recebimentos, `(l.cnpj ?? '').includes(
//    q.replace(/\D/g,''))` — termo de LETRAS virava `''`, e `includes('')` é sempre true.
//    Digitar o nome do fornecedor mostrava a lista INTEIRA, sem filtrar nada.
//
// 2. O VÍNCULO DIGITADO MORRIA COM A NOTA: o mapa aprendido é chaveado por `cProd` (o
//    código do produto no fornecedor, que só existe no XML). Item digitado do DANFE grava
//    `cProd: null` e não cabe na chave — então o dono mapeava tudo e, na nota seguinte do
//    MESMO fornecedor, recomeçava do zero.

import { describe, it, expect } from 'vitest'
import { casaBusca, casaDigitos, normalizarBusca } from '@/lib/busca-texto'

/** as linhas REAIS da tela de Recebimentos da Caçula (nomes conferidos em prod) */
const LINHAS = [
  { fornecedor: 'CIA DA FRUTA COMERCIO DE FRUTAS E VERDURAS EIRELI', cnpj: '12345678000199' },
  { fornecedor: 'FRIGORIFICO SILVA INDUSTRIA E COMERCIO LTDA', cnpj: '88728027000146' },
  { fornecedor: 'DALMOLIN & VANZIN IMPORTACAO E EXPORTACAO', cnpj: '11222333000144' },
  { fornecedor: 'Nestle Brasil Ltda', cnpj: '60409075000152' },
]
const buscar = (termo: string) =>
  LINHAS.filter((l) => casaBusca(l.fornecedor, termo) || casaDigitos(l.cnpj, termo))

describe('⛔⛔ termo TRANSFORMADO que esvazia = filtro que não filtra', () => {
  it('⛔⛔ o caso REAL: buscar por nome NÃO pode devolver a lista inteira', () => {
    // ⚠️ com a régua antiga, `"cia da fruta"` devolvia 4 de 4 — a cláusula do CNPJ era
    // `includes('')`, sempre verdadeira. É o red-then-green deste fix.
    const r = buscar('cia da fruta')
    expect(r.length).toBe(1)
    expect(r[0].fornecedor).toContain('CIA DA FRUTA')
  })

  it('⭐ acha por PEDAÇO do nome, sem caixa e em qualquer ordem', () => {
    expect(buscar('fruta').length).toBe(1)
    expect(buscar('FRUTA').length).toBe(1)
    expect(buscar('fruta cia').length).toBe(1) // palavras fora de ordem
    expect(buscar('frigorifico').length).toBe(1)
  })

  it('⭐ e o termo com dígito acha por CNPJ', () => {
    expect(buscar('88728027').length).toBe(1)
    expect(buscar('88.728.027/0001-46').length).toBe(1) // formatado também
  })

  it('⛔⛔ termo SEM dígito nunca "casa com tudo" pelo lado do CNPJ', () => {
    // é esta linha que continha o bug — a guarda agora mora dentro de `casaDigitos`
    for (const l of LINHAS) expect(casaDigitos(l.cnpj, 'frigorifico')).toBe(false)
    expect(casaDigitos('88728027000146', 'abc')).toBe(false)
    expect(casaDigitos(null, '123')).toBe(false)
  })

  it('⚠️ a RÉGUA da classe: termo CRU vazio = sem filtro (certo); TRANSFORMADO vazio = bug', () => {
    // termo cru vazio significa "não digitei" e devolver tudo é o esperado…
    expect(casaBusca('qualquer coisa', '')).toBe(true)
    // …mas o termo que VIRA vazio depois de transformado não pode significar "casa tudo"
    expect(casaDigitos('12345678000199', '')).toBe(false)
    expect(buscar('').length).toBe(LINHAS.length)
  })

  it('⭐ e o filtro DISCRIMINA: "frigorifico" não devolve a CIA DA FRUTA', () => {
    expect(buscar('frigorifico').some((l) => /FRUTA/i.test(l.fornecedor))).toBe(false)
  })
})

describe('⭐⭐ o mapa por NOME — igualdade INTEIRA, nunca "parecido"', () => {
  // ⚠️ casar por nome é mais frouxo que por código, e o desenho assume isso: a chave é o
  // nome normalizado INTEIRO. Nome parecido virando vínculo automático seria o sistema
  // adivinhando mercadoria — a linha vermelha deste módulo.
  const chave = (s: string) => normalizarBusca(s)

  it('⭐ o mesmo produto escrito com caixa/acento diferente é o MESMO', () => {
    expect(chave('TOMATE LONGA VIDA CX 20KG')).toBe(chave('tomate longa vida cx 20kg'))
    expect(chave('AÇÚCAR REFINADO')).toBe(chave('acucar refinado'))
    expect(chave('OLEO   DE  SOJA')).toBe(chave('OLEO DE SOJA')) // espaços colapsados
  })

  it('⛔⛔ produto PARECIDO NÃO é o mesmo (não vira vínculo sozinho)', () => {
    // são dois produtos de verdade no catálogo da Caçula — casar por semelhança
    // baixaria o item errado do estoque
    expect(chave('COCA-COLA ORIGINAL PET 2L')).not.toBe(chave('CC Zero PET 2L'))
    expect(chave('TOMATE LONGA VIDA CX 20KG')).not.toBe(chave('TOMATE LONGA VIDA CX 10KG'))
    expect(chave('BOBINA 01 LITRO')).not.toBe(chave('BOBINA 02 LITROS'))
  })

  it('⚠️ prefixo não casa: "TOMATE" ≠ "TOMATE LONGA VIDA CX 20KG"', () => {
    expect(chave('TOMATE')).not.toBe(chave('TOMATE LONGA VIDA CX 20KG'))
  })
})
