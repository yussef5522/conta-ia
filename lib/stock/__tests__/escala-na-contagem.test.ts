// ⭐⭐⭐ O FREIO APRENDE A PERGUNTA CERTA (20/09/2026).
//
// **O caso, medido em prod:** `CREME LEITE ITALAC 200GR` contada como **16.600** com o
// sistema em **177**. O freio DISPAROU, perguntou *"a contagem está 9280% fora do
// sistema"*, e a marcyelle **confirmou**. Resultado: R$ 39.342,36 de estoque fantasma que
// seguem lá. No mesmo dia o `REQUEIJAO CHEDDAR` levou 28.500 no lugar de 28,5.
//
// ⛔⛔ ***Pergunta vaga é pergunta que se confirma sem ler.*** A ordem do dono: a pergunta
// passa a ser específica, com o número certo em 1 toque — e **confirmar o absurdo continua
// possível**, porque um dia o número absurdo vai ser verdade.

import { describe, it, expect } from 'vitest'
import { acharTrocaDeEscala } from '../escala'
import { avaliarFreio } from '../contagem'

describe('⭐⭐ os TRÊS casos REAIS desta casa', () => {
  it('⭐ CREME LEITE: 16.600 com o sistema em 177 → "você quis dizer 166?"', () => {
    const r = acharTrocaDeEscala(16600, 177, { unidadeInteira: true, unidade: 'UN' })
    expect(r).not.toBeNull()
    expect(r!.fator).toBe(100)
    expect(r!.provavel).toBe(166)
    expect(r!.pergunta).toContain('Você quis dizer 166')
    // ⛔ e o número do sistema aparece na pergunta — sem ele, a frase é uma acusação vaga
    expect(r!.pergunta).toContain('177')
  })

  it('⭐ REQUEIJÃO: 28.500 com o sistema em 31 → "você quis dizer 28,5?"', () => {
    const r = acharTrocaDeEscala(28500, 31, { unidade: 'KG' })
    expect(r!.fator).toBe(1000)
    expect(r!.provavel).toBe(28.5)
    // ⭐ vírgula, não ponto: é o número como ele vai DIGITAR
    expect(r!.pergunta).toContain('28,5')
  })

  it('⭐ e a MAIONESE de 19/09 cai na mesma régua, por outro caminho', () => {
    // ⚠️ lá a régua foi o rendimento histórico da ficha (produção); aqui é o saldo. Duas
    // perguntas diferentes que leem o MESMO mundo: unidade mental ≠ unidade de controle.
    const r = acharTrocaDeEscala(22864, 25, { unidade: 'KG' })
    expect(r!.fator).toBe(1000)
    expect(r!.provavel).toBe(22.864)
  })
})

describe('⛔⛔ e ela NÃO fala quando não tem o que dizer', () => {
  it('número grande que BATE com o sistema não é suspeito', () => {
    // 16.600 tampinhas com 16.000 no sistema é um estoque normal
    expect(acharTrocaDeEscala(16600, 16000, { unidadeInteira: true })).toBeNull()
  })

  it('⛔ número aleatório não vira palpite — o saldo é a âncora', () => {
    // sem âncora isto viraria "todo número grande é suspeito", e alarme sobre número
    // grande é como um alarme morre
    expect(acharTrocaDeEscala(5000, 3, {})).toBeNull()
    expect(acharTrocaDeEscala(777, 3, {})).toBeNull()
  })

  it('⛔ contagem MENOR que o sistema não é troca de escala', () => {
    // é o caso comum (consumo não lançado) — e o freio antigo já cuida dele
    expect(acharTrocaDeEscala(5, 500, {})).toBeNull()
  })

  it('⛔ item sem saldo no sistema não tem âncora — não chuta', () => {
    expect(acharTrocaDeEscala(16600, 0, {})).toBeNull()
  })

  it('⭐ em UN não sugere fração — seria oferecer o que o sistema recusa', () => {
    // 16.600 / 1000 = 16,6 → inválido em UN; a régua cai pro 100 (=166), que é inteiro
    const r = acharTrocaDeEscala(16600, 20, { unidadeInteira: true, unidade: 'UN' })
    if (r) expect(Number.isInteger(r.provavel)).toBe(true)
  })
})

describe('⭐⭐ o FREIO devolve a pergunta específica e o número', () => {
  it('⭐ no caso real, o motivo É a pergunta e a sugestão vem junto', () => {
    const f = avaliarFreio(177, 16600, 2.37, { unidadeControle: 'UN' })
    expect(f.grande).toBe(true)
    expect(f.motivo).toContain('Você quis dizer 166')
    expect(f.sugestao).toEqual({ provavel: 166, fator: 100 })
  })

  it('⛔ divergência grande SEM assinatura de escala mantém a pergunta antiga', () => {
    // ⚠️ o freio velho não foi substituído: ele continua sendo a rede pro resto
    const f = avaliarFreio(100, 300, 5)
    expect(f.grande).toBe(true)
    expect(f.sugestao).toBeNull()
    expect(f.motivo).toMatch(/vale R\$|% fora do sistema/)
  })

  it('⭐ e o que está certo continua passando sem perguntar nada', () => {
    const f = avaliarFreio(100, 98, 5)
    expect(f.grande).toBe(false)
    expect(f.sugestao).toBeNull()
  })
})
