import { describe, expect, it } from 'vitest'
import { ehQuedaDeRede, fraseDoErro } from '../frase-do-erro'

/**
 * ⛔⛔ OS DOIS LADOS DO CATCH (18/10/2026) — e o teste existe porque a frase errada custou
 * dois dias de import parado: *"Falha de conexão ao processar"* sobre um `TypeError` nosso.
 */
const FRASES = { rede: 'Falha de conexão ao processar. Tentar de novo?', falhou: 'Não consegui montar o preview' }

describe('throw que NÃO é de rede mostra a causa real', () => {
  it('⭐ o defeito de 16/10: o circular do JSON.stringify aparece na tela', () => {
    // a reprodução exata: evento do React é circular, e isto estoura ANTES do fetch
    const circular: Record<string, unknown> = {}
    circular.self = circular
    let erro: unknown
    try { JSON.stringify({ confirmouDia: circular }) } catch (e) { erro = e }

    const frase = fraseDoErro(erro, FRASES)
    expect(frase).toContain('Converting circular structure to JSON')
    expect(frase).toContain('NÃO é problema de conexão')
    // ⛔ a frase antiga mentia: ela NÃO pode mais aparecer num throw que não é de rede
    expect(frase).not.toContain('Falha de conexão ao processar. Tentar de novo?')
  })

  it('qualquer defeito nosso aparece nomeado, não disfarçado de internet', () => {
    const frase = fraseDoErro(new TypeError("Cannot read properties of null (reading 'plano')"), FRASES)
    expect(frase).toContain("Cannot read properties of null (reading 'plano')")
    expect(ehQuedaDeRede(new TypeError('qualquer coisa'))).toBe(false)
  })

  it('throw que não é Error também não some', () => {
    expect(fraseDoErro('deu ruim', FRASES)).toContain('deu ruim')
    expect(fraseDoErro(undefined, FRASES)).toContain('erro desconhecido')
  })
})

describe('queda de rede DE VERDADE continua com a frase de conexão', () => {
  /**
   * ⚠️⚠️ **E é por isso que a régua é a MENSAGEM, nunca a classe do erro:** queda de rede
   * também é `TypeError` nos três motores. Olhar `e instanceof TypeError` não distinguiria
   * nada — foi a 1ª ideia, e o dado a derrubou.
   */
  it.each([
    ['Chrome/Edge', new TypeError('Failed to fetch')],
    ['Firefox', new TypeError('NetworkError when attempting to fetch resource.')],
    ['Safari', new TypeError('Load failed')],
    ['Safari offline', new TypeError('The Internet connection appears to be offline.')],
  ])('%s → frase de conexão', (_motor, e) => {
    expect(ehQuedaDeRede(e)).toBe(true)
    expect(fraseDoErro(e, FRASES)).toBe(FRASES.rede)
    expect(e).toBeInstanceOf(TypeError) // o contrafactual: a classe é a MESMA do defeito
  })

  it('fetch derrubado de verdade (sem servidor) cai no lado da conexão', async () => {
    let erro: unknown
    // ⚠️ porta fechada em localhost: o `fetch` rejeita como queda de rede, igual ao browser
    try { await fetch('http://127.0.0.1:1/isso-nao-existe') } catch (e) { erro = e }
    expect(erro).toBeDefined()
    expect(fraseDoErro(erro, FRASES)).toBe(FRASES.rede)
  })

  it('abort (tempo esgotado ou tela desmontada) também é lado da conexão', () => {
    const e = new Error('abortado')
    e.name = 'AbortError'
    expect(fraseDoErro(e, FRASES)).toBe(FRASES.rede)
  })
})
