// ⭐⭐⭐ `?abrir=` SEMPRE MOSTRA O CARD DAQUELA LINHA (13/09/2026) — contrato do dono.
//
// **O relato, medido com os dois ids dele:** clicar "casar conta" no PJBANK 183,65 abria
// a Conciliação **sem o card** — *"só o Casper de sempre"*. A ROTA devolvia o card certo
// (medido em prod: 3 cards, o do PJBANK entre eles); **quem o perdia era a TELA**.
//
// ⛔⛔ **A CAUSA ERA MINHA, de hoje de manhã:** eu dei `fornecedorId: ''` pro card da linha
// sem fornecedor reconhecido, e a fila usa o id do grupo como *"quem está aberto"* —
// com `a && …`, string vazia é **falsy**: o grupo abria e **se fechava no mesmo render**.
//
// ⭐ *"Deep-link que abre a tela sem o alvo é porta pintada na parede."*

import { describe, it, expect } from 'vitest'
import { agruparDTO } from '@/components/conciliacao/fila-escolher-na-mao'
import { identidadeDoCard } from '@/lib/conciliacao/escolher-na-mao'
import type { CardDeEscolhaDTO } from '@/components/conciliacao/escolher-na-mao-card'

const card = (id: string, fornecedorId: string, fornecedorNome: string): CardDeEscolhaDTO => ({
  linha: { id, descricao: 'PJBANK PAGAMENTOS S.A. - Transferência', valor: 183.65, data: '2026-09-11', conta: 'stone', categoria: null },
  fornecedorId, fornecedorNome, vencidas: [], aVencer: [], atalho: null, semFornecedor: [],
})

/** a MESMA redução da fila: "o grupo aberto ainda existe?" */
const aindaAberto = (a: string | null, grupos: { fornecedorId: string }[]) =>
  a !== null && grupos.some((g) => g.fornecedorId === a) ? a : null

// ⚠️⚠️ A REGRA 11 ME PEGOU AQUI e o bloco abaixo é a correção.
//
// A 1ª versão deste guard montava os cards À MÃO e testava só a `agruparDTO` — repondo o
// `fornecedorId: ''` NA ROTA, ele continuava **VERDE**. *Guard que pergunta pro fixture
// em vez de perguntar a quem decide não prova nada.* A decisão saiu pra `identidadeDoCard`
// e é ELA que responde aqui.
describe('⛔⛔⛔ quem decide a identidade do card — a função que a rota chama', () => {
  const linha = { id: 'l1', descricao: 'PJBANK PAGAMENTOS S.A. - Transferência | Pix' }

  it('⭐⭐ sem fornecedor reconhecido: id NÃO-VAZIO e único por linha', () => {
    const r = identidadeDoCard(null, null, linha)
    expect(r.fornecedorId, 'id vazio volta a fechar o grupo no mesmo render').not.toBe('')
    expect(r.fornecedorId).toBe('linha:l1')
  })

  it('⭐⭐ e o NOME é o que o banco escreveu — cabeçalho em branco não se procura', () => {
    expect(identidadeDoCard(null, null, linha).fornecedorNome)
      .toBe('PJBANK PAGAMENTOS S.A. - Transferência | Pix')
  })

  it('⭐ com fornecedor reconhecido, nada muda — o nome dele manda', () => {
    const r = identidadeDoCard('f1', 'FOCATTO DISTRIBUIDORA', linha)
    expect(r).toEqual({ fornecedorId: 'f1', fornecedorNome: 'FOCATTO DISTRIBUIDORA' })
  })

  it('⚠️ fornecedor com nome VAZIO cai pro texto da linha — nunca cabeçalho mudo', () => {
    expect(identidadeDoCard('f1', '  ', linha).fornecedorNome).toBe(linha.descricao)
  })

  it('⭐ duas linhas não reconhecidas são DOIS grupos — não têm nada em comum', () => {
    const a = identidadeDoCard(null, null, linha)
    const b = identidadeDoCard(null, null, { id: 'l2', descricao: 'MIXX PLAY - Pagamento' })
    expect(a.fornecedorId).not.toBe(b.fornecedorId)
  })
})

describe('⛔⛔ o grupo da linha sem fornecedor não pode nascer falsy', () => {
  it('⭐⭐ o card ganha um id NÃO-VAZIO — senão o grupo fecha sozinho', () => {
    const g = agruparDTO([card('l1', 'linha:l1', 'PJBANK PAGAMENTOS S.A.')])
    expect(g).toHaveLength(1)
    expect(g[0].fornecedorId, 'id vazio volta a quebrar a abertura').not.toBe('')
    expect(aindaAberto(g[0].fornecedorId, g), 'o grupo fechou no mesmo render').toBe(g[0].fornecedorId)
  })

  it('⛔⛔ O CONTRAFACTUAL: com id vazio, a redução FECHA o grupo que acabou de abrir', () => {
    // ⚠️ é ele que prova que o bug era este, e não outra coisa — sem o contrafactual o
    // teste de cima passaria verde num mundo onde o id nunca foi vazio
    const g = agruparDTO([card('l1', '', '')])
    expect(aindaAberto('', g)).toBe('') // ⭐ com a régua nova (`a !== null`) sobrevive
    // ⛔ a régua VELHA, executada: `a && …` com string vazia devolvia null e fechava o grupo
    const reguaVelha = (a: string | null) => (a && g.some((x) => x.fornecedorId === a) ? a : null)
    expect(reguaVelha(''), 'a régua velha deixaria o grupo aberto — então não era ela').toBeNull()
  })

  it('⭐⭐ e o card tem NOME — cabeçalho em branco é um card que o dono não reconhece', () => {
    const g = agruparDTO([card('l1', 'linha:l1', 'PJBANK PAGAMENTOS S.A.')])
    expect(g[0].fornecedorNome).toBe('PJBANK PAGAMENTOS S.A.')
  })

  it('⭐ cada linha não reconhecida é o PRÓPRIO grupo — elas não têm nada em comum', () => {
    // ⛔ juntá-las num grupo "sem fornecedor" faria a navegação ‹ anterior / próxima ›
    // passear entre pagamentos que não têm relação nenhuma
    const g = agruparDTO([card('l1', 'linha:l1', 'PJBANK'), card('l2', 'linha:l2', 'MIXX PLAY')])
    expect(g).toHaveLength(2)
  })
})
