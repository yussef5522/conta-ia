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
import { acoesDoSentido, type AcaoDoBalcao, type SentidoDaLinha } from '@/lib/conciliacao/caixa-de-entrada'
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
const COMO_A_TELA_PEDE_O_ALVO: Record<string, { procurar: RegExp; descricao: string }> = {
  CATEGORIA: { procurar: /pedeAlvo === 'CATEGORIA'[\s\S]{0,900}<MenuDoChip/, descricao: 'menu de categorias com seções' },
  CARTAO: { procurar: /pedeAlvo === 'CARTAO'[\s\S]{0,700}<MenuDoChip/, descricao: 'menu dos cartões' },
  CONTRATO: { procurar: /pedeAlvo === 'CONTRATO'[\s\S]{0,900}<MenuDoChip/, descricao: 'menu de contrato + parcela' },
  CONTA_PAGAR: { procurar: /<FindAndMatchPanel/, descricao: 'painel de casar, aberto na própria linha' },
  CONTA_RECEBER: { procurar: /<FindAndMatchPanel/, descricao: 'painel de casar, aberto na própria linha' },
  PAR: { procurar: /deepLink[\s\S]{0,200}window\.location/, descricao: 'deep-link pro /parear' },
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
    expect(acoesDoSentido('SAIDA')).toHaveLength(7)
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
        expect(fonte(TELA), `a tela não desenha ${mapa.descricao} pro alvo ${a.pedeAlvo}`).toMatch(mapa.procurar)
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
   * ⚠️ REAPONTADO em 20/09, NÃO afrouxado. A régua era `<MenuDoChip` no ARQUIVO inteiro
   * == 3, e ela quebrou com a tela CERTA: o painel do `PEDE_CATEGORIA` (*"essa conta não
   * tem categoria — qual é?"*) desenha um 4º menu **fora do cartão**, e ele não é a mesma
   * pergunta duas vezes — é a resposta que falta ao gesto.
   *
   * ⭐ A pergunta continua a mesma (*o CARTÃO desenha os chips uma vez só?*); o que mudou é
   * que ela passou a ser feita **ao cartão**, em vez de ao arquivo. *Contar no arquivo
   * inteiro era o proxy, não a régua.*
   */
  it('⭐ os chips do CARTÃO são desenhados uma vez só (sem bloco sm:hidden paralelo)', () => {
    const t = fonte(TELA)
    const cartao = t.slice(t.indexOf('function CartaoDaLinha'))
    expect((cartao.match(/<MenuDoChip/g) ?? []).length, 'chip duplicado por viewport = duas telas divergindo')
      .toBe(3)
    expect((t.match(/<FindAndMatchPanel/g) ?? []).length).toBe(1)
  })

  it('⭐ e o cartão empilha no celular pela medida do mock (min-[900px])', () => {
    // ⚠️ o grid mora no CHASSI desde 20/09 — uma medida, todas as casas
    expect(fonte('components/conciliacao/chassi-do-cartao.tsx'))
      .toMatch(/grid-cols-1 min-\[900px\]:grid-cols-\[1fr_64px_1fr\]/)
  })
})
