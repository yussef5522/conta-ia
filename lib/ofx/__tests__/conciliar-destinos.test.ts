// REGRA 1 — A 13ª LINHA SUMIU E NINGUÉM VIU (28/08/2026).
//
// O arquivo `Extrato_20260828.ofx` tinha **129 linhas**. O preview mostrou **12 novas**. A
// linha "26/08 EMPRESTIMO −2.444,62" foi descartada pela heurística de FITID e **não
// apareceu em lugar nenhum** — nem na revisão, nem num "descartadas", nem no log. O gate
// travou pelo SALDO, e o dono ficou com um enigma de R$ 2.444,62 em vez de uma linha
// marcada com o motivo.
//
// ⚠️ POR QUE ESTE INVARIANTE É MAIS FORTE QUE O GATE DE SALDO: o gate só acusa quando a
// linha perdida desequilibra o LEDGERBAL. Linha perdida cujo valor empata com outra coisa,
// ou período em que o LEDGERBAL não é confiável (Banrisul embute bloqueado), some sem
// alarme. **Contar LINHAS não depende de saldo.**

import { describe, it, expect } from 'vitest'
import { conciliarDestinos, contarDestinos, type DestinoLinha } from '../conciliar-destinos'

describe('⭐⭐ o caso real: 129 linhas, 12 classificadas, 1 sumida', () => {
  it('⭐ a conta NÃO fecha e o import é BLOQUEADO', () => {
    // o estado do preview de 28/08 às 15:09: 12 novas + 115 já existem + 1 futura = 128
    const r = conciliarDestinos({ totalNoArquivo: 129, novas: 12, jaExistem: 115, futuras: 1, ignoradas: 0, ilegiveis: 0 })
    expect(r.fecha).toBe(false)
    expect(r.semDestino).toBe(1)
    expect(r.erro).toContain('sem destino')
    expect(r.erro).toContain('não vai abrir')
  })

  it('⭐⭐ depois do fix do FITID: 13 novas → fecha e abre', () => {
    const r = conciliarDestinos({ totalNoArquivo: 129, novas: 13, jaExistem: 115, futuras: 1, ignoradas: 0, ilegiveis: 0 })
    expect(r.fecha).toBe(true)
    expect(r.erro).toBeNull()
    expect(r.resumo).toBe('129 linhas no arquivo = 13 novas + 115 já no sistema + 1 futura')
  })

  it('⚠️ a mensagem diz que o defeito é NOSSO, não do extrato do cliente', () => {
    const r = conciliarDestinos({ totalNoArquivo: 129, novas: 12, jaExistem: 115, futuras: 1, ignoradas: 0, ilegiveis: 0 })
    expect(r.erro).toContain('não do seu extrato')
  })
})

describe('a conta fecha nos casos normais', () => {
  it('import limpo (tudo novo)', () => {
    expect(conciliarDestinos({ totalNoArquivo: 27, novas: 27, jaExistem: 0, futuras: 0, ignoradas: 0, ilegiveis: 0 }).fecha).toBe(true)
  })

  it('re-import do mesmo arquivo (tudo já existe)', () => {
    const r = conciliarDestinos({ totalNoArquivo: 129, novas: 0, jaExistem: 129, futuras: 0, ignoradas: 0, ilegiveis: 0 })
    expect(r.fecha).toBe(true)
    expect(r.resumo).toContain('0 novas')
  })

  it('linha que o USUÁRIO marcou pra ignorar tem destino — e aparece no resumo', () => {
    const r = conciliarDestinos({ totalNoArquivo: 10, novas: 7, jaExistem: 2, futuras: 0, ignoradas: 1, ilegiveis: 0 })
    expect(r.fecha).toBe(true)
    expect(r.resumo).toContain('1 ignorada por você')
  })

  it('arquivo vazio não quebra', () => {
    expect(conciliarDestinos({ totalNoArquivo: 0, novas: 0, jaExistem: 0, futuras: 0, ignoradas: 0, ilegiveis: 0 }).fecha).toBe(true)
  })
})

describe('⚠️ o outro lado: linha contada DUAS vezes', () => {
  it('soma maior que o arquivo também bloqueia (duplicação na leitura)', () => {
    const r = conciliarDestinos({ totalNoArquivo: 10, novas: 7, jaExistem: 4, futuras: 0, ignoradas: 0, ilegiveis: 0 })
    expect(r.fecha).toBe(false)
    expect(r.semDestino).toBe(-1)
    expect(r.erro).toContain('mais de um destino')
  })
})

describe('⭐ contar A PARTIR DA LISTA, não de contadores à mão', () => {
  it('é assim que a linha sumida vira visível: ela não está na lista', () => {
    // 129 linhas lidas, mas só 128 receberam destino → a contagem denuncia
    const destinos: DestinoLinha[] = [
      ...Array<DestinoLinha>(12).fill('nova'),
      ...Array<DestinoLinha>(115).fill('ja_existe'),
      'futura',
    ]
    const c = contarDestinos(destinos, 129)
    expect(c.novas).toBe(12)
    expect(conciliarDestinos(c).fecha).toBe(false)
  })

  it('com a 13ª classificada, fecha', () => {
    const destinos: DestinoLinha[] = [
      ...Array<DestinoLinha>(13).fill('nova'),
      ...Array<DestinoLinha>(115).fill('ja_existe'),
      'futura',
    ]
    expect(conciliarDestinos(contarDestinos(destinos, 129)).fecha).toBe(true)
  })

  it('⚠️ contador mantido à mão é o que falhou — a lista é a fonte', () => {
    // se alguém "esquecer" de somar um balde, a lista continua certa e a conta acusa
    const destinos: DestinoLinha[] = ['nova', 'ja_existe', 'futura', 'ignorada']
    expect(contarDestinos(destinos, 4)).toEqual({ totalNoArquivo: 4, novas: 1, jaExistem: 1, futuras: 1, ignoradas: 1, ilegiveis: 0 })
    expect(conciliarDestinos(contarDestinos(destinos, 5)).semDestino).toBe(1)
  })
})
