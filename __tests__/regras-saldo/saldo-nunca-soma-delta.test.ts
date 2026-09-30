/**
 * ⛔⛔⛔ O SALDO É DERIVADO, NUNCA ACUMULADO — o guard da classe (30/09/2026)
 *
 * **A ordem do dono:** *"troca `balance:{increment}` por `recalcularSaldoConta` no fim da
 * transação em TODAS as ~20 portas — drift vira IMPOSSÍVEL, não improvável. REGRA 11:
 * porta nova com increment cru = vermelho."*
 *
 * ⚠️ **POR QUE ESTE GUARD EXISTE E NÃO UM COMENTÁRIO:** o sprint *"o banco é a lei"*
 * (17/06/2026) já tinha matado o drift — **no import**. E deixou vivo em vinte outras
 * portas. Três meses e meio depois a Stone apareceu com o `balance` **R$ 2.112,00 acima da
 * régua**, e o import culpou o extrato do banco por um drift que era nosso: uma venda em
 * dinheiro lançada à mão com data 17/09, criada em 28/09, numa conta cuja âncora é 25/09.
 * O `increment` somou dinheiro que o saldo declarado já continha.
 *
 * ⭐ **A régua:** `increment` só coincide com a derivação quando a linha é POSTERIOR à
 * âncora. Lançamento retroativo é rotina (o dono lança a nota que já pagou, o Pluggy puxa
 * 90 dias, o ajuste de abertura é datado no passado) — então a coincidência é a exceção,
 * não a regra. Derivar é idempotente e não tem como driftar: não existe delta guardado.
 *
 * ⛔ Este é um guard ESTRUTURAL e é assumido como tal: quem prova o NÚMERO é
 * `lib/balance/__tests__/*` + a prova em prod. Este trava a FORMA — porque no dia em que
 * a forma voltar, o número erra em silêncio e ninguém acha a porta (foi exatamente o que
 * aconteceu: só a perícia de uma conta específica revelou a classe inteira).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()

/** ⚠️ sem comentário: o arquivo que DOCUMENTA o defeito não pode ser o que o absolve.
 *  (a lição do "menção, não uso" — e este arquivo tem o padrão proibido escrito em
 *  comentário dentro das próprias portas corrigidas, explicando o que saiu de lá). */
function semComentario(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

function varrer(dir: string, out: string[] = []): string[] {
  for (const nome of readdirSync(join(raiz, dir))) {
    const rel = `${dir}/${nome}`
    if (nome === 'node_modules' || nome === '.next' || nome === '__tests__') continue
    const st = statSync(join(raiz, rel))
    if (st.isDirectory()) varrer(rel, out)
    else if (nome.endsWith('.ts') || nome.endsWith('.tsx')) out.push(rel)
  }
  return out
}

const ARQUIVOS = [...varrer('app'), ...varrer('lib')]

/**
 * O detector: `balance` recebendo `increment`/`decrement` num update de conta.
 *
 * ⚠️ Ele NÃO procura a string `increment` solta — `creditCardInvoice.totalAmount` também
 * usa `increment` e está CERTO (o total da fatura não é saldo ancorado; quem o vigia é o
 * KP1). Alarme falso ali mataria este guard no dia 1.
 */
/**
 * ⚠️⚠️ ELE É MULTILINHA, e isso NÃO é preciosismo — foi o auto-teste deste arquivo que me
 * pegou. A primeira versão lia linha a linha, e a porta que CAUSOU o incidente
 * (`POST /api/transacoes`) estava escrita assim:
 *
 *     data: {
 *       balance: {
 *         increment: data.type === 'CREDIT' ? data.amount : -data.amount,
 *       },
 *     },
 *
 * O detector passava VERDE por cima dela. *Guard que não pega o caso que o motivou dá
 * selo verde de graça* — e este quase nasceu cego justamente na porta do caso.
 */
const PADRAO_PROIBIDO = /balance:\s*\{\s*(increment|decrement)/m

/**
 * ⛔ EXCEÇÕES NOMEADAS — a lista está VAZIA de propósito, e isso é a afirmação.
 *
 * Se alguém precisar de uma, ela entra aqui **com o motivo escrito**, do mesmo jeito que a
 * `ESCRITA_DE_PREFERENCIA` do guard de rotas. Lista vazia significa: nenhuma porta da casa
 * soma delta no saldo, e não há "só esta aqui" pendurado sem explicação.
 */
const EXCECOES: Array<{ arquivo: string; motivo: string }> = []

describe('⛔⛔⛔ nenhuma porta soma delta no saldo — o saldo se DERIVA', () => {
  it('⛔⛔ zero `balance: { increment/decrement }` em app/ e lib/', () => {
    const achados: string[] = []
    for (const arq of ARQUIVOS) {
      if (EXCECOES.some((e) => e.arquivo === arq)) continue
      const texto = semComentario(readFileSync(join(raiz, arq), 'utf-8'))
      // varre o TEXTO (a forma multilinha é a que mais aparece), e ainda devolve a LINHA
      // — alerta que não diz onde é alerta que ninguém age em cima.
      for (const m of texto.matchAll(/balance:\s*\{\s*(increment|decrement)/g)) {
        const linha = texto.slice(0, m.index).split('\n').length
        achados.push(`${arq}:${linha} → ${m[0].replace(/\s+/g, ' ')}`)
      }
    }
    expect(
      achados,
      'porta somando delta no saldo. Use `reAncorarContas` (PJ) / `reAncorarContasPF` (PF) ' +
        'no FIM da transação — o saldo é derivado do ledger, nunca acumulado. ' +
        'Ver lib/balance/recalcular.ts e o caso da Stone (30/09/2026).\n' +
        achados.join('\n'),
    ).toEqual([])
  })

  it('⛔ e toda exceção da lista existe de verdade e diz o motivo', () => {
    // ⚠️ exceção pra arquivo que não existe mais é a lista envelhecendo em silêncio —
    // e lista frouxa é como um guard deixa de morder sem ninguém notar.
    for (const e of EXCECOES) {
      expect(ARQUIVOS, `exceção aponta pra arquivo que não existe: ${e.arquivo}`).toContain(e.arquivo)
      expect(e.motivo.length, `exceção sem motivo escrito: ${e.arquivo}`).toBeGreaterThan(30)
    }
  })
})

describe('⛔ o detector PEGA a forma antiga (auto-teste — senão passa por cegueira)', () => {
  it('⚠️ as formas EXATAS que as portas tinham antes do item 4 são detectadas', () => {
    // as três formas reais que existiam no código em 29/09/2026
    const formas = [
      // uma linha
      `        data: { balance: { increment: reverso } },`,
      `        data: { balance: { decrement: ajusteSaldo } },`,
      // ⭐⭐ MULTILINHA — a forma EXATA do `POST /api/transacoes`, a porta do caso da Stone.
      // É esta que a 1ª versão deste detector deixava passar.
      `        data: {\n          balance: {\n            increment: data.type === 'CREDIT' ? data.amount : -data.amount,\n          },\n        },`,
      // e a do transfers/create, com select na sequência
      `      data: { balance: { increment: ops.fromBalanceDelta } },\n      select: { id: true },`,
    ]
    for (const f of formas) {
      expect(PADRAO_PROIBIDO.test(f), `não pegou:\n${f}`).toBe(true)
    }
  })

  it('⭐ e NÃO acusa o que está certo (senão vira alarme falso no dia 1)', () => {
    const certos = [
      // o total da fatura de cartão usa increment e É correto (vigiado pelo KP1)
      `data: { totalAmount: { increment: addedAmount } },`,
      // a derivação
      `await reAncorarContas(tx, [antiga.bankAccountId, mudanca?.para.id])`,
      // gravar o saldo derivado NÃO é somar delta
      `data: { balance: saldoDepois },`,
    ]
    for (const c of certos) expect(PADRAO_PROIBIDO.test(c), `falso positivo em: ${c}`).toBe(false)
  })
})

describe('⭐ a derivação tem um dono só, e ela é a porta que as demais chamam', () => {
  const recalcular = readFileSync(join(raiz, 'lib/balance/recalcular.ts'), 'utf-8')

  it('⭐ `reAncorarContas` e `reAncorarContasPF` existem e são exportadas', () => {
    expect(recalcular).toMatch(/export async function reAncorarContas\b/)
    expect(recalcular).toMatch(/export async function reAncorarContasPF\b/)
  })

  it('⛔⛔ o PF NÃO tem uma segunda fórmula — ele usa o MESMO núcleo puro', () => {
    /**
     * ⚠️ É o ponto que separa "curei a classe" de "escrevi a mesma coisa duas vezes": se o
     * PF tivesse cálculo próprio, as duas metades da casa divergiriam na primeira regra
     * nova (foi assim que nasceram os 7 detectores de par). O que muda entre PJ e PF é a
     * TABELA de onde as linhas vêm, nunca a conta.
     */
    const corpoPF = recalcular.slice(recalcular.indexOf('export async function recalcularSaldoContaPF'))
    expect(corpoPF).toContain('calcularSaldo(')
    expect(corpoPF, 'o PF recalculou o saldo na mão em vez de usar o núcleo').not.toMatch(
      /reduce\([^)]*signedAmount|CREDIT'\s*\?\s*\w+\.amount\s*:\s*-/,
    )
  })

  it('⭐ e a derivação é IDEMPOTENTE por construção: ela GRAVA o valor, não soma nele', () => {
    // `balance: saldoDepois` (atribuição) × `balance: { increment }` (acumulação).
    // É esta linha que faz "chamar duas vezes dá o mesmo número".
    expect(recalcular).toMatch(/data:\s*\{\s*balance:\s*saldoDepois\s*\}/)
    expect(recalcular).toMatch(/data:\s*\{\s*balance:\s*calc\.saldo\s*\}/)
  })
})
