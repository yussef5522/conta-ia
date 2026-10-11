/**
 * ⭐⭐⭐ VENDAS v4 — O PDV É A VERDADE, E A TELA ABRE NO MÊS DE HOJE (10/10/2026).
 *
 * ⚠️ Os números são os MEDIDOS em prod (outubro/2026), e isso importa aqui mais que de
 * costume: é justamente a DIVERGÊNCIA entre as duas fontes que o desenho resolve, e fixture
 * inventada mostraria os dois lados batendo — o mundo que eu imaginei, não o que existe.
 * ```
 *   02/10 sex  PDV R$ 21.687,63  ·  extrato R$ 36.835,34   ← o extrato traz o BLOCO do fds
 *   06/10 ter  PDV R$ 15.873,77  ·  extrato R$ 15.926,36   ← dia normal: batem de perto
 * ```
 */
import { describe, it, expect } from 'vitest'
import {
  montarDias, montarCartoes, projetarOMes, composicaoPorMeio, diaTipico,
  segundaDaSemana, MIN_AMOSTRAS_DO_DIA,
  type EntradaDoExtrato, type DiaDeVenda,
} from '../dia-a-dia'

/** ⭐ o PDV real de outubro, dia a dia (produtos + complementos) */
const PDV_OUT: Record<string, number> = {
  '2026-10-01': 23_762.61, '2026-10-02': 23_060.46, '2026-10-03': 30_999.79,
  '2026-10-04': 28_377.16, '2026-10-05': 12_147.24, '2026-10-06': 17_102.63,
  '2026-10-07': 16_225.45, '2026-10-08': 16_328.55, '2026-10-09': 18_936.61,
}
const pdvDe = (dias: string[]) =>
  new Map(dias.filter((d) => PDV_OUT[d] != null).map((d) => [d, { total: PDV_OUT[d], unidades: 500 }]))

/** ⭐ o extrato real: dias únicos + o BLOCO 02→04 do cartão (sex+sáb+dom juntos) */
const EXTRATO_OUT: EntradaDoExtrato[] = [
  { dia: '2026-10-01', fim: '2026-10-01', total: 14_163.31, meio: 'PIX' },
  { dia: '2026-10-02', fim: '2026-10-04', total: 23_908.49, meio: 'CARTAO' },
  { dia: '2026-10-02', fim: '2026-10-02', total: 12_926.85, meio: 'PIX' },
  { dia: '2026-10-05', fim: '2026-10-05', total: 11_369.32, meio: 'PIX' },
  { dia: '2026-10-06', fim: '2026-10-06', total: 15_926.36, meio: 'CARTAO' },
  { dia: '2026-10-07', fim: '2026-10-07', total: 15_608.79, meio: 'DINHEIRO' },
  { dia: '2026-10-08', fim: '2026-10-08', total: 14_195.56, meio: 'PIX' },
]

const base = (o: Partial<Parameters<typeof montarDias>[0]> = {}) =>
  montarDias({
    de: '2026-10-01', ate: '2026-10-31',
    pdv: pdvDe(Object.keys(PDV_OUT)),
    extrato: EXTRATO_OUT,
    hoje: '2026-10-10',
    moduleInicio: '2026-08-01',
    ...o,
  })

const diaDe = (ds: DiaDeVenda[], k: string) => ds.find((d) => d.dia === k)!

describe('⛔⛔⛔ O PDV MANDA — e só o extrato leva `~`', () => {
  it('⭐⭐ dia com import: número do PDV, LISO (sem ~)', () => {
    const d = diaDe(base(), '2026-10-06')
    expect(d.fonte).toBe('PDV')
    expect(d.total).toBeCloseTo(17_102.63, 2)
    // ⛔ O VERMELHO QUE O DONO PEDIU: *"~ em dia com import = vermelho"*
    expect(d.estimado).toBe(false)
  })

  /**
   * ⛔⛔ E O PDV GANHA MESMO QUANDO O EXTRATO TEM O DIA — eles medem coisas diferentes: o PDV
   * é o que foi VENDIDO naquele dia, o extrato é o que CAIU atribuído a ele. Deixar o extrato
   * ganhar faria a célula do dia 02 mostrar R$ 36.835 (o bloco do fds inteiro) num dia que
   * vendeu R$ 23.060.
   */
  it('⛔⛔ com as DUAS fontes no mesmo dia, o PDV ganha', () => {
    const d = diaDe(base(), '2026-10-02')
    expect(d.fonte).toBe('PDV')
    expect(d.total).toBeCloseTo(23_060.46, 2)
    expect(d.total).not.toBeCloseTo(36_835.34, 2)
  })

  it('⭐ dia SEM import e com extrato próprio: fallback com ~', () => {
    const semPdv = base({ pdv: pdvDe(['2026-10-06']) })
    const d = diaDe(semPdv, '2026-10-05')
    expect(d.fonte).toBe('EXTRATO')
    expect(d.total).toBeCloseTo(11_369.32, 2)
    expect(d.estimado).toBe(true)
  })

  /**
   * ⛔⛔⛔ O BLOCO NÃO SE DIVIDE POR 3. Sem import, o número do dia 03 não existe: o cartão
   * liquidou sex+sáb+dom junto e o banco não diz quanto é de cada. A célula aponta pro bloco;
   * mostrar um terço seria inventar — *"saldo não se chuta"*.
   */
  it('⛔⛔⛔ dia de fds sem import e dentro de bloco: `total` null, apontando pro bloco', () => {
    const semPdv = base({ pdv: new Map() })
    const d = diaDe(semPdv, '2026-10-03')
    expect(d.total).toBeNull()
    expect(d.fonte).toBe('BLOCO')
    expect(d.noBloco).toBe('2026-10-02→2026-10-04')
    // ⛔ o terço inventado: 23.908,49 / 3
    expect(d.total).not.toBeCloseTo(7_969.5, 1)
  })

  it('⭐ dia FUTURO não pede import nem inventa número', () => {
    const d = diaDe(base(), '2026-10-20')
    expect(d.fonte).toBe('FUTURO')
    expect(d.total).toBeNull()
    expect(d.pedeImport).toBe(false)
  })

  /**
   * ⛔⛔ COBRAR IMPORT DO DIA DE HOJE É COBRAR O IMPOSSÍVEL — o relatório do PDV entra na
   * MADRUGADA (medido: os imports de prod saem 23h41 · 23h58 · 00h12). É a mesma razão do
   * gate das 10h do aviso de import torto (08/10).
   */
  it('⛔⛔ o dia de HOJE não pede import, mesmo sem ele', () => {
    const d = base({ pdv: new Map(), hoje: '2026-10-06' })
    expect(diaDe(d, '2026-10-06').pedeImport).toBe(false)
    expect(diaDe(d, '2026-10-05').pedeImport).toBe(true)
  })

  it('⭐ antes do início do módulo: "sem dado", e NÃO pede import', () => {
    const d = montarDias({
      de: '2026-07-20', ate: '2026-07-31', pdv: new Map(),
      extrato: [{ dia: '2026-07-25', fim: '2026-07-25', total: 100, meio: 'PIX' }],
      hoje: '2026-10-10', moduleInicio: '2026-08-01',
    })
    const x = diaDe(d, '2026-07-22')
    expect(x.fonte).toBe('SEM_DADO')
    expect(x.pedeImport).toBe(false)
  })

  it('⭐ e o que PEDE IMPORT é o dia de venda que o extrato viu e o PDV não', () => {
    const d = base({ pdv: pdvDe(['2026-10-06']) })
    expect(diaDe(d, '2026-10-01').pedeImport).toBe(true)
    expect(diaDe(d, '2026-10-06').pedeImport).toBe(false)
    // ⚠️ dia sem nenhuma das duas fontes não cobra import — não houve venda registrada
    expect(diaDe(d, '2026-10-09').pedeImport).toBe(false)
  })
})

describe('⛔⛔ UMA CÉLULA POR DIA — o bloco agrupado MORREU', () => {
  /**
   * ⛔⛔ O VERMELHO DO DONO: *"bloco fds agrupado de volta = vermelho"*. A célula de 02, 03 e
   * 04 existe SEPARADA, cada uma com a sua. O agrupado `col-span-3` não volta.
   */
  it('⛔⛔ os 3 dias do fim de semana são 3 células distintas', () => {
    const d = base()
    const fds = ['2026-10-02', '2026-10-03', '2026-10-04'].map((k) => diaDe(d, k))
    expect(fds).toHaveLength(3)
    expect(new Set(fds.map((x) => x.dia)).size).toBe(3)
    // ⭐ e com import cada uma tem o SEU número, diferente dos irmãos
    expect(new Set(fds.map((x) => x.total)).size).toBe(3)
  })

  it('⭐ o recorte tem uma célula por dia de calendário, nada a mais nem a menos', () => {
    expect(base()).toHaveLength(31)
    expect(base({ de: '2026-10-06', ate: '2026-10-06' })).toHaveLength(1)
  })

  it('⭐ o mapa de calor é do PRÓPRIO recorte, e ★ marca o recorde', () => {
    const d = base()
    const rec = d.filter((x) => x.recorde)
    expect(rec).toHaveLength(1)
    expect(rec[0].dia).toBe('2026-10-03') // 30.999,79, o maior de outubro
    expect(rec[0].calor).toBe(1)
    // ⚠️ escala relativa: o menor dia tem calor baixo mas não zero (senão desaparece)
    expect(diaDe(d, '2026-10-05').calor).toBeGreaterThan(0)
    expect(diaDe(d, '2026-10-05').calor).toBeLessThan(0.5)
  })

  it('⭐ "hoje" é marcado — e só ele', () => {
    const d = base()
    expect(d.filter((x) => x.hoje).map((x) => x.dia)).toEqual(['2026-10-10'])
  })
})

describe('⛔⛔ OS 4 CARTÕES — e o relógio é PARÂMETRO, nunca `new Date()`', () => {
  const cartoes = (hoje = '2026-10-10') =>
    montarCartoes({ dias: base({ hoje }), hoje, ehMesInteiro: true, diasSemanaPassada: [] })

  it('⭐ o do período soma os dias medidos e diz quantos venderam', () => {
    const c = cartoes().find((x) => x.qual === 'periodo')!
    const soma = Object.values(PDV_OUT).reduce((a, b) => a + b, 0)
    expect(c.valor).toBeCloseTo(soma, 2)
    expect(c.sub).toBe('9 dias vendidos')
    expect(c.familia).toBe('indigo')
  })

  it('⭐ o melhor dia nomeia o DIA DA SEMANA e a data', () => {
    const c = cartoes().find((x) => x.qual === 'melhorDia')!
    expect(c.valor).toBeCloseTo(30_999.79, 2)
    expect(c.sub).toBe('sábado 03/10')
    expect(c.familia).toBe('verde')
  })

  /**
   * ⛔⛔ A PROJEÇÃO É PELA MÉDIA **POR DIA-DA-SEMANA**, e o contrafactual mostra por quê: no
   * dado real o sábado vende **2,6× a segunda** (30.999 contra 12.147). Uma média simples
   * projetaria o mês que acaba em domingo igual ao que acaba em terça.
   */
  it('⭐⭐ a projeção pondera o dia da semana — não é a média simples × dias restantes', () => {
    const dias = base()
    const p = projetarOMes(dias, '2026-10-10')
    expect(p.valor).not.toBeNull()

    const medidos = dias.filter((d) => d.total != null)
    const realizado = medidos.reduce((a, d) => a + d.total!, 0)
    const mediaSimples = realizado / medidos.length
    const faltam = dias.filter((d) => d.dia > '2026-10-10').length
    const ingenua = realizado + mediaSimples * faltam
    // ⭐ as duas DIFEREM: é esse o ganho da ponderação
    expect(Math.abs(p.valor! - ingenua)).toBeGreaterThan(100)
  })

  /**
   * ⛔⛔ HISTÓRICO INSUFICIENTE = "a apurar", NUNCA um número. Projetar um dia-da-semana que
   * nunca foi medido exigiria inventar — e número inventado numa projeção sai plausível, que
   * é o pior tipo de erro.
   */
  it('⛔⛔ sem amostra de um dia-da-semana que ainda falta: "a apurar" com o PORQUÊ', () => {
    // recorte curto: só 05 e 06 medidos (seg e ter), e o mês inteiro pela frente
    const dias = base({ pdv: pdvDe(['2026-10-05', '2026-10-06']), hoje: '2026-10-06' })
    const p = projetarOMes(dias, '2026-10-06')
    expect(p.valor).toBeNull()
    expect(p.porque).toContain('falta histórico de')
    const c = montarCartoes({ dias, hoje: '2026-10-06', ehMesInteiro: true, diasSemanaPassada: [] })
      .find((x) => x.qual === 'projecao')!
    expect(c.valor).toBeNull()
    // ⚠️ e o rótulo perde o `~` quando não há número: "fecha em ~" sem valor é frase morta
    expect(c.rotulo).not.toContain('~')
  })

  it('⭐ projeção só no MÊS INTEIRO — num recorte de datas livres ela não faz sentido', () => {
    const dias = base({ de: '2026-10-03', ate: '2026-10-06' })
    const c = montarCartoes({ dias, hoje: '2026-10-10', ehMesInteiro: false, diasSemanaPassada: [] })
      .find((x) => x.qual === 'projecao')!
    expect(c.valor).toBeNull()
    expect(c.sub).toContain('mês inteiro')
  })

  it('⭐ mês já fechado: a projeção é o próprio realizado, sem inventar', () => {
    const p = projetarOMes(base({ hoje: '2026-11-05' }), '2026-11-05')
    expect(p.porque).toContain('já fechou')
    expect(p.valor).toBeCloseTo(Object.values(PDV_OUT).reduce((a, b) => a + b, 0), 2)
  })

  /**
   * ⭐⭐ A SUB "vs semana passada" ACENDE SOZINHA — e a comparação é **até o mesmo dia da
   * semana**. ⛔ Comparar 3 dias com 7 diria *"caiu 55%"* numa quarta normal, e esse é o tipo
   * de número que faz o dono deixar de olhar o cartão.
   */
  it('⭐⭐ a comparação acende com histórico, e compara dia a dia', () => {
    const hoje = '2026-10-07' // quarta → a semana atual tem seg, ter, qua
    const passada = montarDias({
      de: '2026-09-28', ate: '2026-10-04',
      pdv: new Map([
        ['2026-09-28', { total: 10_000, unidades: 100 }],
        ['2026-09-29', { total: 10_000, unidades: 100 }],
        ['2026-09-30', { total: 10_000, unidades: 100 }],
      ]),
      extrato: [], hoje, moduleInicio: '2026-08-01',
    })
    const c = montarCartoes({ dias: base({ hoje }), hoje, ehMesInteiro: true, diasSemanaPassada: passada })
      .find((x) => x.qual === 'semana')!
    expect(c.delta).not.toBeNull()
    expect(c.delta).toContain('vs semana passada')
    // ⭐ pctBR: vírgula, nunca ponto
    expect(c.delta).toMatch(/\d+,\d%/)
    expect(c.delta).not.toMatch(/\d\.\d%/)
  })

  it('⛔ sem histórico da semana passada, a sub NÃO inventa comparação', () => {
    const c = cartoes().find((x) => x.qual === 'semana')!
    expect(c.delta).toBeNull()
    expect(c.sub).not.toContain('vs')
  })

  it('⭐ as 4 famílias são as da Opção A, uma por cartão', () => {
    expect(cartoes().map((c) => c.familia)).toEqual(['indigo', 'azul', 'verde', 'ambar'])
  })
})

describe('⛔ AS SEÇÕES DE BAIXO', () => {
  it('⭐ a composição por meio soma 100% e sai em pctBR', () => {
    const m = composicaoPorMeio(EXTRATO_OUT)
    expect(m.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(1, 9)
    for (const x of m) {
      expect(x.rotulo).toMatch(/^\d+,\d%$/)
      expect(x.rotulo).not.toMatch(/\d\.\d/)
    }
    // ⭐ ordenado pelo maior
    expect(m[0].valor).toBeGreaterThanOrEqual(m[m.length - 1].valor)
  })

  it('⭐ sem entrada no período, a composição é lista vazia (a tela diz, não desenha 0%)', () => {
    expect(composicaoPorMeio([])).toEqual([])
  })

  /**
   * ⛔⛔ A AMOSTRA DO FDS É POR **SEMANA**, não por dia: 3 dias de um fim de semana são UMA
   * observação do comportamento de fim de semana, não três. Contar por dia faria o fds passar
   * do mínimo com uma única semana medida.
   */
  it('⛔⛔ o dia típico exige 2 semanas — e o fds conta por SEMANA', () => {
    const umaSemana = montarDias({
      de: '2026-10-05', ate: '2026-10-11',
      pdv: pdvDe(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']),
      extrato: [], hoje: '2026-10-12', moduleInicio: '2026-08-01',
    })
    const t = diaTipico(umaSemana)
    const seg = t.find((x) => x.rotulo === 'segunda')!
    const fds = t.find((x) => x.rotulo === 'fim de semana')!
    expect(seg.amostras).toBe(1)
    expect(seg.media).toBeNull()
    // ⚠️ 1 sexta medida = 0 fins de semana completos
    expect(fds.amostras).toBe(0)
    expect(fds.media).toBeNull()
    expect(MIN_AMOSTRAS_DO_DIA).toBe(2)
  })

  it('⭐ com 2+ semanas o dia típico acende, e a barra é relativa ao maior', () => {
    const t = diaTipico(base())
    const comMedia = t.filter((x) => x.media != null)
    expect(comMedia.length).toBeGreaterThan(0)
    const max = Math.max(...comMedia.map((x) => x.fracao))
    expect(max).toBeCloseTo(1, 9)
  })
})

describe('⭐ a semana é SEG→DOM (a do calendário brasileiro)', () => {
  it('⭐ a segunda de uma quarta é a segunda da mesma semana', () => {
    expect(segundaDaSemana('2026-10-07')).toBe('2026-10-05')
  })
  it('⛔ domingo pertence à semana que COMEÇOU na segunda anterior', () => {
    expect(segundaDaSemana('2026-10-04')).toBe('2026-09-28')
  })
  it('⭐ a segunda de uma segunda é ela mesma', () => {
    expect(segundaDaSemana('2026-10-05')).toBe('2026-10-05')
  })
})

/**
 * ⛔⛔ O ESTADO DE HOJE — achado na PROVA EM PROD de 10/10, não em teste.
 *
 * O dia corrente, antes do import da madrugada, caía no default `SEM_DADO` e a célula dizia
 * ***"sem dado"*** — que se lê como **"não houve venda"** no dia em que a loja está vendendo.
 * ⚠️ É a família do *"sem contagem" × zero* do estoque: **ausência de MEDIÇÃO não é ausência
 * de FATO**, e a tela tem que dizer qual das duas é.
 */
describe('⛔⛔ hoje aberto ≠ sem dado', () => {
  it('⭐ o dia de HOJE sem import é HOJE_ABERTO, nunca SEM_DADO', () => {
    const d = diaDe(base({ pdv: new Map(), extrato: [], hoje: '2026-10-06' }), '2026-10-06')
    expect(d.fonte).toBe('HOJE_ABERTO')
    expect(d.total).toBeNull()
    // ⛔ e ele não cobra import: o relatório do PDV entra de madrugada
    expect(d.pedeImport).toBe(false)
  })

  it('⭐ dia PASSADO sem nada e antes do módulo continua SEM_DADO (o estado honesto dele)', () => {
    const d = montarDias({
      de: '2026-07-20', ate: '2026-07-22', pdv: new Map(), extrato: [],
      hoje: '2026-10-10', moduleInicio: '2026-08-01',
    })
    expect(diaDe(d, '2026-07-21').fonte).toBe('SEM_DADO')
  })

  it('⛔ e HOJE com import é PDV — o estado novo não atropela a medição', () => {
    const d = diaDe(base({ hoje: '2026-10-06' }), '2026-10-06')
    expect(d.fonte).toBe('PDV')
    expect(d.total).toBeCloseTo(17_102.63, 2)
  })

  /**
   * ⛔⛔ E ELE NÃO ENTRA NA MÉDIA DO DIA TÍPICO — dia pela metade puxaria a média do
   * dia-da-semana pra baixo, e é justamente o número que o dono usa pra comparar.
   */
  it('⛔⛔ o dia de HOJE não conta como amostra — nem pelo EXTRATO', () => {
    /**
     * ⚠️ ESTE TESTE ME CORRIGIU: eu queria provar o `HOJE_ABERTO` e o cenário fez o dia de
     * hoje virar `EXTRATO` (o dinheiro do dia já começou a cair). ⭐ E aí apareceu o caso
     * que importa mais — **dia de hoje COM número parcial puxando a média pra baixo**. A
     * régua é sobre o DIA, nunca sobre a fonte.
     */
    const dias = base({ pdv: pdvDe(['2026-10-05']), hoje: '2026-10-06' })
    expect(diaDe(dias, '2026-10-06').fonte, 'o extrato do dia já caiu em parte').toBe('EXTRATO')
    const ter = diaTipico(dias).find((x) => x.rotulo === 'terça')!
    expect(ter.amostras, 'a terça de hoje está pela metade — não é amostra').toBe(0)

    // ⭐ e o CONTRAFACTUAL: amanhã, com o dia fechado, ela passa a contar
    const amanha = base({ pdv: pdvDe(['2026-10-05']), hoje: '2026-10-07' })
    expect(diaTipico(amanha).find((x) => x.rotulo === 'terça')!.amostras).toBe(1)
  })

  it('⛔ e o VOLUME de hoje continua contado no cartão do período', () => {
    const dias = base({ hoje: '2026-10-06' })
    const c = montarCartoes({ dias, hoje: '2026-10-06', ehMesInteiro: true, diasSemanaPassada: [] })
      .find((x) => x.qual === 'periodo')!
    const soma = dias.filter((d) => d.total != null).reduce((a, d) => a + d.total!, 0)
    expect(c.valor).toBeCloseTo(soma, 2)
  })
})

/**
 * ⛔⛔⛔ AS DUAS DEFINIÇÕES, NOMEADAS — a divergência tela × central (10/10).
 *
 * **Medido em prod no dia 06/10:** a TELA DE VENDAS diz **R$ 17.102,63** e a CENTRAL DE
 * IMPORTAÇÃO diz **R$ 15.873,77**. A diferença é **R$ 1.228,86 = os COMPLEMENTOS**.
 *
 * ⚠️⚠️ E O DONO PEDIU QUE AS DUAS BATESSEM NO VALOR R$ 18.743,90 — **que não existe em fonte
 * nenhuma** (medido: produtos 15.873,77 · complementos 1.228,86 · soma 17.102,63 · extrato
 * 15.926,36). Então o guard trava o que dá pra defender: **a composição**, com cada lado
 * dizendo o que soma.
 *
 * ⛔⛔ E EU NÃO ESCOLHI QUAL É "O FATURAMENTO" — a composição medida aponta pra adicional
 * cobrado à parte (borda R$ 22–35, bebida escolhida, upgrade de tamanho), **31 das 80 linhas
 * do dia estão a R$ 0,00** (inclusas no preço, não somam), e os **R$ 1.286,31 (10,5%)** em
 * nomes que vivem nos DOIS relatórios são justamente os que o dono **já decidiu em 02/09**
 * serem vendas distintas (*"a mesma garrafa, uma por caminho"*). ⚠️ O extrato **não serve de
 * juiz** nesta janela: ele é recebimento com defasagem (D+1 e bloco), por isso existe o V6
 * com as bordas nomeadas. **Decidir por ele seria inventar a intenção do dono.**
 */
describe('⛔⛔ a composição do total — o que a tela soma, dito', () => {
  it('⭐ o dia carrega produtos e complementos separados, e eles SOMAM o total', () => {
    const pdv = new Map([['2026-10-06', { total: 17_102.63, unidades: 515, produtos: 15_873.77, complementos: 1_228.86 }]])
    const d = diaDe(montarDias({
      de: '2026-10-06', ate: '2026-10-06', pdv, extrato: [],
      hoje: '2026-10-10', moduleInicio: '2026-08-01',
    }), '2026-10-06')
    expect(d.produtos).toBeCloseTo(15_873.77, 2)
    expect(d.complementos).toBeCloseTo(1_228.86, 2)
    expect((d.produtos ?? 0) + (d.complementos ?? 0)).toBeCloseTo(d.total!, 2)
  })

  /**
   * ⛔ O NÚMERO DA CENTRAL É DERIVÁVEL DO PAYLOAD — é isso que permite a tela EXPLICAR a
   * divergência em vez de o dono descobrir sozinho comparando duas telas.
   */
  it('⛔ Σ(produtos) == o que a central mostra · Σ(total) == o que a tela mostra', () => {
    const pdv = new Map([
      ['2026-10-06', { total: 17_102.63, unidades: 515, produtos: 15_873.77, complementos: 1_228.86 }],
      ['2026-10-07', { total: 16_225.45, unidades: 431, produtos: 15_207.36, complementos: 1_018.09 }],
    ])
    const dias = montarDias({
      de: '2026-10-06', ate: '2026-10-07', pdv, extrato: [],
      hoje: '2026-10-10', moduleInicio: '2026-08-01',
    })
    const somaProd = dias.reduce((a, x) => a + (x.produtos ?? 0), 0)
    const somaTudo = dias.reduce((a, x) => a + (x.total ?? 0), 0)
    expect(somaProd, 'a definição da CENTRAL').toBeCloseTo(31_081.13, 2)
    expect(somaTudo, 'a definição da TELA').toBeCloseTo(33_328.08, 2)
    const c = montarCartoes({ dias, hoje: '2026-10-10', ehMesInteiro: false, diasSemanaPassada: [] })
      .find((x) => x.qual === 'periodo')!
    expect(c.valor, 'o cartão fecha com a definição da TELA').toBeCloseTo(somaTudo, 2)
  })

  it('⚠️ dia que veio do EXTRATO não tem composição (o extrato não separa)', () => {
    const d = diaDe(base({ pdv: new Map() }), '2026-10-06')
    expect(d.fonte).toBe('EXTRATO')
    expect(d.produtos).toBeNull()
    expect(d.complementos).toBeNull()
  })
})
