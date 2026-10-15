/**
 * ⭐⭐⭐ SAÍDA COM ESTOQUE NEGATIVO SAI PELO CUSTO VIGENTE (15/10/2026).
 *
 * **O FURO, achado na conferência de 14/10:** `custoParaBaixar(valor, saldo)` devolvia **0**
 * quando `saldo ≤ 0` → venda de item negativado entrava com quantidade e **R$ 0,00 de custo**.
 * Medido em prod: **293 movimentos a custo zero** (2.589,817 un · BAIXA_VENDA 249 +
 * SEPARACAO_SAIDA 44), crescendo ~16/dia. **Efeito: CMV menor que a verdade, lucro parecendo
 * maior que é** — e ninguém desconfia, porque o número sai plausível.
 *
 * ⭐⭐ **A LEI DO saldo ≤ 0 TEM UM DONO SÓ, E ELE JÁ EXISTIA:** `custoMedioComMemoria` (13/10).
 * `custoParaBaixar` **delega** o ramo negativo a ela em vez de reimplementar *"quanto vale a
 * memória"* — se reimplementasse, seriam **duas réguas pra mesma pergunta**, e elas divergiriam
 * no primeiro caso de borda (memória ≤ 0, memória ausente). É a doença que esta casa mais paga.
 *
 * ⚠️⚠️ **E A SEPARAÇÃO JÁ OBEDECE A MESMA LEI — medido, não suposto.** `confirmarSeparacao` lê
 * `custoMedioPorItem`, que desce pra `saldosDaEmpresa → montar → custoMedioComMemoria`. Ou seja:
 * **os dois tipos passam pela mesma lei**, por dois leitores com precisões diferentes de
 * propósito (ver a nota em `residuo-de-centavos.ts` sobre por que a separação NÃO foi movida
 * pra cá). Os 44 `SEPARACAO_SAIDA` a custo zero são **anteriores a 13/10** ou de item sem
 * memória nenhuma.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '@/lib/db'
import { custoParaBaixar } from '@/lib/stock/residuo-de-centavos'
import { criarMovimento } from '@/lib/stock/movement'
import { lembrarCustoVigente, custoVigentePorItem } from '@/lib/stock/custo-vigente'
import { saldosDaEmpresa, custoMedioPorItem } from '@/lib/stock/saldo'
import { checkCustoVigenteInvariants } from '@/lib/stock/custo-vigente-invariants'

const CNPJ = '84848484000184'
let companyId = ''
/** o item com memória — os números REAIS do fermento em prod (vigente 38,09 · saldo −4,26) */
let fermento = ''
/** o item SEM memória nenhuma — um dos 15 "a definir" legítimos */
let semMemoria = ''
/** o item com estoque EM PÉ — a regressão: saldo > 0 não muda um centavo */
let emPe = ''

beforeAll(async () => {
  await prisma.company.deleteMany({ where: { cnpj: CNPJ } })
  const c = await prisma.company.create({ data: { name: 'saída no negativo ltda', cnpj: CNPJ } })
  companyId = c.id

  const novo = async (nome: string, un = 'KG') =>
    (
      await prisma.stockItem.create({
        data: { companyId, nome, unidadeControle: un, categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
      })
    ).id

  fermento = await novo('fermento')
  semMemoria = await novo('porcao file para xis 150grama', 'UN')
  emPe = await novo('OVO BRANCO CARTELA', 'UN')

  /**
   * ⭐ A CENA DO FERMENTO, pelo caminho REAL: a compra ENSINA o custo (e o choke-point do
   * ledger grava a memória sozinho), depois o consumo leva o saldo pra baixo de zero.
   * ⚠️ Montar o estado com UPDATE direto esconderia justamente o que está sob teste — que a
   * memória sobrevive ao saldo zerar.
   */
  await criarMovimento(prisma, {
    companyId, itemId: fermento, tipo: 'ENTRADA_NF',
    quantidade: 10, custoUnitario: 38.09, origem: 'SEFAZ',
  })
  await criarMovimento(prisma, {
    companyId, itemId: fermento, tipo: 'SEPARACAO_SAIDA',
    quantidade: -14.26, custoUnitario: 38.09, origem: 'MANUAL',
  })

  /** o item sem memória nunca teve entrada COM VALOR — só saída (vendeu sem produzir) */
  await criarMovimento(prisma, {
    companyId, itemId: semMemoria, tipo: 'BAIXA_VENDA',
    quantidade: -35, custoUnitario: 0, origem: 'MANUAL',
  })

  /** e o item em pé: 1019 un por R$ 555,64 — o OVO do caso de 19/09 */
  await criarMovimento(prisma, {
    companyId, itemId: emPe, tipo: 'ENTRADA_NF',
    quantidade: 1019, custoUnitario: 555.64 / 1019, custoTotal: 555.64, origem: 'SEFAZ',
  })
})

afterAll(async () => {
  await prisma.stockItemCustoVigente.deleteMany({ where: { companyId } })
  await prisma.stockMovement.deleteMany({ where: { companyId } })
  await prisma.stockItem.deleteMany({ where: { companyId } })
  await prisma.company.deleteMany({ where: { id: companyId } })
})

// ───────────────────── A LEI, pura ─────────────────────

describe('⛔⛔ a porta única: saldo ≤ 0 sai pelo VIGENTE', () => {
  /**
   * ⛔⛔ O CASO QUE MOTIVOU O SPRINT, com os números medidos em prod. Zero aqui é o furo:
   * a venda entra com quantidade e sem dinheiro, e o CMV fica menor que a verdade.
   */
  it('⛔⛔ fermento (saldo −4,26 · vigente 38,09) → custo 38,09, NUNCA zero', () => {
    expect(custoParaBaixar(-38.69, -4.26, 38.09)).toBe(38.09)
  })

  /**
   * ⛔ ITEM SEM MEMÓRIA CONTINUA 0 — honesto como hoje. Número inventado NUNCA: num item que
   * nunca teve entrada com valor, um custo chutado entra no CMV **saindo plausível**, que é o
   * pior tipo de erro (a lição da FANTA UVA).
   */
  it('⛔ sem vigente → 0 (não inventa)', () => {
    expect(custoParaBaixar(0, -35, null)).toBe(0)
  })

  /**
   * ⚠️ MEMÓRIA ≤ 0 É TRATADA COMO AUSÊNCIA, e isto não é régua nova: é a lei de 13/10, que
   * `custoParaBaixar` DELEGA. Custo zero ou negativo não é *"o que a coisa custa"* — é
   * resquício de um estado impossível, e propagá-lo seria propagar a ficção.
   */
  it('⚠️ vigente ≤ 0 vale como ausência → 0', () => {
    expect(custoParaBaixar(-10, -2, 0)).toBe(0)
    expect(custoParaBaixar(-10, -2, -5)).toBe(0)
  })

  /**
   * ⭐⭐ REGRESSÃO: com saldo EM PÉ nada muda, e em **precisão cheia** — é isto que impede o
   * resíduo de nascer (a cicatriz do pão, 2,3125, e da conclusão de produção).
   */
  it('⭐ saldo > 0 → valor ÷ saldo em precisão cheia, idêntico a hoje', () => {
    expect(custoParaBaixar(555.64, 1019, 99)).toBe(555.64 / 1019)
    expect(custoParaBaixar(555.64, 1019, null)).toBe(555.64 / 1019)
  })

  /** ⚠️ e o vigente NÃO atropela o estoque em pé: com saldo > 0 ele é ignorado */
  it('⚠️ com saldo em pé o vigente é ignorado (o valor real manda)', () => {
    expect(custoParaBaixar(100, 10, 999)).toBe(10)
  })
})

// ───────────────────── O LEDGER, contra banco ─────────────────────

describe('⛔⛔ a BAIXA grava o custo no ledger', () => {
  it('⭐ a compra ENSINOU a memória (o choke-point grava sozinho)', async () => {
    const vig = await custoVigentePorItem(prisma, companyId)
    expect(vig.get(fermento), 'o fermento tem memória').toBe(38.09)
    expect(vig.get(semMemoria), 'o sem-entrada não tem').toBeUndefined()
  })

  it('⭐ e o saldo ficou NEGATIVO, com a memória de pé', async () => {
    const s = (await saldosDaEmpresa(prisma, companyId)).find((x) => x.itemId === fermento)
    expect(s!.saldo).toBeLessThan(0)
    expect(s!.custoMedio, 'a tela mostra a memória, não "a definir"').toBe(38.09)
  })

  /**
   * ⛔⛔ O TESTE QUE MORDE: a baixa de item negativado grava `qtd × vigente`. Com o furo,
   * `custoTotal` era 0 e o CMV daquele dia não registrava a mercadoria que saiu.
   */
  it('⛔⛔ BAIXA_VENDA de item negativado grava qtd × vigente', async () => {
    const saldos = await saldosDaEmpresa(prisma, companyId)
    const at = saldos.find((x) => x.itemId === fermento)!
    const vig = await custoVigentePorItem(prisma, companyId)
    const custo = custoParaBaixar(at.valor, at.saldo, vig.get(fermento) ?? null)

    const m = await criarMovimento(prisma, {
      companyId, itemId: fermento, tipo: 'BAIXA_VENDA',
      quantidade: -2, custoUnitario: custo, origem: 'MANUAL',
    })
    const gravado = await prisma.stockMovement.findUnique({ where: { id: m.id } })
    expect(gravado!.custoUnitario).toBe(38.09)
    expect(gravado!.custoTotal, '2 × 38,09 saindo do estoque').toBe(-76.18)
  })

  /** ⭐ item sem memória segue entrando a ZERO — e a saída é a compra, não um palpite */
  it('⭐ item sem memória continua a custo 0', async () => {
    const saldos = await saldosDaEmpresa(prisma, companyId)
    const at = saldos.find((x) => x.itemId === semMemoria)!
    const vig = await custoVigentePorItem(prisma, companyId)
    expect(custoParaBaixar(at.valor, at.saldo, vig.get(semMemoria) ?? null)).toBe(0)
  })
})

// ───────────────────── O LIVRO E O JUIZ ─────────────────────

describe('⛔⛔ o LIVRO aceita valor negativo COERENTE, e segue barrando o incoerente', () => {
  /**
   * ⭐⭐ `valor ≈ saldo × vigente` com os dois negativos é **contabilidade correta de estoque
   * negativo**, e o guard de 11/09 já a aceita por construção: ele só morde quando
   * `saldoDepois >= 0 && valorDepois < -0.01` — *dinheiro negativo com saldo POSITIVO*.
   * ⚠️ Nada a afrouxar; se houvesse, a regra a ajustar seria o invariante, não a lei.
   */
  it('⭐⭐ saldo negativo COM valor negativo passa (estado coerente)', async () => {
    const s = (await saldosDaEmpresa(prisma, companyId)).find((x) => x.itemId === fermento)!
    expect(s.saldo, 'saldo negativo').toBeLessThan(0)
    expect(s.valor, 'valor negativo junto').toBeLessThan(0)
    const esperado = s.saldo * 38.09
    expect(
      Math.abs(s.valor - esperado),
      `coerente: valor ${s.valor} ≈ saldo ${s.saldo} × 38,09 = ${esperado.toFixed(2)}`,
    ).toBeLessThan(0.02)
  })

  /**
   * ⛔⛔ E O INCOERENTE CONTINUA ALARMANDO — é a metade que segura a regra. Sem este caso,
   * afrouxar o guard passaria verde e o estado impossível (o fermento de 16/09: prateleira
   * cheia com dinheiro negativo) voltaria a entrar calado.
   */
  it('⛔⛔ saldo POSITIVO com valor negativo continua RECUSADO', async () => {
    const i = await prisma.stockItem.create({
      data: { companyId, nome: 'item do estado impossível', unidadeControle: 'UN', categoria: 'MATERIA_PRIMA', criadoVia: 'MANUAL' },
    })
    /** entra 10 un a custo 0 (o estado real do "saldo em pé, valor zerado") … */
    await criarMovimento(prisma, { companyId, itemId: i.id, tipo: 'ENTRADA_NF', quantidade: 10, custoUnitario: 0, origem: 'SEFAZ' })
    /** … e a baixa tenta tirar DINHEIRO deixando quantidade na prateleira */
    await expect(
      criarMovimento(prisma, {
        companyId, itemId: i.id, tipo: 'BAIXA_VENDA',
        quantidade: -2, custoUnitario: 50, origem: 'MANUAL',
      }),
      'dinheiro negativo com saldo positivo não existe',
    ).rejects.toThrow(/não existe|impossível/i)
    await prisma.stockMovement.deleteMany({ where: { itemId: i.id } })
    await prisma.stockItem.delete({ where: { id: i.id } })
  })

  /** ⭐ e o E17 não acusa drift: saída não ensina custo, então a memória não se move */
  it('⭐ E17 continua limpo — a baixa não mexe na memória', async () => {
    const fails = await checkCustoVigenteInvariants(prisma, [companyId])
    expect(fails.map((f) => f.detalhe)).toEqual([])
  })
})

// ───────────────────── A SEGUNDA PORTA, provada ─────────────────────

describe('⭐ os DOIS tipos obedecem a MESMA lei', () => {
  /**
   * ⭐⭐ A SEPARAÇÃO NÃO FOI MOVIDA PRA CÁ, e isto é MEDIÇÃO, não esquecimento:
   * `confirmarSeparacao` lê `custoMedioPorItem`, que desce pra `custoMedioComMemoria` — a
   * MESMA lei. O que ela NÃO tem é a precisão cheia, **de propósito**: o quarteto da produção
   * (separação · consumo · devolução · geração) usa todo ele o MESMO custo arredondado, e é
   * isso que faz o valor do armazém virtual **zerar** quando a ordem fecha. Trocar só a
   * separação pra precisão cheia deixaria centavos presos no em-produção — um desencontro novo.
   */
  it('⭐ o custo que a SEPARAÇÃO usa já vem da memória', async () => {
    const m = await custoMedioPorItem(prisma, companyId)
    expect(m.get(fermento), 'item negativado: a memória, não zero').toBe(38.09)
    expect(m.get(semMemoria), 'sem memória: "a definir"').toBeNull()
  })

  /** ⭐ e as duas portas concordam no número pro item negativado */
  it('⭐ as duas portas dão o MESMO custo no item negativado', async () => {
    const saldos = await saldosDaEmpresa(prisma, companyId)
    const at = saldos.find((x) => x.itemId === fermento)!
    const vig = await custoVigentePorItem(prisma, companyId)
    const porta = custoParaBaixar(at.valor, at.saldo, vig.get(fermento) ?? null)
    const daSeparacao = (await custoMedioPorItem(prisma, companyId)).get(fermento)
    expect(porta).toBe(daSeparacao)
  })
})

// ───────────────────── O GUARD ESTRUTURAL ─────────────────────

describe('⛔ ninguém calcula custo de saída por conta própria', () => {
  /**
   * ⛔⛔ O `valor / saldo` SOLTO É A FORMA DO DEFEITO. Ele é *"o custo médio"* escrito à mão, e
   * quem o escreve **não consulta a memória** — foi assim que a baixa passou a zerar o custo do
   * item negativado. Os dois donos são `custoMedioComMemoria` (a lei) e `custoParaBaixar` (o
   * leitor de precisão cheia, que delega a ela).
   *
   * ⚠️ Exceção NOMEADA: o replay do ledger (`memoriaPelaHistoria`) **precisa** dividir pra
   * reconstruir a memória — é ele que o juiz E17 usa de referência.
   */
  it('⛔ zero `valor / saldo` fora dos donos declarados', async () => {
    const { readdirSync, statSync } = await import('node:fs')
    const raiz = process.cwd()
    const PERMITIDOS = new Set([
      'lib/stock/lei-do-custo-medio.ts', // ⭐ a LEI, módulo PURO (extraída em 15/10 por ciclo)
      'lib/stock/custo-vigente.ts', // a porta que re-exporta a lei + o replay do ledger
      'lib/stock/residuo-de-centavos.ts', // o leitor de precisão cheia, que delega à lei

      // ⚠️ AS DUAS EXCEÇÕES ABAIXO SÃO NOMEADAS, COM O MOTIVO ESCRITO — e a 2ª é DÉBITO
      // REGISTRADO, não absolvição.

      /**
       * `mesclar.ts` — o PREVIEW de mesclar dois itens. A pergunta dele é outra: *"qual
       * custo médio o item FUNDIDO vai ter?"*, e a régua ali é `saldo !== 0` (os dois
       * somam). Não é custo de SAÍDA; nada do ledger se move por este número.
       * ⚠️ DIVERGÊNCIA REGISTRADA: com saldo somado negativo ele mostra `valor/saldo` (dois
       * negativos → positivo plausível) em vez da memória. Mesclar item negativado é raro e
       * ficou FORA do escopo deste sprint — decisão do dono.
       */
      'lib/stock/itens/mesclar.ts',

      /**
       * ⚠️⚠️ `cascata-de-custo.ts` — ESTE **É** CUSTO DE SAÍDA, e tem o MESMO `: 0` que este
       * sprint acabou de fechar na baixa. É a ferramenta de CIRURGIA (19/09) que estorna e
       * relança uma sequência de movimentos reconstruindo o custo médio a cada passo.
       * ⛔ Ficou de fora de propósito: ela RECONSTITUI a história, e fazê-la usar a memória
       * de HOJE mudaria o preview de uma cirurgia retroativa — contrato diferente, caminho
       * não-diário, e mexer nele no meio deste sprint seria alterar o que o dono vê antes de
       * aprovar uma cirurgia. **Débito reportado, não corrigido.**
       */
      'lib/stock/producao/cascata-de-custo.ts',
    ])
    const culpados: string[] = []
    const anda = (dir: string) => {
      for (const e of readdirSync(join(raiz, dir))) {
        const p = `${dir}/${e}`
        if (statSync(join(raiz, p)).isDirectory()) {
          if (e === '__tests__' || e === 'node_modules') continue
          anda(p)
        } else if (/\.ts$/.test(e) && !PERMITIDOS.has(p)) {
          const src = readFileSync(join(raiz, p), 'utf8')
            .split('\n')
            .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
            .join('\n')
          if (/\b(valor|valorAtual|valorAntes)\s*\/\s*(saldo|saldoAtual|saldoAntes|qtd)\b/.test(src)) {
            culpados.push(p)
          }
        }
      }
    }
    anda('lib/stock')
    expect(culpados, 'custo de saída se calcula na porta única').toEqual([])
  })

  /**
   * ⛔⛔ E O VIGENTE É PARÂMETRO **OBRIGATÓRIO**, não opcional com default. Um default `null`
   * faria o chamador que esquecesse de passá-lo receber **0 em silêncio** — exatamente o furo
   * que este sprint fecha, voltando invisível. Com o parâmetro obrigatório, o `tsc` acha todos
   * os chamadores (REGRA 4 de graça) e esquecer **não compila**.
   */
  it('⛔⛔ o vigente é parâmetro obrigatório (esquecer não compila)', () => {
    const src = readFileSync(join(process.cwd(), 'lib/stock/residuo-de-centavos.ts'), 'utf8')
    const assinatura = src.slice(src.indexOf('export function custoParaBaixar'))
    const linha = assinatura.slice(0, assinatura.indexOf(')') + 1)
    expect(linha, 'o vigente está na assinatura').toMatch(/vigente\s*:\s*number\s*\|\s*null/)
    expect(linha, 'e NÃO tem default').not.toMatch(/vigente[^,)]*=/)
  })

  /**
   * ⛔⛔⛔ O CICLO DE IMPORT VIROU IMPOSSÍVEL, NÃO COMBINADO (REGRA 5).
   *
   * Ao fazer `custoParaBaixar` delegar à lei, o import direto de `custo-vigente` fechou o laço
   * `residuo-de-centavos → custo-vigente → contagem-ancora → entrada-cruza-o-zero → de volta`
   * e derrubou **177 testes** — com um `TIPOS_COM_CUSTO_CONHECIDO` chegando **undefined no meio
   * da gravação de um movimento**, não com erro de módulo.
   *
   * ⭐ A lei mora num arquivo que **não importa NINGUÉM**: sem dependência, não há ciclo
   * possível por baixo. Este teste é o que impede alguém de acrescentar um import ali e
   * reabrir o buraco — e o estrago da próxima vez também não se pareceria com um erro de
   * import.
   */
  it('⛔⛔ a LEI não importa NINGUÉM — é o que mata o ciclo por construção', () => {
    const lei = readFileSync(join(process.cwd(), 'lib/stock/lei-do-custo-medio.ts'), 'utf8')
    const imports = lei.split('\n').filter((l) => /^\s*import\b/.test(l))
    expect(imports, `a lei ganhou import e o ciclo reabriu:\n${imports.join('\n')}`).toEqual([])
    expect(lei, 'a lei mudou de casa').toMatch(/export function custoMedioComMemoria\(/)
  })

  /** ⭐ e a PORTA de sempre continua servindo a lei — ninguém mudou de endereço */
  it('⭐ `custo-vigente` RE-EXPORTA a lei (um dono, um endereço)', () => {
    const porta = readFileSync(join(process.cwd(), 'lib/stock/custo-vigente.ts'), 'utf8')
    expect(porta).toMatch(/export \{ custoMedioComMemoria \} from '\.\/lei-do-custo-medio'/)
  })

  /** ⭐ e o ramo negativo DELEGA à lei, em vez de reimplementar "quanto vale a memória" */
  it('⭐ o ramo de saldo ≤ 0 delega a `custoMedioComMemoria`', () => {
    const src = readFileSync(join(process.cwd(), 'lib/stock/residuo-de-centavos.ts'), 'utf8')
    const corpo = src.slice(src.indexOf('export function custoParaBaixar'))
    expect(corpo, 'uma lei, um dono').toMatch(/custoMedioComMemoria\s*\(/)
  })
})
