/**
 * ⭐⭐⭐ CONTAGEM COM DIREÇÃO — o guard TELA × LEI (lei v3, 23/11/2026: docs/contagem-referencia.html).
 *
 * O que dá pra RENDERIZAR (REGRA 3), renderiza: o cartão de contar, o posto de comando e o recibo.
 * A conta do cartão é EXECUTADA (`contaDoCartao`). As frases da lei são lidas DA LEI (ARQUIVO DE
 * REFERÊNCIA = LEI) e procuradas no que a tela desenha. Os PRESERVADOS da tela velha (cega, freio,
 * a apurar, causa do negativo, trava do dia) têm guard próprio aqui — a lei nova não os apaga.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CartaoContar, type LinhaContar } from '@/components/estoque/contagem/cartao-contar'
import { PostoDeComando } from '@/components/estoque/contagem/posto-de-comando'
import { ReciboDaSessao } from '@/components/estoque/contagem/recibo-da-sessao'
import { contaDoCartao } from '@/lib/stock/contagem/cartao'
import type { HistoriaDoItem, Posto, Recibo } from '@/lib/stock/contagem/direcao-dados'

const ler = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const semComentario = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
const LEI = ler('docs/contagem-referencia.html')
const PAGINA = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/contagem/page.tsx'))
const ZONAS = semComentario(ler('app/(dashboard)/empresas/[id]/estoque/contagem/zonas/page.tsx'))

const linha = (o: Partial<LinhaContar> = {}): LinhaContar => ({
  itemId: 'i1', nome: 'QUEIJO MUSSARELA EM PEÇA', titulo: 'QUEIJO MUSSARELA', especificacao: 'EM PEÇA', categoriaLabel: 'Matéria-prima',
  unidadeControle: 'KG', saldoSistema: 571.37, avisoUnidade: null, ultimaContagemEm: '2026-11-16T22:10:00Z', ultimaContagemPor: 'Michele',
  estado: null, contado: null, ...o,
})
const historia = (o: Partial<HistoriaDoItem> = {}): HistoriaDoItem => ({
  saldo14: [34, 31, 28, 25, 23, 35, 32, 29, 26, 24, 22, 34, 30, 27], dias14: [], pontos: [{ i: 4, ok: false }, { i: 10, ok: true }],
  ultimas10: [false, false, false, false, false], bateu: 0, total: 5, nuncaBate: false, caixa: null, ...o,
})
const cartao = (l: LinhaContar, h: HistoriaDoItem | null) => renderToStaticMarkup(
  <CartaoContar linha={l} posicao={3} total={18} salvando={false} onConfirmar={() => {}} onMarcar={() => {}} onPular={() => {}}
    historia={h} historicoHref="/empresas/e/estoque/itens/i1" zonaNome="Câmara fria" />,
)

describe('R38 — o campo é NÚMERO PURO; caixa só com fator; o TOTAL no botão (executado)', () => {
  it('número puro vale sozinho — "cx" nunca é exigido', () => {
    expect(contaDoCartao({ texto: '13', caixas: 0, unidade: 'UN', caixa: { fator: 24, nome: 'caixa' } })).toMatchObject({ valor: 13, valido: true, conta: null })
    expect(contaDoCartao({ texto: '22,4', caixas: 0, unidade: 'KG', caixa: null })).toMatchObject({ valor: 22.4, valido: true, botao: 'Confirmar 22,4 KG', conta: null })
  })
  it('o atalho de caixa soma o fator e ESCREVE a conta', () => {
    const c = contaDoCartao({ texto: '2,4', caixas: 1, unidade: 'KG', caixa: { fator: 12, nome: 'caixa' } })
    expect(c).toMatchObject({ valor: 14.4, botao: 'Confirmar 14,4 KG', conta: '1 cx + 2,4 = 14,4 KG · caixa ×12' })
  })
  it('⛔ sem caixa cadastrada, caixa não existe (o atalho é ignorado)', () => {
    expect(contaDoCartao({ texto: '5', caixas: 3, unidade: 'UN', caixa: null })).toMatchObject({ valor: 5, conta: null })
  })
  it('vazio não confirma; UN não aceita fração', () => {
    expect(contaDoCartao({ texto: '', caixas: 0, unidade: 'KG', caixa: null }).botao).toBe('Confirmar')
    // ⚠️ "2,5" em UN vira 25 pela régua da casa (`quantidade.ts`); a fração chega pela caixa ×0,5
    expect(contaDoCartao({ texto: '', caixas: 1, unidade: 'UN', caixa: { fator: 0.5, nome: 'meia' } })).toMatchObject({ valido: false, fracaoProibida: true })
  })
  it('o cartão DESENHA o total no botão e o teclado próprio; sem fator, nada de "cx" na tela', () => {
    const html = cartao(linha({ contado: { qtdContada: 22.4 } }), historia())
    const botao = html.slice(html.indexOf('data-testid="botao-confirmar"'))
    expect(botao.slice(0, 80)).toContain('Confirmar 22,4 KG')
    expect(html).toContain('data-testid="teclado-proprio"')
    expect(html).not.toMatch(/\+1 cx|caixa ×/)
  })
  it('com caixa cadastrada, o atalho aparece NOMEADO ("caixa ×12")', () => {
    const html = cartao(linha(), historia({ caixa: { fator: 12, nome: 'caixa', curto: 'cx' } }))
    expect(html).toContain('+1 cx')
    expect(html).toContain('caixa ×12 KG')
  })
})

describe('R41 — o item conta a própria história', () => {
  it('a linha do saldo com os pontos (verde bateu · âmbar ajustou)', () => {
    const html = cartao(linha(), historia())
    expect(html).toContain('saldo · 14 dias')
    expect(html).toContain('data-ponto="bateu"')
    expect(html).toContain('data-ponto="ajustou"')
  })
  it('"nunca bate" se DECLARA com as bolinhas e "histórico →"; sem o veredito, não aparece', () => {
    const sim = cartao(linha(), historia({ nuncaBate: true }))
    expect(sim).toContain('data-testid="nunca-bate"')
    expect(sim).toContain('bateu 0 de 5')
    expect(sim).toContain('histórico →')
    expect(cartao(linha(), historia({ nuncaBate: false }))).not.toContain('data-testid="nunca-bate"')
  })
})

describe('⛔ PRESERVADOS da tela velha — a lei nova não apaga nada', () => {
  it('CONTAGEM CEGA: o número do sistema não aparece; revelar é botão (e é registrado)', () => {
    const html = cartao(linha(), historia())
    expect(html).not.toMatch(/571[,.]37/)
    expect(html).toContain('ver o que o sistema diz')
    expect(PAGINA).toMatch(/viuSistema/)
  })
  it('NÃO SEI = A APURAR continua um botão de primeira classe', () => {
    const html = cartao(linha(), historia())
    // ⛔ uso, não menção: "não sei" também está na nota de rodapé — o que vale é o BOTÃO e o gesto
    expect(html).toMatch(/<button[^>]*>(?:(?!<\/button>)[\s\S])*não sei<\/button>/)
    expect(semComentario(ler('components/estoque/contagem/cartao-contar.tsx'))).toMatch(/onClick=\{\(\) => onMarcar\('NAO_SEI'/)
    expect(html).toContain('a apurar')
  })
  it('FREIO do servidor: o 409 FREIO abre a 2ª confirmação (uso na página)', () => {
    expect(PAGINA).toContain("j.code === 'FREIO' || j.code === 'FREIO_ESCALA'")
    expect(PAGINA).toContain('confirmar mesmo assim')
  })
  it('CAUSA DO NEGATIVO em 1 toque: o 409 traz os motivos e cada botão GRAVA', () => {
    expect(PAGINA).toContain("j.code === 'MOTIVO_DO_NEGATIVO'")
    expect(PAGINA).toMatch(/motivo\.motivos\.map\(\(m\) => \(\s*<button[\s\S]*?onClick=\{\(\) => contar\(motivo\.itemId, motivo\.qtd, motivo\.opts, motivo\.confirmarFreio, m\.codigo\)\}/)
  })
  it('TRAVA DO DIA PARADO: o portão fechado impede abrir a sessão e manda fechar o dia', () => {
    expect(PAGINA).toContain('if (!q?.contagem && portao && !portao.liberada) return')
    expect(PAGINA).toContain("j.code === 'DIA_ABERTO'")
    expect(PAGINA).toContain('Feche o dia antes de contar.')
  })
})

const POSTO: Posto = {
  sessao: { id: 's1', iniciadaEm: '2026-11-19T22:02:00Z' },
  ritmo: { A: 1, B: 7, C: 30 },
  acuracidade: { pct: 92, dentro: 165, total: 180, tendencia30: 3 },
  sobContagem: { valor: 210700, pctDoGiro: 73, itens: 74 },
  ajustesSemanas: [310, 480, 220, 62].map((m) => ({ inicio: '', liquido: -m, mexido: m })),
  nuncaContados: { total: 140, candidatos: [{ itemId: 'x', nome: 'FRUKI 2L', giro30: 900 }] },
  hoje: { itens: Array.from({ length: 18 }, (_, k) => ({ itemId: `i${k}`, nome: `I${k}`, zonaId: 'z1', atrasado: k < 3, feito: k < 2, g: 'A' as const })), feitos: 2, estimadoMin: 15 },
  zonas: [
    { chave: 'z1', nome: 'Câmara fria', hoje: 6, feitos: 0, totalNaZona: 12, atrasados: 3, ultima: { quem: 'Michele', quando: '2026-11-18T22:10:00Z' }, aoVivo: null, assinada: null },
    { chave: 'z2', nome: 'Bebidas', hoje: 4, feitos: 2, totalNaZona: 9, atrasados: 0, ultima: null, aoVivo: 'Tauan', assinada: null },
    { chave: 'z3', nome: 'Freezer', hoje: 0, feitos: 0, totalNaZona: 14, atrasados: 0, ultima: null, aoVivo: null, assinada: null },
    { chave: '__sem_zona__', nome: 'sem zona', hoje: 2, feitos: 0, totalNaZona: 218, atrasados: 0, ultima: null, aoVivo: null, assinada: null },
  ],
  totalItens: 271,
  escopos: { hoje: [] },
}
const posto = (sessaoAberta = false) => renderToStaticMarkup(<PostoDeComando id="e" posto={POSTO} sessaoAberta={sessaoAberta} iniciando={false} podeGerenciar onComecar={() => {}} />)

describe('R36/R37/R40 — o posto de comando', () => {
  it('o placar: anel da acuracidade com a tendência, R$ sob contagem, ajustes em 4 barras, nunca contados + decidir', () => {
    const html = posto()
    expect(html).toContain('92%')
    expect(html).toContain('+3 pontos · 30 dias')
    expect(html).toContain('R$ 210,7 mil')
    expect(html).toContain('73% do giro')
    expect((html.match(/rounded-t/g) ?? []).length).toBe(4)
    expect(html).toContain('140')
    expect(html).toContain('decidir →')
  })
  it('o que conta hoje é TERMINÁVEL e "contar tudo (271)" continua escolha explícita', () => {
    const html = posto()
    expect(html).toContain('18 itens · 3 zonas · ~15 min')
    expect(html).toContain('contar tudo (271) →')
    expect(renderToStaticMarkup(<PostoDeComando id="e" posto={{ ...POSTO, hoje: { ...POSTO.hoje, feitos: 18 } }} sessaoAberta iniciando={false} podeGerenciar onComecar={() => {}} />))
      .toContain('18 de 18 ✓')
  })
  it('o mapa: AO VIVO, "contar esta zona →", "nada pra hoje", e o "sem zona" tracejado', () => {
    const html = posto()
    expect(html).toContain('Tauan contando')
    expect(html).toContain('contar esta zona →')
    expect(html).toContain('nada pra hoje')
    expect(html).toContain('data-zona="__sem_zona__"')
    expect(html).toContain('3 atrasados')
  })
})

const RECIBO: Recibo = {
  contagemId: 's1', status: 'FINALIZADA', iniciadaEm: '2026-11-19T22:02:00Z', finalizadaEm: '2026-11-19T22:13:00Z',
  minutosReais: 11, minutosEstimados: 15, itens: 18, bateram: 14, ajustados: 3, liquido: -37.2, mexido: 46.42, aApurar: 1,
  acuracidadeSessao: 78, acuracidadeAcumulada: 92, acuracidadeAntes: 91,
  zonas: [{ chave: 'z1', nome: 'Câmara fria', quem: 'Michele', quando: '2026-11-19T22:10:00Z', viaPin: true }, { chave: 'z2', nome: 'Bebidas', quem: null, quando: null, viaPin: false }],
  finalizadaPor: 'Michele',
  ajustes: [{ itemId: 'p', nome: 'porção queijo 130 g', divergencia: -6, unidade: 'UN', valor: -22.62 }],
}

describe('R42 — o recibo assina a sessão', () => {
  it('itens, bateram, ajustados (líquido e mexido), a apurar, tempo real × estimado, acuracidade sessão × acumulada', () => {
    const html = renderToStaticMarkup(<ReciboDaSessao r={RECIBO} empresaId="e" />)
    expect(html).toContain('11 min')
    expect(html).toContain('estimado ~15')
    expect(html).toMatch(/−R\$\s?37,20 líq\. · R\$\s?46,42 mexidos/)
    expect(html).toContain('78%')
    expect(html).toContain('acumulada 92% (+1)')
    expect(html).toContain('fechada e assinada por Michele')
  })
  it('zona por zona com quem assinou; ⛔ zona sem assinatura DIZ isso', () => {
    const html = renderToStaticMarkup(<ReciboDaSessao r={RECIBO} empresaId="e" />)
    expect(html).toContain('Michele (PIN)')
    expect(html).toContain('sem assinatura')
  })
})

describe('R43 — gerenciar zonas (lido sem comentário)', () => {
  it('excluir pergunta QUANTOS ficam sem zona e diz que nenhum item é apagado', () => {
    expect(ZONAS).toContain('nenhum item é apagado')
    expect(ZONAS).toMatch(/fetch\(`\$\{base\}\/zonas\/\$\{z\.id\}`\)/)
  })
  it('adicionar pela busca, remover na linha, arrastar a ordem, grupo A/B/C ali mesmo, ritmo editável', () => {
    expect(ZONAS).toContain("chamar(`${base}/zonas/${zonaId}/itens`, 'POST', { itemId })")
    expect(ZONAS).toContain("chamar(`${base}/zonas/${zonaId}/itens`, 'DELETE', { itemId })")
    expect(ZONAS).toContain("chamar(`${base}/zonas/${zonaId}/itens`, 'PUT', { itemIds: ids })")
    expect(ZONAS).toContain("chamar(`${base}/grupo`, 'PUT', { itemId, grupo: g })")
    expect(ZONAS).toContain("chamar(`${base}/ritmo`, 'PUT', ritmo)")
  })
})

describe('TELA × LEI — as frases da referência aprovada estão na tela', () => {
  const TELA = [
    posto(), cartao(linha({ contado: { qtdContada: 22.4 } }), historia({ nuncaBate: true, caixa: { fator: 12, nome: 'caixa', curto: 'cx' } })),
    renderToStaticMarkup(<ReciboDaSessao r={RECIBO} empresaId="e" />), ZONAS, PAGINA,
  ].join('\n')
  const FRASES = [
    'Acuracidade do estoque', 'Sob contagem · grupo A', 'Ajustes · por semana', 'Nunca contados', 'candidatos', 'decidir →',
    'O que conta hoje', 'Começar a contagem de hoje', 'contar esta zona →', 'nada pra hoje', 'em dia ✓', 'contar tudo (',
    'atrasados primeiro · contagem cega',
    'saldo · 14 dias', 'bateu', 'ajustou', 'nunca bate', 'histórico →', '+1 cx', '+0,5', 'limpar', 'Confirmar 22,4 KG',
    'não sei', 'pular', 'ver o que o sistema diz', 'buscar', 'zonas', 'próximos (',
    'Bateram', 'Ajustados', 'A apurar', 'Acuracidade', 'líq.', 'mexidos', 'investigar →',
    'nome da nova zona', 'Criar zona', 'renomear', 'excluir', 'adicionar item à zona', 'arrasta pra mudar a ordem',
    'sem zona', 'entram no fim do',
  ]
  for (const f of FRASES) {
    it(f, () => {
      expect(LEI, `a frase "${f}" não está na lei`).toContain(f)
      expect(TELA, `a frase "${f}" da lei não está na tela`).toContain(f)
    })
  }
})
