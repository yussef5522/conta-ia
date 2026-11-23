/**
 * ⭐⭐⭐ LEI DA PERGUNTA NO TOPO (19/11/2026) — toda pergunta pendente do sistema é um cartão
 * destacado no TOPO da tela/modal dona dela, com contador quando é mais de uma; o sininho pousa nela.
 *
 * ⛔ O CASO: "FRUKI LATA: 81 num dia — o normal é 1.7. Confirma?" morava no RODAPÉ do modal de
 * confirmar a baixa, depois da lista inteira do que sai do estoque; o dono procurou até achar.
 *
 * ⭐ O que dá pra RENDERIZAR (REGRA 3), renderiza: o modal da baixa e o próprio cartão — a afirmação é
 * sobre a POSIÇÃO no markup. As telas que só montam a pergunta depois do fetch são lidas SEM
 * comentário, por ORDEM estrutural (nunca janela de distância): a pergunta abre antes da lista, e a
 * AÇÃO da pergunta não existe fora do cartão (uso, não menção).
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PlanoVendaModal, type PlanoVM } from '@/components/estoque/plano-venda-modal'
import { PerguntaNoTopo, contadorDaPergunta } from '@/components/perguntas/pergunta-no-topo'
import { ANCORAS } from '@/components/perguntas/ancoras'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const semComentario = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

/** um dia cheio: 40 itens saindo do estoque e a pergunta da sanidade (o caso do FRUKI) */
const plano = (suspeitas: PlanoVM['sanidade'] extends infer S ? S extends { suspeitas: infer X } ? X : never : never): PlanoVM => ({
  produtos: [{ nome: 'FRUKI LATA', quantidade: 81, alvoNome: 'FRUKI LATA' }],
  pendentes: [], fora: [],
  agregada: Array.from({ length: 40 }, (_, i) => ({ nome: `ITEM DA LISTA ${String(i).padStart(2, '0')}`, qtd: 1, valor: 1 })),
  sanidade: { precisaConfirmar: true, suspeitas, totalDoArquivo: 900, totalMedioDoDia: 300, vezesNoTotal: 3 },
})
const FRUKI = { produto: 'FRUKI LATA', quantidade: 81, mediaDiaria: 1.7, frase: 'FRUKI LATA: 81 num dia — o normal é 1.7. Confirma?' }
const modal = (p: PlanoVM) => renderToStaticMarkup(
  <PlanoVendaModal plano={p} data="2026-11-18" titulo="Confirmar baixa" processando={false} erro={null} onConfirmar={() => {}} onClose={() => {}} />,
)

describe('⛔ O CASO DO FRUKI — a pergunta da sanidade abre o modal, antes da lista', () => {
  it('a pergunta vem ANTES do 1º item que sai do estoque e antes do "Sai do estoque"', () => {
    const html = modal(plano([FRUKI]))
    const pergunta = html.indexOf(`data-pergunta-do-sistema="${ANCORAS.SANIDADE}"`)
    expect(pergunta, 'a pergunta tem que existir').toBeGreaterThan(-1)
    expect(html.indexOf('FRUKI LATA: 81 num dia')).toBeGreaterThan(pergunta)
    expect(pergunta).toBeLessThan(html.indexOf('ITEM DA LISTA 00'))
    expect(pergunta).toBeLessThan(html.indexOf('Sai do estoque'))
    expect(pergunta).toBeLessThan(html.indexOf('o que cada nome do PDV baixou'))
  })
  it('com 2 números suspeitos o cartão diz quantos esperam a decisão', () => {
    const html = modal(plano([FRUKI, { ...FRUKI, produto: 'COCA 2L', frase: 'COCA 2L: 40 num dia — o normal é 9. Confirma?' }]))
    expect(html).toContain('2 números esperando tua decisão')
  })
  it('o caso NEGATIVO: sem nada a perguntar, não nasce cartão nenhum', () => {
    const p = plano([]); p.sanidade!.precisaConfirmar = false
    expect(modal(p)).not.toContain('data-pergunta-do-sistema')
  })
})

describe('o cartão da lei', () => {
  it('contador só acima de 1, âncora no id, e quantas = 0 não desenha nada', () => {
    const um = renderToStaticMarkup(<PerguntaNoTopo id="x" titulo="t" quantas={1} singular="par" plural="pares">c</PerguntaNoTopo>)
    expect(um).toContain('id="x"')
    expect(um).not.toContain('esperando tua decisão')
    const dois = renderToStaticMarkup(<PerguntaNoTopo id="x" titulo="t" quantas={2} singular="par" plural="pares">c</PerguntaNoTopo>)
    expect(dois).toContain('2 pares esperando tua decisão')
    expect(renderToStaticMarkup(<PerguntaNoTopo id="x" titulo="t" quantas={0} singular="par" plural="pares">c</PerguntaNoTopo>)).toBe('')
    expect(contadorDaPergunta(1, 'par', 'pares')).toBe('1 par esperando tua decisão')
  })
})

/** as telas que montam a pergunta depois do fetch: ordem estrutural, sem comentário */
const TELAS: { arquivo: string; ancora: keyof typeof ANCORAS; lista: string; acao: string }[] = [
  { arquivo: 'app/(dashboard)/empresas/[id]/estoque/itens/gemeos/page.tsx', ancora: 'GEMEOS', lista: 'pares?.map((p) =>', acao: "responder(p, 'JUNTAR')" },
  { arquivo: 'components/estoque/central-de-import.tsx', ancora: 'CONFLITO', lista: '{prodVisiveis.map((p, i) =>', acao: '<AcaoDoConflito' },
  { arquivo: 'components/estoque/revisao-do-import.tsx', ancora: 'CONFLITO', lista: '{visiveis.map((l) =>', acao: '<AcaoDoConflito' },
  { arquivo: 'components/estoque/busca-item.tsx', ancora: 'JA_EXISTE', lista: '{res.map((it) =>', acao: '>usar o existente<' },
  { arquivo: 'app/(dashboard)/empresas/[id]/estoque/itens/page.tsx', ancora: 'JA_EXISTE', lista: 'placeholder="ex: Molho de tomate"', acao: '>usar o existente' },
  // (23/11) "algum destes é o pagamento desta fatura?" — morava depois dos totais e dos números
  { arquivo: 'app/(dashboard)/empresas/[id]/cartoes/[cardId]/importar-fatura/page.tsx', ancora: 'PAGAMENTO_DA_FATURA', lista: 'Linhas extraídas — IA sugeriu, você decide', acao: 'onChange={() => setReclassPaymentTxId(c.id)}' },
]

describe('as outras perguntas do sistema — no TOPO, e a ação só dentro do cartão', () => {
  for (const t of TELAS) {
    it(t.arquivo, () => {
      const src = semComentario(ler(t.arquivo))
      const abre = src.indexOf(`<PerguntaNoTopo id={ANCORAS.${t.ancora}}`)
      expect(abre, 'a pergunta mora no cartão da lei').toBeGreaterThan(-1)
      const fecha = src.indexOf('</PerguntaNoTopo>', abre)
      expect(abre, 'o cartão abre ANTES da lista').toBeLessThan(src.indexOf(t.lista))
      // ⛔ uso, não menção: a AÇÃO da pergunta só existe DENTRO do cartão — no meio da lista seria a pergunta escondida de novo
      const fora = src.slice(0, abre) + src.slice(fecha)
      expect(fora.includes(t.acao), `"${t.acao}" fora do cartão`).toBe(false)
      expect(src.slice(abre, fecha)).toContain(t.acao)
    })
  }
})

describe('o sininho POUSA na pergunta (âncora), não no topo genérico', () => {
  it('o aviso do dia parado leva à faixa, e o da fila de pares leva aos pares', () => {
    expect(semComentario(ler('lib/suit/dia-parado.ts'))).toContain('acaoHref: `/empresas/${companyId}/estoque/vendas#${ANCORAS.DIA_PARADO}`')
    expect(semComentario(ler('lib/stock/itens/fila-de-gemeos.ts'))).toContain('acaoHref: `/empresas/${companyId}/estoque/itens/gemeos#${ANCORAS.GEMEOS}`')
  })
  it('a faixa do dia parado (já no topo) carrega a MESMA âncora e rola até ela', () => {
    const f = semComentario(ler('components/estoque/faixa-dia-parado.tsx'))
    expect(f).toContain('id={ANCORAS.DIA_PARADO}')
    expect(f).toContain('usePousoDaPergunta(ANCORAS.DIA_PARADO, dias.length > 0)')
  })
})
