/**
 * ⭐⭐⭐ O ANTI-SPAM — PADRÃO, NUNCA LOTE ISOLADO · VERDE SEMANAL · QUEM VÊ O QUÊ (04/10/2026).
 *
 * **Decisões do dono testadas aqui:** *"rendimento avisa por PADRÃO (N lotes seguidos fora, com
 * o nome de quem fez), **NUNCA por lote isolado** — variação de carne é natural"* · *"aviso
 * verde semanal (1 por semana, domingo)"* · *"**financeiro NUNCA aparece na produção (lei)**"*.
 *
 * ⛔⛔ **O NÚMERO QUE JUSTIFICA ESTE ARQUIVO:** o juiz P8 denuncia **42 lotes abaixo de 85%**
 * (medido em 03/10). Sem a régua do padrão, a central nasceria com 42 linhas de ruído e o dono
 * aprenderia a ignorar o sininho na primeira semana — exatamente o que os 111 alarmes falsos de
 * 26/08 ensinaram a esta casa.
 */
import { describe, it, expect } from 'vitest'
import {
  acharPadrao, fraseDoPadrao, LOTES_SEGUIDOS_PRA_PADRAO,
  PCT_IMPOSSIVEL_BAIXO, PCT_IMPOSSIVEL_ALTO, type LoteMedido,
} from '../padrao-de-rendimento'
import { montarSemanaVerde, semanaIso, ehDomingoNoBrasil } from '../semana-verde'
import { setoresVisiveis, podeVerSetor } from '../visibilidade'
import { exigirLinguaDoBalcao } from '../lingua-do-balcao'

function lote(dia: number, pct: number | null, quem: string | null = 'rodrigo'): LoteMedido {
  return { ordemId: `o${dia}`, encerradoEm: `2026-10-${String(dia).padStart(2, '0')}T12:00:00.000Z`, pct, quem }
}

describe('⛔⛔ rendimento: PADRÃO sim, lote isolado NUNCA', () => {
  it('⛔⛔ UM lote fora NÃO é aviso — variação de carne é natural (decisão do dono)', () => {
    expect(acharPadrao([lote(1, 100), lote(2, 100), lote(3, 60)])).toBeNull()
  })

  it('⛔ DOIS seguidos também não — dois dias ruins é coincidência', () => {
    expect(acharPadrao([lote(1, 100), lote(2, 60), lote(3, 70)])).toBeNull()
  })

  it('⭐⭐ TRÊS seguidos é PADRÃO', () => {
    const p = acharPadrao([lote(1, 100), lote(2, 60), lote(3, 70), lote(4, 65)])
    expect(p).not.toBeNull()
    expect(p!.seguidos).toBe(3)
    expect(p!.sentido).toBe('BAIXO')
    expect(LOTES_SEGUIDOS_PRA_PADRAO).toBe(3)
  })

  /**
   * ⛔⛔ **A SEQUÊNCIA É CONTADA DO MAIS RECENTE PRA TRÁS — e é o coração da regra.** Contar
   * "quantos estão fora no período" acusaria uma receita que teve 3 lotes ruins em agosto e
   * está ótima desde então: o dono iria caçar um problema que ele JÁ resolveu.
   */
  it('⛔⛔ lote que VOLTOU pra faixa QUEBRA o padrão — ele se resolve sozinho', () => {
    expect(acharPadrao([lote(1, 60), lote(2, 65), lote(3, 70), lote(4, 100)])).toBeNull()
  })

  /**
   * ⚠️ As 471 ordens antigas não têm meta — elas não são MEDÍVEIS. Deixar o sem-pedido QUEBRAR
   * a sequência faria um lote antigo esconder um padrão real; deixar CONTAR seria inventar uma
   * medição que ninguém fez.
   */
  it('⭐ lote SEM PEDIDO não conta nem quebra', () => {
    const p = acharPadrao([lote(1, 60), lote(2, null), lote(3, 65), lote(4, 70)])
    expect(p).not.toBeNull()
    expect(p!.seguidos).toBe(3)
  })

  it('⭐ a ORDEM sai do relógio, nunca da ordem do array', () => {
    const p = acharPadrao([lote(4, 100), lote(1, 60), lote(3, 65), lote(2, 70)])
    // ⭐ o lote mais recente (dia 4) está DENTRO → não há padrão agora
    expect(p).toBeNull()
  })

  it('⭐⭐ o NOME de quem fez entra, sem repetir — o dono pediu nominal', () => {
    const p = acharPadrao([lote(2, 60, 'rodrigo'), lote(3, 65, 'eliane'), lote(4, 70, 'rodrigo')])
    expect(p!.quem).toEqual(['rodrigo', 'eliane'])
  })

  it('⭐ sentido ALTO quando tudo rendeu MAIS, MISTO quando varia pros dois lados', () => {
    expect(acharPadrao([lote(1, 160), lote(2, 180), lote(3, 333)])!.sentido).toBe('ALTO')
    expect(acharPadrao([lote(1, 160), lote(2, 60), lote(3, 333)])!.sentido).toBe('MISTO')
  })

  /** ⛔⛔ a frase do padrão tem que PASSAR na lei da língua do balcão — senão nunca é gravada */
  it('⛔⛔ a frase do padrão obedece a lei do balcão (título=ação, "o que fazer" com verbo)', () => {
    const p = acharPadrao([lote(1, 161), lote(2, 333), lote(3, 180)])!
    const f = fraseDoPadrao('porçao frango frito 200 grama', p)
    expect(f.titulo).toMatch(/porçao frango frito/)
    expect(f.corpo, 'o dono pediu o nome de quem fez').toMatch(/rodrigo/)
    expect(f.corpo, 'e os percentuais, pra ele poder conferir').toMatch(/161%/)
    expect(() =>
      exigirLinguaDoBalcao({
        companyId: 'c', setor: 'producao', severidade: 'ambar',
        titulo: f.titulo, corpo: f.corpo, oQueFazer: f.oQueFazer,
        origem: 'PADRAO_RENDIMENTO', alvo: 'f1',
      }),
    ).not.toThrow()
  })
})

/**
 * ⛔⛔⛔ OS CASOS REAIS DA PREVIEW EM PROD — 7 receitas deram padrão com **1% em 12-14 lotes
 * seguidos** (`ABRIR MILHO`, `tomate em rodela`, `PICAR BRÓCOLIS`, `ABRIR ERVILHA`…).
 * Render 1% catorze vezes não é a mão da cozinha: é o lote base da ficha em outra GRANDEZA.
 * Mandar *"confira a porção com o rodrigo"* ali é acusar o campo errado — a lição de 16/09.
 */
describe('⛔⛔ grandeza IMPOSSÍVEL é outra causa, outra frase, outra ação', () => {
  const MILHO = [lote(1, 1), lote(2, 1), lote(3, 1), lote(4, 1)]

  it('⭐⭐ o padrão é marcado como grandeza impossível', () => {
    const p = acharPadrao(MILHO)!
    expect(p.grandezaImpossivel).toBe(true)
    expect(PCT_IMPOSSIVEL_BAIXO).toBe(10)
    expect(PCT_IMPOSSIVEL_ALTO).toBe(1000)
  })

  it('⛔⛔ a frase manda CORRIGIR O LOTE BASE — e NÃO fala da mão de ninguém', () => {
    const f = fraseDoPadrao('ABRIR MILHO', acharPadrao(MILHO)!)
    expect(f.titulo).toMatch(/Corrija quantas unidades rende/)
    expect(f.oQueFazer).toMatch(/lote base/)
    expect(f.corpo, 'não é variação de cozinha').toMatch(/não é variação de cozinha/)
    expect(f.oQueFazer, 'não cobra a porção de quem fez').not.toMatch(/porção com/)
  })

  /** ⚠️ BASTA UM lote lixo: com um número impossível no meio, não dá pra julgar a mão de ninguém */
  it('⭐ um ÚNICO lote impossível no meio já muda a frase (o caso CUBA MAIONESE: 1·1·0·999)', () => {
    const p = acharPadrao([lote(1, 1), lote(2, 1), lote(3, 0.4), lote(4, 999)])!
    expect(p.grandezaImpossivel).toBe(true)
    expect(fraseDoPadrao('CUBA MAIONESE', p).titulo).toMatch(/Corrija quantas unidades rende/)
  })

  it('⭐ padrão de rendimento DE VERDADE (80-70-65%) segue com a frase da porção', () => {
    const p = acharPadrao([lote(1, 80), lote(2, 70), lote(3, 65)])!
    expect(p.grandezaImpossivel).toBe(false)
    const f = fraseDoPadrao('beef de xis', p)
    expect(f.titulo).toMatch(/Revise a receita/)
    expect(f.oQueFazer).toMatch(/porção com rodrigo/)
  })
})

describe('⛔ sem nome registrado, a frase NÃO fala de pessoa', () => {
  /**
   * ⛔⛔ Na preview em prod os 7 avisos saíram com *"feitos por sem nome registrado"* — texto de
   * sistema vazando pro balcão. A causa era eu ler o USUÁRIO do sistema (`criadoPorId`, 78 de
   * 400 linhas) em vez do colaborador da CONCLUSÃO (353 de 400). Consertada a fonte, a frase
   * ainda precisa aguentar o caso legítimo: lote antigo sem colaborador gravado.
   */
  it('⛔ nem no corpo nem no "o que fazer"', () => {
    const p = acharPadrao([lote(1, 80, null), lote(2, 70, null), lote(3, 65, null)])!
    const f = fraseDoPadrao('beef de xis', p)
    expect(f.corpo).not.toMatch(/sem nome registrado/)
    expect(f.corpo, 'a frase simplesmente não menciona pessoa').not.toMatch(/feitos por/)
    expect(f.oQueFazer).not.toMatch(/sem nome registrado/)
    expect(f.oQueFazer).not.toMatch(/com :/)
  })

  it('⭐ com nome, ele aparece nos dois', () => {
    const f = fraseDoPadrao('beef de xis', acharPadrao([lote(1, 80), lote(2, 70), lote(3, 65)])!)
    expect(f.corpo).toMatch(/feitos por rodrigo/)
    expect(f.oQueFazer).toMatch(/com rodrigo/)
  })
})

describe('⭐⭐ o verde semanal: 1 por semana, domingo, e NUNCA mentindo', () => {
  const DOMINGO = new Date('2026-10-04T15:00:00.000Z') // domingo no Brasil
  const SEGUNDA = new Date('2026-10-05T15:00:00.000Z')
  const FOTO = { contasQueFecham: 35, contasConferidas: 35, bancosOk: 3, bancosTotal: 3, severidadesAbertas: [] as never[] }

  it('⭐ sai no domingo', () => {
    const a = montarSemanaVerde('c1', FOTO, DOMINGO)
    expect(a).not.toBeNull()
    expect(a!.severidade).toBe('verde')
    expect(a!.corpo).toMatch(/35\/35/)
  })

  it('⛔ não sai em dia de semana', () => {
    expect(montarSemanaVerde('c1', FOTO, SEGUNDA)).toBeNull()
  })

  /**
   * ⛔⛔ Um "tudo certo" ao lado de um aviso vermelho destrói a confiança nos DOIS — e aí
   * nenhum dos dois é lido.
   */
  it('⛔⛔ NÃO sai com vermelho ou coral em aberto', () => {
    expect(montarSemanaVerde('c1', { ...FOTO, severidadesAbertas: ['vermelho'] }, DOMINGO)).toBeNull()
    expect(montarSemanaVerde('c1', { ...FOTO, severidadesAbertas: ['coral'] }, DOMINGO)).toBeNull()
    // ⭐ âmbar e azul não impedem: são "pede olho", não "está errado"
    expect(montarSemanaVerde('c1', { ...FOTO, severidadesAbertas: ['ambar'] }, DOMINGO)).not.toBeNull()
  })

  /** ⛔ dizer "tudo certo" sem ter conferido nada é o selo de graça do invariante circular (28/08) */
  it('⛔ NÃO sai quando nada foi medido', () => {
    expect(
      montarSemanaVerde('c1', { contasQueFecham: 0, contasConferidas: 0, bancosOk: 0, bancosTotal: 0, severidadesAbertas: [] }, DOMINGO),
    ).toBeNull()
  })

  /**
   * ⭐⭐ "1 por semana" é IMPOSSÍVEL de violar porque o ALVO é a semana ISO e `origem+alvo` é
   * UNIQUE no banco — rodar o cron 7× no domingo dá UM aviso.
   */
  it('⭐⭐ o alvo é a semana ISO (é o que faz "1 por semana" ser estrutural)', () => {
    const a = montarSemanaVerde('c1', FOTO, DOMINGO)!
    expect(a.alvo).toBe(semanaIso(DOMINGO))
    expect(a.alvo).toMatch(/^2026-W\d{2}$/)
    // mesma semana, outro instante → MESMO alvo
    expect(semanaIso(new Date('2026-10-04T23:00:00.000Z'))).toBe(a.alvo)
    // semana seguinte → alvo diferente
    expect(semanaIso(new Date('2026-10-11T15:00:00.000Z'))).not.toBe(a.alvo)
  })

  /** ⚠️ domingo é o do BRASIL: às 21h de sábado em SP o UTC já diz domingo (a régua de 13/09) */
  it('⭐ o domingo é o do Brasil, não o do UTC', () => {
    expect(ehDomingoNoBrasil(new Date('2026-10-04T02:00:00.000Z')), 'sábado 23h em SP').toBe(false)
    expect(ehDomingoNoBrasil(new Date('2026-10-04T15:00:00.000Z')), 'domingo meio-dia em SP').toBe(true)
    expect(ehDomingoNoBrasil(new Date('2026-10-05T02:00:00.000Z')), 'domingo 23h em SP').toBe(true)
  })

  it('⛔ o verde também obedece a lei do balcão', () => {
    expect(() => exigirLinguaDoBalcao(montarSemanaVerde('c1', FOTO, DOMINGO)!)).not.toThrow()
  })
})

describe('⛔⛔ LEI: quem não pode ver financeiro não vê aviso de financeiro', () => {
  /**
   * ⛔⛔ O sininho é GLOBAL — e em 30/08 a operadora de estoque abriu o Fluxo de Caixa e viu
   * *"entrou: 475.739,55"*. Um sininho mostrando *"a fatura venceu"* pra ela seria **o mesmo
   * vazamento por uma porta nova**.
   */
  it('⛔⛔ OPERADOR_ESTOQUE (stock.view+operate) NÃO vê financeiro', () => {
    const op = ['stock.view', 'stock.operate']
    expect(setoresVisiveis(op)).toEqual(['producao', 'estoque', 'sistema'])
    expect(podeVerSetor(op, 'financeiro')).toBe(false)
  })

  it('⭐ quem tem transaction.view vê financeiro', () => {
    expect(podeVerSetor(['transaction.view'], 'financeiro')).toBe(true)
    expect(setoresVisiveis(['transaction.view'])).toEqual(['financeiro', 'sistema'])
  })

  /**
   * ⚠️ **ESTA LISTA CRESCEU EM 09/10 e a asserção foi ATUALIZADA com o motivo escrito:** entrou
   * o setor `gerencia` (o aviso da conferência parada, item 2d). Ele exige `stock.manage`, que
   * o dono tem — e é exatamente isso que o teste passa a afirmar.
   * ⭐ A metade que importa continua intacta logo acima: o **OPERADOR_ESTOQUE não vê `gerencia`**,
   * porque foi ele quem declarou o lote.
   */
  it('⭐ o dono (lista concreta de chaves, como no banco) vê tudo', () => {
    const dono = ['stock.view', 'stock.operate', 'stock.manage', 'transaction.view', 'transaction.update']
    expect(setoresVisiveis(dono)).toEqual(['producao', 'estoque', 'gerencia', 'financeiro', 'sistema'])
  })

  /** ⚠️ wildcard do RBAC continua valendo (`stock.*` cobre `stock.view`) */
  it('⭐ wildcard do RBAC é respeitado', () => {
    expect(podeVerSetor(['stock.*'], 'producao')).toBe(true)
    expect(podeVerSetor(['*'], 'financeiro')).toBe(true)
  })

  /** ⛔ sem chave nenhuma, nem `sistema` aparece — quem não opera nada aqui não recebe aviso */
  it('⛔ sem permissão, nenhum setor', () => {
    expect(setoresVisiveis([])).toEqual([])
    expect(setoresVisiveis(['report.view'])).toEqual([])
  })
})
