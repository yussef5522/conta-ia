/**
 * ⛔⛔⛔ A LEI: **A CONTA DE PADEIRO SOMA SEMPRE** (02/10/2026).
 *
 * **O caso real, na Coca 2L, janela 01/10 → 02/10:** a tela imprimia
 *
 * ```
 *   tinha ........ 265
 *   vendeu ....... −81
 *   DEVIA TER .... 147      ⛔ e 265 − 81 = 184
 * ```
 *
 * Os **37** de diferença o motor descontava por dentro (o `deviaTer` é o `saldoSistema`
 * gravado na contagem, que já sentiu tudo) e a conta IMPRESSA **não tinha linha pra eles** —
 * só um rodapé dizendo *"37 UN desta janela não têm movimento que explique"*.
 *
 * ⭐ **E os 37 eram UM movimento, com nome e sobrenome:** `BAIXA_VENDA −37`, fato datado em
 * **01/10 00:00** (o import de complementos grava à meia-noite) e **lançado em 02/10 04:58**
 * — com a contagem no meio, às **01/10 04:30**. Datado antes da contagem, criado depois: ele
 * entra no saldo do sistema e **não aparece numa janela filtrada por `dataMovimento`**.
 *
 * ⚠️⚠️ **E A COZINHA CONTA DE MADRUGADA** (medido: as 21 contagens da Coca saíram entre 02:22
 * e 05:23). Então a baixa de complementos datada à meia-noite cai ANTES da contagem do
 * próprio dia **todo dia** — não é caso de borda, é a rotina.
 *
 * **A LEI (palavras do dono):** *"toda parcela que o motor usa aparece como LINHA, e
 * Σ(linhas) == devia ter — guard vermelho se não fechar."*
 *
 * ⚠️ Roda contra o BANCO e monta a cena **na forma de prod** (REGRA 3): o ajuste de contagem
 * leva `receiptId = contagemId`, como o `contarLinha` grava. Fixture que não reproduz a forma
 * de prod não prova nada sobre prod.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { calcularFechamentoDoDia } from '../fechamento'
import { criarMovimento } from '@/lib/stock/movement'

const CNPJ = '73737373000173'
let companyId: string
let coca: string

/**
 * ⚠️⚠️ A CENA É RELATIVA AO RELÓGIO, e isso não é preciosismo — foi um defeito de fixture
 * pego aqui: o `criadoEm` de um movimento é o relógio real e **não se backdata pela porta**.
 * Com datas fixas no passado, TODO movimento da fixture nascia "depois" da contagem de
 * referência e a classificação saía errada. ⭐ A cena honesta é a da operação: *"a contagem
 * anterior foi ontem nesta hora; a de referência acabou de sair"* — aí a ordem de lançamento
 * da fixture é a mesma de prod. (E datas fixas no futuro são proibidas pelo guard da casa.)
 */
const AGORA = Date.now()
const H = 3_600_000
const ANT = new Date(AGORA - 24 * H)        // a contagem anterior: ontem nesta hora
const REF = new Date(AGORA + 5 * 60 * 1000) // a de referência: acabou de sair
const DENTRO = new Date(AGORA - 12 * H)     // o fato datado DENTRO da janela
const RETRO = new Date(AGORA - 30 * H)      // o fato datado ANTES da contagem anterior
const diaBR = (d: Date) => new Date(+d - 3 * H).toISOString().slice(0, 10)
const JANELA = { de: diaBR(ANT), ate: diaBR(REF) }

/** a contagem como a tela grava: linha + AJUSTE_CONTAGEM com `receiptId` = a SESSÃO */
async function contar(contadoEm: Date, saldoSistema: number, contou: number, custo = 8) {
  const divergencia = Math.round((contou - saldoSistema) * 1000) / 1000
  const sessao = await prisma.stockContagem.create({
    data: { companyId, tipo: 'ROTINA', status: 'FINALIZADA', iniciadaEm: contadoEm, finalizadaEm: contadoEm },
  })
  const mov = divergencia === 0 ? null : await criarMovimento(prisma, {
    companyId, itemId: coca, tipo: 'AJUSTE_CONTAGEM', quantidade: divergencia,
    custoUnitario: custo, custoTotal: Math.round(divergencia * custo * 100) / 100,
    // ⭐ é ESTE campo que faz o ajuste da borda ficar fora da conta (o `tinha` já é
    // pós-ajuste da anterior; o `deviaTer` é pré-ajuste da de referência)
    receiptId: sessao.id, origem: 'MANUAL', dataMovimento: contadoEm,
  })
  await prisma.stockContagemItem.create({
    data: {
      companyId, contagemId: sessao.id, itemId: coca, saldoSistema, qtdContada: contou, divergencia,
      custoUnitario: custo, valorDivergencia: Math.round(divergencia * custo * 100) / 100,
      movementId: mov?.id ?? null, contadoEm, contadoPorNome: 'cristian fortes',
    },
  })
  return sessao.id
}

const rodar = () =>
  calcularFechamentoDoDia({ companyId, de: JANELA.de, ate: JANELA.ate, caros: [], revenda: [coca], porcoes: [] }, prisma)

const linha = async () => {
  const r = await rodar()
  return r.revenda[0]
}

/** ⭐ a conta impressa: `tinha` + cada linha que a tela desenha */
function somaImpressa(c: NonNullable<Awaited<ReturnType<typeof linha>>['conta']>) {
  // ⚠️ o `foraDoTotal` aparece na tela e NÃO soma — é a linha do lançamento atrasado
  const soma = c.baldes.reduce((s, b) => s + (b.foraDoTotal ? 0 : b.qtd), 0)
  return Math.round((c.tinha + soma) * 1000) / 1000
}

beforeEach(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { cnpj: CNPJ, name: 'CONTA SOMA' } })
  companyId = c.id
  const i = await prisma.stockItem.create({
    data: { companyId, nome: 'COCA-COLA  2L', unidadeControle: 'UN', categoria: 'REVENDA', criadoVia: 'CONFERENCIA' },
  })
  coca = i.id
})
afterEach(async () => { await prisma.company.deleteMany({ where: { cnpj: CNPJ } }) })

describe('⛔⛔⛔ O CASO REAL DA COCA 2L — o lançamento retroativo tem LINHA', () => {
  it('⛔⛔⛔ Σ das linhas impressas == devia ter, e o resíduo é ZERO', async () => {
    // ⭐ a contagem da madrugada ESTABELECE o "tinha" (como a 1ª contagem real faz)
    await contar(ANT, 266, 265)
    // a venda do dia (relatório de PRODUTOS, datado no meio da janela)
    await criarMovimento(prisma, {
      companyId, itemId: coca, tipo: 'BAIXA_VENDA', quantidade: -81, custoUnitario: 8, custoTotal: -648,
      origem: 'MANUAL', dataMovimento: DENTRO,
    })
    /**
     * ⛔ O RETROATIVO: o complemento do MESMO dia 01/10, datado à **meia-noite** — portanto
     * ANTES da contagem das 04:30 — e lançado agora. É ele que o `deviaTer` sente e a janela
     * do fato não vê.
     */
    await criarMovimento(prisma, {
      companyId, itemId: coca, tipo: 'BAIXA_VENDA', quantidade: -37, custoUnitario: 8, custoTotal: -296,
      origem: 'MANUAL', dataMovimento: RETRO,
    })
    // a contagem de referência: o sistema agora diz 147 (265 − 81 − 37)
    await contar(REF, 147, 201)

    const l = await linha()
    const c = l.conta!
    expect(c.tinha, 'o "tinha" é o que a contagem anterior CONTOU').toBe(265)
    expect(c.deviaTer, 'o "devia ter" é o saldo gravado na contagem de referência').toBe(147)

    const vendeu = c.baldes.find((b) => b.chave === 'vendeu')!
    expect(vendeu.qtd, 'a venda do dia, pela data do fato').toBe(-81)

    const retro = c.baldes.find((b) => b.chave === 'foraDeOrdem')
    expect(retro, '⛔ o lançamento retroativo não tem LINHA — é o defeito de 02/10').toBeTruthy()
    expect(retro!.qtd, 'a linha do retroativo tem que valer os 37').toBe(-37)
    expect(retro!.rotulo, 'a linha tem que DIZER as duas datas').toMatch(/retroativo/i)
    expect(retro!.rotulo, 'o rótulo tem que nomear o dia do FATO em DD/MM').toContain(
      diaBR(RETRO).split('-').reverse().slice(0, 2).join('/'),
    )

    // ⭐⭐ A LEI
    expect(somaImpressa(c), 'Σ das linhas impressas tem que dar o DEVIA TER').toBe(c.deviaTer)
    expect(c.naoExplicado, 'não pode sobrar resíduo — toda parcela tem linha').toBe(0)
    expect(c.contamos).toBe(201)
    expect(c.faltou, 'o veredito segue sendo o gravado na contagem').toBe(54)
  })

  it('⭐ a conta de um dia NORMAL (sem retroativo) continua fechando e sem linha a mais', async () => {
    await contar(ANT, 100, 100)
    await criarMovimento(prisma, {
      companyId, itemId: coca, tipo: 'BAIXA_VENDA', quantidade: -20, custoUnitario: 8, custoTotal: -160,
      origem: 'MANUAL', dataMovimento: DENTRO,
    })
    await contar(REF, 80, 79)

    const c = (await linha()).conta!
    expect(somaImpressa(c)).toBe(c.deviaTer)
    expect(c.naoExplicado).toBe(0)
    // ⛔ sem retroativo, a linha não aparece — móvel zerado treina o dono a não olhar
    expect(c.baldes.find((b) => b.chave === 'foraDeOrdem'), 'linha de retroativo apareceu sem retroativo').toBeFalsy()
  })
})

describe('⛔⛔ O AJUSTE DE CONTAGEM — a exclusão é pela SESSÃO, não pelo TIPO', () => {
  it('⭐⭐ a contagem do MEIO vira o "tinha" — e a conta continua fechando', async () => {
    /**
     * ⚠️⚠️ ACHADO ESCREVENDO ESTE GUARD: *"ajuste de contagem no meio da janela"* é
     * **estruturalmente impossível**. O `ant` é, por construção, **a última contagem antes da
     * de referência** — então qualquer contagem no meio PASSA A SER o `ant`, e o ajuste dela
     * é de BORDA. ⭐ A cena honesta é esta: três contagens, e a janela encurta pra a última.
     *
     * ⛔ O balde `ajustes` fica como rede (ajuste de sessão que não é nenhuma das duas
     * bordas), e o teste abaixo prova o que importa: **o ajuste da borda NUNCA vira linha**,
     * senão o `tinha` e o `deviaTer` o contariam duas vezes.
     */
    await contar(ANT, 100, 100)
    await contar(DENTRO, 100, 90)   // esta passa a ser o "tinha"
    await contar(REF, 90, 88)

    const c = (await linha()).conta!
    expect(c.tinha, 'a janela encurta pra a contagem mais recente antes da referência').toBe(90)
    expect(c.desde, 'e o "desde" diz isso').toBe(diaBR(DENTRO))
    expect(c.deviaTer).toBe(90)
    expect(somaImpressa(c)).toBe(c.deviaTer)
    expect(c.naoExplicado).toBe(0)
  })

  it('⛔ o ajuste da PRÓPRIA contagem de borda NÃO entra (senão conta duas vezes)', async () => {
    // as duas contagens têm ajuste (−1 e +5): nenhum dos dois pode virar linha
    await contar(ANT, 50, 49)
    await contar(REF, 49, 54)
    const c = (await linha()).conta!
    expect(c.tinha).toBe(49)
    expect(c.deviaTer).toBe(49)
    expect(c.baldes.find((b) => b.chave === 'ajustes'), 'o ajuste da borda virou linha').toBeFalsy()
    expect(somaImpressa(c)).toBe(c.deviaTer)
    expect(c.naoExplicado).toBe(0)
  })
})

describe('⚠️⚠️ O ESPELHO — lançado DEPOIS da contagem aparece e NÃO soma', () => {
  it('⛔⛔ import atrasado: a linha existe, fica fora do total, e a conta FECHA', async () => {
    /**
     * ⭐⭐ **MEDIDO EM PROD, e foi o dado que decidiu:** das 35 linhas das listas, **7 não
     * fechavam e (B) era a causa de 6** — tirando-o do total, `tinha + normal + retroativo` dá
     * o `deviaTer` ao centavo (iscas de frango 119 · queijo 271,11 · beef 17). Eu tinha
     * deixado (B) como simples resíduo achando que era raro; **o dado disse o contrário**.
     *
     * ⛔ E ele PRECISA aparecer na tela: some calado seria o buraco de novo, do outro lado.
     * Ele entra na PRÓXIMA janela (lá o fato é anterior à contagem, então vira retroativo).
     */
    /**
     * ⚠️ AS DUAS CONTAGENS FICAM NO PASSADO nesta cena — é a única forma de o movimento
     * (criado agora) nascer DEPOIS delas, que é exatamente o que define (B). Nas outras cenas
     * a de referência está no futuro imediato, pra os movimentos nascerem antes.
     */
    const ANT_P = new Date(AGORA - 48 * H)
    const REF_P = new Date(AGORA - 24 * H)
    const FATO_P = new Date(AGORA - 36 * H) // datado ENTRE as duas contagens
    await contar(ANT_P, 100, 100)
    await contar(REF_P, 100, 97)
    // a venda daquele dia, lançada só agora (import atrasado)
    await criarMovimento(prisma, {
      companyId, itemId: coca, tipo: 'BAIXA_VENDA', quantidade: -8, custoUnitario: 8, custoTotal: -64,
      origem: 'MANUAL', dataMovimento: FATO_P,
    })

    const r = await calcularFechamentoDoDia(
      { companyId, de: diaBR(ANT_P), ate: diaBR(REF_P), caros: [], revenda: [coca], porcoes: [] }, prisma,
    )
    const c = r.revenda[0].conta!
    expect(c.tinha).toBe(100)
    expect(c.deviaTer, 'a foto da contagem é anterior ao lançamento').toBe(100)

    const tarde = c.baldes.find((b) => b.chave === 'lancadoDepois')
    expect(tarde, '⛔ o lançamento atrasado sumiu da tela').toBeTruthy()
    expect(tarde!.qtd).toBe(-8)
    expect(tarde!.foraDoTotal, 'ele NÃO pode entrar no total — não estava na foto').toBe(true)
    expect(tarde!.rotulo).toMatch(/próxima janela/i)

    // ⛔ e o balde "vendeu" NÃO o contou
    expect(c.baldes.find((b) => b.chave === 'vendeu'), 'o atrasado entrou no vendeu e a conta não fecha').toBeFalsy()
    expect(somaImpressa(c), 'Σ das linhas QUE SOMAM tem que dar o devia ter').toBe(c.deviaTer)
    expect(c.naoExplicado).toBe(0)
  })
})

describe('⚠️ O ARREDONDAMENTO DA FOTO — 6 milésimos não são linha faltando', () => {
  it('⭐ snapshot de 2 casas × ledger de 3 casas: resíduo de milésimo vira ZERO', async () => {
    /**
     * ⭐⭐ **MEDIDO EM PROD no «Coxão Mole»:** Σ das linhas **49,316** × snapshot **49,31** —
     * resíduo de **6 milésimos**. O `saldoSistema` da contagem é gravado com 2 casas e o
     * ledger anda em 3 (grama/ml), então a diferença é **artefato de arredondamento**, não
     * movimento sem linha.
     *
     * ⛔ Com a tolerância em 0,005 isso acendia a faixa âmbar todo dia num item que está
     * certo — e *alarme falso repetido é como um alarme morre* (os 111 falsos de 26/08).
     */
    await contar(ANT, 20.2, 20.2)
    // uma entrada em KG, com a 3ª casa que o ledger guarda e a foto não
    await criarMovimento(prisma, {
      companyId, itemId: coca, tipo: 'ENTRADA_NF', quantidade: 29.116, custoUnitario: 8,
      custoTotal: Math.round(29.116 * 8 * 100) / 100, origem: 'SEFAZ', dataMovimento: DENTRO,
    })
    // a foto da contagem guarda 49,31 — o ledger soma 49,316
    await contar(REF, 49.31, 49)
    const c = (await linha()).conta!
    expect(somaImpressa(c), 'o ledger soma em 3 casas').toBe(49.316)
    expect(c.deviaTer, 'a foto guarda 2 casas').toBe(49.31)
    expect(c.naoExplicado, '6 milésimos de arredondamento não são linha faltando').toBe(0)
  })
})

describe('⭐ COBERTURA TOTAL — nenhum tipo do ledger some da conta', () => {
  it('⭐⭐ tipo que nenhuma coluna nomeia cai em "outros", com o nome dele', async () => {
    /**
     * ⭐ O `AJUSTE_RESIDUO` nasceu em 19/09 (a limpeza de centavos do encerrar-item) e
     * **nunca teve casa nesta conta** — somaria em silêncio pro resíduo. A rede `outros`
     * existe pra tipo novo aparecer com o nome dele em vez de virar um número que ninguém
     * explica.
     */
    await contar(ANT, 30, 30)
    await criarMovimento(prisma, {
      companyId, itemId: coca, tipo: 'AJUSTE_RESIDUO', quantidade: -0.5, custoUnitario: 8, custoTotal: -4,
      origem: 'MANUAL', dataMovimento: DENTRO,
    })
    await contar(REF, 29.5, 29)

    const c = (await linha()).conta!
    const outros = c.baldes.find((b) => b.chave === 'outros')
    expect(outros, 'tipo sem coluna própria sumiu da conta').toBeTruthy()
    expect(outros!.qtd).toBe(-0.5)
    expect(outros!.rotulo, 'a linha tem que dizer QUE tipo é').toContain('ajuste_residuo')
    expect(somaImpressa(c)).toBe(c.deviaTer)
    expect(c.naoExplicado).toBe(0)
  })
})
