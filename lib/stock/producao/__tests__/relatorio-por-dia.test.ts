/**
 * ⭐⭐ RELATÓRIO POR DIA — as agregações PURAS, e as honestidades que elas têm que manter.
 *
 * ⛔⛔ **O teste central é o da UNIDADE MISTA.** Num mesmo dia a cozinha faz porção (UN) e massa
 * (KG): somar os dois num número só produz o `1.415,84 un` de 13/09 — *"aquele `,84` era um
 * número que não existe"*. Se este arquivo passar a somar cruzado, o relatório inteiro mente.
 */
import { describe, it, expect } from 'vitest'
import { agruparPorDia, agruparPorReceita, textoDoPedido, type LinhaDoRelatorio } from '../relatorio-por-dia'

const linha = (p: Partial<LinhaDoRelatorio>): LinhaDoRelatorio => ({
  ordemId: 'o1', dia: '2026-10-04', tarefa: 'porcao coxao 80 grama', itemId: 'it-coxao', unidade: 'UN',
  pedido: 80, produzido: 78, pctDoPedido: 98, seloDoPedido: 'OK',
  eficiencia: 0.98, separadoReais: 412.3, minutos: 95, relampago: false,
  setor: 'COZINHA', quemConcluiu: 'rodrigo', ...p,
})

describe('⭐⭐ subtotal do dia', () => {
  it('⭐ soma lotes, dinheiro e tempo; e a eficiência é MÉDIA dos que têm', () => {
    const [d] = agruparPorDia([
      linha({ ordemId: 'a', eficiencia: 0.98, separadoReais: 100, minutos: 60 }),
      linha({ ordemId: 'b', eficiencia: 0.9, separadoReais: 50, minutos: 30 }),
    ])
    expect(d.lotes).toBe(2)
    expect(d.separadoReais).toBe(150)
    expect(d.minutos).toBe(90)
    expect(d.eficienciaMedia).toBeCloseTo(0.94, 4)
    expect(d.lotesComEficiencia).toBe(2)
  })

  it('⛔⛔ UN e KG NUNCA viram um número só (o pecado de 13/09)', () => {
    const [d] = agruparPorDia([
      linha({ ordemId: 'a', tarefa: 'porção', unidade: 'UN', pedido: 80, produzido: 78 }),
      linha({ ordemId: 'b', tarefa: 'massa', unidade: 'KG', pedido: 12, produzido: 11.5 }),
    ])
    // ⭐ a quantidade é POR UNIDADE, e o TOTAL é `null` quando há mistura
    expect(d.produzido.porUnidade).toEqual([{ unidade: 'UN', qtd: 78 }, { unidade: 'KG', qtd: 11.5 }])
    expect(d.produzido.mista).toBe(true)
    expect(d.produzido.total, 'misto NÃO tem total — é o pecado de 13/09').toBeNull()
    expect(d.pedido.total).toBeNull()
    // ⛔ e o texto nomeia as duas, nunca um total cruzado
    expect(d.produzido.texto).toBe('78 UN · 11,5 KG')
    expect(d.produzido.texto).not.toContain('89,5')
  })

  it('⭐ dinheiro SOMA atravessando unidades — é a única grandeza que pode', () => {
    const [d] = agruparPorDia([
      linha({ ordemId: 'a', unidade: 'UN', separadoReais: 100 }),
      linha({ ordemId: 'b', unidade: 'KG', separadoReais: 23.45 }),
    ])
    expect(d.separadoReais).toBe(123.45)
  })

  it('⚠️ lote SEM pedido registrado é CONTADO e DITO — nunca somado como zero', () => {
    const [d] = agruparPorDia([
      linha({ ordemId: 'a', pedido: 80, produzido: 78 }),
      linha({ ordemId: 'b', pedido: null, pctDoPedido: null, seloDoPedido: 'SEM_META', produzido: 40 }),
    ])
    expect(d.semPedido).toBe(1)
    // ⭐ o pedido soma só os 80 — o `null` não entra como 0, que baixaria a média
    expect(d.pedido.total).toBe(80)
    // ⭐ mas o VOLUME dele conta: 78 + 40
    expect(d.produzido.total).toBe(118)
  })

  it('⚠️ sem eficiência nenhuma: `null` e "a apurar", NUNCA 0%', () => {
    const [d] = agruparPorDia([linha({ eficiencia: null })])
    expect(d.eficienciaMedia).toBeNull()
    expect(d.lotesComEficiencia).toBe(0)
  })

  it('⚠️ tempo: soma só os MEDIDOS, e diz quantos ficaram fora', () => {
    const [d] = agruparPorDia([
      linha({ ordemId: 'a', minutos: 60 }),
      linha({ ordemId: 'b', minutos: null }),
      linha({ ordemId: 'c', minutos: null, relampago: true }),
    ])
    expect(d.minutos).toBe(60)
    expect(d.semTempo).toBe(2)
    expect(d.relampagos).toBe(1)
  })

  it('⭐ os dias vêm do mais recente pro mais antigo', () => {
    const ds = agruparPorDia([
      linha({ ordemId: 'a', dia: '2026-10-01' }),
      linha({ ordemId: 'b', dia: '2026-10-04' }),
      linha({ ordemId: 'c', dia: '2026-10-02' }),
    ])
    expect(ds.map((d) => d.dia)).toEqual(['2026-10-04', '2026-10-02', '2026-10-01'])
  })
})

/**
 * ⛔⛔ ESTE BLOCO NASCEU DE UM DEFEITO QUE SÓ A PROVA EM PROD PEGOU (04/10).
 *
 * Com as 471 ordens antigas sem meta, a tela imprimia **"pedido 0"** nos 29 dias — e isso lê
 * como ***"pedi zero"***. O `somarQuantidades([])` está certo no contrato dele (texto `'0'`);
 * errado era a TELA afirmar um pedido que ninguém registrou. *Ausência não é zero* — a régua
 * do "sem contagem" do estoque e do "a apurar" das vendas.
 */
describe('⛔⛔ "pedido 0" não existe — ausência é AUSÊNCIA', () => {
  it('⛔ nenhum lote com pedido → "sem pedido registrado", nunca "0"', () => {
    const [d] = agruparPorDia([
      linha({ ordemId: 'a', pedido: null, pctDoPedido: null, seloDoPedido: 'SEM_META' }),
      linha({ ordemId: 'b', pedido: null, pctDoPedido: null, seloDoPedido: 'SEM_META' }),
    ])
    expect(d.semPedido).toBe(2)
    expect(d.pedido.texto, 'o somarQuantidades devolve "0" — e ele está certo no contrato dele').toBe('0')
    // ⭐ quem traduz pra tela é a régua, e ela DIZ a ausência
    expect(textoDoPedido(d.pedido, d.semPedido, d.lotes)).toBe('sem pedido registrado')
    expect(textoDoPedido(d.pedido, d.semPedido, d.lotes)).not.toContain('0')
  })

  it('⭐ com pedido em ALGUNS, o número aparece (e o resto é dito à parte)', () => {
    const [d] = agruparPorDia([
      linha({ ordemId: 'a', pedido: 80 }),
      linha({ ordemId: 'b', pedido: null, pctDoPedido: null, seloDoPedido: 'SEM_META' }),
    ])
    expect(textoDoPedido(d.pedido, d.semPedido, d.lotes)).toBe('80 UN')
    expect(d.semPedido).toBe(1)
  })

  it('⭐ e vale igual na agregação por receita', () => {
    const [r] = agruparPorReceita([linha({ pedido: null, pctDoPedido: null, seloDoPedido: 'SEM_META' })])
    expect(textoDoPedido(r.pedido, r.semPedido, r.lotes)).toBe('sem pedido registrado')
  })
})

describe('⭐⭐ por receita no período — o acompanhamento que o dono pediu', () => {
  it('⭐ "porção de frango nos últimos 30 dias": Σ pedido, Σ produzido, % médio, tempo médio', () => {
    const [r] = agruparPorReceita([
      linha({ ordemId: 'a', dia: '2026-09-20', pedido: 100, produzido: 98, pctDoPedido: 98, minutos: 90 }),
      linha({ ordemId: 'b', dia: '2026-10-01', pedido: 50, produzido: 52, pctDoPedido: 104, minutos: 50 }),
    ])
    expect(r.lotes).toBe(2)
    expect(r.pedido.total).toBe(150)
    expect(r.produzido.total).toBe(150)
    expect(r.produzido.unidade).toBe('UN')
    expect(r.pctMedio).toBe(101)
    expect(r.minutosPorLote).toBe(70)
  })

  it('⭐ ordena por LOTES, não por unidades — ordenar por unidade compararia UN com KG', () => {
    const rs = agruparPorReceita([
      linha({ ordemId: 'a', tarefa: 'massa', unidade: 'KG', produzido: 500 }),
      linha({ ordemId: 'b', tarefa: 'porção', unidade: 'UN', produzido: 10 }),
      linha({ ordemId: 'c', tarefa: 'porção', unidade: 'UN', produzido: 10 }),
    ])
    // ⭐ porção tem 2 lotes e 20 unidades; massa tem 1 lote e 500 KG — porção vem primeiro
    expect(rs.map((r) => r.tarefa)).toEqual(['porção', 'massa'])
  })

  it('⚠️ média de tempo ignora o RELÂMPAGO e o sem-tempo, e DIZ quantos', () => {
    /**
     * ⛔ É a régua de 13/09: *"nenhum lote real fica pronto em menos de 5 min; registro
     * retroativo é o caso"*. Sem isso a média da porção de queijo caía de 88 pra 44 min e
     * cobrava de gente.
     */
    const [r] = agruparPorReceita([
      linha({ ordemId: 'a', minutos: 90 }),
      linha({ ordemId: 'b', minutos: 86 }),
      linha({ ordemId: 'c', minutos: null, relampago: true }),
    ])
    expect(r.minutosPorLote).toBe(88)
    expect(r.semTempo).toBe(1)
    expect(r.relampagos).toBe(1)
  })

  it('⚠️ sem nenhum pedido registrado, o % é `null` — não 0% nem 100%', () => {
    const [r] = agruparPorReceita([linha({ pedido: null, pctDoPedido: null, seloDoPedido: 'SEM_META' })])
    expect(r.pctMedio).toBeNull()
    expect(r.semPedido).toBe(1)
  })

  it('⭐ e a unidade da receita é UMA só — por isso a soma aqui é segura', () => {
    const [r] = agruparPorReceita([linha({ ordemId: 'a' }), linha({ ordemId: 'b' })])
    expect(r.unidade).toBe('UN')
    // ⭐ UMA unidade → `mista: false` e `total` existe (é o que torna a soma honesta aqui)
    expect(r.produzido.mista).toBe(false)
    expect(r.produzido.porUnidade.map((x) => x.unidade)).toEqual(['UN'])
  })
})
