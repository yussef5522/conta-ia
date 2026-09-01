// ⭐⭐ A EMPRESA NÃO PODE FICAR SEM MODELO (01/09/2026).
//
// ⚠️ Regra levantada pelo DONO antes de eu construir a lista: *"a lista precisa mostrar
// qual é o padrão E impedir excluir o padrão (ou o único modelo). Senão o próximo bug é a
// empresa ficar sem modelo nenhum."*
//
// ⛔ POR QUE SERIA GRAVE, e é a parte que não se vê: sem modelo, `lerBlocos(null)` cai no
// `BLOCOS_PADRAO` de fábrica. **A etiqueta continua saindo** — com o desenho de fábrica em
// vez do que o dono desenhou, e sem nada na tela dizendo que trocou. É a falha silenciosa
// que este módulo mais combate, e ela seria descoberta com a etiqueta já colada no pacote.

import { describe, it, expect } from 'vitest'
import { motivoParaNaoExcluir, mensagemDeRecusa } from '../excluir-modelo'
import { lerBlocos, BLOCOS_PADRAO } from '../blocos'

const padrao = { id: 'm1', nome: 'Padrão', padrao: true }
const outro = { id: 'm2', nome: 'Calabresa', padrao: false }

describe('⛔⛔ as duas recusas', () => {
  it('⛔⛔ o ÚNICO modelo não sai, mesmo não sendo padrão', () => {
    expect(motivoParaNaoExcluir(outro, 1)).toBe('E_O_UNICO')
    expect(mensagemDeRecusa('E_O_UNICO', outro)).toContain('desenho de fábrica')
  })

  it('⛔⛔ o PADRÃO não sai enquanto for o padrão', () => {
    expect(motivoParaNaoExcluir(padrao, 3)).toBe('E_O_PADRAO')
    expect(mensagemDeRecusa('E_O_PADRAO', padrao)).toContain('Marque outro como padrão')
  })

  it('⭐ um modelo comum, com outros na empresa, SAI', () => {
    expect(motivoParaNaoExcluir(outro, 2)).toBeNull()
    expect(mensagemDeRecusa(null, outro)).toBeNull()
  })

  it('⚠️ com UM só modelo, as duas regras valem — e ganha a do ÚNICO', () => {
    // ⚠️ a ordem importa: a mensagem útil é a do único (ele precisa CRIAR outro, não
    // apenas trocar o padrão). Dizer "marque outro como padrão" não teria outro pra marcar.
    expect(motivoParaNaoExcluir(padrao, 1)).toBe('E_O_UNICO')
  })

  it('⭐ a recusa ENSINA — nunca só "não pode"', () => {
    for (const [motivo, alvo] of [['E_O_UNICO', outro], ['E_O_PADRAO', padrao]] as const) {
      const msg = mensagemDeRecusa(motivo, alvo)!
      expect(msg).toContain(alvo.nome)          // diz QUAL
      expect(msg.length).toBeGreaterThan(60)    // e diz POR QUÊ e o que fazer
    }
  })
})

describe('⛔ o que aconteceria se a empresa ficasse sem modelo', () => {
  it('⛔⛔ a etiqueta NÃO para de sair — ela sai com o desenho de FÁBRICA, calada', () => {
    // é exatamente por isso que a recusa existe: o estrago não daria erro em lugar nenhum.
    const semModelo = lerBlocos(null)
    expect(semModelo).toEqual(BLOCOS_PADRAO)
    expect(semModelo.length).toBeGreaterThan(0)
  })
})
