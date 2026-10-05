/**
 * ⭐⭐⭐ A LEI DA LÍNGUA DO BALCÃO — o guard que RECUSA aviso mudo (04/10/2026).
 *
 * **Ordem do dono:** *"**Aviso sem ação clara NÃO PODE ser criado (guard).**"*
 *
 * ⛔⛔ **O TESTE QUE MAIS IMPORTA É O DO "O QUE FAZER".** Esta casa já provou, com número, que
 * alarme sem ação não é lido: o juiz denunciou **R$ 21.968,02** em boletos por **10 dias**
 * (30/08, 5 achados F3 por noite) e nada aconteceu — a frase dizia *"parcela conferida há mais
 * de 7 dias e ainda não foi pro contas a pagar"*, que descreve e não manda. Este arquivo é o
 * que impede a central de nascer com a mesma doença.
 *
 * ⚠️ REGRA 3: executa a lei contra objetos reais — nenhum grep, nenhuma menção.
 */
import { describe, it, expect } from 'vitest'
import { exigirLinguaDoBalcao, avaliarLinguaDoBalcao, AvisoMudoError } from '../lingua-do-balcao'
import type { NovoAviso } from '../tipos'

/** ⭐ o aviso REAL do CHEDDAR — o caso que o dono nomeou na ordem do sprint */
const BOM: NovoAviso = {
  companyId: 'c1',
  setor: 'producao',
  severidade: 'vermelho',
  titulo: 'Não cria ordem de QUEIJO CHEDDAR antes de corrigir a ficha',
  corpo: 'A ficha diz que o lote rende KG e o produto se conta em UN. Se alguém pedir 10, separa queijo pra 1 só.',
  oQueFazer: 'Abra a ficha de QUEIJO CHEDDAR e conserte quantas UN saem de uma receita.',
  acaoRotulo: 'corrigir a ficha',
  acaoHref: '/empresas/c1/estoque/fichas/f1',
  origem: 'FICHA_SEM_COMPARACAO',
  alvo: 'f1',
}

describe('⭐⭐ o aviso do balcão passa', () => {
  it('⭐ o caso real do CHEDDAR é aceito', () => {
    expect(() => exigirLinguaDoBalcao(BOM)).not.toThrow()
    expect(avaliarLinguaDoBalcao(BOM)).toEqual({ ok: true })
  })

  it('⭐ aviso sem BOTÃO passa — nem toda ação tem tela própria', () => {
    expect(() =>
      exigirLinguaDoBalcao({
        ...BOM,
        acaoRotulo: null,
        acaoHref: null,
        oQueFazer: 'Conte o item na próxima contagem da manhã.',
      }),
    ).not.toThrow()
  })
})

describe('⛔⛔ aviso MUDO não pode existir', () => {
  it('⛔⛔ sem "o que fazer" — a exigência central da ordem do dono', () => {
    expect(() => exigirLinguaDoBalcao({ ...BOM, oQueFazer: '   ' })).toThrow(AvisoMudoError)
    const v = avaliarLinguaDoBalcao({ ...BOM, oQueFazer: '' })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.motivo).toMatch(/sem "o que fazer"/)
  })

  it('⛔ sem título e sem corpo', () => {
    expect(() => exigirLinguaDoBalcao({ ...BOM, titulo: '' })).toThrow(/sem título/)
    expect(() => exigirLinguaDoBalcao({ ...BOM, corpo: '' })).toThrow(/sem corpo/)
  })

  /**
   * ⛔⛔ **O TÍTULO É A AÇÃO, não o nome do defeito.** Este é o caso que separa a central do
   * e-mail do juiz: *"Rendimento fora da faixa"* é verdade, é claro, e **ninguém levanta da
   * cadeira por causa dele**.
   */
  it('⛔⛔ título que DESCREVE o problema em vez de mandar a ação', () => {
    expect(() => exigirLinguaDoBalcao({ ...BOM, titulo: 'Rendimento fora da faixa' })).toThrow(
      /precisa ser a AÇÃO/,
    )
    expect(() => exigirLinguaDoBalcao({ ...BOM, titulo: 'Ficha com unidade divergente' })).toThrow(
      /precisa ser a AÇÃO/,
    )
  })

  /**
   * ⚠️⚠️ **A OUTRA METADE DA RÉGUA DO VERBO: ela não pode barrar o CERTO.** Foi medido em prod
   * em 04/10 — o aviso de PADRÃO do fiscal (*"Confere a receita de PICAR BRÓCOLIS — 9 lotes
   * declararam mais do que o material dava"*) foi **RECUSADO**, porque `conferi`/`confir` não
   * casam "Confer**e**". ⛔ E o irmão dele (*"Confere o lançamento de…"*) passava **por
   * acidente**, pela palavra "lançamento". *Guard que barra o certo ensina a afrouxar a régua* —
   * e é a 3ª vez desta classe aqui (`corrig`×Corrija, `troc`×Troque).
   */
  it('⭐⭐ os imperativos que o dono escreve de verdade PASSAM', () => {
    for (const titulo of [
      'Confere a receita de PICAR BRÓCOLIS — 9 lotes declararam mais do que o material dava',
      'Confere o lançamento de CUBA MAIONESE — declarou mais do que o material dava',
      'Corrija a ficha do CHEDDAR',
      'Troque a unidade do lote',
      'Conferir o saldo do fermento',
    ]) {
      expect(() => exigirLinguaDoBalcao({ ...BOM, titulo }), titulo).not.toThrow()
    }
  })

  it('⛔ "o que fazer" sem verbo (um lamento, não uma ação)', () => {
    expect(() => exigirLinguaDoBalcao({ ...BOM, oQueFazer: 'o problema é da ficha' })).toThrow(
      /precisa começar por um verbo/,
    )
  })

  /**
   * ⚠️ A lista de jargão é FECHADA e curta de propósito. Uma régua aberta (tipo *"nada em CAIXA
   * ALTA"*) barraria `QUEIJO CHEDDAR` e `NF`, que é **exatamente como o dono escreve**.
   */
  it('⛔ jargão de sistema em qualquer um dos três campos', () => {
    expect(() => exigirLinguaDoBalcao({ ...BOM, titulo: 'Corrija o invariante M5 da ficha' })).toThrow(/jargão/)
    expect(() => exigirLinguaDoBalcao({ ...BOM, corpo: 'o payload veio null' })).toThrow(/jargão/)
    /** ⚠️ a frase tem verbo ("Confira") DE PROPÓSITO: sem ele o teste reprovaria pela régua do
     *  verbo e eu nunca saberia se a do jargão morde. Teste que falha pelo motivo errado é um
     *  verde disfarçado. */
    expect(() => exigirLinguaDoBalcao({ ...BOM, oQueFazer: 'Confira a migration que falhou' })).toThrow(/jargão/)
  })

  it('⭐ mas o nome do produto em CAIXA ALTA passa (é como o dono escreve)', () => {
    expect(() =>
      exigirLinguaDoBalcao({ ...BOM, titulo: 'Confira a NF 967122 do CASPER antes de pagar' }),
    ).not.toThrow()
  })

  /**
   * ⛔ Botão pela metade é a *"porta pintada na parede"* de 13/09 (rótulo sem destino) e o
   * *"link invisível"* de 30/08 (destino sem rótulo, sem afordância).
   */
  it('⛔ botão pela METADE — rótulo sem destino e destino sem rótulo', () => {
    expect(() => exigirLinguaDoBalcao({ ...BOM, acaoHref: null })).toThrow(/pela metade/)
    expect(() => exigirLinguaDoBalcao({ ...BOM, acaoRotulo: null })).toThrow(/pela metade/)
  })

  /** ⛔ aviso do sistema não manda o dono pra fora — a mesma trava do `redirect` do convite */
  it('⛔ destino externo (open redirect)', () => {
    expect(() => exigirLinguaDoBalcao({ ...BOM, acaoHref: 'https://evil.com' })).toThrow(/caminho interno/)
    expect(() => exigirLinguaDoBalcao({ ...BOM, acaoHref: '//evil.com' })).toThrow(/caminho interno/)
  })

  it('⛔ sem origem ou sem alvo (é o alvo que faz 1 problema não virar 10 avisos)', () => {
    expect(() => exigirLinguaDoBalcao({ ...BOM, origem: '' })).toThrow(/sem origem/)
    expect(() => exigirLinguaDoBalcao({ ...BOM, alvo: '' })).toThrow(/sem alvo/)
  })

  it('⛔ setor/severidade fora do vocabulário', () => {
    expect(() => exigirLinguaDoBalcao({ ...BOM, setor: 'cozinha' as never })).toThrow(/setor desconhecido/)
    expect(() => exigirLinguaDoBalcao({ ...BOM, severidade: 'roxo' as never })).toThrow(/severidade desconhecida/)
  })
})
