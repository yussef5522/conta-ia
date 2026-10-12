/**
 * ⭐⭐⭐ A PERGUNTA ÚNICA DO PEDIDO — *"pergunta UMA vez, no lugar certo"* (dono, 11/10/2026).
 *
 * ═══ ⛔⛔ O DEFEITO QUE ISTO FECHA ═══
 *
 * *"A quantidade era perguntada 2× — na criação E depois de criar — e números diferentes
 * deixam o 1º assombrando a tela."*
 *
 * **E o retrato medido mostrou que não eram 2 writers: eram 2 LUGARES DE PERGUNTA e o 2º NÃO
 * ESCREVIA.** O campo *"Quero fazer"* da página da ordem só mexia em `useState` — recalculava
 * a separação linha a linha e **nunca regravava nem a meta nem a escala**. Digitar 20 ali fazia
 * a cozinha separar material pra 20 enquanto o cabeçalho, a home, a lista e os relatórios
 * seguiam imprimindo **30**, porque todos leem o pedido/escala do BANCO.
 *
 * ═══ ⚠️ POR QUE ESTE GUARD É ESTRUTURAL (e assume ser) ═══
 *
 * O projeto roda em `environment: node`, **sem jsdom** — não dá pra clicar no teste. Então o
 * que dá pra travar é a FORMA: onde a pergunta existe, quem escreve a meta, e de onde sai o
 * "vai tirar". As regras que EXECUTAM (gravação, correção, recusa pós-separada) vivem em
 * `lib/stock/producao/__tests__/pedido-gravado.integration.test.ts`, contra banco.
 *
 * ⛔ Ele lê a tela **SEM COMENTÁRIO**: os arquivos documentam o defeito que mataram, e
 * *"o arquivo que documenta o defeito não pode ser o que o absolve"* (a cicatriz de 21/09).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { semComentarios, usosDe, blocoEntre } from './_leitura-de-fonte'

const RAIZ = process.cwd()
const CRIACAO = join(RAIZ, 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx')
const ORDEM = join(RAIZ, 'app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx')
const WRITER = join(RAIZ, 'lib/stock/producao/confirmar-pedido.ts')

const ler = (p: string) => readFileSync(p, 'utf8')
const limpo = (p: string) => semComentarios(ler(p))

describe('⭐⭐⭐ PASSO 1 — a criação é ENXUTA: receita + data + setor', () => {
  /**
   * ⚠️⚠️ ESTE GUARD NASCEU LARGO E REPROVOU A TELA CERTA — e a correção fica registrada.
   *
   * A 1ª versão proibia a FRASE `/Quantas unidades/i` no arquivo, e o formulário tem uma linha
   * HONESTA dizendo o próximo passo: *"Criar abre a ordem na pergunta «quantas unidades
   * produzir?»"*. Proibir a frase me obrigaria a APAGAR a explicação pra o guard ficar verde —
   * trocaria um campo duplicado por um caminho mudo (*"guard largo demais reprova o certo e
   * ensina a afrouxar a régua"*, a lição de 21/09).
   *
   * ⭐ O que morde é ESTRUTURAL: quais CONTROLES o formulário tem.
   */
  it('⛔⛔ o formulário de criação tem 3 controles, e nenhum é de quantidade', () => {
    const corpo = blocoEntre(limpo(CRIACAO), 'function NovaOrdem', '\nfunction ')
    expect(corpo, 'o formulário existe').not.toBe('')

    // ⭐ os únicos estados do formulário: receita + data + setor (mais os de UI)
    const estados = [...corpo.matchAll(/const \[(\w+), set\w+\] = useState/g)].map((m) => m[1])
    expect(estados.sort()).toEqual(['busy', 'data', 'erro', 'fichaId', 'fichas', 'setorId', 'setores'])

    /**
     * ⛔ O ÚNICO `<input>` é o de DATA. Um campo de número aqui é o fantasma de volta — e a
     * forma (`type="date"`) é o que separa "campo de data" de "campo de quantidade".
     */
    const inputs = [...corpo.matchAll(/<input\b[^>]*/g)].map((m) => m[0])
    expect(inputs).toHaveLength(1)
    expect(inputs[0]).toMatch(/type="date"/)

    // ⛔ e o campo morto não volta pelo nome antigo
    expect(corpo).not.toMatch(/pedidoUnidades|Quero fazer/i)
  })

  it('⛔ e o RETALHO também saiu da criação (ele é parte da mesma pergunta)', () => {
    const corpo = blocoEntre(limpo(CRIACAO), 'function NovaOrdem', '\nfunction ')
    expect(corpo).not.toMatch(/retalho/i)
  })

  it('⭐ o POST de criar manda só ficha + data + setor', () => {
    const src = limpo(CRIACAO)
    const corpo = blocoEntre(src, "fetch(`/api/empresas/${id}/estoque/producao/ordens`", '})')
    expect(corpo, 'o POST de criação existe').not.toBe('')
    expect(corpo).toMatch(/fichaId/)
    expect(corpo).toMatch(/dataProducao/)
    expect(corpo, 'quantidade não viaja mais na criação').not.toMatch(/pedidoUnidades|retalhoKg/)
  })

  it('⭐ criar leva DIRETO pra página da ordem (é lá que a pergunta mora)', () => {
    const src = limpo(CRIACAO)
    expect(src).toMatch(/estoque\/producao\/\$\{[^}]*ordemId[^}]*\}|producao\/\$\{j\.ordemId\}/)
  })
})

describe('⭐⭐⭐ PASSO 2 — a pergunta mora na página da ordem, e é UMA', () => {
  const src = () => limpo(ORDEM)

  it('⭐ a página abre na pergunta quando o pedido está AGUARDANDO', () => {
    const s = src()
    expect(s).toMatch(/Quantas unidades produzir\?/)
    expect(s).toMatch(/origem === 'AGUARDANDO'/)
    /**
     * ⭐ e o gate junta o aguardando com a correção — um componente, dois momentos.
     *
     * ⚠️⚠️ **REAPONTADO EM 11/10, E MAIS FORTE:** o literal ganhou `!esperaRendimento` (item 2b
     * do dono — *"se alguém criar ordem de receita ainda pendente, a página NÃO pergunta"*).
     * A pergunta do guard não mudou (*"a pergunta é UMA e mora aqui"*); o que mudou é que ela
     * passou a exigir também a condição NOVA — senão o gate poderia perder o `!esperaRendimento`
     * num refactor e a ordem voltaria a pedir um pedido que o sistema não tem como dividir.
     */
    expect(s).toMatch(/perguntando\s*=\s*ordem\?\.estado === 'PLANEJADA' && !esperaRendimento && \(aguardando \|\| corrigindoPedido\)/)
  })

  /**
   * ⛔⛔⛔ O VERMELHO QUE O DONO NOMEOU: *"NUNCA um campo de rendimento na ordem"* (item 5).
   *
   * A ficha é a ÚNICA casa do número. Um campo de rendimento aqui seria a **config paralela**
   * que o item 2 proíbe — duas casas pro mesmo número, divergindo no primeiro ajuste.
   */
  it('⛔⛔ a ordem NUNCA tem campo de rendimento — ela mostra o LINK pra ficha', () => {
    const s = src()
    /**
     * ⚠️⚠️ **A REGRA 11 REPROVOU A 1ª VERSÃO DESTE TESTE (11/10):** ela fazia
     * `toMatch(/foco=rendimento/)` sobre o arquivo inteiro. Arranquei o bloco do gate e o
     * teste ficou **VERDE**, porque a MESMA string vive no atalho do aviso de escala, cem
     * linhas abaixo. ***"Menção, não uso" pela 13ª vez nesta casa*** (o `moldura ? 'O BANCO
     * DIZ' : null` de 20/09, o `hrefSemPagamento`, o `IgnoradosDoCardapio`…).
     *
     * ⭐ O que morde é exigir o **BLOCO GATEADO**: o `<a>` do *"completar a ficha"* tem que
     * existir **dentro** do ramo `esperaRendimento`, e não solto no arquivo.
     */
    const iGate = s.indexOf('{esperaRendimento && ')
    expect(iGate, 'o bloco do link tem que ser gateado por esperaRendimento').toBeGreaterThan(-1)
    const bloco = s.slice(iGate, s.indexOf('{perguntando && (', iGate))
    expect(bloco, 'o link mora DENTRO do gate, não solto no arquivo').toMatch(/<a[\s\S]*?foco=rendimento/)
    expect(bloco).toMatch(/completar a ficha/)
    expect(bloco, 'e com o caminho de volta pra esta ordem').toMatch(/voltar=/)
    // ⛔ e NENHUM input/estado de rendimento/lote mora nesta tela
    expect(s).not.toMatch(/setLoteBase|unidadeLoteBase\s*=\s*useState|A receita rende/)
    // ⭐ o veredito vem do SERVIDOR (uma régua), nunca de uma comparação de unidades aqui
    expect(s).toMatch(/ordem\?\.rendimentoPendente/)
    expect(s).not.toMatch(/unidadeLoteBase !== .*unidadeProduzido|unidadeProduzido !== .*unidadeLoteBase/)
  })

  it('⛔⛔ existe EXATAMENTE UM input de quantidade de pedido na tela', () => {
    const s = src()
    const campos = (s.match(/aria-label="quantas unidades produzir"/g) ?? []).length
    expect(campos, 'dois campos de pedido = o fantasma de volta').toBe(1)
  })

  it('⭐⭐ corrigir REABRE o MESMO componente (não nasce um 2º campo)', () => {
    const s = src()
    // o botão de corrigir só liga o estado; quem desenha é o bloco da pergunta
    expect(s).toMatch(/setCorrigindoPedido\(true\)/)
    /**
     * ⚠️ E `quanto` nasce VAZIO na correção: número pré-preenchido vira número confirmado sem
     * ninguém conferir (a régua do campo de conclusão, 05/10).
     */
    expect(s).toMatch(/setQuanto\(''\)\s*;?\s*setCorrigindoPedido\(true\)/)
  })

  it('⛔ a correção só é oferecida enquanto PLANEJADA e já DECLARADO', () => {
    const s = src()
    expect(s).toMatch(/planejada && pedido\?\.origem === 'DECLARADO'/)
  })

  it('⛔⛔ a TABELA AO VIVO vem da PORTA da separação, nunca de uma 2ª conta', () => {
    const s = src()
    expect(usosDe(s, 'tabelaDaPergunta'), 'a tela consome a lib').toBeGreaterThan(0)
    /**
     * ⛔ O "vai tirar" é `dose × pedido ÷ loteBase` — e ele tem UM dono (`insumoDoPedido`, via
     * `tabelaDaPergunta`). Multiplicar aqui faria a tela prometer um material e a ordem separar
     * outro: *o dono descobriria com a carne na mão*.
     */
    const bloco = blocoEntre(s, 'const tabela = useMemo(', '  )')
    expect(bloco).not.toMatch(/porLote\s*\*/)
    expect(bloco).not.toMatch(/\/\s*loteBase/)
    expect(usosDe(s, 'insumoDoPedido'), 'a tela não chama a porta direto — ela usa a lib').toBe(0)
  })

  it('⭐ falta NÃO bloqueia o confirmar (a régua da separação não muda neste sprint)', () => {
    const s = src()
    const botao = blocoEntre(s, 'onClick={confirmarPedido}', '</button>')
    expect(botao, 'o botão de confirmar existe').not.toBe('')
    expect(botao, 'o disabled olha o NÚMERO, nunca a falta de insumo').toMatch(
      /disabled=\{busy \|\| pedidoNum == null \|\| !\(pedidoNum > 0\)\}/,
    )
    expect(botao).not.toMatch(/faltando/)
  })

  it('⭐ o retalho é perguntado AQUI, junto do número', () => {
    const s = src()
    expect(s).toMatch(/Tem retalho de ontem/)
    expect(usosDe(s, 'fraseDoRetalho'), 'a frase "vai sair ~X" continua, e vem da lib').toBeGreaterThan(0)
  })

  it('⭐ os avisos do ato mudaram de tela COM o número (remoção sem realocação é perda)', () => {
    expect(usosDe(src(), 'avisosDaEscala')).toBeGreaterThan(0)
    expect(usosDe(limpo(CRIACAO), 'avisosDaEscala'), 'eles saíram da criação').toBe(0)
  })
})

describe('⛔⛔⛔ PASSO 3 — a meta tem UM writer', () => {
  /** varre `lib/` e `app/` atrás de qualquer escrita nas duas colunas do pedido */
  function arquivos(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '__tests__') continue
      const p = join(dir, e.name)
      if (e.isDirectory()) arquivos(p, acc)
      else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p)
    }
    return acc
  }

  const todos = [...arquivos(join(RAIZ, 'lib')), ...arquivos(join(RAIZ, 'app'))]

  it('⛔⛔ só `confirmar-pedido.ts` escreve em `stockOrdemMeta`', () => {
    const escrevem = todos.filter((f) => {
      const s = semComentarios(ler(f))
      return /stockOrdemMeta\s*\.\s*(create|createMany|upsert|update|updateMany|delete|deleteMany)/.test(s)
    })
    expect(escrevem.map((f) => f.replace(RAIZ + '/', '')), 'a meta com 2 writers = vermelho').toEqual([
      'lib/stock/producao/confirmar-pedido.ts',
    ])
  })

  it('⛔⛔ e só ele mexe em `escalaReceitas` depois da criação', () => {
    const escrevem = todos.filter((f) => {
      const s = semComentarios(ler(f))
      /**
       * ⚠️⚠️ A ASSERÇÃO É POR CHAMADA, NÃO POR ARQUIVO — a 1ª versão olhava o arquivo inteiro
       * e acusou o `ordens.ts`, que tem `create({ … escalaReceitas … })` (a criação, outro
       * gesto) e `update(…)` de ESTADO em funções distintas. Ler o arquivo em vez da chamada
       * dava falso vermelho contra código certo.
       */
      return [...s.matchAll(/stockProductionOrder\s*\.\s*update(?:Many)?\(\{[\s\S]{0,400}?\}\)/g)]
        .some((m) => /escalaReceitas\s*:/.test(m[0]))
    })
    expect(escrevem.map((f) => f.replace(RAIZ + '/', ''))).toEqual([
      'lib/stock/producao/confirmar-pedido.ts',
    ])
  })

  it('⭐ a escala sai da PORTA ÚNICA (`escalaDoPedido`), nunca de `pedido / loteBase` à mão', () => {
    const s = semComentarios(ler(WRITER))
    expect(usosDe(s, 'escalaDoPedido')).toBeGreaterThan(0)
    expect(s, 'uma 2ª derivação aqui fecharia o ciclo com o material errado').not.toMatch(
      /unidades\s*\/\s*(versao\.)?loteBase/,
    )
  })

  it('⭐⭐ meta + rastro + escala andam na MESMA transação', () => {
    const s = semComentarios(ler(WRITER))
    const gravar = blocoEntre(s, 'const gravar = async (tx: Db) => {', '\n  }')
    expect(gravar).not.toBe('')
    for (const alvo of ['stockOrdemMeta.upsert', 'stockOrdemPedidoDeclarado.create', 'stockProductionOrder.update']) {
      expect(gravar, `${alvo} tem que andar junto`).toContain(alvo)
    }
  })

  it('⛔ e `criarOrdem` não aceita mais pedido (chamar com pedido não compila)', () => {
    const s = semComentarios(ler(join(RAIZ, 'lib/stock/producao/ordens.ts')))
    const input = blocoEntre(s, 'export interface CriarOrdemInput', '}')
    expect(input).not.toMatch(/pedidoUnidades/)
    expect(input).not.toMatch(/retalhoKg/)
  })
})

describe('⛔⛔ PASSO 3b — o FANTASMA morreu: nenhuma tela imprime o número da criação', () => {
  it('⛔ o componente que imprimia a escala crua não existe mais', () => {
    const s = semComentarios(ler(CRIACAO))
    /**
     * ⚠️ O `Secao` tinha ZERO chamadores e era o último lugar que imprimia o número cru da
     * criação. **Foi APAGADO, não desligado** — *enquanto o componente existe no arquivo,
     * alguém religa* (a lição do `GruposSugeridos`, 23/09).
     */
    expect(s).not.toMatch(/function Secao\b/)
  })

  it('⭐ a lista distingue "pedido a definir" de "sem pedido" (legado)', () => {
    const s = semComentarios(ler(CRIACAO))
    expect(s).toMatch(/pedido a definir/)
    expect(s).toMatch(/AGUARDANDO/)
  })
})
