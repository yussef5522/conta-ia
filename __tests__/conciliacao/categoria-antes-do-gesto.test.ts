// ⭐⭐⭐ CATEGORIA ANTES DO GESTO — a régua do dono (20/09/2026)
//
// *"Escolher categoria é OBRIGATÓRIO ANTES de resolver a linha — os gestos da direita ficam
// com aviso «escolha a categoria primeiro →» enquanto vazio; exceções estruturais continuam
// automáticas (pagamento de fatura, parcela, transferência, retirada — categoria vem do
// gesto; e casar-com-conta HERDA da conta)."*
//
// ⛔⛔ **A METADE QUE FAZ A RÉGUA FUNCIONAR É A DAS EXCEÇÕES.** Exigir categoria de um
// pagamento de fatura é cobrar **duas vezes pelo mesmo fato**: a despesa são as compras, já
// classificadas; o pagamento é quitação. Foi por isso que o Fluxo de Caixa inventou os
// rótulos estruturais em 26/08 em vez de mandar o dono classificar fatura na mão. ***Parede
// é como o dono aprende a contornar o sistema por fora.***

import { describe, it, expect } from 'vitest'
import { origemDaCategoria, podeDisparar, estadoDoSeletor, AVISO_CATEGORIA } from '@/lib/conciliacao/categoria-antes-do-gesto'
import { acoesDoSentido } from '@/lib/conciliacao/caixa-de-entrada'

describe('⛔⛔ quem PEDE categoria e quem não pede', () => {
  it('⭐ despesa/receita avulsa e estorno PEDEM — a natureza deles é a categoria', () => {
    for (const a of ['CATEGORIA', 'RECEBIMENTO_VENDA', 'ESTORNO'] as const) {
      expect(origemDaCategoria(a)).toBe('ESCOLHER')
      expect(podeDisparar(a, false), `${a} disparou sem categoria`).toBe(false)
      expect(podeDisparar(a, true)).toBe(true)
    }
  })

  it('⛔⛔ fatura, parcela e transferência NÃO pedem — seria cobrar 2× o mesmo fato', () => {
    for (const a of ['PGTO_CARTAO', 'PARCELA_EMPRESTIMO', 'TRANSFERENCIA_ENVIADA', 'TRANSFERENCIA_RECEBIDA'] as const) {
      expect(origemDaCategoria(a)).toBe('ESTRUTURAL')
      expect(podeDisparar(a, false), `${a} ficou preso — a fatura não teria como ser quitada`).toBe(true)
    }
  })

  it('⛔ IGNORAR também não pede: o dono já classificou como nada', () => {
    expect(podeDisparar('IGNORAR', false)).toBe(true)
  })

  it('⭐ casar HERDA da conta — não pede escolha que o reconcile descartaria', () => {
    expect(origemDaCategoria('CASAR_PAGAR')).toBe('HERDA_DA_CONTA')
    expect(podeDisparar('CASAR_PAGAR', false)).toBe(true)
  })

  /**
   * ⭐⭐ A LISTA É FECHADA POR CONSTRUÇÃO — e este teste é a prova de que ela não envelhece:
   * ação nova no menu sem entrada na régua cai aqui (o `switch` é exaustivo no tipo, mas o
   * tipo não sabe se alguém acrescentou a ação SÓ no menu).
   */
  it('⛔ toda ação dos DOIS menus tem origem declarada', () => {
    for (const sentido of ['SAIDA', 'ENTRADA'] as const)
      for (const a of acoesDoSentido(sentido))
        expect(['ESCOLHER', 'ESTRUTURAL', 'HERDA_DA_CONTA'], `${a.acao} não tem origem de categoria`)
          .toContain(origemDaCategoria(a.acao))
  })
})

describe('⭐⭐ o que o SELETOR da esquerda mostra', () => {
  it('⭐ palpite de casar com conta CATEGORIZADA → diz de onde herda', () => {
    expect(estadoDoSeletor('CASAR_PAGAR', 'Salários'))
      .toEqual({ modo: 'HERDA', texto: 'herda da conta: Salários' })
  })

  it('⛔⛔ conta SEM categoria → PEDE antes do clique, não depois da recusa', () => {
    const s = estadoDoSeletor('CASAR_PAGAR', null)
    expect(s.modo).toBe('PEDE')
    expect(s.texto, 'o dono clicaria pra levar um não — a recusa já era conhecida').toMatch(/não tem categoria/)
  })

  it('⭐ palpite estrutural DIZ que a categoria vem do gesto', () => {
    expect(estadoDoSeletor('PGTO_CARTAO', null).modo).toBe('ESTRUTURAL')
    expect(estadoDoSeletor('PARCELA_EMPRESTIMO', null).texto).toBe('categoria vem do gesto')
  })

  it('⭐ linha sem palpite nenhum: o seletor pede, simples', () => {
    expect(estadoDoSeletor(null, null)).toEqual({ modo: 'PEDE', texto: 'categoria' })
  })

  it('⛔ e o texto NUNCA é vazio — seletor mudo é campo sem nome', () => {
    for (const a of [null, 'CATEGORIA', 'CASAR_PAGAR', 'PGTO_CARTAO', 'IGNORAR'] as const)
      for (const cat of [null, 'Salários'])
        expect(estadoDoSeletor(a, cat).texto.length).toBeGreaterThan(0)
  })
})

describe('⭐ a TELA consome a régua — e o aviso aponta pro seletor', () => {
  const fonte = (arq: string) =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), arq), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

  it('⛔ o botão do palpite espera a categoria', () => {
    const t = fonte('components/conciliacao/caixa-de-entrada.tsx')
    expect(t, 'o confirmar voltou a disparar sem a categoria')
      .toMatch(/disabled=\{ocupado \|\| !podeDisparar\(l\.palpite\.acao/)
    /**
     * ⭐ a tela usa a CONSTANTE, não o literal — se ela escrevesse a frase à mão, seria a
     * segunda cópia do texto e as duas divergiriam no dia em que o aviso mudasse.
     */
    expect(t, 'o aviso sumiu — chip bloqueado sem explicação é botão quebrado').toContain('{AVISO_CATEGORIA}')
    expect(t, 'alguém escreveu a frase à mão em vez de usar a constante').not.toContain(AVISO_CATEGORIA)
  })

  it('⭐⭐ o chip de categoria NÃO abre um 2º menu — usa a escolha da esquerda', () => {
    const t = fonte('components/conciliacao/caixa-de-entrada.tsx')
    const bloco = t.slice(t.indexOf("a.pedeAlvo === 'CATEGORIA'"), t.indexOf("a.pedeAlvo === 'CARTAO'"))
    expect(bloco, 'dois menus pra mesma pergunta = duas réguas na mesma tela')
      .not.toContain('<MenuDoChip')
    expect(bloco).toContain('comCategoria()')
  })

  it('⭐ e o servidor recebe a categoria junto do gesto', () => {
    expect(fonte('components/conciliacao/caixa-de-entrada.tsx'))
      .toMatch(/categoriaEscolhida \? \{ \.\.\.alvo, categoryId: categoriaEscolhida\.id \} : alvo/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ⛔⛔⛔ "HERDA DA CONTA" SÓ VALIA NA METADE DOS CASOS (achado na prova em prod, 20/09)
//
// **Medido com a ELIANE, depois de conciliar pela rota real:** a conta virou
// `EFFECTED/RECONCILED` com o vínculo certo — e a **linha do banco saiu pro arquivo SEM
// CATEGORIA**, aparecendo como **"A CLASSIFICAR"** no Fluxo de Caixa.
//
// **A causa:** o *backfill cooperativo* (a linha herdar a categoria da conta) existia **só
// no ORPHAN MODE**. No **CLASSIC** — que é o caminho COMUM, conta a pagar em aberto — ele
// simplesmente não existia. ⚠️ Eu escrevi *"a linha HERDA a categoria da conta (é o que o
// reconcile já faz)"* no código e no doc; ***valia pra metade***.
describe('⛔⛔ o backfill cooperativo vale nos DOIS modos', () => {
  const fonte = (arq: string) =>
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('node:fs').readFileSync(require('node:path').join(process.cwd(), arq), 'utf-8')

  const REC = fonte('lib/conciliacao/reconcile.ts')
  const classic = REC.slice(REC.indexOf("if (candidateMode === 'CLASSIC')"), REC.indexOf('// ORPHAN MODE'))

  it('⭐ o CLASSIC herda categoria e fornecedor da conta casada', () => {
    expect(classic, 'a linha volta a sair da caixa como A CLASSIFICAR')
      .toMatch(/ofx\.categoryId === null && candidate\.categoryId !== null/)
    expect(classic).toMatch(/ofx\.supplierId === null && candidate\.supplierId !== null/)
  })

  it('⛔ e é COOPERATIVO — nunca sobrescreve o que o dono já pôs', () => {
    // a condição é `=== null`: categoria existente na linha fica intacta
    expect(classic).not.toMatch(/categoryId: candidate\.categoryId\s*[,}]\s*$/m)
  })

  it('⭐⭐ ganhar categoria sobe o status — linha categorizada não fica "Pendente"', () => {
    expect(classic).toMatch(/'categoryId' in backfillClassic/)
    expect(classic).toContain("status: 'RECONCILED' as const")
  })

  it('⛔⛔ e o DESFAZER devolve — um helper, os dois modos', () => {
    expect(REC, 'o undo do CLASSIC deixaria uma categoria que a linha nunca escolheu')
      .toMatch(/restaurarOfxDoBackfill\(trx, metadata\)[\s\S]{0,600}mode: 'CLASSIC'/)
    expect((REC.match(/await restaurarOfxDoBackfill\(/g) ?? []).length, 'um dos dois ramos ficou sem restaurar')
      .toBe(2)
    // ⭐ e o audit do CLASSIC guarda o que foi escrito (sem isso o undo é cego)
    expect(classic).toMatch(/ofxBefore: \{ categoryId: ofx\.categoryId/)
    expect(classic).toMatch(/ofxBackfilled: backfillClassic/)
  })
})
