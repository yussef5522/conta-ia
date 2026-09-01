// ⛔⛔ O FATOR NUNCA É ADIVINHADO — a pergunta que o dono fez antes de eu codar:
// *"quando eu escolher no catálogo e a unidade vier do cadastro (UN) mas a nota estiver em
// CX, quem decide o fator? Se não tiver fator conhecido, prefiro que a linha peça o fator
// na hora do que assumir 1."*
//
// A resposta é a ordem que o módulo já tem (22-23/08), menos o degrau que o papel não tem:
//   mapa aprendido → (qTrib/uTrib: não existe no DANFE) → sugestão pelo nome → PERGUNTA.
//
// ⛔ Foi o bug da SKOL (22/08): fator 1 assumido em silêncio, e a caixa de 20 garrafas
// entrou no ledger como 1 unidade.

import { describe, it, expect } from 'vitest'
import {
  estadoDoFator, fatorEfetivo, linhaBloqueada, aplicarItemEscolhido, limparVinculo,
  linhaVazia, type LinhaManual,
} from '../vinculo'

const linha = (p: Partial<LinhaManual> = {}): LinhaManual => ({ ...linhaVazia(), ...p })

describe('⛔⛔ unidade diferente + fator desconhecido = PERGUNTA, nunca 1', () => {
  it('⛔⛔ o caso da pergunta: catálogo em UN, nota em CX, ninguém sabe o fator', () => {
    const l = linha({ xProd: 'CERV SKOL 600ML', uCom: 'CX', unidadeControle: 'UN' })
    const e = estadoDoFator(l, null, null)
    expect(e.tipo).toBe('PERGUNTA')
    expect(e.tipo === 'PERGUNTA' && e.pergunta).toBe('quantas UN tem 1 CX?')
    // ⛔ e a linha NÃO fecha
    expect(fatorEfetivo(l, e)).toBeNull()
    expect(linhaBloqueada(l, e)).toContain('quantas UN tem 1 CX?')
  })

  it('⛔⛔ NÃO existe caminho que devolva 1 quando as unidades diferem e ninguém sabe', () => {
    // é o bug da Skol travado: o "1 por omissão" tem que ser impossível de alcançar
    for (const uCom of ['CX', 'FD', 'PC', 'EB']) {
      const l = linha({ xProd: 'x', uCom, unidadeControle: 'UN' })
      expect(fatorEfetivo(l, estadoDoFator(l, null, null))).toBeNull()
    }
  })

  it('⭐ digitou o fator → desbloqueia, e é o digitado que vale', () => {
    const l = linha({ xProd: 'CERV SKOL 600ML', uCom: 'CX', unidadeControle: 'UN', fatorTexto: '20' })
    const e = estadoDoFator(l, null, null)
    expect(fatorEfetivo(l, e)).toBe(20)
    expect(linhaBloqueada(l, e)).toBeNull()
  })
})

describe('⭐ a ORDEM de resolução (a mesma do módulo)', () => {
  const l = linha({ xProd: 'FRUKI GUARANA 600ML 12UN', uCom: 'EB', unidadeControle: 'UN' })

  it('1º o mapa APRENDIDO do fornecedor manda', () => {
    const e = estadoDoFator(l, 12, { fator: 99, explicacao: 'errado' })
    expect(e.tipo).toBe('APRENDIDO')
    expect(fatorEfetivo(l, e)).toBe(12)
  })

  it('2º sem mapa, a SUGESTÃO pelo nome — com a conta à vista', () => {
    const e = estadoDoFator(l, null, { fator: 12, explicacao: '1 EB = 12 UN · R$ 3,75/UN' })
    expect(e.tipo).toBe('SUGERIDO')
    expect(e.tipo === 'SUGERIDO' && e.explicacao).toContain('12 UN')
    // ⚠️ sugestão PREENCHE e continua editável — sugerir não é decidir
    expect(fatorEfetivo(l, e)).toBe(12)
  })

  it('⭐ e o digitado sobrepõe QUALQUER sugestão (a última palavra é do dono)', () => {
    const comDigito = { ...l, fatorTexto: '24' }
    expect(fatorEfetivo(comDigito, estadoDoFator(comDigito, 12, null))).toBe(24)
  })
})

describe('⭐ unidades IGUAIS: fator 1 é identidade, não suposição', () => {
  it('⭐ não pergunta nada quando a nota e o cadastro usam a mesma unidade', () => {
    const l = linha({ xProd: 'TOMATE', uCom: 'KG', unidadeControle: 'KG' })
    const e = estadoDoFator(l, null, null)
    expect(e.tipo).toBe('IDENTIDADE')
    expect(fatorEfetivo(l, e)).toBe(1)
    expect(linhaBloqueada(l, e)).toBeNull()
  })

  it('⚠️ caixa e espaço não fazem diferença ("kg" == "KG ")', () => {
    const l = linha({ xProd: 'x', uCom: 'kg ', unidadeControle: 'KG' })
    expect(estadoDoFator(l, null, null).tipo).toBe('IDENTIDADE')
  })

  it('⚠️ perguntar aqui viraria ruído — e alarme que se ignora não protege nada', () => {
    const l = linha({ xProd: 'x', uCom: 'UN', unidadeControle: 'UN' })
    expect(linhaBloqueada(l, estadoDoFator(l, null, null))).toBeNull()
  })
})

describe('⭐⭐ escolher no catálogo CRIA O VÍNCULO, não substitui a descrição', () => {
  it('⭐⭐ a descrição DO DANFE fica intacta — é o que o dono leu no papel', () => {
    const antes = [linha({ xProd: 'TOMATE LONGA VIDA CX 20KG', qCom: '2', uCom: 'CX', vUnCom: '80' })]
    const depois = aplicarItemEscolhido(antes, 0, { id: 'i1', nome: 'Tomate', unidadeControle: 'KG' })
    expect(depois[0].xProd).toBe('TOMATE LONGA VIDA CX 20KG') // ⭐ NÃO virou "Tomate"
    expect(depois[0].itemId).toBe('i1')
    expect(depois[0].itemNome).toBe('Tomate')
    expect(depois[0].unidadeControle).toBe('KG') // ⭐ a unidade vem do CADASTRO
    expect(depois[0].uCom).toBe('CX')            // ⭐ e a da NOTA continua sendo a da nota
  })

  it('⛔ escolher numa linha NÃO mexe nas outras (não perde o que já foi digitado)', () => {
    const antes = [
      linha({ xProd: 'TOMATE LONGA VIDA', qCom: '2', uCom: 'CX', vUnCom: '80' }),
      linha({ xProd: 'ALFACE CRESPA', qCom: '10', uCom: 'UN', vUnCom: '3,50' }),
      linha({ xProd: 'BANANA', qCom: '5', uCom: 'KG', vUnCom: '6' }),
    ]
    const depois = aplicarItemEscolhido(antes, 1, { id: 'i2', nome: 'Alface', unidadeControle: 'UN' })
    expect(depois[0]).toEqual(antes[0])
    expect(depois[2]).toEqual(antes[2])
    expect(depois[1].itemId).toBe('i2')
  })

  it('⭐ desfazer o vínculo volta a texto livre, sem perder o que foi digitado', () => {
    const com = aplicarItemEscolhido([linha({ xProd: 'TOMATE', qCom: '2', uCom: 'CX', vUnCom: '80' })], 0,
      { id: 'i1', nome: 'Tomate', unidadeControle: 'KG' })
    const sem = limparVinculo(com, 0)
    expect(sem[0].itemId).toBeNull()
    expect(sem[0].xProd).toBe('TOMATE')
    expect(sem[0].qCom).toBe('2')
    expect(sem[0].vUnCom).toBe('80')
    expect(estadoDoFator(sem[0], null, null).tipo).toBe('SEM_VINCULO')
  })

  it('⚠️ linha em branco não bloqueia nada (dá pra salvar com linhas sobrando)', () => {
    const l = linhaVazia()
    expect(linhaBloqueada(l, estadoDoFator(l, null, null))).toBeNull()
  })
})
