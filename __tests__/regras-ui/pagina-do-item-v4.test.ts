/**
 * ⭐⭐ A PÁGINA DO ITEM v4 (06/10/2026) — e o guard é de DOIS LADOS.
 *
 * **Ordem do dono:** *"tudo que existe FICA, entram as peças novas"*. Então metade deste
 * arquivo prova que **nada morreu** (converter a unidade, mín/máx com salvar, gráfico de
 * preço, chips, forense, clique-na-origem, o Σ que bate com o saldo, as portas do negativo) e
 * a outra metade prova que as peças novas estão na tela.
 *
 * ⚠️⚠️ **ELE LÊ A TELA SEM COMENTÁRIO, de propósito.** O arquivo documenta no próprio texto os
 * defeitos que ele mata (*"a linha do zero"*, *"custo indisponível"*, *"cobertura"*) — lendo o
 * texto cru, **o arquivo que documenta o defeito seria o que o absolve**. É a 6ª vez que essa
 * armadilha aparece nesta casa.
 *
 * ⚠️ Guard ESTRUTURAL e assumido como tal: o projeto roda em `environment: node`, sem jsdom —
 * não dá pra clicar. O que dá pra travar é o que a tela DESENHA e o que ela NÃO pode voltar a
 * fazer. A decisão de cada régua (pílula, dose suspeita, cobertura) tem teste de
 * COMPORTAMENTO próprio em `lib/stock/item/__tests__`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.cwd()
const ler = (p: string) => readFileSync(join(raiz, p), 'utf8')
/** ⛔ sem comentário: senão a documentação do defeito vira a prova de que ele não existe */
const semComentario = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const PAGINA = 'app/(dashboard)/empresas/[id]/estoque/itens/[itemId]/page.tsx'
const tela = () => semComentario(ler(PAGINA))

describe('⛔⛔ O QUE EXISTIA CONTINUA LÁ (a metade que o dono mandou preservar)', () => {
  it('⭐ converter a unidade — o gesto e a afordância de botão', () => {
    const t = tela()
    expect(t).toContain('Converter a unidade')
    expect(t).toContain('ver a prévia')
    expect(t).toContain('confirmar a troca')
    // ⛔ a afordância de 30/08: `aria-expanded` porque é disclosure, não link decorativo
    expect(t).toContain('aria-expanded')
    // ⛔ e a âncora da prévia: o valor em estoque NÃO muda
    expect(t).toContain('O valor em estoque não muda')
  })

  it('⭐ a faixa mín/máx com salvar continua montada', () => {
    const t = tela()
    expect(t).toContain('<MinMaxEditor')
    expect(t).toMatch(/estoqueMin=\{ficha\.item\.estoqueMin\}/)
    // ⛔ e salvar continua recalculando o status pela régua ÚNICA
    expect(t).toMatch(/statusEstoque\(ficha\.saldo, min, max\)/)
  })

  it('⭐ o gráfico de preço unitário no tempo', () => {
    const t = tela()
    expect(t).toContain('Preço unitário no tempo')
    expect(t).toMatch(/dataKey="preco"/)
    // ⚠️ e ele só aparece com 2+ compras (1 ponto não é série)
    expect(t).toMatch(/ficha\.precoTempo\.length >= 2/)
  })

  it('⭐⭐ o histórico: chips por tipo, forense, clique-na-origem', () => {
    const t = tela()
    expect(t).toMatch(/ficha\.tipos\.map/)
    expect(t).toContain('mostrar tudo (forense)')
    expect(t).toContain('voltar ao modo limpo')
    // ⛔ o toggle só existe quando há par colapsado
    expect(t).toMatch(/ficha\.anulados > 0 \|\| forense/)
    // ⛔ clique na origem → a fonte
    expect(t).toMatch(/href=\{l\.href\}/)
    expect(t).toContain('ver detalhe')
  })

  it('⛔⛔ o Σ do rodapé que BATE com o saldo — o teste da tela, à vista', () => {
    const t = tela()
    expect(t).toContain('soma das linhas')
    expect(t).toContain('bate com o saldo em estoque')
    expect(t).toContain('a tabela está somando algo que o saldo não conta')
    expect(t).toMatch(/ficha\.conferencia\.confere/)
    /**
     * ⛔⛔ E ELE SÓ APARECE SEM RECORTE. Filtrado, a soma é do RECORTE, e repetir ali o
     * "bate com o saldo" afirmaria uma conferência que não foi feita — quem fala do recorte
     * é o resumo do topo.
     */
    expect(t).toMatch(/\{!recorteAtivo && \(/)
  })

  it('⛔ linha que não move a prateleira continua sem valor no total', () => {
    const t = tela()
    expect(t).toMatch(/l\.movePrateleira \? brl\(l\.custoTotal\)/)
    expect(t).toContain('não mexe no saldo')
  })

  it('⛔ e o saldo da linha continua "—" quando não dá pra AFIRMAR', () => {
    const t = tela()
    expect(t).toMatch(/l\.saldoApos == null/)
    expect(t).toContain('o recorte não permite afirmar o saldo deste instante')
  })
})

describe('⭐⭐ AS PEÇAS NOVAS DO v4', () => {
  it('⭐ 1. cabeçalho: logo do mapa ÚNICO, pontinho no negativo, pílula de status', () => {
    const t = tela()
    expect(t).toContain('<LogoDaReceita')
    expect(t).toMatch(/tamanho=\{48\}/)
    // ⛔ o pontinho vermelho é o do negativo
    expect(t).toMatch(/alerta=\{negativo \? \{ titulo: 'saldo negativo' \} : null\}/)
    // ⭐⭐ a pílula vem DECIDIDA do servidor — a tela só escolhe a tinta
    expect(t).toMatch(/ficha\.pilula\.label/)
    expect(t).toMatch(/TOM\[ficha\.pilula\.tom\]/)
    /**
     * ⛔⛔ E A TELA NÃO PODE DERIVAR O ESTADO: um `saldo < 0 ? 'negativo' : …` aqui seria a 2ª
     * resposta pra "em que estado este item está?", e ela divergiria do `statusEstoque` que a
     * Posição desenha no primeiro ajuste.
     */
    expect(t, 'a tela não escreve a régua da pílula').not.toContain('pilulaDoItem(')
  })

  it('⭐ os 4 cartões, com a COBERTURA e o fallback do custo médio', () => {
    const t = tela()
    for (const c of ['Saldo atual', 'Custo médio', 'Valor em estoque', 'Cobertura']) expect(t).toContain(c)
    /**
     * ⭐⭐ COBERTURA NUNCA MOSTRA "0 DIAS" — é "—" com o motivo.
     *
     * ⚠️⚠️ A 1ª versão desta asserção veio **VERDE com o defeito reposto**: eu procurava
     * `ficha.cobertura.dias != null` na tela inteira, e a MESMA frase aparece na linha de
     * baixo do próprio cartão (a que escolhe o subtítulo). ***"Menção, não uso"*** pela 7ª
     * vez nesta casa. ⭐ O que morde é fatiar o CARTÃO e exigir o fallback `'—'` **no valor**.
     */
    const cobertura = t.slice(t.indexOf('<Cartao titulo="Cobertura">'))
    const valorDaCobertura = cobertura.slice(0, cobertura.indexOf('</p>'))
    expect(valorDaCobertura).toMatch(/ficha\.cobertura\.dias != null/)
    expect(valorDaCobertura, 'sem o fallback, item negativo mostraria "~0 dias"').toContain("'—'")
    expect(t).toContain('nada saiu nos últimos')
    expect(t).toContain('sem saldo positivo pra projetar')
    // ⭐ custo médio "—" mostra a ÚLTIMA COMPRA, marcada como compra
    expect(t).toContain('última compra')
    expect(t).toMatch(/ficha\.custoMedio == null && ultimaCompra/)
    // ⛔ e o saldo negativo sai coral com a saída escrita
    expect(t).toContain('contar resolve — a contagem é a âncora')
  })

  it('⭐ 2. a classificação é editável NA PÁGINA, com o rastro de quem/quando', () => {
    const t = tela()
    expect(t).toContain('<CategoriaEditavel')
    // ⭐ o rastro que a tabela guardava e ninguém mostrava
    expect(t).toMatch(/ficha\.categoriaRastro/)
    expect(t).toContain('classificação trocada de')
  })

  it('⭐⭐⭐ 3. a BUSCA REVERSA está montada, e a tela NÃO decide quem é suspeito', () => {
    const t = tela()
    expect(t).toContain('<UsadoEmFichasCard')
    expect(t).toMatch(/uso=\{ficha\.usoEmFichas\}/)
    // ⛔ a régua da dose suspeita mora no servidor — duas respostas divergiriam no 1º ajuste
    expect(t).not.toContain('marcarDosesSuspeitas')

    const card = semComentario(ler('components/estoque/usado-em-fichas-card.tsx'))
    expect(card).toContain('corrigir agora')
    expect(card).toContain('abrir ficha')
    // ⭐ a porta leva DIRETO na dose
    expect(card).toMatch(/href=\{f\.hrefCorrigir\}/)
    // ⛔ ausência é informação (item de revenda pura)
    expect(card).toContain('Nenhuma ficha ativa usa este item')
    // ⭐ e a dose vai POR EXTENSO, pelo formatador da casa (vem pronta do servidor)
    expect(card).toMatch(/\{f\.doseTexto\}/)

    /**
     * ⛔⛔ A PORTA TEM QUE CHEGAR NA **DOSE**, não na ficha — e isso se prova do OUTRO LADO.
     * Sem o `foco` no editor, o `[corrigir agora]` abriria uma receita de 8 ingredientes e o
     * dono caçaria de novo o que a tela anterior acabou de apontar.
     */
    const editor = semComentario(ler('components/estoque/ficha-editor.tsx'))
    expect(editor, 'o editor não sabe acender a linha do componente').toMatch(/foco\?: string \| null/)
    expect(editor).toMatch(/id=\{`comp-\$\{c\.itemId\}`\}/)
    expect(editor).toMatch(/foco === c\.itemId/)
    expect(editor, 'e leva o olho até lá').toContain('scrollIntoView')
    const pagFicha = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/fichas/[fichaId]/page.tsx'))
    expect(pagFicha, 'a página da ficha não repassa o foco da URL').toMatch(/foco=\{qp\?\.get\('foco'\)\}/)
  })

  it('⭐ 4. o mínimo SUGERIDO aparece e NUNCA grava', () => {
    const t = tela()
    expect(t).toMatch(/sugestao=\{ficha\.sugestaoMinimo\}/)
    const ed = semComentario(ler('components/estoque/min-max-editor.tsx'))
    expect(ed).toContain('sugestão:')
    expect(ed).toContain('usar no campo')
    /**
     * ⛔⛔ A TRAVA: o botão da sugestão só PREENCHE o campo (`setMin`). Se ele chamasse
     * `salvar()`, gravaria um mínimo que o dono não escolheu — *"o campo é meu"* — e isso
     * viraria alarme de "abaixo do mínimo" todo dia.
     */
    expect(ed).toMatch(/onClick=\{\(\) => setMin\(String\(sugestao\.minimo\)\)\}/)
    const bloco = ed.slice(ed.indexOf('sugestao?.minimo != null'))
    expect(bloco, 'a sugestão não pode salvar sozinha').not.toContain('salvar()')
    // ⛔ e sem dado suficiente ela não aparece (número de reposição chutado é pior que ausência)
    expect(ed).toMatch(/sugestao\?\.minimo != null &&/)
  })

  it('⭐⭐ 5. o histórico ganhou resumo, período, busca, a LINHA DO ZERO e CSV', () => {
    const t = tela()
    // (a) resumo recalculando com o recorte
    expect(t).toMatch(/resumoDoPeriodo\(linhas\)/)
    expect(t).toContain('entrou ')
    expect(t).toContain('saiu ')
    expect(t).toContain('movimento(s)')
    // ⚠️ e ele DIZ o que ficou fora da conta
    expect(t).toMatch(/resumo\.foraDaConta > 0/)
    expect(t).toContain('fora da conta')
    // (b) período livre + busca pela régua da CASA
    expect(t).toMatch(/type="date"/)
    expect(t).toMatch(/aplicarRecorte\(ficha\?\.historico \?\? \[\], recorte, casaBusca\)/)
    expect(t).toContain('limpar o recorte')
    // (c) a linha do zero
    expect(t).toContain('ficou negativo aqui')
    expect(t).toMatch(/zero\?\.movimentoId === l\.movimentoId/)
    /**
     * ⛔ ELA SAI DA LISTA INTEIRA, não do recorte: o cruzamento pro negativo é fato do
     * ledger e não muda porque o dono filtrou a tela.
     */
    expect(t).toMatch(/linhaDoZero\(ficha\?\.historico \?\? \[\]\)/)
    // (d) custo zero de item negativo não parece dinheiro
    expect(t).toContain('custo indisponível — o item estava negativo quando esta linha saiu')
    expect(t).toMatch(/!l\.precoEhDeCompra && l\.custoUnitario === 0/)
    // (f) CSV do que está FILTRADO
    expect(t).toMatch(/baixarCsv\(/)
    expect(t).toMatch(/linhas\.map\(\(l\) => \[/)
  })

  it('⭐ 6. o gráfico de SALDO no tempo, com a zona negativa pintada', () => {
    const t = tela()
    expect(t).toContain('Saldo no tempo')
    expect(t).toMatch(/dataKey="saldo"/)
    expect(t).toMatch(/saldoNoTempo\(ficha\?\.historico \?\? \[\]\)/)
    // ⭐ a zona vermelha só existe se o item REALMENTE esteve negativo
    expect(t).toContain('<ReferenceArea')
    expect(t).toMatch(/serieSaldo\.some\(\(p\) => p\.saldo < 0\)/)
    // ⚠️ toggle, não duas telas
    expect(t).toMatch(/setGrafico\(k\)/)
  })
})

describe('⛔⛔ O ACABAMENTO v4 — dois temas e UMA composição', () => {
  it('⛔ zero cor cravada: a tela pinta por TOKEN', () => {
    const t = tela()
    const hex = t.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []
    expect(hex, `cor cravada não inverte no tema escuro: ${hex.join(', ')}`).toHaveLength(0)
    // ⛔ e nenhuma classe de paleta do Tailwind (slate-/amber-/rose-…) sobrou
    const paleta = t.match(/\b(?:bg|text|border|ring|fill)-(?:slate|gray|zinc|amber|rose|emerald|sky|violet|indigo|teal)-\d{2,3}\b/g) ?? []
    expect(paleta, `classe de paleta não acompanha o tema: ${[...new Set(paleta)].join(', ')}`).toHaveLength(0)
  })

  /**
   * ⛔⛔ A ARMADILHA DE CSS DE 05/10: `bg-[var(--x)]/70` — opacidade sobre valor arbitrário —
   * **não gera cor no Tailwind 3**: sai transparente. O bloco ficaria sem fundo nenhum.
   */
  it('⛔⛔ nenhuma opacidade sobre valor arbitrário de token', () => {
    const achados = tela().match(/\[var\(--[a-z-]+\)\]\/\d+/g) ?? []
    expect(achados, `isto sai TRANSPARENTE no Tailwind 3: ${achados.join(', ')}`).toHaveLength(0)
  })

  /**
   * ⛔ UMA COMPOSIÇÃO (REGRA 12): o que muda entre celular e desktop é o LAYOUT (`lg:`), nunca
   * um segundo bloco desenhado à mão — duas composições divergem no 1º ajuste.
   */
  it('⛔ nenhum bloco só-celular / só-desktop duplicando conteúdo', () => {
    const t = tela()
    const soCelular = t.match(/className="[^"]*\blg:hidden\b[^"]*"/g) ?? []
    const soDesktop = t.match(/className="[^"]*\bhidden lg:block\b[^"]*"/g) ?? []
    // ⚠️ `hidden lg:block` em TEXTO AUXILIAR é legítimo (a frase de ajuda do cabeçalho);
    //    o que não pode é um par celular/desktop desenhando a MESMA lista duas vezes.
    expect(soCelular, 'bloco exclusivo de celular = 2ª composição').toHaveLength(0)
    expect(soDesktop.length, 'só a frase auxiliar do cabeçalho pode se esconder').toBeLessThanOrEqual(2)
    // ⭐ e a tabela rola dentro do cartão em vez de ganhar uma versão de cartões à parte
    expect(t).toContain('overflow-x-auto')
  })

  it('⭐ os formatadores são os da CASA (nunca um `toFixed` solto)', () => {
    const t = tela()
    expect(t).toContain('formatarQtd(')
    expect(t).toMatch(/style: 'currency', currency: 'BRL'/)
    expect(t, 'toFixed arredonda e não fala pt-BR').not.toContain('.toFixed(')
    // ⭐ número de estoque é tabular — coluna de dígito que dança não se confere
    expect(t).toContain('tabular-nums')
  })
})
