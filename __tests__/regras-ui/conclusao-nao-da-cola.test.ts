/**
 * ⛔⛔⛔ A TELA DE CONCLUSÃO NÃO DÁ COLA DE PROVA (05/10/2026) — regra de segurança do dono.
 *
 * **Ordem, ao pé da letra:** *"NENHUM número esperado/sugerido/médio aparece na tela de
 * conclusão pra quem declara. Motivo: é cola de prova — ensina qual número digitar pro fiscal
 * não pegar. A régua dos líderes (SAP/Oracle/Katana): aviso vem DEPOIS do digitado, nunca
 * sugestão antes. O fiscal continua conferindo em silêncio e acusando no pontinho/sininho/
 * página da ordem."*
 *
 * ⭐⭐ **POR QUE ISTO É GUARD E NÃO UM COMENTÁRIO:** o número esperado é *útil* — foi pedido em
 * 01/09 e entrou de boa-fé. Ele não volta por maldade: volta porque **alguém vai achar que
 * ajuda**. A régua só sobrevive se estiver escrita num teste que fica vermelho.
 *
 * ⛔ E o guard é de DOIS LADOS: a cola sai da tela de quem DECLARA **e** o juízo continua
 * existindo onde ele vale (a página da ordem CONCLUÍDA, o fiscal, o P8). *Guard que só afirma
 * a remoção aprovaria o dia em que a conferência sumisse de todo lugar.*
 *
 * ⚠️ **ESTRUTURAL e assumido como tal** (sem jsdom): o que dá pra provar por comportamento mora
 * nas libs (`quem-produziu` tem teste próprio que EXECUTA a frase).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ = process.cwd()
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8')

/**
 * ⚠️⚠️ **LER SEM COMENTÁRIO É O CORAÇÃO DESTE GUARD.** A própria modal documenta, no texto, as
 * frases que ela matou (*"a receita promete ~61 · a sua média daria ~72"*). Lendo o arquivo
 * cru, **o comentário que explica o defeito seria o que o absolve** — a 5ª vez que esta casa
 * paga por isso. ⚠️ E mordeu de novo HOJE, numa asserção do meu próprio script de edição.
 */
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const ORDEM = 'app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx'
const ROTA = 'app/api/empresas/[id]/estoque/producao/ordens/[ordemId]/concluir/route.ts'
const LIB_QUEM = 'lib/stock/producao/quem-produziu.ts'

const tela = () => semComentario(ler(ORDEM))
/** ⭐ a MODAL é a fatia que vai de `function ConclusaoForm` ao fim do arquivo */
const modal = () => {
  const t = tela()
  const i = t.indexOf('function ConclusaoForm')
  expect(i, 'a modal foi achada no arquivo').toBeGreaterThan(0)
  return t.slice(i)
}

// ───────────────── a regra de segurança ─────────────────

describe('⛔⛔⛔ NENHUM número esperado na mão de quem declara', () => {
  /**
   * ⛔⛔ A LISTA É DE SUBSTRING, de propósito: ela pega a frase antiga (*"a receita promete"*),
   * a variante (*"promete ~61"*) e qualquer redação nova que use a mesma palavra. Régua por
   * símbolo (`preverSaida`) se escapa com um `const p = preverSaida`; régua por PALAVRA, não.
   */
  const PROIBIDAS = [
    'promete', 'sua média', 'a média', 'daria', 'deve sair', 'esperado', 'esperada',
    'rendimento', 'previsão', 'previsto',
  ]
  it('⛔⛔ nenhuma palavra de número esperado dentro da modal', () => {
    const m = modal().toLowerCase()
    for (const p of PROIBIDAS) {
      expect(m, `"${p}" é cola de prova na tela de quem declara`).not.toContain(p)
    }
  })

  /**
   * ⛔ E as FUNÇÕES que produzem o esperado não podem ser chamadas ali — nem com outro nome de
   * variável. `avaliarVariacao` era quem imprimia *"93% do que a receita promete · sua média é
   * 102%"*; `preverSaida` era a previsão ANTES do digitado.
   */
  it('⛔⛔ a modal não chama nenhuma função de previsão/veredito', () => {
    const m = modal()
    for (const f of ['preverSaida(', 'avaliarVariacao(', 'eficienciaMedia(', 'escalaDoConsumo(']) {
      expect(m, `${f} não entra na tela de conclusão`).not.toContain(f)
    }
  })

  /**
   * ⭐⭐ **O OUTRO LADO: O JUÍZO NÃO SUMIU DO SISTEMA, MUDOU DE LUGAR.** Ele vive na página da
   * ordem **CONCLUÍDA** (depois do fato), no fiscal e no P8 — exatamente onde o dono mandou.
   */
  it('⭐⭐ o veredito CONTINUA na ordem concluída, no fiscal e no P8', () => {
    const t = tela()
    expect(t, 'o fiscal segue na página da ordem').toMatch(/fraseDoFiscal\(/)
    expect(t, 'e a eficiência da ordem também').toMatch(/eficienciaDaOrdem\(/)
    expect(t, 'o bloco só existe pra ordem encerrada').toMatch(/Saiu menos do que a receita promete/)
    // ⛔ e o P8/fiscal não foram tocados: a régua continua tendo dono fora da tela
    expect(ler('lib/stock/producao/eficiencia-da-ordem.ts'), 'o fiscal existe').toMatch(/fiscalDoDeclarado/)
  })

  /**
   * ⛔⛔ **E A PREVISÃO DA SEPARAÇÃO NÃO PODE DIVIDIR A TELA COM A CONCLUSÃO.** O *"Com isso
   * deve sair ~N"* é o auxílio de PLANEJAMENTO (pedido em 01/09) e vive no estado PLANEJADA;
   * se ele deixasse de ser gateado, apareceria ao lado do campo de declarar — e a régua de
   * segurança morreria sem ninguém tocar na modal.
   */
  it('⛔⛔ o "deve sair" da separação é gateado por `planejada`', () => {
    const t = tela()
    const i = t.indexOf('Com isso deve sair')
    expect(i, 'o bloco da separação existe').toBeGreaterThan(0)
    const gate = t.lastIndexOf('{planejada && (', i)
    expect(gate, 'ele está dentro do gate de PLANEJADA').toBeGreaterThan(0)
    // ⚠️ e o gate é ANTES do bloco, sem um `)}` fechando no meio
    expect(t.slice(gate, i), 'o gate não fecha antes do bloco').not.toContain(')}\n      {')
  })
})

// ───────────────── o que morreu na tela ─────────────────

describe('⛔ OS TEXTOS MORTOS NÃO VOLTAM', () => {
  /**
   * ⛔ (a) *"Confirme o que foi consumido de verdade (sobra volta pro estoque)"* — **a cozinha
   * NUNCA devolve** (decisão do dono, 05/10). A frase prometia um caminho que não existe, e
   * frase mentirosa na tela é como a confiança nela se perde.
   */
  it('⛔ (a) a frase da sobra que volta pro estoque', () => {
    expect(modal()).not.toContain('sobra volta pro estoque')
    expect(modal(), 'nem o campo editável de consumo').not.toMatch(/setConsumo/)
  })

  it('⛔ (c) a aula do PIN saiu — a informação ficou', () => {
    const m = modal()
    expect(m, 'a explicação do mecanismo').not.toContain('o PIN de cada um')
    expect(m, 'mas o nome continua, pela lib').toMatch(/fraseDeQuemProduziu\(quemProduziu\)/)
    expect(semComentario(ler(LIB_QUEM)), 'e a lib diz de onde o nome veio').toContain('(das etapas)')
  })

  it('⛔ (d) o checkbox de produção parcial saiu da tela', () => {
    expect(modal()).not.toContain('produção parcial')
    expect(modal(), 'nem o estado dele').not.toMatch(/\bparcial\b.*useState/)
  })

  it('⛔ (e) o cartão de "rendimento médio" saiu', () => {
    expect(modal()).not.toContain('rendimento médio')
  })
})

// ───────────────── o que a tela virou ─────────────────

describe('⭐⭐ UMA PERGUNTA, DOIS CUSTOS, UM BOTÃO', () => {
  it('⭐ cabeçalho: logo do dono único + o pedido redondo', () => {
    const m = modal()
    expect(m, 'o MESMO logo da lista e da ordem').toMatch(/<LogoDaReceita nome=\{nomeProduzido\}/)
    expect(m).toContain('Concluir produção')
    expect(m, 'o pedido pelo dono único').toMatch(/fmtPedido\(pedido\.unidades, unidadeProduzido\)/)
    /**
     * ⛔⛔⛔ **SÓ O PEDIDO DECLARADO** — e isto resolve um conflito entre dois itens do pedido
     * do dono. O item 1 pedia *"derivado = esperadas"*; o item 2(b) proíbe número esperado.
     * ⚠️ Medido: o pedido DERIVADO é `escalaReceitas × loteBase`, e `esperadoDaFicha` (o número
     * que o item 2(b) nomeia, régua do P8) é `escala × teorico` — **o MESMO número**. Então
     * *"pedido 61 UN esperadas"* era a cola com outro rótulo, e a palavra "esperadas" era o
     * sinal. **Declarado é a ORDEM que ele já recebeu de boca; derivado é a expectativa da
     * ficha.**
     */
    expect(m, 'o pedido é gateado pelo DECLARADO').toMatch(/pedido\?\.origem === 'DECLARADO'/)
    expect(m, 'e a palavra "esperadas" não entra na modal').not.toContain('esperadas')
  })

  it('⭐⭐ A PERGUNTA: campo GRANDE de 26px, tabular, e nasce VAZIO', () => {
    const m = modal()
    expect(m).toContain('Quantas unidades saíram?')
    expect(m, '26px').toMatch(/text-\[26px\]/)
    expect(m, 'tabular (a classe `num` da casa)').toMatch(/className="num w-40/)
    /** ⛔ nascer preenchido faria todo mundo confirmar o número sem contar (o viés da contagem) */
    expect(m, 'o estado nasce string vazia').toMatch(/useState\(''\)/)
  })

  /**
   * ⭐⭐ Os DOIS custos: o do lote é FIXO (o material já saiu da prateleira) e o por unidade
   * anda com o que ele digita.
   */
  it('⭐⭐ os dois cartões de custo, pelo dono único do R$', () => {
    const m = modal()
    expect(m).toContain('custo deste lote')
    expect(m).toMatch(/custo por \{unidadeProduzido\}/)
    expect(m, 'o do lote').toMatch(/formatBRL\(custoLote\)/)
    expect(m, 'o por unidade recalcula').toMatch(/custoLote \/ qg/)
    /** ⚠️ e o R$ tem UM dono: o `brl` local da página morreu nesta volta */
    expect(tela(), 'nenhum formatador de moeda local').not.toMatch(/style: 'currency'/)
  })

  /**
   * ⛔⛔ O GUARD É DUPLO: `qg > 0` mata a divisão por zero (vazio, "0", "abc") e
   * `Number.isFinite` mata o NaN/Infinity que escaparia pro `Intl`. ⛔ Vazio é **"—"**, nunca
   * `R$ 0,00` — zero é uma afirmação, e dizer que a unidade custa zero é a pior delas numa
   * tela que existe pra medir custo.
   */
  it('⛔⛔ anti-NaN e anti-divisão-por-zero, e vazio é "—"', () => {
    const m = modal()
    expect(m).toMatch(/qg > 0 \? custoLote \/ qg : null/)
    expect(m).toMatch(/Number\.isFinite\(custoUnit\)/)
    expect(m).toMatch(/: '—'/)
  })

  it('⛔ validação: vazio/0/negativo dá erro INLINE e não conclui', () => {
    const m = modal()
    expect(m).toMatch(/if \(!\(qg > 0\)\) return setErro\(/)
    expect(m, 'o erro aparece na tela').toMatch(/\{erro && <p/)
  })

  it('⭐ um primário índigo + "voltar" de contorno', () => {
    const m = modal()
    expect(m).toContain('Concluir e gerar etiqueta')
    expect(m, 'o primário pelo token').toMatch(/background: 'var\(--prod-acao-bg\)'/)
    const i = m.indexOf('voltar\n')
    expect(i, 'o voltar existe').toBeGreaterThan(0)
    const bloco = m.slice(m.lastIndexOf('<a', i), i)
    expect(bloco, 'contorno, nunca preenchido').toMatch(/border: '1px solid var\(--prod-line-strong\)'/)
    expect(bloco, 'e NUNCA primário').not.toContain('--prod-acao-bg')
  })

  it('⭐ a etiqueta continua saindo igual (Zebra no mesmo caminho)', () => {
    expect(modal()).toMatch(/conclusoes\/\$\{j\.conclusaoId\}\/etiqueta\?print=zebra/)
  })
})

// ───────────────── o que grava, e os dois lados ─────────────────

describe('⭐⭐ A GRAVAÇÃO — o consumo é o separado, e o `parcial` fica na ROTA', () => {
  /**
   * ⭐⭐ **E ISSO FORTALECE O P1** (`Σ separado == Σ consumido + Σ devolvido`): com o campo
   * editável, declarar consumo MENOR que o separado **sem devolver** deixava material preso no
   * armazém virtual — o vazamento que o **P4** acusa. Agora o estado torto é inalcançável.
   */
  it('⛔⛔ o consumo enviado é o `qtdSeparada`, não um campo digitado', () => {
    const m = modal()
    expect(m).toMatch(/qtdConsumida: l\.qtdSeparada/)
    expect(m, 'nenhum input de consumo por insumo').not.toMatch(/consumo\[l\.itemId\]/)
  })

  /**
   * ⭐ **A TELA PARA DE OFERECER; A CAPACIDADE FICA** — a mesma régua do "devolver". Produção
   * em dois dias continua possível pela rota; só o checkbox que ninguém usava saiu.
   */
  it('⛔ o `parcial` não é mandado pela tela — e a rota continua aceitando', () => {
    expect(modal(), 'a tela não manda').not.toMatch(/parcial:/)
    const rota = semComentario(ler(ROTA))
    expect(rota, 'a capacidade segue viva').toMatch(/parcial: z\.boolean\(\)\.optional\(\)/)
  })

  /**
   * ⭐ O MOTIVO é INCONDICIONAL agora — e isso FECHA um canal lateral: ele só nascia quando o
   * desvio estourava a faixa, então *"o campo apareceu"* dizia **"seu número está fora"** sem
   * escrever número nenhum. ⚠️ Opcional de propósito: cobrar motivo em produção normal treina
   * a pessoa a escrever qualquer coisa, e o campo deixa de valer quando o desvio for de verdade.
   */
  it('⭐ o motivo é incondicional, opcional e sem juízo', () => {
    const m = modal()
    expect(m).toContain('Aconteceu alguma coisa? (opcional')
    expect(m, 'e vai no gesto').toMatch(/motivoDesvio: motivo\.trim\(\) \|\| null/)
    // ⛔ ele NÃO pode estar atrás de nenhum gate de variação/faixa
    expect(m, 'sem gate de faixa').not.toMatch(/variacao/)
  })

  /** ⛔ o aviso de etapa aberta FICA: ele fala de TEMPO, não de quanto deve sair */
  it('⛔ o aviso de etapas abertas continua, pela mesma função do servidor', () => {
    expect(modal()).toMatch(/avisoDeEtapasAbertas\(etapasAbertas\)/)
  })

  /** ⚠️ os nomes vêm do MESMO payload das etapas — um 2º fetch faria as telas discordarem */
  it('⭐ "quem produziu" desce das etapas, e o dropdown só existe sem ninguém', () => {
    const t = tela()
    expect(t).toMatch(/aoSaberQuemProduziu=\{setQuemProduziu\}/)
    expect(t).toMatch(/colaboradores=\{quemProduziu\.length > 0 \? \[\] : colaboradores\}/)
    expect(t, 'o custo do lote é o MESMO do rodapé dos insumos').toMatch(/custoLote=\{custoSeparado\}/)
  })
})

// ───────────────── 2 viewports e 2 temas ─────────────────

describe('⭐ 2 TEMAS e UMA COMPOSIÇÃO na modal', () => {
  it('⛔⛔ zero paleta cravada', () => {
    const m = modal()
    for (const fam of ['slate', 'amber', 'emerald', 'rose', 'sky', 'zinc', 'gray']) {
      expect(m, `${fam}-N não inverte no escuro`).not.toMatch(new RegExp(`\\b(text|bg|border|divide)-${fam}-\\d`))
    }
    expect(m, 'sem hex de cor').not.toMatch(/(color|background|borderColor): '#[0-9a-fA-F]{3,8}'/)
    expect(m, 'sem hex em classe').not.toMatch(/-\[#[0-9a-fA-F]{3,8}\]/)
  })

  it('⛔ nenhum bloco por viewport — ela quebra com flex-wrap', () => {
    const m = modal()
    expect(m).not.toMatch(/className="[^"]*\bsm:hidden\b/)
    expect(m).not.toMatch(/className="[^"]*\bhidden (sm|lg):(block|flex)\b/)
    expect(m, 'os dois custos quebram no celular').toMatch(/flex flex-wrap gap-2/)
  })

  /** ⚠️ um id, um alvo: duas âncoras `#concluir` fariam o botão das ações pular pro lugar errado */
  it('⚠️ a âncora #concluir existe UMA vez no documento', () => {
    expect(tela().split('id="concluir"').length - 1).toBe(1)
  })
})
