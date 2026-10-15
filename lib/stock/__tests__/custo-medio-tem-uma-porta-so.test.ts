/**
 * ⛔⛔⛔ O GUARD DO DONO (13/10/2026): *"A PORTA ÚNICA do custo (a que ficha, explodir, bases,
 * baixa e veredito leem) passa a devolver a lei. NENHUM consumidor muda — só a porta. Grep:
 * leitura de valor/saldo por fora = vermelho."*
 *
 * ⚠️ **Estrutural e assumido como tal:** o que dá pra travar sem banco é a PROCEDÊNCIA — quem
 * responde *"quanto custa uma unidade deste item"* tem que ser `custoMedioComMemoria`, nunca
 * uma divisão escrita à mão. Era justamente uma divisão à mão (`saldo > 0 ? valor/saldo :
 * null`) que **apagava o custo quando o estoque zerava**.
 *
 * ⚠️ E ele lê a fonte **SEM COMENTÁRIO** — senão morderia a própria documentação do defeito
 * (*"o arquivo que documenta o defeito não pode ser o que o absolve"*, 21/09).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe } from '../../../__tests__/regras-ui/_leitura-de-fonte'

const RAIZ = process.cwd()
const PORTA = 'lib/stock/custo-vigente.ts'
/**
 * ⚠️ A LEI saiu de `custo-vigente.ts` pra cá em 15/10, por CICLO DE IMPORT (`residuo-de-
 * centavos` → porta → `contagem-ancora` → `entrada-cruza-o-zero` → de volta; 177 testes
 * vermelhos com um `undefined` no meio da gravação de movimento). ⛔ **A PORTA não mudou** —
 * `custo-vigente.ts` RE-EXPORTA a lei, e todo leitor de sempre segue importando dela.
 */
const LEI = 'lib/stock/lei-do-custo-medio.ts'
const SALDO = 'lib/stock/saldo.ts'

const fonte = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8')
const limpa = (rel: string) => semComentarios(fonte(rel))

/**
 * ⭐ Os DOIS lugares que legitimamente dividem `valor/saldo` — e a razão é a mesma nos dois:
 * eles respondem *"qual SERIA o custo médio num estado que o ledger ainda NÃO tem"* (a prévia
 * do reunitizar e a da mescla). ⛔ Eles **não podem** consultar a memória, porque ela reflete
 * o estado de HOJE, e a pergunta deles é sobre um estado hipotético.
 *
 * ⚠️ Exceção NOMEADA, com o motivo escrito — *exceção sem motivo é a porta por onde o décimo
 * leitor entra*.
 */
const PREVIAS_DE_ESTADO_HIPOTETICO = new Set([
  'lib/stock/reunitizar-item.ts', // prévia da conversão de unidade (o valor é INVARIANTE)
  'lib/stock/itens/mesclar.ts', // prévia da soma de dois itens (o ponderado cai de graça)
  /**
   * ⭐⭐ `custoParaBaixar` — e esta exceção é a mais importante das três, porque ela responde
   * uma pergunta **de verdade diferente**: *"com que custo eu movo DINHEIRO no ledger agora"*,
   * em **PRECISÃO CHEIA**. O custo médio da porta é arredondado em 2 casas (número de TELA), e
   * usá-lo pra mover dinheiro é a classe do `2,3125` do pão (27/08) — é o que faz o resíduo de
   * centavos NASCER.
   *
   * ⭐⭐ **E O DÉBITO QUE ESTE COMENTÁRIO REGISTRAVA FOI FECHADO EM 15/10:** ela devolvia ZERO
   * com saldo ≤ 0 (293 movimentos a custo zero no ledger, medidos) e **o dono decidiu** que
   * saída de item negativado sai pelo CUSTO VIGENTE. ⛔ O ramo negativo agora **DELEGA** a
   * `custoMedioComMemoria` — não é uma 2ª régua: é a MESMA lei, chamada de outro leitor. O que
   * continua morando aqui é só a precisão cheia do ramo positivo.
   */
  'lib/stock/residuo-de-centavos.ts',
])

function varrer(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(join(RAIZ, dir))) {
    if (n === 'node_modules' || n === '.next' || n.startsWith('.')) continue
    const rel = `${dir}/${n}`
    if (statSync(join(RAIZ, rel)).isDirectory()) varrer(rel, acc)
    else if (/\.(ts|tsx)$/.test(n) && !rel.includes('__tests__')) acc.push(rel)
  }
  return acc
}

/**
 * ⭐⭐ O DETECTOR — uma divisão cujo lado de cima fala de VALOR e o de baixo fala de SALDO.
 *
 * ⚠️⚠️ É **estrutural, por linha**, e não um regex de adjacência: na v4 da margem o regex de
 * custo-sobre-preço nasceu **cego na forma que o código real tem** — com um `?? 0` no meio da
 * divisão ele não casa. Aqui as formas reais são `valorAtual / saldoAtual`,
 * `s.valor / saldoDepois` e `(valorAntes + custoTotal) / saldoDepois`.
 */
function divisoesDeCustoMedio(src: string): string[] {
  const achadas: string[] = []
  for (const linha of src.split('\n')) {
    for (let i = linha.indexOf('/'); i >= 0; i = linha.indexOf('/', i + 1)) {
      const depois = linha.slice(i + 1)
      if (depois.startsWith('/') || depois.startsWith('>') || depois.startsWith('*')) break // comentário/JSX/bloco
      /**
       * ⚠️⚠️ **A JANELA É DOS OPERANDOS, não da linha** — e isto veio de um FALSO VERMELHO
       * meu, na 1ª rodada: o freio da contagem tem um one-liner com `R$ ${absValor}` no começo
       * e `Math.abs(divergencia) / saldoSistema` no fim, e olhando a linha INTEIRA ele casava
       * "valor…/…saldo" sem ter nada a ver com custo médio. Num operador aritmético os
       * operandos são adjacentes **por definição**, então a janela aqui é estrutura, não
       * distância chutada — e o caso que me enganou virou teste, logo abaixo.
       */
      const antes = linha.slice(Math.max(0, i - 60), i)
      if (/valor/i.test(antes) && /saldo/i.test(depois.slice(0, 30))) achadas.push(linha.trim())
    }
  }
  return achadas
}

describe('⛔ NINGUÉM DIVIDE valor/saldo FORA DA PORTA', () => {
  it('⭐ AUTO-TESTE do detector — ele pega as formas REAIS', () => {
    expect(divisoesDeCustoMedio('  return valorAtual / saldoAtual')).toHaveLength(1)
    expect(divisoesDeCustoMedio('custoMedio: saldoDepois !== 0 ? s.valor / saldoDepois : null')).toHaveLength(1)
    expect(divisoesDeCustoMedio('const c = round2((e.valorAntes + e.custoTotal) / saldoDepois)')).toHaveLength(1)
    // ⚠️ e NÃO morde o legítimo
    expect(divisoesDeCustoMedio('// valor / saldo é da porta')).toHaveLength(0)
    expect(divisoesDeCustoMedio('const x = total / quantidade')).toHaveLength(0)
    expect(divisoesDeCustoMedio('<Barra valor={v} saldo={s} />')).toHaveLength(0)
    /**
     * ⚠️ O FALSO VERMELHO DA 1ª RODADA, virado teste: o freio da contagem (um one-liner longo)
     * tem `R$ ${absValor}` no começo e `/ saldoSistema` no fim — a linha casava, os OPERANDOS
     * não. É % de divergência, não custo médio.
     */
    expect(
      divisoesDeCustoMedio(
        'return { grande: true, motivo: `a diferença vale R$ ${absValor.toFixed(2)} — acima de R$ ${FREIO_VALOR} pede conferência`, pct: saldoSistema > 0 ? Math.abs(divergencia) / saldoSistema : null }',
      ),
      'o detector tem que olhar os OPERANDOS, nunca a linha inteira',
    ).toHaveLength(0)
  })

  it('⛔ VERMELHO DO DONO: nenhum arquivo fora da porta divide valor por saldo', () => {
    const arquivos = [...varrer('lib/stock'), ...varrer('lib/margem')]
    const fora: string[] = []
    for (const f of arquivos) {
      if (f === PORTA || f === LEI || f === SALDO || PREVIAS_DE_ESTADO_HIPOTETICO.has(f)) continue
      const achadas = divisoesDeCustoMedio(limpa(f))
      if (achadas.length) fora.push(`${f}: ${achadas.join(' | ')}`)
    }
    expect(fora, `o custo médio tem um dono só — dividir aqui é a 2ª régua do mesmo número:\n${fora.join('\n')}`).toEqual([])
  })

  it('⚠️ as 2 exceções EXISTEM de verdade e são PRÉVIA de estado hipotético', () => {
    for (const f of PREVIAS_DE_ESTADO_HIPOTETICO) {
      const achadas = divisoesDeCustoMedio(limpa(f))
      expect(achadas.length, `${f} deixou de dividir — tire da lista de exceções`).toBeGreaterThan(0)
    }
  })
})

describe('⛔⛔ A PORTA DO SALDO CONSOME A LEI — nunca uma divisão própria', () => {
  it('⭐ `montar` chama `custoMedioComMemoria`', () => {
    const t = fonte(SALDO)
    expect(usosDe(t, 'custoMedioComMemoria'), 'a porta tem que DELEGAR a lei').toBeGreaterThan(0)
  })

  it('⛔ VERMELHO: a porta não pode voltar a decidir o custo por conta própria', () => {
    const t = limpa(SALDO)
    expect(
      divisoesDeCustoMedio(t),
      '⛔ `saldo > 0 ? valor/saldo : null` é A RÉGUA QUE APAGAVA O CUSTO quando o estoque zerava',
    ).toEqual([])
    expect(t, 'a lei não se reescreve aqui').not.toMatch(/saldo\s*>\s*0\s*\?/)
  })

  it('⭐ e a porta LÊ a memória (guard que só proíbe aprovaria a porta que ignora o campo)', () => {
    const t = fonte(SALDO)
    expect(usosDe(t, 'custoVigentePorItem'), 'a leitura da empresa inteira tem que buscar a memória').toBeGreaterThan(0)
    expect(usosDe(t, 'custoVigenteDoItem'), 'a leitura de UM item também').toBeGreaterThan(0)
  })
})

describe('⛔⛔ A MEMÓRIA SÓ APRENDE NO CHOKE-POINT DO LEDGER', () => {
  it('⭐ `criarMovimento` grava a memória (REGRA 5 — todo caminho herda de graça)', () => {
    const t = fonte('lib/stock/movement.ts')
    expect(usosDe(t, 'memoriaDaEntrada'), 'quem decide o número é a lei pura').toBeGreaterThan(0)
    expect(usosDe(t, 'lembrarCustoVigente'), 'e ela é GRAVADA no choke-point').toBeGreaterThan(0)
  })

  it('⛔ ninguém mais grava na tabela da memória (uma porta de escrita, não N)', () => {
    const arquivos = [...varrer('lib'), ...varrer('app')]
    const escritores = arquivos.filter(
      (f) => f !== PORTA && /stockItemCustoVigente\.(upsert|create|update|updateMany|createMany)/.test(limpa(f)),
    )
    expect(escritores, `memória gravada fora da porta em: ${escritores.join(', ')}`).toEqual([])
  })

  /**
   * ⚠️ **Guard reapontado (13/10):** o E17 **mudou de casa** — saiu de dentro do
   * `stock-invariants.ts` pra `custo-vigente-invariants.ts`, porque inline ele só dava pra
   * travar por grep e a REGRA 11 o pegou VERDE. A pergunta é a mesma (*o campo-fonte é
   * auditado?*); o que mudou é onde ela é respondida.
   *
   * ⛔ E o que MORDE de verdade está no `.integration`, executando o juiz contra um drift.
   * Isto aqui é só a trava de que o invariante continua **LIGADO na rodada do estoque** —
   * invariante correto e desligado é selo verde de graça (a lição do E10, 23/08).
   */
  it('⛔ o juiz E17 existe e está LIGADO na rodada do estoque', () => {
    const e17 = fonte('lib/stock/custo-vigente-invariants.ts')
    expect(usosDe(e17, 'memoriaDoLedger'), 'sem isto o campo vira a `CreditCardInvoice.status` de novo').toBeGreaterThan(0)
    expect(e17).toMatch(/'E17'/)
    /**
     * ⚠️⚠️ **A ASSERÇÃO É A CHAMADA, nunca o identificador** — e isto veio de VERDE na REGRA
     * 11, duas vezes no mesmo sprint: `usosDe()` conta `void checkCustoVigenteInvariants`
     * como "uso", então desligar o invariante passava batido. *"Menção, não uso"* na sua 16ª
     * aparição nesta casa, e as duas de hoje foram dentro do guard do meu próprio sprint.
     */
    const juiz = limpa('lib/stock/stock-invariants.ts')
    expect(
      juiz,
      'o invariante tem que ser EMPURRADO na rodada — existir e estar desligado é selo verde de graça',
    ).toMatch(/fails\.push\([^)]*checkCustoVigenteInvariants\s*\(/)
  })

  /**
   * ⛔⛔⛔ UMA RÉGUA DE PRATELEIRA, NÃO DUAS — e este guard nasceu de um defeito MEDIDO EM PROD
   * (13/10), com o backfill já pronto pra gravar.
   *
   * O replay filtrava só `TIPOS_FORA_DA_PRATELEIRA` e **esquecia o `idsDeEstornoInterno`**, que
   * a porta exclui desde 09/09. A `CUBA MAIONESE` real dava **R$ 0,04 pelo replay contra R$
   * 11,95 pela régua da prateleira** — e o replay é justamente quem o **juiz E17** usa de
   * referência e quem o **backfill** copia pro banco. Ou seja: a régua torta faria o juiz
   * acusar drift inexistente **e** o backfill gravar o número errado.
   *
   * ⚠️ Eu havia movido a função pra `prateleira.ts` exatamente pra os dois lados
   * compartilharem — e esqueci de CHAMÁ-LA aqui. **Extrair o dono não basta; o consumidor
   * tem que consumir.** Quem morde de verdade é o `.integration` (que executa as duas
   * leituras e exige o mesmo número); isto trava a FORMA, pra a query não ser reescrita sem a
   * régua de novo.
   */
  it('⛔⛔ o replay usa a régua da prateleira INTEIRA (tipo fora dela E estorno interno)', () => {
    const t = fonte(PORTA)
    expect(
      usosDe(t, 'idsDeEstornoInterno'),
      'sem isto o replay mede contra outra régua que a porta — foi o caso da CUBA (0,04 × 11,95)',
    ).toBeGreaterThan(0)
    expect(t, 'e o tipo fora da prateleira também').toMatch(/TIPOS_FORA_DA_PRATELEIRA/)
  })
})
