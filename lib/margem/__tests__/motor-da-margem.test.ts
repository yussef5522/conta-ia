/**
 * ⭐⭐⭐ OS GUARDS DA MARGEM v3 (07/10/2026) — os que o dono nomeou, mais os que a prova em
 * prod cobrou.
 *
 * ⚠️ Testes PUROS de propósito: toda decisão da tela mora em lib pura, e é isso que permite
 * provar `Σ(tijolos) == sobra == Σ da liga` sem subir Postgres. Os números das fixtures são
 * os MEDIDOS em prod — fixture inventada testa o mundo que eu imaginei, não o que existe.
 */
import { describe, it, expect } from 'vitest'
import { sobrasDoPeriodo, medianaDe, type LinhaParaSobra } from '../sobra'
import { montarCasa, textoDaComposicao, COBERTURA_MINIMA, TIJOLOS_VISIVEIS } from '../casa'
import { montarLiga, seloDoProduto, MINIMO_PRA_SELO } from '../liga'
import { linhaDeChegada, diaDoBrasil } from '../dia'
import { janelaDaMargem, custoFixoDaJanela } from '../janela'
import { sobraPorDia, custoComplementoPorDia, acumular } from '../por-dia'
import { montarFichaDeMargem, ehEmbalagem } from '../ficha-de-margem'
import { ehSaborDeVerdade } from '../leitura'

const linha = (o: Partial<LinhaParaSobra> & { chave: string; nome: string }): LinhaParaSobra => ({
  status: 'FICHA_OK',
  vendasQtd: 10,
  vendasValor: 1000,
  precoUsado: 100,
  precoOrigem: 'praticado',
  custoUnitario: 20,
  custoParcial: 20,
  componentesSemCusto: 0,
  ...o,
})

/** ⭐ os 4 maiores tijolos reais de prod (outubro, 7 dias) */
const PROD: LinhaParaSobra[] = [
  linha({ chave: 'f:combo', nome: 'Combo Caçula', vendasQtd: 285, precoUsado: 83.3, custoUnitario: 15.2 }),
  linha({ chave: 'f:fam45', nome: 'PIZZA FAMILIA 45CM', vendasQtd: 108, precoUsado: 120.44, custoUnitario: 17.74 }),
  linha({ chave: 'f:gp', nome: 'PIZZA GRANDE PRECINHO', vendasQtd: 143, precoUsado: 64.74, custoUnitario: 9.92 }),
  linha({ chave: 'f:pq', nome: 'PIZZA PEQUENA 25CM', vendasQtd: 38, precoUsado: 52.45, custoUnitario: 6.4 }),
]

describe('⛔⛔ O GUARD DO DONO: Σ(tijolos) == sobra BRUTA == Σ da liga', () => {
  it('⭐ fecha ao centavo, com o agrupado no meio', () => {
    // ⚠️ 12 produtos pra o teto de 8 morder e o "+N" nascer
    const muitos = Array.from({ length: 12 }, (_, i) =>
      linha({ chave: `f:${i}`, nome: `P${i}`, vendasQtd: 12 - i, precoUsado: 50, custoUnitario: 10 }),
    )
    const s = sobrasDoPeriodo(muitos)
    const casa = montarCasa({
      sobras: s,
      custoFixo: 1000,
      dias: 7,
      composicao: { casa: true, banco: true, compromissos: true },
      complementos: { custo: 0, ocorrenciasComCusto: 0, ocorrenciasSemCusto: 0 },
    })
    const liga = montarLiga(s.dentro, 'CAIXA')

    expect(casa.tijolos).toHaveLength(TIJOLOS_VISIVEIS + 1)
    expect(casa.tijolos.at(-1)!.agrupado?.quantos).toBe(4)

    const somaTijolos = casa.tijolos.reduce((a, t) => a + t.sobraTotal, 0)
    expect(somaTijolos).toBeCloseTo(s.sobraTotal, 2)
    expect(liga.somaDaAba).toBeCloseTo(s.sobraTotal, 2)
  })

  /**
   * ⚠️⚠️ TESTE INVERTIDO EM 07/10, COM O MOTIVO ESCRITO — ele afirmava
   * `pctDaSobra == sobraTotal / custoFixo`, que é a conta do RÓTULO (`pctDaCasa`), não da ÁREA.
   *
   * ⛔ O defeito que isso escondia apareceu na prova em prod: a sobra de outubro é **152% da
   * casa**, então a Σ dos `pctDaSobra` dava 1,52, a pilha de tijolos passava do telhado e a
   * tela clampava o `y` em 0 — os tijolos de cima **se sobrepunham**. A metade CERTA do teste
   * (área ∝ contribuição) continua travada, agora com o denominador que a faz somar 1.
   */
  it('⭐⭐ a ÁREA é a fatia da SOBRA e a Σ dos tijolos é 1 — inclusive com a casa PAGA', () => {
    const s = sobrasDoPeriodo(PROD)
    // ⚠️ a cena é a de prod: a sobra PASSA do custo fixo (a casa se pagou e transbordou).
    // Em prod a razão é 152%; a fixture é um recorte, então o custo fixo aqui é menor.
    const CUSTO_FIXO = 20_000
    const casa = montarCasa({
      sobras: s, custoFixo: CUSTO_FIXO, dias: 7,
      composicao: { casa: true, banco: true, compromissos: true },
      complementos: { custo: 0, ocorrenciasComCusto: 0, ocorrenciasSemCusto: 0 },
    })
    expect(casa.sobraTotal).toBeGreaterThan(CUSTO_FIXO)

    for (const t of casa.tijolos) {
      // ÁREA: fatia da sobra
      expect(t.pctDaSobra).toBeCloseTo(t.sobraTotal / s.sobraTotal, 9)
      // RÓTULO: fração da casa — e ele PODE passar de 1, que é informação boa
      expect(t.pctDaCasa).toBeCloseTo(t.sobraTotal / CUSTO_FIXO, 9)
    }
    // ⛔⛔ o invariante que impede a pilha de estourar o telhado
    const somaArea = casa.tijolos.reduce((a, t) => a + t.pctDaSobra, 0)
    expect(somaArea).toBeCloseTo(1, 6)
    // ⭐ o 👑 é o maior contribuinte, nunca o mais vendido
    expect(casa.tijolos[0].rei).toBe(true)
    expect(casa.tijolos[0].nome).toBe('Combo Caçula')
  })

  it('⭐ a Σ da área é 1 TAMBÉM sem plano declarado (custo fixo nulo)', () => {
    const s = sobrasDoPeriodo(PROD)
    const casa = montarCasa({
      sobras: s, custoFixo: null, dias: 7,
      composicao: { casa: true, banco: false, compromissos: false },
      complementos: { custo: 0, ocorrenciasComCusto: 0, ocorrenciasSemCusto: 0 },
    })
    expect(casa.tijolos.reduce((a, t) => a + t.pctDaSobra, 0)).toBeCloseTo(1, 6)
    // ⚠️ sem plano não existe fração da casa — é `null`, nunca 0
    expect(casa.tijolos.every((t) => t.pctDaCasa === null)).toBe(true)
  })

  it('⭐ sobra == preço − custo POR CONSTRUÇÃO', () => {
    const s = sobrasDoPeriodo(PROD)
    for (const p of s.dentro) {
      expect(p.sobraUn).toBeCloseTo(p.preco - p.custo, 2)
      expect(p.sobraTotal).toBeCloseTo(p.sobraUn * p.unidades, 2)
      expect(p.margemPct).toBeCloseTo((p.preco - p.custo) / p.preco, 9)
    }
  })
})

describe('⛔⛔ NENHUM CUSTO INVENTADO — "a apurar" e "fora da obra" NOMEADOS', () => {
  it('⛔ sem custo → fora da obra, com o PORQUÊ, e NUNCA com o parcial como se fosse o custo', () => {
    const s = sobrasDoPeriodo([
      linha({ chave: 'f:xis', nome: 'XIS COMPLETO', vendasQtd: 284, custoUnitario: null, custoParcial: 8.58, componentesSemCusto: 1 }),
      linha({ chave: 'n:maio', nome: 'MAIONESE CASEIRA', vendasQtd: 53, status: 'SEM_DESTINO', custoUnitario: null, custoParcial: 0 }),
    ])
    expect(s.dentro).toHaveLength(0)
    expect(s.sobraTotal).toBe(0)
    expect(s.fora).toHaveLength(2)
    expect(s.fora[0].nome).toBe('XIS COMPLETO')
    expect(s.fora[0].porque).toContain('1 insumo')
    // ⭐ o parcial aparece pra a linha não ficar muda, mas NÃO virou custo
    expect(s.fora[0].custoParcial).toBeCloseTo(8.58, 2)
    expect(s.fora[1].porque).toContain('ninguém disse o que este produto é')
  })

  it('⛔ produto sem PREÇO não vira sobra zero — vai pra fora com a frase do PDV', () => {
    const s = sobrasDoPeriodo([linha({ chave: 'f:x', nome: 'X', precoUsado: null })])
    expect(s.dentro).toHaveLength(0)
    expect(s.fora[0].porque).toContain('não registrou valor de venda')
  })

  it('⚠️ cobertura de período sem venda é `null`, NUNCA 0%', () => {
    const s = sobrasDoPeriodo([])
    expect(s.cobertura.pct).toBeNull()
  })

  it('⛔ produto que NÃO vendeu no período não é tijolo nem banquinho', () => {
    const s = sobrasDoPeriodo([linha({ chave: 'f:z', nome: 'Z', vendasQtd: 0 })])
    expect(s.dentro).toHaveLength(0)
    expect(s.fora).toHaveLength(0)
  })
})

describe('⛔⛔ O CUSTO DOS COMPLEMENTOS — abate a CASA, nunca o tijolo', () => {
  it('⭐ com os números reais de prod: o veredito VIRA', () => {
    const s = sobrasDoPeriodo(PROD)
    const base = {
      sobras: s, dias: 30,
      composicao: { casa: true, banco: true, compromissos: true },
    }
    // ⚠️ os números medidos em 07/10 na janela de 30 dias
    const semComp = montarCasa({
      ...base, custoFixo: 193_082.88,
      complementos: { custo: 0, ocorrenciasComCusto: 0, ocorrenciasSemCusto: 0 },
      sobras: { ...s, sobraTotal: 219_906.16 },
    })
    const comComp = montarCasa({
      ...base, custoFixo: 193_082.88,
      complementos: { custo: 35_700.53, ocorrenciasComCusto: 7201, ocorrenciasSemCusto: 4534 },
      sobras: { ...s, sobraTotal: 219_906.16 },
    })
    // ⛔ sem o custo do complemento a casa MENTE que está paga
    expect(semComp.veredito.estado).toBe('PAGA')
    expect(semComp.transbordo).toBeCloseTo(26_823.28, 2)
    // ⭐ com ele, a verdade: 95%, faltam R$ 8.877,25
    expect(comComp.veredito.estado).toBe('EM_OBRA')
    expect(comComp.falta).toBeCloseTo(8_877.25, 2)
    expect(comComp.sobraLiquida).toBeCloseTo(184_205.63, 2)
  })

  it('⛔ o complemento NÃO entra em tijolo nenhum — a Σ dos tijolos segue a BRUTA', () => {
    const s = sobrasDoPeriodo(PROD)
    const casa = montarCasa({
      sobras: s, custoFixo: 43_599.36, dias: 7,
      composicao: { casa: true, banco: true, compromissos: true },
      complementos: { custo: 9_255, ocorrenciasComCusto: 1750, ocorrenciasSemCusto: 1272 },
    })
    expect(casa.tijolos.reduce((a, t) => a + t.sobraTotal, 0)).toBeCloseTo(s.sobraTotal, 2)
    expect(casa.sobraLiquida).toBeCloseTo(s.sobraTotal - 9_255, 2)
    // ⚠️ e a tela sabe que o número é um PISO
    expect(casa.complementos.ocorrenciasSemCusto).toBe(1272)
  })
})

describe('⛔⛔ O VEREDITO CARREGA A COBERTURA — o defeito que a prova em prod pegou', () => {
  const comCobertura = (dentro: number, fora: number) =>
    montarCasa({
      sobras: sobrasDoPeriodo([
        linha({ chave: 'f:a', nome: 'A', vendasQtd: dentro, precoUsado: 100, custoUnitario: 20 }),
        linha({ chave: 'f:b', nome: 'B', vendasQtd: fora, custoUnitario: null, componentesSemCusto: 1 }),
      ]),
      custoFixo: 100, dias: 7,
      composicao: { casa: true, banco: true, compromissos: true },
      complementos: { custo: 0, ocorrenciasComCusto: 0, ocorrenciasSemCusto: 0 },
    })

  it('⛔ cobertura BAIXA: "paga" vem com a ressalva, nunca seca', () => {
    const c = comCobertura(55, 45)
    expect(c.veredito.estado).toBe('PAGA')
    expect(c.veredito.confiavel).toBe(false)
    expect(c.veredito.ressalva).toContain('é o que dá pra medir')
    expect(c.veredito.ressalva).toContain('55%')
    expect(c.veredito.ressalva).toContain('fora da obra')
  })

  it('⭐ cobertura ALTA: o veredito é confiável e a ressalva some', () => {
    const c = comCobertura(90, 10)
    expect(c.veredito.confiavel).toBe(true)
    expect(c.veredito.ressalva).toBeNull()
  })

  it('⛔ sem custo fixo declarado o veredito é A_APURAR, nunca R$ 0,00 de casa', () => {
    const c = montarCasa({
      sobras: sobrasDoPeriodo(PROD), custoFixo: null, dias: 7,
      composicao: { casa: true, banco: true, compromissos: true },
      complementos: { custo: 0, ocorrenciasComCusto: 0, ocorrenciasSemCusto: 0 },
    })
    expect(c.veredito.estado).toBe('A_APURAR')
    expect(c.pctPago).toBeNull()
    expect(c.placar.porque).toContain('declare o plano')
    // ⭐ e a casa ainda DESENHA: a área cai pra a própria sobra, senão a tela fica vazia
    // justamente quando o dono abre pra entender por que não sabe o número
    expect(c.tijolos.length).toBeGreaterThan(0)
    expect(c.tijolos[0].pctDaSobra).toBeGreaterThan(0)
  })
})

describe('⛔⛔ O PLACAR DO DIA D É GATEADO PELA COBERTURA', () => {
  const dias = [
    { dia: '2026-10-01', sobra: 300, unidades: 10, unidadesFora: 0 },
    { dia: '2026-10-02', sobra: 400, unidades: 10, unidadesFora: 0 },
    { dia: '2026-10-03', sobra: 500, unidades: 10, unidadesFora: 0 },
  ]

  it('⛔ abaixo de 80% o placar NÃO nomeia dia — diz a cobertura', () => {
    const c = montarCasa({
      sobras: sobrasDoPeriodo([
        linha({ chave: 'f:a', nome: 'A', vendasQtd: 50, precoUsado: 100, custoUnitario: 20 }),
        linha({ chave: 'f:b', nome: 'B', vendasQtd: 50, custoUnitario: null, componentesSemCusto: 1 }),
      ]),
      custoFixo: 500, dias: 3,
      composicao: { casa: true, banco: true, compromissos: true },
      complementos: { custo: 0, ocorrenciasComCusto: 0, ocorrenciasSemCusto: 0 },
      acumuladoPorDia: acumular(dias),
    })
    expect(c.placar.dia).toBeNull()
    expect(c.placar.porque).toContain(`${(COBERTURA_MINIMA * 100).toFixed(0)}%`)
  })

  it('⭐ acima de 80% ele nomeia o 1º dia em que a casa se pagou', () => {
    const c = montarCasa({
      sobras: sobrasDoPeriodo([
        linha({ chave: 'f:a', nome: 'A', vendasQtd: 90, precoUsado: 100, custoUnitario: 20 }),
        linha({ chave: 'f:b', nome: 'B', vendasQtd: 10, custoUnitario: null, componentesSemCusto: 1 }),
      ]),
      custoFixo: 600, dias: 3,
      composicao: { casa: true, banco: true, compromissos: true },
      complementos: { custo: 0, ocorrenciasComCusto: 0, ocorrenciasSemCusto: 0 },
      acumuladoPorDia: acumular(dias),
    })
    // 300 → 700 (passa de 600 no dia 02)
    expect(c.placar.dia).toBe('2026-10-02')
  })

  it('⛔⛔ o acumulado do placar é LÍQUIDO — com o bruto ele acenderia cedo', () => {
    const comp = custoComplementoPorDia(
      [
        { dia: '2026-10-01', nomeSuitable: 'CALABRESA', ocorrencias: 100 },
        { dia: '2026-10-02', nomeSuitable: 'CALABRESA', ocorrencias: 100 },
      ],
      new Map([['CALABRESA', 2.12]]),
    )
    const bruto = acumular(dias)
    const liquido = acumular(dias, comp)
    expect(bruto[1].acumulado).toBeCloseTo(700, 2)
    expect(liquido[1].acumulado).toBeCloseTo(700 - 424, 2)
    // ⭐ com o bruto o dia 02 "pagaria" uma casa de 600; com o líquido, não
    expect(bruto[1].acumulado >= 600).toBe(true)
    expect(liquido[1].acumulado >= 600).toBe(false)
  })
})

describe('⛔⛔ A CASA É O CUSTO FIXO DA COMPOSIÇÃO DOS CHIPS — e a tela DIZ qual', () => {
  it('⭐ a frase da composição sai de um lugar só', () => {
    expect(textoDaComposicao({ casa: true, banco: true, compromissos: true })).toBe('casa + banco + compromissos')
    expect(textoDaComposicao({ casa: true, banco: false, compromissos: true })).toBe('casa + compromissos')
    expect(textoDaComposicao({ casa: true, banco: false, compromissos: false })).toBe('casa')
    expect(textoDaComposicao({ casa: false, banco: false, compromissos: false })).toBe('nenhuma prateleira ligada')
  })

  it('⭐ a casa CARREGA a composição que o dono deixou ligada', () => {
    const c = montarCasa({
      sobras: sobrasDoPeriodo(PROD), custoFixo: 1000, dias: 7,
      composicao: { casa: true, banco: false, compromissos: true },
      complementos: { custo: 0, ocorrenciasComCusto: 0, ocorrenciasSemCusto: 0 },
    })
    expect(c.composicao.banco).toBe(false)
    expect(c.composicao.texto).toBe('casa + compromissos')
  })
})

describe('⭐ A JANELA — uma pra a tela inteira', () => {
  const agora = new Date('2026-10-07T19:00:00Z')

  it('⭐ hoje · semana · mês, com o dia do BRASIL', () => {
    expect(janelaDaMargem('HOJE', agora).de).toBe('2026-10-07')
    expect(janelaDaMargem('HOJE', agora).dias).toBe(1)
    expect(janelaDaMargem('SEMANA', agora).de).toBe('2026-10-01')
    expect(janelaDaMargem('SEMANA', agora).dias).toBe(7)
    expect(janelaDaMargem('MES', agora).de).toBe('2026-10-01')
  })

  it('⛔ às 23h de São Paulo o dia ainda é o de HOJE, não o de amanhã (a cicatriz de 09/09)', () => {
    // 08/10 02:00Z == 07/10 23:00 em São Paulo
    expect(diaDoBrasil(new Date('2026-10-08T02:00:00Z'))).toBe('2026-10-07')
    expect(janelaDaMargem('HOJE', new Date('2026-10-08T02:00:00Z')).de).toBe('2026-10-07')
  })

  it('⚠️ datas invertidas são ORDENADAS, nunca janela vazia (que a tela leria como "sem venda")', () => {
    const j = janelaDaMargem('DATAS', agora, { de: '2026-10-05', ate: '2026-10-01' })
    expect(j.de).toBe('2026-10-01')
    expect(j.ate).toBe('2026-10-05')
    expect(j.dias).toBe(5)
  })

  it('⭐ o custo fixo da janela é DIÁRIO × dias, e atravessa a virada de mês', () => {
    const j = janelaDaMargem('DATAS', agora, { de: '2026-09-29', ate: '2026-10-02' })
    expect(j.dias).toBe(4)
    const r = custoFixoDaJanela(j, new Map([['2026-09', 100], ['2026-10', 200]]))
    // 2 dias de setembro (29, 30) + 2 de outubro (01, 02)
    expect(r.total).toBeCloseTo(2 * 100 + 2 * 200, 2)
  })

  it('⛔⛔ UM mês sem plano torna o total NULL, nunca um total incompleto com cara de completo', () => {
    const j = janelaDaMargem('DATAS', agora, { de: '2026-09-29', ate: '2026-10-02' })
    const r = custoFixoDaJanela(j, new Map([['2026-09', 100], ['2026-10', null]]))
    expect(r.total).toBeNull()
    expect(r.porque).toContain('2026-10')
    expect(r.mesesSemPlano).toEqual(['2026-10'])
  })
})

describe('⭐ A LINHA DE CHEGADA — o último dia FECHADO, dizendo qual é', () => {
  const agora = new Date('2026-10-07T19:00:00Z')
  const dias = [{ dia: '2026-10-06', sobra: 7556.31, unidades: 300 }]

  it('⛔ a RESSALVA é obrigatória quando o dia mostrado não é hoje', () => {
    const l = linhaDeChegada(dias, 6228.48, agora)
    expect(l.dia).toBe('2026-10-06')
    expect(l.ehHoje).toBe(false)
    expect(l.bateu).toBe(true)
    expect(l.ressalva).toContain('último dia fechado')
    expect(l.frase).toContain('pagou a casa do dia')
  })

  it('⭐ dia que NÃO bateu diz o quanto faltou, com o % da casa', () => {
    const l = linhaDeChegada([{ dia: '2026-10-06', sobra: 3000, unidades: 100 }], 6228.48, agora)
    expect(l.bateu).toBe(false)
    expect(l.faltou).toBeCloseTo(3228.48, 2)
    expect(l.frase).toContain('48% da casa do dia')
  })

  it('⛔ sem custo fixo não existe linha de chegada — e a frase DIZ o que falta', () => {
    const l = linhaDeChegada(dias, null, agora)
    expect(l.pct).toBeNull()
    expect(l.frase).toContain('declare o plano')
  })

  it('⚠️ período sem venda nenhuma: frase própria, nunca 0%', () => {
    const l = linhaDeChegada([], 6228.48, agora)
    expect(l.dia).toBeNull()
    expect(l.sobra).toBeNull()
    expect(l.frase).toContain('nenhum dia com venda')
  })
})

describe('⭐⭐ A LIGA — os cortes pela MEDIANA, nunca pela média', () => {
  /**
   * ⛔⛔ O CONTRAFACTUAL: a PIZZA GRANDE PRECINHO real faz 21% da sobra do período. Com MÉDIA
   * ela levanta a referência acima de quase todo o cardápio e o ⭐ nunca acende pra mais
   * ninguém — é a mesma razão do M2 (02/10) e do prazo típico de compra (06/10).
   */
  it('⛔ com MÉDIA o desviante esconde todo mundo; com MEDIANA, não', () => {
    const v = [100, 120, 130, 140, 45_000]
    const media = v.reduce((a, b) => a + b, 0) / v.length
    expect(medianaDe(v)).toBe(130)
    expect(media).toBeGreaterThan(9000)
    // ⭐ pela mediana, 3 dos 5 ficam no lado "sobra alta"; pela média, UM
    expect(v.filter((x) => x >= (medianaDe(v) as number)).length).toBe(3)
    expect(v.filter((x) => x >= media).length).toBe(1)
  })

  it('⭐ os 4 selos são exaustivos — produto novo nunca cai num "sem selo" silencioso', () => {
    const cortes = { sobra: 1000, unidades: 50 }
    expect(seloDoProduto({ sobraTotal: 2000, unidades: 100 }, cortes)).toBe('ESTRELA')
    expect(seloDoProduto({ sobraTotal: 500, unidades: 100 }, cortes)).toBe('BURRO_DE_CARGA')
    expect(seloDoProduto({ sobraTotal: 2000, unidades: 10 }, cortes)).toBe('JOIA_ESCONDIDA')
    expect(seloDoProduto({ sobraTotal: 500, unidades: 10 }, cortes)).toBe('REPENSAR')
  })

  it('⛔⛔ com menos de 4 produtos o SELO não sai — prêmio sem disputa não é prêmio', () => {
    const s = sobrasDoPeriodo(PROD.slice(0, MINIMO_PRA_SELO - 1))
    const liga = montarLiga(s.dentro, 'CAIXA')
    expect(liga.cortes.sobra).toBeNull()
    for (const l of liga.linhas) expect(l.frase).toContain('ainda apurando')
  })

  it('⭐ as 3 abas ordenam por critérios DIFERENTES e a barra é proporcional ao 1º', () => {
    const s = sobrasDoPeriodo(PROD)
    const caixa = montarLiga(s.dentro, 'CAIXA')
    const margem = montarLiga(s.dentro, 'MARGEM')
    const vendidos = montarLiga(s.dentro, 'VENDIDOS')
    expect(caixa.linhas[0].nome).toBe('Combo Caçula')
    // ⭐ a melhor MARGEM não é o que mais encheu o caixa — é o ponto das abas
    expect(margem.linhas[0].nome).toBe('PIZZA PEQUENA 25CM')
    expect(vendidos.linhas[0].nome).toBe('Combo Caçula')
    for (const l of [caixa, margem, vendidos]) {
      expect(l.linhas[0].barra).toBeCloseTo(1, 9)
      expect(l.linhas.at(-1)!.barra).toBeLessThanOrEqual(1)
    }
  })

  it('⭐ medalha só no top 3', () => {
    const liga = montarLiga(sobrasDoPeriodo(PROD).dentro, 'CAIXA')
    expect(liga.linhas.map((l) => l.medalha)).toEqual([1, 2, 3, null])
  })
})

describe('⭐ A FICHA DE MARGEM — insumo e embalagem em linhas SEPARADAS', () => {
  const folhas = [
    { itemId: 'i1', nome: 'porçao queijo 135 grama', categoria: 'INTERMEDIARIO', qtd: 2, unidade: 'UN', custoUnitario: 4.21 },
    { itemId: 'i2', nome: 'metade de bolinha massa', categoria: 'INTERMEDIARIO', qtd: 2, unidade: 'UN', custoUnitario: 0.73 },
    { itemId: 'e1', nome: 'CAIXA P/ PIZZA 35 cm', categoria: 'EMBALAGEM', qtd: 1, unidade: 'UN', custoUnitario: 2.9 },
  ]

  it('⭐ separa, soma cada lado, e o total é a soma dos dois', () => {
    const f = montarFichaDeMargem({
      chave: 'f:g', nome: 'PIZZA GRANDE 35CM', preco: 105, precoOrigem: 'praticado',
      folhas, canais: [], casaDoDia: 6228.48,
    })
    expect(f.insumos).toHaveLength(2)
    expect(f.embalagem).toHaveLength(1)
    expect(f.custoInsumos).toBeCloseTo(2 * 4.21 + 2 * 0.73, 2)
    expect(f.custoEmbalagem).toBeCloseTo(2.9, 2)
    expect(f.custoTotal).toBeCloseTo((f.custoInsumos as number) + (f.custoEmbalagem as number), 2)
    expect(f.sobra).toBeCloseTo(105 - (f.custoTotal as number), 2)
    expect(f.porque).toBeNull()
  })

  it('⭐ "quantos pagam a casa" = casa do dia ÷ sobra, arredondado PRA CIMA', () => {
    const f = montarFichaDeMargem({
      chave: 'f:g', nome: 'G', preco: 105, precoOrigem: 'praticado',
      folhas, canais: [], casaDoDia: 6228.48,
    })
    expect(f.quantosPagamACasa).toBe(Math.ceil(6228.48 / (f.sobra as number)))
  })

  it('⛔ sobra ≤ 0 NÃO vira infinito nem número gigante — vira `null`', () => {
    const f = montarFichaDeMargem({
      chave: 'f:x', nome: 'X', preco: 5, precoOrigem: 'praticado',
      folhas, canais: [], casaDoDia: 6228.48,
    })
    expect(f.sobra).toBeLessThan(0)
    expect(f.quantosPagamACasa).toBeNull()
  })

  it('⛔ UM insumo sem custo torna o total `null` — "a definir" nunca vira 0,01', () => {
    const f = montarFichaDeMargem({
      chave: 'f:x', nome: 'X', preco: 105, precoOrigem: 'praticado',
      folhas: [...folhas, { itemId: 'i9', nome: 'molho', categoria: 'MATERIA_PRIMA', qtd: 1, unidade: 'KG', custoUnitario: null }],
      canais: [], casaDoDia: 6228.48,
    })
    expect(f.custoTotal).toBeNull()
    expect(f.sobra).toBeNull()
    expect(f.semCusto).toBe(1)
    // ⭐ mas o parcial aparece, pra a linha não ficar muda
    expect(f.parcial).toBeGreaterThan(0)
    expect(f.porque).toContain('1 insumo sem custo')
  })

  it('⛔⛔ canal sem taxa declarada é "a declarar", NUNCA 0% (que afirmaria ser de graça)', () => {
    const f = montarFichaDeMargem({
      chave: 'f:g', nome: 'G', preco: 100, precoOrigem: 'praticado', folhas,
      canais: [
        { id: 'c1', nome: 'balcão', taxaPct: 0 },
        { id: 'c2', nome: 'iFood', taxaPct: null },
      ],
      casaDoDia: 6228.48,
    })
    const balcao = f.canais[0]
    const ifood = f.canais[1]
    expect(balcao.taxa).toBe(0)
    expect(balcao.sobra).toBeCloseTo(f.sobra as number, 2)
    // ⭐ o iFood não inventa sobra: fica tudo `null` e a tela diz "a declarar"
    expect(ifood.taxaPct).toBeNull()
    expect(ifood.taxa).toBeNull()
    expect(ifood.sobra).toBeNull()
    expect(ifood.quantosPagamACasa).toBeNull()
  })

  it('⭐ a taxa do canal sai do PREÇO e derruba a sobra na medida exata', () => {
    const f = montarFichaDeMargem({
      chave: 'f:g', nome: 'G', preco: 100, precoOrigem: 'praticado', folhas,
      canais: [{ id: 'c', nome: 'app', taxaPct: 0.27 }], casaDoDia: null,
    })
    expect(f.canais[0].taxa).toBeCloseTo(27, 2)
    expect(f.canais[0].sobra).toBeCloseTo((f.sobra as number) - 27, 2)
  })

  it('⭐ "é embalagem?" tem UMA resposta no sistema', () => {
    expect(ehEmbalagem('EMBALAGEM')).toBe(true)
    expect(ehEmbalagem('embalagem')).toBe(true)
    expect(ehEmbalagem('MATERIA_PRIMA')).toBe(false)
    expect(ehEmbalagem('INTERMEDIARIO')).toBe(false)
  })
})

describe('⭐ O POR-DIA — uma execução do hub, não uma por dia', () => {
  it('⭐ a sobra do dia usa a sobra/un do período × as unidades DAQUELE dia', () => {
    const s = sobrasDoPeriodo(PROD)
    const r = sobraPorDia(
      [
        { dia: '2026-10-01', nomeSuitable: 'Combo Caçula', quantidade: 10 },
        { dia: '2026-10-02', nomeSuitable: 'Combo Caçula', quantidade: 5 },
      ],
      s.dentro,
      new Map([['f:combo', ['Combo Caçula']]]),
    )
    const sobraUn = s.dentro.find((p) => p.chave === 'f:combo')!.sobraUn
    expect(r).toHaveLength(2)
    expect(r[0].sobra).toBeCloseTo(sobraUn * 10, 2)
    expect(r[1].sobra).toBeCloseTo(sobraUn * 5, 2)
  })

  it('⛔ produto FORA da obra não entra como ZERO — entra na cobertura do dia', () => {
    const r = sobraPorDia(
      [{ dia: '2026-10-01', nomeSuitable: 'XIS COMPLETO', quantidade: 40 }],
      sobrasDoPeriodo(PROD).dentro,
      new Map(),
    )
    expect(r[0].sobra).toBe(0)
    expect(r[0].unidades).toBe(0)
    expect(r[0].unidadesFora).toBe(40)
  })

  it('⭐ o mapa é NOME → chave: os apelidos do PDV caem no mesmo tijolo', () => {
    const s = sobrasDoPeriodo([linha({ chave: 'f:xis', nome: 'XIS', precoUsado: 30, custoUnitario: 10 })])
    const r = sobraPorDia(
      [
        { dia: '2026-10-01', nomeSuitable: 'XIS COMPLETO', quantidade: 2 },
        { dia: '2026-10-01', nomeSuitable: 'XIS - COMPLETO', quantidade: 3 },
      ],
      s.dentro,
      new Map([['f:xis', ['XIS COMPLETO', 'XIS - COMPLETO']]]),
    )
    expect(r[0].unidades).toBe(5)
    expect(r[0].sobra).toBeCloseTo(20 * 5, 2)
  })
})

describe('⚠️ "GRANDE" É TAMANHO VAZADO, NÃO SABOR (decisão do dono, 07/10)', () => {
  it('⛔ os tamanhos ficam FORA da fila de sabores', () => {
    for (const n of ['GRANDE', 'grande', 'FAMÍLIA', 'FAMILIA', 'PEQUENA', 'BROTO']) {
      expect(ehSaborDeVerdade(n), n).toBe(false)
    }
  })

  it('⭐ e a lista é FECHADA: sabor que CONTÉM a palavra continua sabor', () => {
    // ⛔ lista aberta esconderia sabor legítimo — existe "PORTUGUESA GRANDE" no cardápio
    expect(ehSaborDeVerdade('PORTUGUESA GRANDE')).toBe(true)
    expect(ehSaborDeVerdade('4 QUEIJOS')).toBe(true)
    expect(ehSaborDeVerdade('CALABRESA')).toBe(true)
  })
})
