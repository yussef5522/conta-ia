/**
 * ⛔⛔⛔ A CICATRIZ DO CAMPO — *"quando vou troca numero eu excluir ele volta na hora mesmo
 * numero"* (dor do dono, 14/10/2026).
 *
 * **O vermelho que o dono ditou: APAGAR E O VALOR VOLTAR SOZINHO.** Este arquivo escreve a
 * digitação REAL que ele descreveu — apagar tudo · `"7"` · `"78,"` · vazio + blur — porque o
 * defeito só existe na SEQUÊNCIA: um teste que só olhasse o estado final não veria a média
 * reaparecendo no meio do caminho.
 *
 * ⚠️ E ele existe porque a régua saiu do `useState` pra uma lib pura: o projeto roda em
 * `environment: node`, sem jsdom — *regra que mora num `value={...}` é regra que ninguém
 * prova* (o prefill do cardápio quebrou DUAS vezes antes de virar função).
 */
import { describe, it, expect } from 'vitest'
import {
  CAMPO_INTOCADO,
  digitar,
  mostrarVoltarParaMedia,
  precoDoCampo,
  textoDoCampo,
  type TextoDoCampo,
} from '../campo-de-preco'

/** a média real do PDV do XIS - COMPLETO no caso que o dono trouxe */
const MEDIA = 95.9

describe('o campo de preço é DONO do texto enquanto se digita', () => {
  it('⭐ nasce com a média do PDV — intocado é o único estado em que ela aparece', () => {
    expect(textoDoCampo(CAMPO_INTOCADO, MEDIA)).toBe('95,90')
    expect(precoDoCampo(CAMPO_INTOCADO, MEDIA)).toBe(95.9)
    expect(mostrarVoltarParaMedia(CAMPO_INTOCADO, MEDIA)).toBe(false)
  })

  it('⛔⛔ A DIGITAÇÃO REAL DO DONO: apagar tudo · "7" · "78," · vazio + blur', () => {
    // apaga tudo
    let txt: TextoDoCampo = digitar('')
    expect(txt, 'apagar é uma RESPOSTA do dono, não ausência de estado').toBe('')
    expect(textoDoCampo(txt, MEDIA), '⛔ a média NÃO pode voltar').toBe('')
    expect(precoDoCampo(txt, MEDIA), 'campo apagado → farol neutro, nunca a média').toBeNull()
    expect(mostrarVoltarParaMedia(txt, MEDIA), 'o caminho de volta existe').toBe(true)

    // digita o 7
    txt = digitar('7')
    expect(textoDoCampo(txt, MEDIA)).toBe('7')
    expect(precoDoCampo(txt, MEDIA)).toBe(7)

    // digita a vírgula pendurada — o estado intermediário que um `value` numérico destrói
    txt = digitar('78,')
    expect(textoDoCampo(txt, MEDIA), 'a vírgula pendurada sobrevive').toBe('78,')
    expect(precoDoCampo(txt, MEDIA)).toBe(78)

    // apaga de novo (e o blur não muda nada: não existe reposição em lugar nenhum)
    txt = digitar('')
    expect(textoDoCampo(txt, MEDIA), '⛔ nem no blur a média volta').toBe('')
    expect(textoDoCampo(textoDoCampo(txt, MEDIA), MEDIA), 'idempotente: reler não repõe').toBe('')
  })

  it('⛔ texto ilegível é "—", nunca a média', () => {
    const txt = digitar('abc')
    expect(txt).toBe('')
    expect(precoDoCampo(txt, MEDIA)).toBeNull()
  })

  it('⭐ o ponto é MILHAR, não decimal — 1.500 são mil e quinhentos', () => {
    expect(precoDoCampo(digitar('1.500'), MEDIA)).toBe(1500)
    expect(precoDoCampo(digitar('1,50'), MEDIA)).toBe(1.5)
  })

  it('⭐ "↺ voltar pra média" aparece só quando o valor DIFERE da média (ou está vazio)', () => {
    expect(mostrarVoltarParaMedia(digitar('78,00'), MEDIA), 'difere → aparece').toBe(true)
    expect(mostrarVoltarParaMedia(digitar(''), MEDIA), 'vazio → aparece (tem que haver volta)').toBe(true)
    expect(mostrarVoltarParaMedia(digitar('95,90'), MEDIA), 'voltou a ser a média → some').toBe(false)
    expect(mostrarVoltarParaMedia(CAMPO_INTOCADO, MEDIA), 'intocado JÁ é a média → some').toBe(false)
  })

  it('⛔ sem média não há pra onde voltar — o link não aparece', () => {
    expect(mostrarVoltarParaMedia(digitar('30'), null)).toBe(false)
    expect(textoDoCampo(CAMPO_INTOCADO, null), 'e o campo nasce vazio').toBe('')
    expect(precoDoCampo(CAMPO_INTOCADO, null)).toBeNull()
  })
})
