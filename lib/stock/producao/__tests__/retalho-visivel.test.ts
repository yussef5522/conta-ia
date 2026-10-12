/**
 * ⭐⭐⭐ O RETALHO VISÍVEL NA PÁGINA DA ORDEM (12/10/2026).
 *
 * **O caso real que motivou:** ordem de **10 UN** de *metade de bolinha massa de pizza*
 * declarando **10 KG** de retalho de ontem. A página mostrava *"deve sair ~12 UN (pela sua
 * média)"* e **nenhum sinal do retalho** — o dono perguntou se não era a quantidade do pedido
 * que devia mudar. **Não é** (pedido comanda separação; retalho não gasta material), mas a
 * tela tinha que DIZER que os 10 KG estão lá.
 *
 * ⛔ Os dois vermelhos que o dono nomeou moram aqui:
 *   · *"ordem COM retalho gravado sem a linha visível no pedido = vermelho"*;
 *   · *"frase sem o total (só a massa nova) = vermelho"*.
 */
import { describe, it, expect } from 'vitest'
import { linhaDoRetalho, fraseDaSeparacao, unidadesDoRetalho, PESO_DA_METADE_G } from '../retalho'

/** ⭐ o caso do dono, com os números dele */
const CASO = { aceita: true, kg: 10, pesoUnidadeG: PESO_DA_METADE_G, unidade: 'UN' }

describe('⭐⭐ a LINHA do retalho no bloco do pedido', () => {
  it('⭐⭐ o CASO REAL: 10 KG viram "+50 UN" e a linha DIZ isso', () => {
    const l = linhaDoRetalho(CASO)
    expect(l, 'a receita aceita — a linha existe').not.toBeNull()
    expect(l!.declarado).toBe(true)
    expect(l!.bonus).toBe(50)
    /** ⭐ a frase que o dono pediu: o kg que ele pesou e o que ele rende */
    expect(l!.texto).toContain('retalho de ontem')
    expect(l!.texto).toContain('10 KG')
    expect(l!.texto).toContain('+50 UN')
  })

  /**
   * ⛔⛔ A SAÍDA QUE FECHA A DÚVIDA: receita que ACEITA e ordem SEM retalho declarado.
   *
   * Sem esta linha, a ausência significaria duas coisas — *"não declarei"* e *"a receita não
   * aceita"* — e o dono ficaria sem saber qual, justo no caso em que ele esqueceu de declarar.
   */
  it('⛔⛔ aceita e SEM retalho → "sem retalho declarado" (ausência nunca é dúvida)', () => {
    for (const kg of [null, undefined, 0]) {
      const l = linhaDoRetalho({ ...CASO, kg })
      expect(l, `kg=${kg} ainda produz linha`).not.toBeNull()
      expect(l!.declarado).toBe(false)
      expect(l!.bonus, 'bônus é null, nunca zero').toBeNull()
      expect(l!.texto).toBe('sem retalho declarado')
    }
  })

  /** ⛔ receita que NÃO aceita: a tela não diz nada, como hoje */
  it('⛔ receita que não aceita retalho não ganha linha nenhuma', () => {
    expect(linhaDoRetalho({ ...CASO, aceita: false })).toBeNull()
    expect(linhaDoRetalho({ ...CASO, aceita: false, kg: null })).toBeNull()
  })

  /** ⚠️ peso da unidade quebrado não inventa bônus — cai no "sem retalho declarado" */
  it('⚠️ sem peso de unidade não dá pra converter — e não chuta', () => {
    const l = linhaDoRetalho({ ...CASO, pesoUnidadeG: 0 })
    expect(l!.declarado).toBe(false)
    expect(l!.bonus).toBeNull()
  })

  /** ⭐ a conversão é a MESMA porta do fiscal — não existe 2ª régua de kg→unidades */
  it('⭐ o bônus da linha é o `unidadesDoRetalho`, não uma conta própria', () => {
    expect(linhaDoRetalho({ ...CASO, kg: 9.2 })!.bonus).toBe(unidadesDoRetalho(9.2, PESO_DA_METADE_G))
  })
})

describe('⭐⭐ a FRASE da separação diz o TOTAL', () => {
  /**
   * ⭐⭐⭐ O vermelho nº 2 do dono: *"frase sem o total (só a massa nova) = vermelho"*.
   *
   * A frase que ele viu dizia *"deve sair ~12 UN"* numa ordem que vai render 62 — a tela
   * escondendo a metade do lote.
   */
  it('⭐⭐⭐ o CASO REAL: ~12 da massa nova + 50 do retalho = "~62 UN no total"', () => {
    const f = fraseDaSeparacao({ daMassaNova: 12, porMedia: true, bonusDoRetalho: 50, unidade: 'UN' })
    expect(f).toContain('~62 UN no total')
    expect(f, 'a quebra fica à vista — senão o 62 não se confere').toContain('~12 da massa nova')
    expect(f).toContain('50 do retalho')
    /** ⚠️ e a régua continua NOMEADA: espelho sem nome não se audita */
    expect(f).toContain('pela sua média')
  })

  it('⭐ sem retalho a frase é a de hoje — o pedido não vira novidade', () => {
    const f = fraseDaSeparacao({ daMassaNova: 12, porMedia: true, bonusDoRetalho: null, unidade: 'UN' })
    expect(f).toBe('Com isso deve sair ~12 UN (pela sua média)')
    expect(f, 'sem retalho não existe "no total"').not.toContain('no total')
  })

  it('⭐ a régua da ficha também é dita quando não há média', () => {
    const f = fraseDaSeparacao({ daMassaNova: 200, porMedia: false, bonusDoRetalho: 46, unidade: 'UN' })
    expect(f).toContain('~246 UN no total')
    expect(f).toContain('pelo que a receita promete')
  })

  /** ⛔ sem massa nova não existe total — somar o bônus a nada seria inventar o lote */
  it('⛔ sem o número da separação não há frase', () => {
    expect(fraseDaSeparacao({ daMassaNova: null, porMedia: true, bonusDoRetalho: 50, unidade: 'UN' })).toBeNull()
    expect(fraseDaSeparacao({ daMassaNova: undefined, porMedia: false, bonusDoRetalho: null, unidade: 'UN' })).toBeNull()
  })

  /**
   * ⭐ O TOTAL DA FRASE É O MESMO NÚMERO QUE O FISCAL PERMITE — por construção.
   *
   * ⚠️ O fiscal soma `permitido = material + retalho ÷ 200 g`; aqui a soma é
   * `massa nova + o MESMO bônus`. Se a frase tivesse conta própria, a tela prometeria um total
   * e o fiscal mediria contra outro.
   */
  it('⭐ a soma usa o bônus que o fiscal usa, sem arredondar no meio', () => {
    const bonus = unidadesDoRetalho(9.2, PESO_DA_METADE_G)!
    const f = fraseDaSeparacao({ daMassaNova: 200, porMedia: false, bonusDoRetalho: bonus, unidade: 'UN' })
    expect(bonus).toBe(46)
    expect(f).toContain('~246 UN no total')
  })
})
