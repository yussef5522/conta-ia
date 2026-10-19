/**
 * ⛔⛔⛔ UM DONO PRO CUSTO DA BAIXA — "quanto vale esta baixa" se responde num lugar só (19/10/2026).
 *
 * **A ordem do dono, depois de a baixa de 17/10 ser barrada pelo guarda da sanidade:**
 * *"nenhum caminho de baixa pode calcular o custo por si — o dono é único."*
 *
 * ⭐ ESTE GUARD É ESTRUTURAL E ASSUMIDO COMO TAL: o que morde de verdade — *a conta está
 * certa?* — vive em `lib/stock/vendas/__tests__/custo-da-baixa.test.ts` (com os números de
 * prod e o contrafactual dos −R$ 0,12) e no teste de integração que roda a baixa contra
 * banco. O que falta provar AQUI é que **ninguém abriu um TERCEIRO caminho** — e foi
 * exatamente a terceira cópia que custou o dia 17/10:
 *
 * ```
 * baixa de PRODUTOS      → precisão cheia (19/09) + memória do saldo ≤ 0 (15/10)   ⭐
 * baixa de COMPLEMENTOS  → custoMedioPorItem × qtd, SEM as duas curas             ⛔
 * ```
 *
 * ⚠️⚠️ **E A LISTA DE PERMITIDOS É ESTREITA DE PROPÓSITO: `custoMedioPorItem` NÃO é proibido
 * no sistema** — ele é o custo de LEITURA (a Posição, o cardápio, a margem) e é de propósito
 * que o **quarteto da produção** (separação · consumo · devolução · geração) use ele: os
 * quatro usam o MESMO número arredondado, e é isso que faz o valor do armazém virtual ZERAR
 * quando a ordem fecha (decisão registrada em 15/10). Mover só a separação pra precisão
 * cheia deixaria centavos presos no em-produção.
 *
 * ⛔ O que tem dono único é **o custo de uma BAIXA DE VENDA**.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { custoDaBaixa, type EstadoDaBaixa } from '@/lib/stock/vendas/custo-da-baixa'

const raiz = process.cwd()
const DIR = 'lib/stock/vendas'

/** ⚠️ sem comentário: o arquivo que DOCUMENTA o defeito não pode ser o que o absolve */
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

/** ⭐ A PORTA. É aqui que "quanto vale esta baixa" é respondido. */
const A_PORTA = 'custo-da-baixa.ts'

/** os dois caminhos que GRAVAM baixa de venda no ledger */
const CAMINHOS_DE_BAIXA = ['baixa-venda.ts', 'baixa-complemento.ts']

/**
 * A FORMA DO DEFEITO: um custo de LEITURA multiplicado por quantidade.
 *
 * ⚠️ Casa nos DOIS sentidos (`custo * qtd` e `qtd * custo`) porque a ordem dos fatores não
 * muda o defeito, e tolera sufixo de chamada/acesso no meio (`custoDeLeitura(itemId)! * qtd`)
 * — foi o auto-teste abaixo que cobrou essa segunda forma.
 *
 * ⛔⛔ **E O QUE ELE *NÃO* ALCANÇA, DITO EM VEZ DE DISFARÇADO:** a cópia real de 17/10 estava
 * em DUAS linhas (`const custo = custoMap.get(…) ?? 0` e, abaixo, `round2(-a.qtd * custo)`),
 * e `custo` solto é nome genérico demais pra proibir sem alarme falso. ***Quem mata a classe
 * é o teste do IMPORT*** — sem `custoMedioPorItem` no arquivo, não existe custo de leitura
 * pra multiplicar. Este regex é cinto sobre suspensório.
 */
const MULTIPLICA_CUSTO_DE_LEITURA =
  /\b(custoMedio|custoMap|custoDeLeitura)[A-Za-z]*\b[^,;:\n=]*?\*|\*\s*[A-Za-z_.[\]()?!]*\b(custoMedio|custoMap|custoDeLeitura)[A-Za-z]*\b/

function arquivosDeVenda(): string[] {
  return readdirSync(join(raiz, DIR))
    .filter((n) => n.endsWith('.ts'))
    .filter((n) => !n.endsWith('.d.ts'))
}

const ler = (nome: string) => semComentario(readFileSync(join(raiz, DIR, nome), 'utf8'))

/** ⭐ conta o USO, nunca a MENÇÃO — import e comentário não valem (a lição das 19 vezes) */
function usos(src: string, nome: string): number {
  const semImport = src.replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  return (semImport.match(new RegExp(`\\b${nome}\\s*\\(`, 'g')) ?? []).length
}

describe('o custo de uma baixa de venda tem UM dono', () => {
  it('⛔ nenhum arquivo de vendas decide o custo por si (só a porta chama a lei)', () => {
    const culpados: string[] = []
    for (const nome of arquivosDeVenda()) {
      if (nome === A_PORTA) continue
      const src = ler(nome)
      if (usos(src, 'custoParaBaixar') > 0) culpados.push(`${nome} → chama custoParaBaixar`)
      if (usos(src, 'avaliarResiduo') > 0) culpados.push(`${nome} → chama avaliarResiduo`)
    }
    expect(culpados, `régua de custo de baixa fora de ${A_PORTA}:\n${culpados.join('\n')}`).toEqual([])
  })

  it('⛔⛔ nenhum arquivo de vendas multiplica custo de LEITURA por quantidade (o defeito de 17/10)', () => {
    const culpados: string[] = []
    for (const nome of arquivosDeVenda()) {
      const src = ler(nome)
      src.split('\n').forEach((linha, i) => {
        if (MULTIPLICA_CUSTO_DE_LEITURA.test(linha)) culpados.push(`${DIR}/${nome}:${i + 1}  ${linha.trim()}`)
      })
    }
    expect(
      culpados,
      'custo ARREDONDADO (número de TELA) multiplicado por quantidade — era isso que punha '
      + 'R$ 39,69 num item que valia R$ 39,57:\n' + culpados.join('\n'),
    ).toEqual([])
  })

  it('⛔ nenhum caminho de baixa importa o custo de leitura (a porta é a única fonte)', () => {
    const culpados = CAMINHOS_DE_BAIXA.filter((n) => /custoMedioPorItem/.test(ler(n)))
    expect(culpados, `importam custoMedioPorItem: ${culpados.join(', ')}`).toEqual([])
  })

  /**
   * ⭐⭐ O OUTRO LADO — guard que só PROÍBE aprovaria o dia em que ninguém calcula custo
   * nenhum e a baixa grava R$ 0,00. Os dois caminhos têm que CONSUMIR a porta, na gravação
   * E no preview (foi a divergência preview×gravação que custou o import de OFX, 17/08).
   */
  it('⭐ os DOIS caminhos de baixa consomem a porta — na gravação e no preview', () => {
    for (const nome of CAMINHOS_DE_BAIXA) {
      const src = ler(nome)
      expect(usos(src, 'custoDaBaixa'), `${nome} não chama custoDaBaixa na gravação`).toBeGreaterThan(0)
      expect(usos(src, 'estadoParaBaixa'), `${nome} não lê o estado pela porta`).toBeGreaterThan(0)
      expect(usos(src, 'valorPrevistoDaBaixa'), `${nome} não usa a porta no PREVIEW`).toBeGreaterThan(0)
    }
  })

  /**
   * ⚠️ `encerrar-item.ts` usa `avaliarResiduo` e NÃO é violação — ele responde outra
   * pergunta (*"dá pra encerrar o item com centavos sobrando?"*, 19/09). Fica FORA do
   * diretório de vendas de propósito, e este teste documenta que isso é escolha, não descuido.
   */
  it('⚠️ o encerrar-item segue com a régua dele, fora do diretório de vendas', () => {
    const src = readFileSync(join(raiz, 'lib/stock/itens/encerrar-item.ts'), 'utf8')
    expect(src).toMatch(/avaliarResiduo/)
    expect(arquivosDeVenda()).not.toContain('encerrar-item.ts')
  })
})

/**
 * ⭐⭐ AUTO-TESTE DO DETECTOR (REGRA 11) — sem isto o guard passaria por CEGUEIRA, que é
 * como três guards desta casa nasceram verdes.
 */
describe('o detector pega a FORMA do defeito', () => {
  const pega = (s: string) => MULTIPLICA_CUSTO_DE_LEITURA.test(s)

  it('⛔ pega a multiplicação do custo de leitura, nas duas ordens dos fatores', () => {
    expect(pega('round2(-a.qtd * (custoMap.get(a.itemId) ?? 0))')).toBe(true)
    expect(pega('const total = custoMedio * qtd')).toBe(true)
    expect(pega('const total = qtd * custoMedioDoItem')).toBe(true)
    // ⭐ a 2ª forma, que a 1ª versão deste detector NÃO pegava (sufixo de chamada no meio)
    expect(pega('valor: round2(custoDeLeitura(itemId)! * qtd)')).toBe(true)
  })

  it('⚠️ e NÃO pega a cópia de 17/10 em DUAS linhas — é por isso que o teste do IMPORT existe', () => {
    expect(pega('const custo = custoMap.get(a.itemId) ?? 0')).toBe(false) // ler não é multiplicar
    expect(pega('custoTotal: round2(-a.qtd * custo)')).toBe(false) // `custo` solto é genérico demais
  })

  it('⭐ NÃO morde o caminho certo (a porta devolve o total pronto)', () => {
    expect(pega('const { custoUnitario, custoTotal } = custoDaBaixa(a.itemId, a.qtd, estado)')).toBe(false)
    expect(pega('valor: valorPrevistoDaBaixa(itemId, round2(qtd), estado)')).toBe(false)
    expect(pega('custoMedio: estado.porItem.get(itemId)?.custoMedio ?? null')).toBe(false)
  })
})

/**
 * ⭐⭐⭐ A AMARRA QUE IMPEDE O GUARD DE SER SÓ TEXTO: o CHECK do ledger
 * (`|custoTotal − qtd × custoUnitário| ≤ 0,01`) tem que fechar **por construção**, inclusive
 * no ramo em que o resíduo do histórico é absorvido — ali o ajuste é proporcional à
 * quantidade (`qtd × 0,005`) e numa baixa de 2.000 unidades chega a R$ 10.
 */
describe('o CHECK do ledger fecha pela porta, não por sorte', () => {
  const fecha = (itemId: string, qtd: number, e: EstadoDaBaixa) => {
    const r = custoDaBaixa(itemId, qtd, e)
    return Math.abs(r.custoTotal - (-qtd * r.custoUnitario)) <= 0.01
  }

  it('⭐ fecha no caso real de 17/10', () => {
    const e: EstadoDaBaixa = {
      porItem: new Map([['calabresa', { saldo: 49, valor: 39.57, custoMedio: 0.81 }]]),
      vigentes: new Map([['calabresa', 0.81]]),
    }
    expect(fecha('calabresa', 49, e)).toBe(true)
  })

  it('⭐⭐ fecha TAMBÉM quando o resíduo é absorvido — o unitário DERIVA do total', () => {
    const e: EstadoDaBaixa = {
      porItem: new Map([['drift', { saldo: 2000, valor: 1108, custoMedio: 0.55 }]]),
      vigentes: new Map([['drift', 0.55]]),
    }
    expect(fecha('drift', 2000, e)).toBe(true)
  })
})
