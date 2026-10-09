/**
 * ⭐⭐⭐ A CORREÇÃO TEM UMA PORTA SÓ — E ELA ABRE NA ORDEM (09/10/2026, itens 2c e 3).
 *
 * **Ordem do dono (item 3):** *"a mesma «corrigir com preview» se aplica a uma conclusão
 * PASSADA, aberta da página da ordem (papel de gerência) — é o caminho pra eu finalmente
 * corrigir as 2 ordens de 22.864 e o 320% da NATHALIA, caso a caso, eu decidindo na tela, com
 * preview e rastro. **Nada de correção em lote.**"*
 *
 * ⛔⛔ **O QUE ESTE GUARD EXISTE PRA IMPEDIR não é a tela feia — é a SEGUNDA tela.** O painel de
 * conferir/corrigir nasceu dentro da «Conferência do dia»; a página da ordem precisava do MESMO
 * gesto. Reescrever os campos lá daria dois formulários pro mesmo fato, e eles divergiriam no
 * primeiro motivo novo — a mesma conclusão passaria a ter duas telas dizendo coisas diferentes
 * sobre o mesmo gesto. É a lição do B1 em forma de formulário, e o mesmo vale pro SELO.
 *
 * ⚠️ **Guard ESTRUTURAL, e assumido como tal**: o projeto roda em `environment: node`, sem
 * jsdom — não dá pra clicar no teste. Então ele prova o que de fato quebrou/pode quebrar: a
 * duplicação do formulário, o gate que oferece o que levaria 403, e o carimbo não viajando.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { semComentarios, usosDe } from './_leitura-de-fonte'

const PAINEL = 'components/estoque/painel-de-conferencia.tsx'
const SELO = 'components/estoque/selo-da-conferencia.tsx'
const FILA = 'components/estoque/conferencia-do-dia.tsx'
const ORDEM = 'app/(dashboard)/empresas/[id]/estoque/producao/[ordemId]/page.tsx'
const HOME = 'app/(dashboard)/empresas/[id]/estoque/producao/page.tsx'
const ROTA_ORDEM = 'app/api/empresas/[id]/estoque/producao/ordens/[ordemId]/route.ts'

const ler = (p: string) => semComentarios(readFileSync(p, 'utf8'))

describe('⛔⛔ UM formulário de correção, dois lugares', () => {
  it('⭐ o painel é o dono do gesto: PIN, motivos, prévia e o POST moram nele', () => {
    const p = ler(PAINEL)
    expect(p, 'o campo do PIN').toMatch(/seu PIN/)
    expect(p, 'os 3 motivos fechados').toMatch(/CONTOU_ERRADO/)
    expect(p, 'a prévia ANTES de gravar (ordem do dono)').toMatch(/PREVER_CORRECAO/)
    expect(p, 'e a gravação').toMatch(/acao: 'CORRIGIR'/)
    /** ⚠️ teto de gravação maior que o de leitura — a correção mexe no ledger */
    expect(p).toMatch(/timeoutMs: 60_000/)
  })

  it('⛔ as DUAS telas CONSOMEM o painel — nenhuma remonta o formulário', () => {
    for (const tela of [FILA, ORDEM]) {
      const s = ler(tela)
      expect(usosDe(s, 'PainelDeConferencia'), `${tela} parou de consumir o painel`).toBeGreaterThan(0)
      expect(s, `${tela} remontou o campo do PIN`).not.toMatch(/seu PIN/)
      expect(s, `${tela} remontou a lista de motivos`).not.toMatch(/CONTOU_ERRADO/)
      expect(s, `${tela} fez a própria prévia`).not.toMatch(/PREVER_CORRECAO/)
      expect(s, `${tela} gravou a correção por fora do painel`).not.toMatch(/acao: 'CORRIGIR'/)
    }
  })

  it('⛔ UM selo, duas telas — dois seriam dois estados pro mesmo fato', () => {
    const s = ler(SELO)
    expect(s).toMatch(/AGUARDANDO_CONFERENCIA/)
    expect(s, 'âmbar pede ação').toMatch(/--fam-ambar-bg/)
    expect(s, 'verde é fechado').toMatch(/--fam-verde-bg/)
    expect(s, 'índigo distingue CORRIGIDO de confirmado').toMatch(/--fam-indigo-bg/)
    /** ⚠️ o "era X" é o que a cozinha declarou — sem ele a linha mostra número que ninguém digitou */
    expect(s).toMatch(/era \$\{/)
    for (const tela of [HOME, ORDEM]) {
      expect(usosDe(ler(tela), 'SeloDaConferencia'), `${tela} parou de desenhar o selo`).toBeGreaterThan(0)
    }
  })

  it('⛔⛔ o VEREDITO DO FISCAL não entra no painel nem no selo — a lei de 05/10', () => {
    for (const p of [PAINEL, SELO]) {
      const s = ler(p)
      for (const cola of ['fiscalFrase', 'permitido', 'material dava', 'esperado']) {
        expect(s, `cola de prova vazou pra ${p}: ${cola}`).not.toContain(cola)
      }
    }
  })
})

describe('⭐⭐ a porta da correção ABRE na página da ordem (item 3)', () => {
  it('⭐ a linha da conclusão oferece "corrigir"', () => {
    const s = ler(ORDEM)
    expect(s).toMatch(/corrigir/)
    expect(usosDe(s, 'somenteCorrigir'), 'na ordem o gesto nasce de "o número está errado"').toBeGreaterThan(0)
  })

  it('⛔⛔ e o botão é GATEADO por stock.manage E pelo estado do carimbo', () => {
    const s = ler(ORDEM)
    const bloco = s.slice(s.indexOf('const podeCorrigir'), s.indexOf('const abertoAqui'))
    expect(bloco, 'oferecer pra quem levaria 403 é mandar clicar pra levar um não')
      .toMatch(/podePerm\('stock\.manage'\)/)
    expect(bloco, 'conclusão JÁ conferida é recusada pelo motor (JA_CONFERIDA) — não se oferece')
      .toMatch(/AGUARDANDO_CONFERENCIA/)
    /** ⚠️ e espera a permissão carregar: `pode()` devolve true enquanto carrega */
    expect(bloco).toMatch(/!carregandoPerm/)
  })

  it('⛔ NADA de correção em lote — o painel corrige UMA conclusão por gesto', () => {
    const p = ler(PAINEL)
    expect(p, 'o alvo é singular').toMatch(/conclusaoId: alvo\.conclusaoId/)
    expect(p, 'nenhuma lista de ids viaja').not.toMatch(/conclusaoIds|\.map\(\(c\) => c\.conclusaoId\)/)
  })

  it('⭐ e o carimbo VIAJA no payload da ordem (senão o selo não tem o que desenhar)', () => {
    const r = ler(ROTA_ORDEM)
    expect(usosDe(r, 'carimbosDasConclusoes')).toBeGreaterThan(0)
    expect(r).toMatch(/conferencia: carimbos\.get\(c\.id\) \?\? null/)
    /**
     * ⛔ E o veredito do fiscal NÃO vai junto: esta rota é `stock.view` (o tablet lê), e o
     * carimbo é estado — não número esperado.
     */
    expect(r, 'o fiscal não pode vazar por esta rota').not.toMatch(/fiscalDeOrdens|permitido:/)
  })
})

/**
 * ⛔⛔⛔ OS DOIS BURACOS QUE A REGRA 11 ACHOU NO ITEM 5 (09/10) — e os dois vieram VERDES.
 *
 * Repondo *"a conferência removida da tela"* e *"o fiscal em `stock.view`"*, **nenhum teste
 * mordeu**. As causas são de família conhecida:
 *
 * ⚠️ **(a)** o motor estava em prod e nada afirmava que a seção é RENDERIZADA — é a *"porta sem
 * maçaneta"* (10 voltas nesta casa): a fila existiria, a rota responderia, e o dedo do dono não
 * alcançaria nada.
 *
 * ⚠️⚠️ **(b)** a rota está em `LEITURA_SENSIVEL` **com o motivo escrito** — mas aquele registro
 * é uma LISTA DE EXCEÇÕES, não uma trava: ele PERMITE o GET ser mais estrito, nunca EXIGE.
 * Baixar pra `stock.view` deixava o guard verde e **mandava o veredito do fiscal pro tablet**.
 * ***Comentário que promete ser a trava sem ser a trava é pior que comentário nenhum.***
 */
describe('⛔⛔⛔ os dois buracos do item 5', () => {
  it('⛔⛔ a FILA exige stock.manage no GET — é o gate da cola de prova', () => {
    const r = ler('app/api/empresas/[id]/estoque/producao/conferencia/route.ts')
    /** o GET é o primeiro handler do arquivo; a fatia dele vai até o `const schema` */
    const get = r.slice(r.indexOf('export async function GET'), r.indexOf('const schema'))
    expect(get, 'o veredito do fiscal em stock.view viaja no JSON até o tablet')
      .toMatch(/guardStock\(request, companyId, 'stock\.manage'\)/)
    expect(get).not.toMatch(/'stock\.view'|'stock\.operate'/)
    /** ⭐ e o POST também: conferir é gesto de gestão */
    const post = r.slice(r.indexOf('export async function POST'))
    expect(post).toMatch(/guardStock\(request, companyId, 'stock\.manage'\)/)
  })

  it('⛔⛔ a seção está na LISTA DE RENDER da home — motor sem maçaneta não existe', () => {
    const h = ler(HOME)
    /**
     * ⚠️ Lê o JSX QUE RODA, não o arquivo: a `function ConferenciaDoDia` importada continua
     * existindo mesmo se ninguém a desenhar — é a *"menção, não uso"* que já veio verde 11×.
     */
    const render = h.slice(h.indexOf('return (', h.indexOf('export default function ProducaoPage')))
    expect(render, 'a seção saiu da tela — a fila existiria e ninguém chegaria nela')
      .toMatch(/<ConferenciaDoDia\b/)
    const tag = render.slice(render.indexOf('<ConferenciaDoDia'), render.indexOf('<ConferenciaDoDia') + 400)
    /**
     * ⚠️ **E o gate tem que VIR DA PERMISSÃO, não ser `true` cravado** — o guard passou verde
     * com `podeGerenciar={true}` na 1ª versão. A trava de verdade é o payload (a rota 403), mas
     * com `true` o componente dispara o fetch e **queima um 403 por carregamento de página no
     * tablet**, mostrando a faixa âmbar de erro pra a cozinha. É a cicatriz do badge de 28/09
     * (1.391 403/dia) com outra roupa.
     */
    expect(tag, 'e ela recebe o gate de permissão (o payload é a trava, isto é o desenho)')
      .toMatch(/podeGerenciar=\{podePerm\('stock\.manage'\)\}/)
    expect(tag, 'e espera as permissões carregarem antes de pedir a fila')
      .toMatch(/carregandoPerm=/)
    expect(tag, 'e a lista recarrega junto — o selo tem que mudar na frente dele')
      .toMatch(/onMudou=/)
  })
})

describe('⭐ auto-teste do detector', () => {
  it('pega o formulário remontado e não acusa quem só consome', () => {
    const consome = "import { PainelDeConferencia } from './painel-de-conferencia'\n<PainelDeConferencia id={id} />"
    const remonta = "<label>seu PIN<input /></label>\nbody: JSON.stringify({ acao: 'CORRIGIR' })"
    expect(usosDe(consome, 'PainelDeConferencia')).toBeGreaterThan(0)
    expect(remonta).toMatch(/seu PIN/)
    expect(consome).not.toMatch(/seu PIN/)
  })
})
