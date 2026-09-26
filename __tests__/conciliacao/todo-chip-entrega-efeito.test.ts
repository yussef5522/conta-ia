// ⛔⛔⛔ O GUARD DE FAMÍLIA DOS CHIPS DO CARTÃO ≍ (17/09/2026)
//
// **A ordem do dono, depois de o "casar com conta a pagar" ficar mudo em prod:** *"o guard
// de família: TODO chip do menu do cartão ≍ tem teste navegando que prova o EFEITO — não
// só o casar, os 6 gestos — nos 2 viewports."*
//
// ⭐⭐ **A LEI QUE ESTE ARQUIVO IMPÕE, chip a chip:**
//
//   todo chip ou (a) EFETIVA no servidor com o alvo que a TELA consegue fornecer,
//                ou (b) LEVA a uma rota que EXISTE e que CONSOME o parâmetro.
//
// ⛔ Não existe terceira saída. Chip que manda a ação sem o alvo e leva 422 é **mudo**;
// chip que aponta pra rota inexistente é **porta pintada**. Os dois casos existiam:
//
// | chip | o que acontecia antes de 17/09 |
// |---|---|
// | casar com conta a pagar | `window.location` recarregava a PRÓPRIA tela: o cartão ≍ fechava, o scroll ia pro topo, o painel ficava abaixo da dobra |
// | casar com conta a receber | deep-link pra `/empresas/<id>/contas-a-receber` — **rota que não existe**, 404 |
// | parcela de empréstimo | botão sem seletor → 422 *"Escolha o contrato e a parcela"* |
// | estorno | botão sem seletor → 422 *"Escolha a categoria do estorno"* |
// | é despesa: categoria · recebimento de venda · aporte | `<select>` alimentado por `/api/categorias` — **rota que não existe**: menu VAZIO |
// | transferência enviada/recebida | levava ao `/parear`, que **ignorava** o `?abrir=` |
//
// **Dez dos doze chips não entregavam o efeito.** Este guard é o que impede a volta.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { TODAS_AS_ACOES, acoesDoSentido, type AcaoDoBalcao, type SentidoDaLinha } from '@/lib/conciliacao/caixa-de-entrada'
import { destinoDaAcao } from '@/lib/conciliacao/resolver-linha'

const raiz = process.cwd()
const fonte = (arq: string) =>
  readFileSync(join(raiz, arq), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const TELA = 'components/conciliacao/caixa-de-entrada.tsx'
const SENTIDOS: SentidoDaLinha[] = ['SAIDA', 'ENTRADA']

/**
 * ⭐ O MAPA DO ALVO → como a TELA deixa o dono escolher.
 *
 * ⚠️ Cada `pedeAlvo` precisa de um desenho na tela; a entrada aqui é o que o guard vai
 * procurar. `pedeAlvo` novo sem entrada neste mapa **quebra o teste** — que é como um chip
 * mudo deixa de conseguir nascer.
 */
/**
 * ⚠️⚠️ **DETECTOR REESCRITO EM 25/09 — ELE MEDIA DISTÂNCIA, e isso deu FALSO VERMELHO.**
 *
 * As entradas de menu eram `/pedeAlvo === 'X'[\s\S]{0,700}<MenuDoChip/`: uma **janela de
 * caracteres**. Ao o menu do CARTÃO ganhar as faturas (mês · valor · vencimento), ~30 linhas
 * entraram no meio e o `<MenuDoChip` ficou **além da janela** — com o código CERTO.
 *
 * ⛔ É a **5ª vez** que janela de distância produz falso positivo ou falso negativo nesta casa
 * (o rastro em 12/09, o menu do PF em 13/09, o rodapé em 14/09, o toggle em 17/09). A lição
 * já estava escrita: ***o que morde é ESTRUTURA, não distância.***
 *
 * ⭐ Agora o guard **fatia o RAMO** daquele `pedeAlvo` (do `if` dele até o `if` seguinte ou o
 * fim do laço dos chips) e pergunta pelo desenho DENTRO dele. Comentário novo, lógica nova,
 * ordem trocada: nada disso quebra o guard — só arrancar o desenho quebra.
 */
function ramoDoAlvo(fonte: string, alvo: string): string {
  const i = fonte.indexOf(`a.pedeAlvo === '${alvo}'`)
  if (i < 0) return ''
  const resto = fonte.slice(i + 1)
  const fim = resto.indexOf('a.pedeAlvo === ')
  return fim < 0 ? resto : resto.slice(0, fim)
}

const COMO_A_TELA_PEDE_O_ALVO: Record<string, { desenho: RegExp; descricao: string; noRamo: boolean }> = {
  /**
   * ⚠️⚠️ **O CATEGORIA ESTAVA VERDE PELO MOTIVO ERRADO — ele NÃO desenha menu nenhum.**
   *
   * Desde 20/09 o chip de categoria **dispara com a escolha do seletor da ESQUERDA**
   * (*"dois menus pra mesma pergunta seriam duas réguas na mesma tela: ele escolheria num,
   * clicaria no outro, e a linha sairia com a categoria errada"*). O ramo dele desenha um
   * `<button>`, e a janela de 900 caracteres alcançava o `<MenuDoChip` do ramo **VIZINHO**
   * (o do CARTÃO, logo abaixo) — o guard media o desenho de outro alvo e chamava de verde.
   *
   * ⭐ Agora ele pergunta pelo que o ramo do CATEGORIA de fato entrega: o gesto sai **com a
   * resposta da esquerda junto** (`comCategoria()`). Arrancar isso volta a ser vermelho.
   */
  CATEGORIA: { desenho: /onGesto\(l, a\.acao, comCategoria\(\)\)/, descricao: 'chip que dispara com a categoria escolhida na esquerda', noRamo: true },
  CARTAO: { desenho: /<MenuDoChip/, descricao: 'menu dos cartões', noRamo: true },
  /** ⭐ 25/09 — o aporte em investimento: o espelho do empréstimo, do lado do ativo */
  CONTRATO_INVESTIMENTO: { desenho: /<MenuDoChip/, descricao: 'menu dos contratos de investimento', noRamo: true },
  CONTRATO: { desenho: /<MenuDoChip/, descricao: 'menu de contrato + parcela', noRamo: true },
  CONTA_PAGAR: { desenho: /<FindAndMatchPanel/, descricao: 'painel de casar, aberto na própria linha', noRamo: false },
  CONTA_RECEBER: { desenho: /<FindAndMatchPanel/, descricao: 'painel de casar, aberto na própria linha', noRamo: false },
  PAR: { desenho: /deepLink[\s\S]{0,200}window\.location/, descricao: 'deep-link pro /parear', noRamo: false },
}

/**
 * as que gravam direto, sem alvo nenhum.
 *
 * ⭐ 25/09 — `AVULSA_CONFIRMADA` entrou: o gesto É a resposta (*"não tem nota"*), então não
 * há alvo a escolher. Ele grava a decisão com autor e data, e a linha arquiva com selo
 * PRÓPRIO (*"avulsa confirmada"*) — nunca reusando o *"categorizada"*, que é justamente a
 * mistura que escondeu R$ 16.201,01 de pagamento de fornecedor.
 */
const EFETIVAM_SOZINHAS: AcaoDoBalcao[] = ['IGNORAR', 'AVULSA_CONFIRMADA']

describe('⭐⭐⭐ os 12 chips do cartão ≍ — nenhum é mudo', () => {
  it('⭐ o menu de cada sentido tem o tamanho que o mock desenha', () => {
    /**
     * ⚠️ 25/09 — a SAÍDA ganhou o 7º gesto (*"é despesa avulsa — não tem nota"*), a porta da
     * linha de fornecedor que deixou de arquivar só com categoria. A ENTRADA fica em 6:
     * crédito não paga nota, então a pergunta *"tem nota?"* não existe do outro lado.
     */
    /**
     * ⚠️ 25/09 — a SAÍDA foi a 8: entrou o **📈 aporte em investimento**, o espelho do
     * empréstimo do lado do ativo (*"lá a parcela reduz dívida, aqui aumenta ativo"*).
     * ⭐ A ENTRADA fica em 6: aporte é dinheiro que SAI, e a lei do sentido é checada no
     * servidor — a tela não oferece o que o servidor recusaria.
     */
    expect(acoesDoSentido('SAIDA')).toHaveLength(8)
    expect(acoesDoSentido('ENTRADA')).toHaveLength(6)
  })

  for (const sentido of SENTIDOS) {
    for (const a of acoesDoSentido(sentido)) {
      it(`⭐ ${sentido} · «${a.rotulo}» entrega efeito (nunca cala, nunca aponta pro vazio)`, () => {
        // (a) efetiva sozinha
        if (EFETIVAM_SOZINHAS.includes(a.acao)) {
          expect(a.pedeAlvo, `${a.acao} não devia pedir alvo`).toBeNull()
          return
        }
        // toda a que não efetiva sozinha PRECISA declarar o alvo
        expect(a.pedeAlvo, `«${a.rotulo}» não efetiva sozinha e não declara pedeAlvo — é o chip mudo`).not.toBeNull()

        const mapa = COMO_A_TELA_PEDE_O_ALVO[a.pedeAlvo!]
        expect(mapa, `pedeAlvo «${a.pedeAlvo}» não tem desenho declarado na tela`).toBeDefined()
        // ⭐ o desenho é procurado DENTRO do ramo daquele alvo (estrutura, não distância)
        const onde = mapa.noRamo ? ramoDoAlvo(fonte(TELA), a.pedeAlvo!) : fonte(TELA)
        expect(onde, `o ramo do alvo ${a.pedeAlvo} não existe na tela`).not.toBe('')
        expect(onde, `a tela não desenha ${mapa.descricao} pro alvo ${a.pedeAlvo}`).toMatch(mapa.desenho)
      })
    }
  }
})

describe('⛔⛔ todo deep-link aponta pra rota que EXISTE e que CONSOME o alvo', () => {
  const comDestino = SENTIDOS.flatMap((s) => acoesDoSentido(s).map((a) => a.acao))
    .filter((acao, i, arr) => arr.indexOf(acao) === i)
    .map((acao) => ({ acao, href: destinoDaAcao(acao, 'emp-1', 'tx-1') }))
    .filter((d): d is { acao: AcaoDoBalcao; href: string } => d.href != null)

  it('⭐ só as transferências levam pra outra tela (as duas de casar resolvem na caixa)', () => {
    expect(comDestino.map((d) => d.acao).sort()).toEqual(['TRANSFERENCIA_ENVIADA', 'TRANSFERENCIA_RECEBIDA'])
  })

  for (const { acao, href } of comDestino) {
    it(`⭐ ${acao} → ${href.split('?')[0]} existe como página`, () => {
      const caminho = href.split('?')[0]
        .replace(/^\//, '')
        .replace(/emp-1/, '[id]')
      const alvo = join(raiz, 'app/(dashboard)', caminho, 'page.tsx')
      expect(existsSync(alvo), `a rota ${caminho} NÃO existe — é a porta pintada de novo`).toBe(true)
    })

    it(`⭐ ${acao} → a tela de destino CONSOME o parâmetro`, () => {
      const caminho = href.split('?')[0].replace(/^\//, '').replace(/emp-1/, '[id]')
      const param = href.split('?')[1].split('=')[0]
      const tela = fonte(join('app/(dashboard)', caminho, 'page.tsx'))
      expect(tela, `a tela lê o "${param}"? sem isso o deep-link abre a tela SEM o alvo`)
        .toMatch(new RegExp(`searchParams\\.get\\(['"]${param}['"]\\)`))
    })
  }
})

describe('⛔ as portas que estavam pintadas não voltam', () => {
  it('⭐ o menu de categoria lê a rota que EXISTE (/api/empresas/[id]/categorias)', () => {
    const t = fonte(TELA)
    expect(t, 'voltou a pedir /api/categorias — rota que não existe em lugar nenhum')
      .not.toMatch(/['"`]\/api\/categorias/)
    expect(t).toMatch(/\/api\/empresas\/\$\{empresaId\}\/categorias/)
    // ⛔ e lê a CHAVE certa: a rota devolve { categorias }, não { categories }
    expect(t, 'voltou a ler a chave `categories` — a rota devolve `categorias`')
      .toMatch(/categorias\?: CategoriaDoMenu\[\]/)
  })

  it('⭐ casar NÃO recarrega a própria tela (era o que fechava o cartão ≍)', () => {
    const t = fonte(TELA)
    expect(t, 'o casar voltou a navegar em vez de abrir o painel aqui')
      .toMatch(/acao === 'CASAR_PAGAR' \|\| acao === 'CASAR_RECEBER'[\s\S]{0,120}setProcurando/)
  })

  it('⭐ o painel abre NA LINHA que o dono tocou, não solto no rodapé', () => {
    expect(fonte(TELA)).toMatch(/procurando\?\.id === l\.id/)
  })

  it('⭐ conciliar no painel tira a linha da caixa (o efeito fecha o gesto)', () => {
    expect(fonte(TELA), 'o onReconciled deixou de recarregar — a linha ficaria na caixa depois de conciliada')
      .toMatch(/onReconciled=\{\(\) => \{[\s\S]{0,300}carregar\(\)/)
  })

  it('⛔ nenhum chip de alvo voltou a ser <select> nativo', () => {
    const t = fonte(TELA)
    expect(t, 'voltou o <select> nativo — é o widget que cobre a tela no celular')
      .not.toMatch(/<select/)
  })
})

describe('⭐ REGRA 12 — a caixa tem UMA composição, então celular e desktop não divergem', () => {
  /**
   * ⚠️⚠️ **REAPONTADO DUAS VEZES, E A SEGUNDA ENSINA MAIS QUE A PRIMEIRA — porque as duas
   * vezes ele ficou vermelho COM A TELA CERTA.**
   *
   * Em 20/09 a régua era `<MenuDoChip` no ARQUIVO inteiro == 3, e quebrou quando o painel
   * do `PEDE_CATEGORIA` desenhou um 4º menu fora do cartão. Passou a contar DENTRO do
   * cartão == 3, e quebrou de novo em 25/09, quando o palpite de fatura ganhou o
   * *"não é essa — escolher outro cartão/fatura →"*. ⭐ **Guard que CONTA cresce junto com
   * a tela e cobra por cada controle novo — ele mede o tamanho, não a doença.**
   *
   * ⛔ A doença é **DUAS COMPOSIÇÕES**: um bloco de chips pro celular e outro pro desktop,
   * que divergem no primeiro gesto novo (a REGRA 12 nasceu disso). Ela tem forma própria:
   * o laço `l.acoes.map` aparecendo mais de uma vez, ou um par `sm:hidden` × `hidden sm:`
   * desenhando chip. É isso que o guard afirma agora — e controle novo (um menu de troca,
   * um painel) não o move, porque nenhum deles é uma segunda fileira de chips.
   */
  it('⭐ os chips do CARTÃO saem de UM laço só — nunca um bloco por viewport', () => {
    const t = fonte(TELA)
    const cartao = t.slice(t.indexOf('function CartaoDaLinha'))
    expect((cartao.match(/l\.acoes\.map\(/g) ?? []).length,
      'a fileira de chips foi desenhada mais de uma vez — é a composição por viewport voltando')
      .toBe(1)
  })

  it('⛔ nenhum bloco de viewport desenha chip dentro do cartão', () => {
    const t = fonte(TELA)
    const cartao = t.slice(t.indexOf('function CartaoDaLinha'))
    // ⚠️ o que o mock manda é empilhar por `min-[900px]` no GRID, nunca duplicar conteúdo
    expect(cartao, 'bloco só-celular dentro do cartão = segunda composição dos chips')
      .not.toMatch(/sm:hidden[\s\S]{0,400}(<MenuDoChip|l\.acoes\.map)/)
    expect(cartao, 'bloco só-desktop dentro do cartão = segunda composição dos chips')
      .not.toMatch(/hidden sm:[\s\S]{0,400}(<MenuDoChip|l\.acoes\.map)/)
  })
})

describe('⛔⛔⛔ O SCHEMA DA ROTA COBRE TODO GESTO — senão o gesto novo nasce quebrado', () => {
  /**
   * ⚠️⚠️ **DOIS GESTOS NASCERAM QUEBRADOS EM PROD por causa disto, e só a prova navegando
   * pegou.** O `z.enum` da rota `/resolver` repetia a lista de ações **à mão**:
   * ```
   * AVULSA_CONFIRMADA   (25/09) → 400 "Gesto inválido"   ⛔ nunca funcionou
   * APORTE_INVESTIMENTO (25/09) → 400 "Gesto inválido"   ⛔ idem
   * IGNORAR (no enum)           → 422 "linha não encontrada"  ⭐ chega na lib
   * ```
   * ⛔ **E os testes não pegavam porque chamam `resolverLinha` DIRETO**, passando por cima do
   * zod — *"testar a lib não prova o encaixe da rota"* (23/09), a 3ª vez desta classe.
   *
   * ⭐ Agora o enum é DERIVADO de `TODAS_AS_ACOES`. Este guard trava que ele continue sendo.
   */
  it('⭐ o enum da rota é DERIVADO, não uma segunda lista digitada', () => {
    const rota = fonte('app/api/conciliacao/resolver/route.ts')
    expect(rota, 'a lista de ações voltou a ser digitada à mão na rota — gesto novo nasce quebrado')
      .toContain('z.enum(TODAS_AS_ACOES)')
    expect(rota).not.toMatch(/acao: z\.enum\(\[/)
  })

  it('⭐⭐ e TODA ação dos dois sentidos está no conjunto derivado', () => {
    const todas = new Set(TODAS_AS_ACOES)
    for (const s of SENTIDOS) {
      for (const a of acoesDoSentido(s)) {
        expect(todas.has(a.acao), `«${a.rotulo}» (${a.acao}) ficou fora do schema da rota`).toBe(true)
      }
    }
    // ⭐ e os dois que quebraram estão lá, nomeados — o guard não passa por cegueira
    expect(todas.has('AVULSA_CONFIRMADA')).toBe(true)
    expect(todas.has('APORTE_INVESTIMENTO')).toBe(true)
  })
})
