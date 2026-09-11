// ⛔⛔⛔ A PORTA QUE CRIAVA FORNECEDOR DUPLICADO (10/09/2026)
//
// **O dono:** *"a porta que criava duplicata de fornecedor fecha na origem (criar
// fornecedor com nome idêntico a existente → recusa e aponta, igual o criar-item já faz)."*
//
// **A PORTA, medida:** `resolverFornecedor` da ponte estoque→financeiro procurava **só por
// CNPJ**. Os cadastros antigos da Caçula (05-07/06, do Excel) **não têm CNPJ** — então
// toda NF-e criava um SEGUNDO cadastro com o mesmo nome. Resultado: **11 fornecedores
// duplicados**, e foi a duplicata que matou o reconhecimento na conciliação (o empate
// devolvia NULL) e deixou o Frigorífico — 6 contas abertas — fora de card nenhum.

import { describe, it, expect } from 'vitest'
import { chaveDoNomeDoFornecedor } from '../ponte-contas-pagar'

describe('⭐ a chave do nome é a MESMA do reconhecimento da conciliação', () => {
  it('ignora caixa, acento e pontuação', () => {
    const k = chaveDoNomeDoFornecedor
    expect(k('Frigorífico Silva Indústria e Comércio LTDA.'))
      .toBe(k('FRIGORIFICO SILVA INDUSTRIA E COMERCIO LTDA'))
    expect(k('DISTRIB. DE PROD. ALIMENT. LAMANA LTDA'))
      .toBe(k('DISTRIB DE PROD ALIMENT LAMANA LTDA'))
  })

  it('⛔ mas NÃO confunde nomes de verdade diferentes', () => {
    expect(chaveDoNomeDoFornecedor('M. IVAN LUNARDI OURIQUE LTDA'))
      .not.toBe(chaveDoNomeDoFornecedor('MAURO IVAN LUNARDI'))
  })
})

// ⚠️ A REGRA DA PONTE, escrita como tabela de decisão: o teste de integração dela exige
// Postgres (o `resolverFornecedor` é privado e roda dentro do envio), então o que se trava
// aqui é a DECISÃO — e ela é a mesma régua de 04/09 do estoque.
describe('⛔⛔ a régua da ponte: completar o velho, não criar um segundo', () => {
  type Cadastro = { id: string; nome: string; cnpj: string | null }
  const soDigitos = (x: string | null) => (x ?? '').replace(/\D/g, '')

  /** a decisão que `resolverFornecedor` toma, isolada pra poder ser afirmada */
  function decidir(nome: string, cnpj: string | null, base: Cadastro[]):
    'REUSA_POR_CNPJ' | 'COMPLETA_O_VELHO' | 'CRIA_NOVO' {
    const doc = soDigitos(cnpj)
    if (doc && base.some((f) => soDigitos(f.cnpj) === doc)) return 'REUSA_POR_CNPJ'
    const alvo = chaveDoNomeDoFornecedor(nome)
    const mesmoNome = base.filter((f) => chaveDoNomeDoFornecedor(f.nome) === alvo)
    if (mesmoNome.some((f) => !soDigitos(f.cnpj))) return 'COMPLETA_O_VELHO'
    return 'CRIA_NOVO'
  }

  const VELHO_SEM_CNPJ: Cadastro[] = [
    { id: 'velho', nome: 'FOCATTO DISTRIBUIDORA DE ALIMENTOS LTDA', cnpj: null },
  ]

  it('⭐ o caso REAL: nome idêntico e o velho sem CNPJ → COMPLETA, não duplica', () => {
    expect(decidir('FOCATTO DISTRIBUIDORA DE ALIMENTOS LTDA', '04.902.760/0001-45', VELHO_SEM_CNPJ))
      .toBe('COMPLETA_O_VELHO')
  })

  it('o CNPJ conhecido continua mandando (caminho de sempre)', () => {
    expect(decidir('QUALQUER NOME', '04902760000145', [
      { id: 'x', nome: 'FOCATTO …', cnpj: '04.902.760/0001-45' },
    ])).toBe('REUSA_POR_CNPJ')
  })

  it('⛔⛔ nome idêntico com CNPJ DIFERENTE cria mesmo — matriz e filial', () => {
    expect(decidir('NESTLE BRASIL LTDA', '60409075020692', [
      { id: 'matriz', nome: 'NESTLE BRASIL LTDA', cnpj: '60.409.075/0001-52' },
    ])).toBe('CRIA_NOVO')
  })

  it('nome que não existe cria normalmente', () => {
    expect(decidir('FORNECEDOR NOVO LTDA', '11222333000181', VELHO_SEM_CNPJ)).toBe('CRIA_NOVO')
  })
})
